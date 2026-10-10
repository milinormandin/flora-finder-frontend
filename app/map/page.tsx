"use client";

import { Component, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import mapboxgl from "mapbox-gl";
import Map, { NavigationControl, ScaleControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import PageState from "../components/PageState";
import classes from "./Page.module.css";

const subscribeToSupport = () => () => {};
const serverSupport = () => null;
let cachedSupport: boolean | undefined;

function browserSupport() {
  if (cachedSupport === undefined) cachedSupport = mapboxgl.supported();
  return cachedSupport;
}

class MapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function MapPage() {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  const supported = useSyncExternalStore<boolean | null>(subscribeToSupport, browserSupport, serverSupport);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!mapboxToken || !supported || loaded || failed) return;
    const timeout = window.setTimeout(() => setFailed(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [mapboxToken, supported, loaded, failed, attempt]);

  const retry = () => {
    setLoaded(false);
    setFailed(false);
    setAttempt((current) => current + 1);
  };

  const unavailable = (
    <div className={classes.unavailable}>
      <PageState
        kind="error"
        title="Map unavailable"
        description={supported === false
          ? "Your browser cannot display this map. You can still explore the plants in the field guide."
          : "The map couldn’t load. You can still explore the plants in the field guide."}
        onRetry={mapboxToken && supported ? retry : undefined}
        action={<Button nativeButton={false} role="link" render={<Link href="/" />}><span>Explore plants</span><ArrowRight className="size-4" aria-hidden="true" /></Button>}
      />
    </div>
  );

  return (
    <main id="main-content" tabIndex={-1} className={`page-container ${classes.mainStyle}`}>
      <div className={classes.heading}>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] md:text-4xl">Explore Hawaiʻi</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Get to know the landscape of the Hawaiian Islands.</p>
      </div>

      <section className={classes.mapFrame} aria-label="Map of the Hawaiian Islands">
        {!mapboxToken || supported === false || failed ? unavailable : (
          <MapBoundary key={attempt} fallback={unavailable}>
            {supported && (
              <Map
                key={attempt}
                mapboxAccessToken={mapboxToken}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                style={{ width: "100%", height: "100%" }}
                initialViewState={{ latitude: 20.8, longitude: -157.2, zoom: 6 }}
                maxZoom={20}
                minZoom={3}
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
              >
                <NavigationControl position="top-right" showCompass={false} />
                <ScaleControl position="bottom-left" />
              </Map>
            )}
            {!loaded && (
              <div className={classes.loading} role="status">
                <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
                <span>Loading map…</span>
              </div>
            )}
          </MapBoundary>
        )}
      </section>
    </main>
  );
}
