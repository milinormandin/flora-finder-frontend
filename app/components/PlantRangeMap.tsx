"use client";

import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import mapboxgl from "mapbox-gl";
import Map, { Layer, NavigationControl, ScaleControl, Source, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { getPlantRangePath, preparePlantRange } from "@/lib/plant-range";
import PageState from "./PageState";

type PlantRangeMapProps = {
  plantId: string;
  plantName: string;
  geojsonPath?: string | null;
};

type Range = NonNullable<ReturnType<typeof preparePlantRange>>;
type RangeState =
  | { status: "loading" | "error" | "empty" }
  | { status: "ready"; range: Range };

const sourceId = "plant-range";
const fitOptions = { padding: 36, maxZoom: 14, duration: 0 };
const subscribeToSupport = () => () => {};
const serverSupport = () => null;
let cachedSupport: boolean | undefined;

function browserSupport() {
  if (cachedSupport === undefined) {
    try {
      cachedSupport = mapboxgl.supported();
    } catch {
      cachedSupport = false;
    }
  }
  return cachedSupport;
}

class RangeMapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function MapMessage({ empty = false, description, onRetry }: {
  empty?: boolean;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-auto p-4 [&>div]:min-h-0 [&>div]:w-full [&>div]:max-w-xl [&>div]:border-0 [&>div]:bg-transparent [&>div]:py-4">
      <PageState
        kind={empty ? "empty" : "error"}
        title={empty ? "Range not available" : "Map unavailable"}
        description={description}
        onRetry={onRetry}
      />
    </div>
  );
}

function RangeMapAttempt({ geojsonPath, plantName, onRetry }: PlantRangeMapProps & { onRetry: () => void }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  const path = getPlantRangePath(geojsonPath);
  const supported = useSyncExternalStore<boolean | null>(subscribeToSupport, browserSupport, serverSupport);
  const map = useRef<MapRef>(null);
  const [state, setState] = useState<RangeState>({ status: "loading" });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const ready = mapLoaded && sourceLoaded;

  useEffect(() => {
    if (!path || !token || !supported) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = window.setTimeout(() => controller.abort(), 15000);

    async function loadRange() {
      try {
        const response = await fetch(path!, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load plant range");
        const range = preparePlantRange(await response.json());
        if (!cancelled) setState(range ? { status: "ready", range } : { status: "empty" });
      } catch {
        if (!cancelled) setState({ status: "error" });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadRange();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [path, token, supported]);

  useEffect(() => {
    if (state.status !== "ready" || ready || mapFailed) return;
    const timeout = window.setTimeout(() => setMapFailed(true), 15000);
    return () => window.clearTimeout(timeout);
  }, [state.status, ready, mapFailed]);

  const unavailable = (
    <MapMessage
      description={supported === false
        ? "Your browser cannot display the range map. You can still explore this plant’s details."
        : "The range map couldn’t load. You can still explore this plant’s details."}
      onRetry={token && supported ? onRetry : undefined}
    />
  );

  if (!path || state.status === "empty") {
    return <MapMessage empty description="Mapped range data is not available for this plant." />;
  }
  if (!token || supported === false || mapFailed || state.status === "error") return unavailable;

  return (
    <RangeMapBoundary fallback={unavailable}>
      {state.status === "ready" && supported && (
        <Map
          ref={map}
          mapLib={mapboxgl}
          mapboxAccessToken={token}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          style={{ width: "100%", height: "100%" }}
          initialViewState={{ bounds: state.range.bounds, fitBoundsOptions: fitOptions }}
          minZoom={3}
          maxZoom={20}
          cooperativeGestures
          onLoad={() => {
            map.current?.getCanvas().setAttribute("aria-label", `Range map for ${plantName}`);
            setMapLoaded(true);
          }}
          onSourceData={(event) => {
            if (event.sourceId === sourceId && event.isSourceLoaded) setSourceLoaded(true);
          }}
          onError={() => setMapFailed(true)}
        >
          <Source id={sourceId} type="geojson" data={state.range.data}>
            <Layer id="plant-range-fill" type="fill" paint={{ "fill-color": "#66845b", "fill-opacity": 0.35 }} />
            <Layer id="plant-range-outline" type="line" paint={{ "line-color": "#344d32", "line-width": 1.5 }} />
          </Source>
          <NavigationControl position="top-right" showCompass={false} />
          <ScaleControl position="bottom-left" />
        </Map>
      )}
      {ready && state.status === "ready" && (
        <Button
          variant="outline"
          size="sm"
          className="absolute left-3 top-3 bg-card shadow-sm"
          onClick={() => map.current?.fitBounds(state.range.bounds, fitOptions)}
        >
          <RotateCcw className="size-4" aria-hidden="true" /> Reset view
        </Button>
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-secondary text-sm text-muted-foreground" role="status" aria-label="Loading plant range">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          <span>Loading plant range…</span>
        </div>
      )}
    </RangeMapBoundary>
  );
}

export default function PlantRangeMap(props: PlantRangeMapProps) {
  const [attempt, setAttempt] = useState(0);

  return (
    <div
      className="relative isolate h-[280px] overflow-hidden rounded-xl border border-border bg-secondary sm:h-[400px]"
      role="region"
      aria-label={`Range map for ${props.plantName}`}
    >
      <RangeMapAttempt
        key={`${props.plantId}:${props.geojsonPath}:${attempt}`}
        {...props}
        onRetry={() => setAttempt((current) => current + 1)}
      />
    </div>
  );
}
