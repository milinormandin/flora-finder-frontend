// page.js
"use client";

import Map from 'react-map-gl/mapbox';
import "mapbox-gl/dist/mapbox-gl.css";

import classes from "./Page.module.css";

export default function Home() {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    return (
        <main className={classes.mainStyle}>
            <Map
                mapboxAccessToken={mapboxToken}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                style={classes.mapStyle}
                initialViewState={{ latitude: 35.668641, longitude: 139.750567, zoom: 10 }}
                maxZoom={20}
                minZoom={3}
            ></Map>
        </main>
    );
}