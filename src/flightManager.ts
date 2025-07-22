import {ThemeManager} from "./themeManager";
import {LatLng, Marker, polyline, Polyline} from "leaflet";
import {marker, updateMarker} from "./marker";
import {Airport} from "./airportManager";
import {
    calculateBearing,
    generateBezierPoints,
    generateGreatCirclePoints,
    getBezierPoint,
    getIntermediatePoint
} from "./calculations";
import {Coordinates} from "./coordinates";

export interface Flight {
    identifier: string;
    origin: Airport;
    destination: Airport;
    elapsedDistance: number;
    remainingDistance: number;
    speed: number;
    lastUpdatedAt: number;
}

interface ManagedFlight extends Flight {
    marker?: Marker;
    elapsedPolyline?: Polyline;
    remainingPolyline?: Polyline;

    fullPathPoints: LatLng[];
    totalDistance: number;
    isAntimeridian: boolean;
    bezierControlPoint?: Coordinates;

    lastAnimatedAt: number;
}

export class FlightManager {
    private flights: Flight[] = [];
    private managedFlights: {[flightIdentifier: string]: ManagedFlight} = {};
    private themeManager: ThemeManager;
    private animationFrameId?: number;
    private currentlyTracking: boolean = false;

    constructor(themeManager: ThemeManager) {
        this.themeManager = themeManager;
    }

    registerFlight(flight: Flight): void {
        this.flights.push(flight);
        console.log('Updated', flight.lastUpdatedAt);
    }

    updateFlight(updatedFlight: Flight): void {
        // Find the index of the flight in the flights array
        const index = this.flights.findIndex(f => f.identifier === updatedFlight.identifier);
        if (index === -1) {
            console.warn(`Flight with identifier ${updatedFlight.identifier} does not exist. Cannot update.`);
            return;
        }
        // Update the flight in the flights array
        this.flights[index] = updatedFlight;

        // Remove the managed flight visuals if they exist
        const managed = this.managedFlights[updatedFlight.identifier];
        if (managed) {
            managed.marker?.remove();
            managed.elapsedPolyline?.remove();
            managed.remainingPolyline?.remove();
            delete this.managedFlights[updatedFlight.identifier];
        }
        // Re-create the managed flight visuals
        this.createManagedFlight(updatedFlight);
    }

    addFlights(currentlyTracking: boolean) {
        this.currentlyTracking = currentlyTracking;

        // Stop any existing animation loop.
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = undefined;
        }

        // Clear all layers from the map and from the internal state.
        Object.values(this.managedFlights).forEach(flight => {
            flight.marker?.remove();
            flight.elapsedPolyline?.remove();
            flight.remainingPolyline?.remove();
        });
        this.managedFlights = {};

        // Create managed flight objects for each registered flight.
        this.flights.forEach(flight => {
            this.createManagedFlight(flight);
        });
    }

    startAnimation(): void {
        if (!this.animationFrameId) {
            this.animationLoop();
        }
    }

    animationLoop(): void {
        this.updateFlightPositions();
        this.animationFrameId = requestAnimationFrame(this.animationLoop.bind(this));
    }

    createManagedFlight(flight: Flight): void {
        const totalDistance = flight.elapsedDistance + flight.remainingDistance;
        const originCoords: Coordinates = flight.origin;
        const destCoords: Coordinates = flight.destination;

        const lonDiff = destCoords.lon - originCoords.lon;
        const crossesAntimeridian = Math.abs(lonDiff) > 180;
        const numPoints = 100;

        let fullPathPoints: LatLng[];
        let bezierControlPoint: Coordinates | undefined;

        // Generate the full path for the flight, handling antimeridian crossing.
        if (crossesAntimeridian) {
            const p0 = {...originCoords};
            const p2 = {...destCoords};

            if (p0.lon > 0 && p2.lon < 0) {
                // No adjustment needed, path will cross prime meridian.
            } else {
                // Adjust longitude to force path across the antimeridian.
                if (lonDiff > 180) p2.lon -= 360;
                else if (lonDiff < -180) p2.lon += 360;
            }

            const midLon = (p0.lon + p2.lon) / 2;
            const midLat = (p0.lat + p2.lat) / 2;
            const latOffset = Math.abs(p2.lon - p0.lon) / 4;
            const controlLat = midLat < 0 ? Math.max(midLat - latOffset, -85) : Math.min(midLat + latOffset, 85);

            bezierControlPoint = {lat: controlLat, lon: midLon};
            fullPathPoints = generateBezierPoints(p0, bezierControlPoint, p2, numPoints);
        } else {
            fullPathPoints = generateGreatCirclePoints(originCoords, destCoords, numPoints);
        }

        // Prevent adding duplicate flights with the same identifier.
        if (this.managedFlights[flight.identifier]) {
            console.warn(`Flight with identifier ${flight.identifier} already exists. Skipping duplicate.`);
            return;
        }
        // Create the managed flight object and store it.
        const managedFlight: ManagedFlight = {
            ...flight,
            fullPathPoints: fullPathPoints,
            totalDistance: totalDistance,
            isAntimeridian: crossesAntimeridian,
            bezierControlPoint: bezierControlPoint,
            // Use lastUpdatedAt for the first animation frame, then update this value.
            lastAnimatedAt: flight.lastUpdatedAt,
        };
        this.managedFlights[flight.identifier] = managedFlight;

        // Perform the initial draw of the flight.
        this.updateFlightVisuals(managedFlight);
    }

    private updateFlightPositions(): void {
        const now = Date.now();
        Object.values(this.managedFlights).forEach(flight => {
            // If flight has already landed, do nothing.
            if (flight.elapsedDistance >= flight.totalDistance) {
                return;
            }

            // Calculate time delta since last update and distance traveled.
            const deltaTimeMs = now - flight.lastAnimatedAt;
            console.log('Delta', deltaTimeMs, 'ms for flight', flight.identifier);
            const deltaTimeHours = deltaTimeMs / (1000 * 60 * 60);
            console.log('Delta', deltaTimeHours, 'hours for flight', flight.identifier);
            // Assuming speed is in knots
            const distanceTravelled = flight.speed * deltaTimeHours;
            // Update flight distances.
            flight.elapsedDistance += distanceTravelled;
            flight.remainingDistance -= distanceTravelled;
            flight.lastAnimatedAt = now; // Update timestamp for the next frame.

            // Ensure distance doesn't exceed total.
            if (flight.elapsedDistance >= flight.totalDistance) {
                flight.elapsedDistance = flight.totalDistance;
                flight.remainingDistance = 0;
            }

            // Update the flight's visual representation on the map.
            this.updateFlightVisuals(flight);
        });
    }

    private updateFlightVisuals(flight: ManagedFlight): void {
        const elapsedRatio = flight.totalDistance > 0 ? flight.elapsedDistance / flight.totalDistance : 0;
        // If the flight has landed (or if tracking is not ongoing), remove the marker and polylines.
        if (elapsedRatio >= 1 || !this.currentlyTracking) {
            if (flight.marker) {
                flight.marker.remove();
                flight.marker = undefined;
            }
            if (this.currentlyTracking) {
                // Make the entire path the "elapsed" color.
                flight.elapsedPolyline?.setLatLngs(flight.fullPathPoints);
                flight.remainingPolyline?.remove();
                flight.remainingPolyline = undefined;
            } else {
                // Make the entire path the "remaining" color, and add the polyline if it doesn't exist.
                if (!flight.remainingPolyline) {
                    flight.remainingPolyline = polyline(flight.fullPathPoints, this.themeManager.t().getPath("remaining")).addTo(this.themeManager.getMap());
                } else {
                    flight.remainingPolyline.setLatLngs(flight.fullPathPoints);
                }
            }

            return;
        }

        let currentPosition: LatLng;
        let direction = 0;
        const numPoints = flight.fullPathPoints.length - 1;

        // Calculate current position and bearing based on path type.
        if (flight.isAntimeridian && flight.bezierControlPoint) {
            const p0 = flight.origin;
            const p2 = {...flight.destination};
            if (p0.lon > 0 && p2.lon < 0) {}
            else {
                if (p2.lon - p0.lon > 180) p2.lon -= 360;
                else if (p2.lon - p0.lon < -180) p2.lon += 360;
            }

            const pt = getBezierPoint(p0, flight.bezierControlPoint, p2, elapsedRatio);
            currentPosition = new LatLng(pt.lat, pt.lon);

            // Calculate direction by looking at the next point on the Bezier curve.
            const nextRatio = Math.min(elapsedRatio + 0.01, 1.0);
            const nextPt = getBezierPoint(p0, flight.bezierControlPoint, p2, nextRatio);
            direction = calculateBearing(pt.lat, pt.lon, nextPt.lat, nextPt.lon);

        } else {
            const pt = getIntermediatePoint(flight.origin, flight.destination, elapsedRatio);
            currentPosition = new LatLng(pt.lat, pt.lon);

            // Calculate direction by looking at the next point on the great circle path.
            const nextRatio = Math.min(elapsedRatio + 0.01, 1.0);
            const nextPt = getIntermediatePoint(flight.origin, flight.destination, nextRatio);
            direction = calculateBearing(pt.lat, pt.lon, nextPt.lat, nextPt.lon);
        }

        // Update or create the flight marker.
        const rotation = (direction + 360) % 360;
        if (flight.marker) {
            updateMarker(flight.marker, this.themeManager.t().getIcon("airplane"), {
                coordinates: {lat: currentPosition.lat, lon: currentPosition.lng},
                direction: rotation,
                flipped: true,
                zIndexOffset: 500
            });
        } else {
            flight.marker = marker(
                this.themeManager.t().getIcon("airplane"),
                {
                    coordinates: {lat: currentPosition.lat, lon: currentPosition.lng},
                    direction: rotation,
                    flipped: true,
                    zIndexOffset: 500
                }
            ).addTo(this.themeManager.getMap());
        }

        // Update polylines
        const currentIndex = Math.max(1, Math.round(elapsedRatio * numPoints));

        const elapsedPathPoints = flight.fullPathPoints.slice(0, currentIndex);
        elapsedPathPoints.push(currentPosition);

        const remainingPathPoints = flight.fullPathPoints.slice(currentIndex - 1);
        if (remainingPathPoints.length > 0) {
            remainingPathPoints[0] = currentPosition;
        }

        if (flight.elapsedPolyline) {
            flight.elapsedPolyline.setLatLngs(elapsedPathPoints);
        } else if (elapsedPathPoints.length > 1) {
            flight.elapsedPolyline = polyline(elapsedPathPoints, this.themeManager.t().getPath("elapsed")).addTo(this.themeManager.getMap());
        }

        if (flight.remainingPolyline) {
            flight.remainingPolyline.setLatLngs(remainingPathPoints);
        } else if (remainingPathPoints.length > 1) {
            flight.remainingPolyline = polyline(remainingPathPoints, this.themeManager.t().getPath("remaining")).addTo(this.themeManager.getMap());
        }
    }
}