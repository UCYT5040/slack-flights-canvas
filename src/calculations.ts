import * as L from 'leaflet'; // TODO: Import only necessary types
import {Coordinates} from './coordinates';

const toRadians = (degrees: number): number => degrees * Math.PI / 180;
const toDegrees = (radians: number): number => radians * 180 / Math.PI;

function toCartesian(coord: Coordinates): { x: number; y: number; z: number } {
    const latRad = toRadians(coord.lat);
    const lonRad = toRadians(coord.lon);
    return {
        x: Math.cos(latRad) * Math.cos(lonRad),
        y: Math.cos(latRad) * Math.sin(lonRad),
        z: Math.sin(latRad),
    };
}

function toGeographic(cartesian: { x: number; y: number; z: number }): Coordinates {
    return {
        lat: toDegrees(Math.asin(cartesian.z)),
        lon: toDegrees(Math.atan2(cartesian.y, cartesian.x)),
    };
}

export function getIntermediatePoint(p1: Coordinates, p2: Coordinates, fraction: number): Coordinates {
    const v1 = toCartesian(p1);
    const v2 = toCartesian(p2);

    const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    const omega = Math.acos(Math.max(-1, Math.min(1, dotProduct))); // Angle between vectors

    if (omega === 0) return p1; // Points are identical

    const sinOmega = Math.sin(omega);
    const a = Math.sin((1 - fraction) * omega) / sinOmega;
    const b = Math.sin(fraction * omega) / sinOmega;

    const interpolatedVector = {
        x: a * v1.x + b * v2.x,
        y: a * v1.y + b * v2.y,
        z: a * v1.z + b * v2.z,
    };

    return toGeographic(interpolatedVector);
}

export function generateGreatCirclePoints(p1: Coordinates, p2: Coordinates, numPoints: number = 100): L.LatLng[] {
    const points: L.LatLng[] = [];
    for (let i = 0; i <= numPoints; i++) {
        const fraction = i / numPoints;
        const pt = getIntermediatePoint(p1, p2, fraction);

        // Unwrap longitudes to prevent Leaflet from drawing a line across the entire map.
        if (i > 0) {
            const lastLon = points[points.length - 1].lng;
            // If the longitude jump is > 180°, adjust it by 360°.
            while (pt.lon - lastLon > 180) {
                pt.lon -= 360;
            }
            while (lastLon - pt.lon > 180) {
                pt.lon += 360;
            }
        }
        points.push(L.latLng(pt.lat, pt.lon));
    }
    return points;
}

export function getBezierPoint(p0: Coordinates, p1: Coordinates, p2: Coordinates, t: number): Coordinates {
    const oneMinusT = 1 - t;
    const t2 = t * t;
    const oneMinusT2 = oneMinusT * oneMinusT;

    const lat = oneMinusT2 * p0.lat + 2 * oneMinusT * t * p1.lat + t2 * p2.lat;
    const lon = oneMinusT2 * p0.lon + 2 * oneMinusT * t * p1.lon + t2 * p2.lon;

    return {lat, lon};
}

export function generateBezierPoints(p0: Coordinates, p1: Coordinates, p2: Coordinates, numPoints: number = 100): L.LatLng[] {
    const points: L.LatLng[] = [];
    for (let i = 0; i <= numPoints; i++) {
        const t = i / numPoints;
        const pt = getBezierPoint(p0, p1, p2, t);
        points.push(L.latLng(pt.lat, pt.lon));
    }
    return points;
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    /* Utility function to calculate the bearing between two geographic coordinates. */
    const toRadians = (deg: number) => deg * Math.PI / 180;
    const toDegrees = (rad: number) => rad * 180 / Math.PI;

    const lat1Rad = toRadians(lat1);
    const lon1Rad = toRadians(lon1);
    const lat2Rad = toRadians(lat2);
    const lon2Rad = toRadians(lon2);

    const deltaLon = lon2Rad - lon1Rad;

    const y = Math.sin(deltaLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
        Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLon);

    const bearingRad = Math.atan2(y, x);
    const bearingDeg = toDegrees(bearingRad);

    return (bearingDeg + 360) % 360;
}