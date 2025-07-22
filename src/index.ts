import * as L from 'leaflet';
import 'leaflet-rotatedmarker';
import {Theme, ThemeOptions} from './theme';
import {ThemeManager} from "./themeManager";
import {POI} from "./poiManager";
import {Airport} from "./airportManager";
import {Flight} from "./flightManager";

let map = L.map('map', {
    worldCopyJump: true
});

const themeManager = new ThemeManager(map);


interface ServerData {
    pois: POI[];
    airports: Airport[];
    flights: Flight[];
    themes: ThemeOptions[];
    tracking: {
        arrivalDates: string[];
        currentlyTracking: boolean;
    },
    file_id: string;
}

const trackingStatus = document.getElementById('tracking-status') as HTMLSpanElement;
let fileId;

function loadServerData() {
    const serverDataMeta = document.getElementById('server-data') as HTMLMetaElement;
    if (!serverDataMeta) {
        console.error('Server data meta tag not found');
        return;
    }
    const serverData: ServerData = JSON.parse(serverDataMeta.content);
    serverData.themes.forEach(themeData => {
        themeManager.registerTheme(new Theme(themeData));
    });
    serverData.pois.forEach(poi => {
        themeManager.getPOIManager().registerPOI(poi);
    });
    serverData.airports.forEach(airport => {
        themeManager.getAirportManager().registerAirport(airport);
    });
    serverData.flights.forEach(flight => {
        themeManager.getFlightManager().registerFlight(flight);
    });
    themeManager.setCurrentlyTracking(serverData.tracking.currentlyTracking);
    if (!serverData.tracking.currentlyTracking) {
        trackingStatus.innerHTML = `<strong>Live tracking not active.</strong> Active dates: ${serverData.tracking.arrivalDates.join(', ')}`;
    } else {
        trackingStatus.innerHTML = `<strong>Live tracking active.</strong>`;
        setInterval(fetchServerData, 1000 * 60); // Fetch server data every minute
    }
    fileId = serverData.file_id;
}

function fetchServerData() {
    fetch(`/api/map/${fileId}`).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        response.json().then(data => {
            const serverData: ServerData = data;
            serverData.flights.forEach(flight => {
                themeManager.getFlightManager().updateFlight(flight);
            });
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    loadServerData();
    themeManager.setDefaultTheme(fileId);
    themeManager.initSelect();
});
