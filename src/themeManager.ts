import {Theme} from "./theme";
import {Map as LeafletMap} from "leaflet";
import {AirportManager} from "./airportManager";
import {POIManager} from "./poiManager";
import {FlightManager} from "./flightManager"; // To avoid conflicts with the global Map type

export class ThemeManager {
    private themes: Theme[] = [];
    private currentTheme: Theme | null = null;
    private readonly map: LeafletMap
    private readonly themeSelect: HTMLSelectElement | null = null;
    private readonly airportManager: AirportManager | null = null;
    private readonly poiManager: POIManager | null = null;
    private readonly flightManager: FlightManager | null = null;
    private currentlyTracking: boolean = false;
    private fileId: string | null = null;

    constructor(map: LeafletMap) {
        this.map = map;
        this.themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
        this.airportManager = new AirportManager(this);
        this.poiManager = new POIManager(this);
        this.flightManager = new FlightManager(this);
    }

    setCurrentlyTracking(value: boolean): void {
        this.currentlyTracking = value;

    }

    registerTheme(theme: Theme): void {
        this.themes.push(theme);
    }

    setTheme(index: number): void {
        if (index < 0 || index >= this.themes.length) {
            console.error(`Theme index ${index} is out of bounds.`);
            return;
        }
        if (this.currentTheme) {
            this.map.removeLayer(this.currentTheme.getTileLayer());
        }
        this.currentTheme = this.themes[index];
        this.currentTheme.getTileLayer().addTo(this.map);
        this.map.setView([0, 0], 2);
        this.airportManager?.addAirports();
        this.poiManager?.addPOIs();
        this.flightManager?.addFlights(this.currentlyTracking);
        if (this.currentlyTracking) {
            this.flightManager?.startAnimation();
        }
        // Save theme index preference to localStorage by fileId
        if (this.fileId) {
            localStorage.setItem(`themeIndex_${this.fileId}`, index.toString());
        }
    }

    setDefaultTheme(fileId): void {
        this.fileId = fileId;
        if (this.themes.length === 0) {
            console.error('No themes registered. Cannot set default theme.');
            return;
        }
        // Check for saved index in localStorage
        let savedIndex = 0;
        const stored = localStorage.getItem(`themeIndex_${fileId}`);
        if (stored !== null) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && parsed >= 0 && parsed < this.themes.length) {
                savedIndex = parsed;
            }
        }
        if (!this.currentTheme) {
            this.setTheme(savedIndex); // Use saved or default index
        }
    }

    getCurrentTheme(): Theme | null {
        return this.currentTheme;
    }

    t(): Theme | null { // Alias for getCurrentTheme
        return this.getCurrentTheme();
    }

    getThemes(): Theme[] {
        return this.themes;
    }

    initSelect(): void {
        if (!this.themeSelect) {
            console.error('Theme select element not found');
            return;
        }

        this.themes.forEach((theme, index) => {
            const option = document.createElement('option');
            option.value = index.toString();
            option.textContent = theme.getName();
            this.themeSelect.appendChild(option);
        });

        this.themeSelect.addEventListener('change', (event) => {
            const selectedIndex = parseInt((event.target as HTMLSelectElement).value, 10);
            this.setTheme(selectedIndex);
        });
    }

    getMap(): LeafletMap {
        return this.map;
    }

    getAirportManager(): AirportManager | null {
        return this.airportManager;
    }

    getPOIManager(): POIManager | null {
        return this.poiManager;
    }

    getFlightManager(): FlightManager | null {
        return this.flightManager;
    }
}