import {icon as leaflet_icon, marker as leaflet_marker} from "leaflet";

export interface IconOptions {
    main: string;  // URL of the main icon image
    flipped?: string  // URL of the flipped icon image (optional)
    rotate?: number  // Apply rotation (in degrees) to the icon (optional)
    size?: [  // Size of the icon (optional)
        number,  // Width of the icon
        number   // Height of the icon
    ],
    anchor?: [  // Anchor point of the icon (optional)
        number,  // X offset
        number   // Y offset
    ]
    popup_anchor?: [  // Anchor point for the popup (optional)
        number,  // X offset for the popup
        number   // Y offset for the popup
    ]
}

// TODO: Implement popup functionality through MarkerState
export interface MarkerState {
    direction?: number;  // Current direction of the marker (default is 0)
    flipped?: boolean;  // Whether the marker is flipped (default is false)
    coordinates: Coordinates;  // Coordinates of the marker
    zIndexOffset?: number;  // Z-index offset for the marker (optional)
}

const defaultSize = 48;

export function marker(options: IconOptions, state: MarkerState): L.Icon {
    // Determine the icon URL based on the flipped state
    const iconUrl = state.flipped && options.flipped ? options.flipped : options.main;

    // Create the icon instance with the specified options
    const iconInstance = leaflet_icon({
        iconUrl: iconUrl,
        iconSize: options.size || [defaultSize, defaultSize],
        iconAnchor: options.anchor || [defaultSize/2, defaultSize/2],
        popupAnchor: options.popup_anchor || [0, -defaultSize/2]
    });

    // Create the marker instance with the icon and state
    const marker = leaflet_marker([state.coordinates.lat, state.coordinates.lon], {
        icon: iconInstance,
        rotationAngle: (state.direction || 0) + (options.rotate || 0),
        rotationOrigin: 'center center',
        zIndexOffset: state.zIndexOffset || 0
    });

    // Return the marker instance
    return marker;
}
