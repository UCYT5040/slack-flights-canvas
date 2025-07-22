import {IconOptions} from './marker';
import {tileLayer, TileLayer} from 'leaflet';
import {PathOptions} from "./path";

export interface ThemeOptions {
    name: string;  // Name of the theme
    tile_layer: {
        url: string;  // URL of the tile layer
        attribution: string;  // Attribution text for the tile layer
    };
    icons: {
        airplane: IconOptions;
        airport: IconOptions;
    },
    paths: {
        elapsed: PathOptions;
        remaining: PathOptions;
    }
}


export class Theme {
    private options: ThemeOptions;
    private pois: { [key: string]: IconOptions } = {};  // Points of Interest (POIs) icons for this theme

    constructor(options: ThemeOptions) {
        this.options = options;
    }

    registerPOI(name: string, icon: IconOptions): void {
        if (this.pois[name]) {
            throw new Error(`POI with name ${name} already exists.`);
        }
        this.pois[name] = icon;
    }

    getPOI(name: string): IconOptions | undefined {
        return this.pois[name];
    }

    getIcon(name: string): IconOptions | undefined {
        return this.options.icons[name];
    }

    getPath(name: 'elapsed' | 'remaining'): PathOptions {
        return this.options.paths[name];
    }

    getTileLayer(): TileLayer {
        return tileLayer(this.options.tile_layer.url, {
            minZoom: 1,
            maxZoom: 16,
            attribution: this.options.tile_layer.attribution,
        });
    }

    getName(): string {
        return this.options.name;
    }
}