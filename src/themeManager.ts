import {Theme} from "./theme";
import {Map as LeafletMap} from "leaflet"; // To avoid conflicts with the global Map type

export class ThemeManager {
    private themes: Theme[] = [];
    private currentTheme: Theme | null = null;
    private readonly map: LeafletMap
    private readonly themeSelect: HTMLSelectElement | null = null;

    constructor(map: LeafletMap) {
        this.map = map;
        this.themeSelect = document.getElementById('theme-select') as HTMLSelectElement | null;
    }

    registerTheme(theme: Theme): void {
        this.themes.push(theme);
        if (!this.currentTheme) {
            this.setTheme(0); // Set the first theme as the current theme by default
        }
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
        console.log(`Theme set to: ${this.currentTheme.getName()}`);
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
}