import {ThemeManager} from "./themeManager";
import {Marker} from "leaflet";
import {marker} from "./marker";

export interface Airport {
    name: string;
    lat: number; // TODO: Use Coordinates interface
    lon: number;
}

export class AirportManager {
    private airports: Airport[] = [];
    private markers: Marker[] = [];
    private themeManager: ThemeManager;

    constructor(themeManager: ThemeManager) {
        this.themeManager = themeManager;
    }

    registerAirport(airport: Airport): void {
        this.airports.push(airport);
    }

    addAirport(airport: Airport) {
        if (!this.themeManager.t()) return console.error('No theme set for the map. Cannot add airport.');
        const airportMarker = marker(
            this.themeManager.t().getIcon('airport'),
            {
                coordinates: {lat: airport.lat, lon: airport.lon},
                zIndexOffset: 0
            }
        ).addTo(this.themeManager.getMap());
        this.markers.push(airportMarker);
    }

    addAirports() {
        this.markers.forEach(marker => marker.remove()); // Clear existing markers
        this.markers = []; // Reset markers array

        this.airports.forEach(airport => {
            this.addAirport(airport);
        });
    }
}