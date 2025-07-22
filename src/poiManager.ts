import {ThemeManager} from "./themeManager";
import {Marker} from "leaflet";
import {IconOptions, marker} from "./marker";

export interface POI {
    lat: number; // TODO: Use Coordinates interface
    lon: number;
    name?: string;
    image?: string;
    themes?: {
        [themeName: string]: IconOptions;
    }
}

export class POIManager {
    private pois: POI[] = [];
    private markers: Marker[] = [];
    private themeManager: ThemeManager;

    constructor(themeManager: ThemeManager) {
        this.themeManager = themeManager;
    }

    registerPOI(poi: POI): void {
        this.pois.push(poi);
        Object.entries(poi.themes || {}).forEach(([themeName, iconOptions]) => {
            let targetTheme = this.themeManager.getThemes().find(t => t.getName() === themeName);
            if (!targetTheme) {
                console.error(`Theme ${themeName} not found for POI ${poi.name}.`);
                return;
            }
            targetTheme.registerPOI(poi.name || '', iconOptions);
        });
    }

    addPOI(poi: POI) {
        const poiMarker = marker(
            this.themeManager.t().getPOI(poi.name),
            {
                coordinates: {lat: poi.lat, lon: poi.lon},
                zIndexOffset: 1000
            }
        ).addTo(this.themeManager.getMap());
        this.markers.push(poiMarker);
        const poiName = poi.name || 'Point of Interest';
        let popupContent = `<b>${poiName}</b>`;
        if (poi.image) {
            popupContent += `<br><img src="${poi.image}" alt="${poiName}" style="width: 100%; height: auto; min-width: 200px;">`;
        }
        poiMarker.bindPopup(popupContent);
        poiMarker.openPopup();
    }

    addPOIs() {
        this.markers.forEach(marker => marker.remove()); // Clear existing markers
        this.markers = []; // Reset markers array

        this.pois.forEach(poi => {
            this.addPOI(poi);
        });
    }
}