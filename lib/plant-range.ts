import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";

export type PlantRangeBounds = [[number, number], [number, number]];

export type PreparedPlantRange = {
  data: FeatureCollection<Polygon | MultiPolygon>;
  bounds: PlantRangeBounds;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Resolve only GeoJSON files in the public plant-range dataset directory. */
export function getPlantRangePath(path?: string | null): string | null {
  if (!path || !/^\/?datasets\/geojson\/[a-zA-Z0-9_-]+\.geojson$/.test(path)) return null;
  return path.startsWith("/") ? path : `/${path}`;
}

function invalidRange(): never {
  throw new Error("The plant range GeoJSON is invalid.");
}

function validateRing(value: unknown): asserts value is Position[] {
  if (!Array.isArray(value) || value.length < 4) invalidRange();

  for (const position of value) {
    if (
      !Array.isArray(position) ||
      position.length < 2 ||
      !position.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate)) ||
      position[0] < -180 || position[0] > 180 ||
      position[1] < -90 || position[1] > 90
    ) invalidRange();
  }

  const first = value[0];
  const last = value[value.length - 1];
  if (first.length !== last.length || first.some((coordinate: number, index: number) => coordinate !== last[index])) {
    invalidRange();
  }
}

function validatePolygon(value: unknown): asserts value is Position[][] {
  if (!Array.isArray(value) || value.length === 0) invalidRange();
  for (const ring of value) validateRing(ring);
}

function validateGeometry(value: unknown): asserts value is Polygon | MultiPolygon {
  if (!isRecord(value)) invalidRange();

  if (value.type === "Polygon") {
    validatePolygon(value.coordinates);
  } else if (value.type === "MultiPolygon") {
    if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) invalidRange();
    for (const polygon of value.coordinates) validatePolygon(polygon);
  } else {
    invalidRange();
  }
}

/** Keep mapped presence ranges, preserving their geometry and polygon holes. */
export function preparePlantRange(input: unknown): PreparedPlantRange | null {
  if (!isRecord(input) || input.type !== "FeatureCollection" || !Array.isArray(input.features)) {
    invalidRange();
  }

  const features: Feature<Polygon | MultiPolygon>[] = [];
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  for (const feature of input.features) {
    if (!isRecord(feature) || feature.type !== "Feature" ||
      (feature.properties !== null && !isRecord(feature.properties))) {
      invalidRange();
    }

    const gridcode = feature.properties?.GRIDCODE;
    if (gridcode !== 1 && gridcode !== 2) continue;

    validateGeometry(feature.geometry);
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;

    for (const polygon of polygons) {
      // Holes affect rendering, but the exterior ring determines the fitted extent.
      for (const [longitude, latitude] of polygon[0]) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }

    features.push(feature as unknown as Feature<Polygon | MultiPolygon>);
  }

  if (features.length === 0) return null;

  return {
    data: { type: "FeatureCollection", features },
    bounds: [[west, south], [east, north]],
  };
}
