import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Feature, Polygon, Position } from "geojson";
import { getPlantRangePath, preparePlantRange } from "../lib/plant-range";

const exterior: Position[] = [[-158, 20], [-156, 20], [-156, 22], [-158, 22], [-158, 20]];
const hole: Position[] = [[-157.8, 20.2], [-157.8, 20.8], [-157.2, 20.8], [-157.2, 20.2], [-157.8, 20.2]];

function feature(gridcode: unknown = 1, coordinates: Position[][] = [exterior]): Feature<Polygon> {
  return {
    type: "Feature",
    properties: { GRIDCODE: gridcode },
    geometry: { type: "Polygon", coordinates },
  };
}

function collection(features: unknown[]) {
  return { type: "FeatureCollection", features };
}

test("range paths resolve catalog filenames and reject nonlocal or ambiguous URLs", () => {
  expect(getPlantRangePath("datasets/geojson/cyahirt.geojson")).toBe("/datasets/geojson/cyahirt.geojson");
  expect(getPlantRangePath("/datasets/geojson/plant_1-2.geojson")).toBe("/datasets/geojson/plant_1-2.geojson");
  for (const path of [
    undefined, null, "", "cyahirt.geojson", "https://example.com/datasets/geojson/cyahirt.geojson",
    "//datasets/geojson/cyahirt.geojson", "datasets/geojson/../plants.json", "datasets/geojson/.geojson",
    "datasets/geojson/subdir/cyahirt.geojson", "datasets/geojson/%2e%2e.geojson",
    "datasets/geojson/cyahirt.geojson?token=1", "datasets/geojson/cyahirt.geojson#part",
    "datasets\\geojson\\cyahirt.geojson", " datasets/geojson/cyahirt.geojson",
  ]) {
    expect(getPlantRangePath(path), String(path)).toBeNull();
  }
});

test("presence codes 1 and 2 retain holes, feature properties, and source geometry", () => {
  const present = feature(1, [exterior, hole]);
  present.id = "native-range";
  const likely = feature(2);
  const absent = { ...feature(0), geometry: null };
  const input = collection([present, absent, likely, feature("1"), feature(null), feature(3)]);
  const before = structuredClone(input);
  const result = preparePlantRange(input);

  expect(result?.data.features).toEqual([present, likely]);
  expect(result?.data.features[0]).toBe(present);
  expect(result?.data.features[0].geometry.coordinates[1]).toEqual(hole);
  expect(result?.bounds).toEqual([[-158, 20], [-156, 22]]);
  expect(input).toEqual(before);
});

test("bounds span every outer ring in polygons and separate MultiPolygon islands", () => {
  const secondIsland: Position[] = [[-155, 19], [-154, 19], [-154, 20], [-155, 19]];
  const multi = {
    type: "Feature",
    properties: { GRIDCODE: 2 },
    geometry: { type: "MultiPolygon", coordinates: [[exterior, hole], [secondIsland]] },
  };
  const result = preparePlantRange(collection([multi]));

  expect(result?.bounds).toEqual([[-158, 19], [-154, 22]]);
  expect(result?.data.features).toEqual([multi]);
});

test("valid collections without presence ranges return an empty-range result", () => {
  expect(preparePlantRange(collection([]))).toBeNull();
  expect(preparePlantRange(collection([feature(0), feature("2"), { ...feature(), properties: null }]))).toBeNull();
});

test("malformed collections and included nonpolygon features fail explicitly", () => {
  for (const input of [
    null, [], {}, { type: "FeatureCollection" }, { type: "FeatureCollection", features: {} },
    { type: "Polygon", coordinates: [] }, collection([null]), collection([{}]),
    collection([{ ...feature(), properties: [] }]), collection([{ ...feature(), properties: undefined }]),
    collection([{ ...feature(), geometry: null }]),
    collection([{ ...feature(), geometry: { type: "Point", coordinates: [-157, 21] } }]),
    collection([{ ...feature(), geometry: { type: "MultiPolygon", coordinates: [] } }]),
  ]) {
    expect(() => preparePlantRange(input)).toThrow("The plant range GeoJSON is invalid.");
  }
});

test("invalid included rings, holes, and coordinates cannot reach the map", () => {
  for (const coordinates of [
    [], [[]], [[[0, 0], [1, 0], [0, 0]]],
    [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    [[[0, 0], [Infinity, 0], [1, 1], [0, 0]]],
    [[[0, 0], [1, NaN], [1, 1], [0, 0]]],
    [[[0, 0], [181, 0], [1, 1], [0, 0]]],
    [[[0, 0], [1, 91], [1, 1], [0, 0]]],
    [[[0], [1, 0], [1, 1], [0]]],
    [exterior, [[-157, 21], [-156.5, 21], [-157, 21]]],
  ]) {
    expect(() => preparePlantRange(collection([feature(1, coordinates)]))).toThrow();
  }
});

for (const [filename, count, bounds] of [
  ["cyahirt", 33, [[-159.68914645728225, 21.91784835122159], [-159.34416128426636, 22.217536553907703]]],
  ["achmuti", 90, [[-159.7013115155528, 19.090636520624134], [-155.22478828274353, 22.161635021164845]]],
  ["dodvisc", 263, [[-160.2467898666704, 18.910853093741398], [-154.806940293332, 22.235024449151187]]],
] as const) {
  test(`real ${filename} ranges preserve holes and fit only mapped presence`, () => {
    const input = JSON.parse(readFileSync(join(process.cwd(), `public/datasets/geojson/${filename}.geojson`), "utf8"));
    const result = preparePlantRange(input);

    expect(result?.data.features).toHaveLength(count);
    expect(result?.bounds).toEqual(bounds);
    expect(result?.data.features.every((item) => item.properties?.GRIDCODE === 1 || item.properties?.GRIDCODE === 2)).toBe(true);
    const withHole = result?.data.features.find((item) => item.geometry.type === "Polygon" && item.geometry.coordinates.length > 1);
    expect(withHole).toBeDefined();
    expect(input.features).toContain(withHole);
  });
}
