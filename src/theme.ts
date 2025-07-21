import {IconOptions} from './marker';
import {tileLayer, TileLayer} from 'leaflet';

interface ThemeOptions {
    name: string;  // Name of the theme
    tile_layer: {
        url: string;  // URL of the tile layer
        attribution: string;  // Attribution text for the tile layer
        ext: string;  // File extension for the tile layer images
    };
    icons: {
        airplane: IconOptions;
        airport: IconsOptions;
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

    getTileLayer(): TileLayer {
        return tileLayer(this.options.tile_layer.url, {
            minZoom: 1,
            maxZoom: 16,
            attribution: this.options.tile_layer.attribution,
            ext: this.options.tile_layer.ext
        });
    }

    getName(): string {
        return this.options.name;
    }
}