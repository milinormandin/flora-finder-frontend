import type { Plant } from "@/types/Plant";
import { previewPlants, previewSavedPlantIds } from "@/lib/preview-plants";

const previewStorageKey = "flora-finder:ui-preview:saved-plants:v1";
let memorySavedIds = [...previewSavedPlantIds];

export class PlantDataError extends Error {
  readonly status: number;

  constructor(status: number, message = "Unable to load plant data.") {
    super(message);
    this.name = "PlantDataError";
    this.status = status;
  }
}

export function isPreviewMode(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_UI_PREVIEW === "true"
  );
}

function readPreviewSavedIds(): string[] {
  if (typeof window === "undefined") return [...memorySavedIds];

  try {
    const stored = window.sessionStorage.getItem(previewStorageKey);
    if (stored === null) {
      const initialIds = [...previewSavedPlantIds];
      writePreviewSavedIds(initialIds);
      return initialIds;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
      return [...memorySavedIds];
    }
    return [...new Set(parsed)].filter((id) =>
      previewPlants.some((plant) => plant.PLANT_ID === id),
    );
  } catch {
    return [...memorySavedIds];
  }
}

function writePreviewSavedIds(ids: string[]): void {
  memorySavedIds = [...ids];
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(previewStorageKey, JSON.stringify(ids));
  } catch {
    // The local preview still works when browser storage is unavailable.
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new PlantDataError(0, "Unable to connect. Please try again.");
  }
  if (!response.ok) {
    throw new PlantDataError(
      response.status,
      response.status === 404
        ? "This plant could not be found."
        : "Unable to load plant data. Please try again.",
    );
  }
  return response;
}

function getPreviewPlant(id: string): Plant {
  const plant = previewPlants.find((item) => item.PLANT_ID === id);
  if (!plant) throw new PlantDataError(404, "This plant could not be found.");
  return { ...plant };
}

export async function getPlants(): Promise<Plant[]> {
  if (isPreviewMode()) return previewPlants.map((plant) => ({ ...plant }));
  const response = await request("/api/plants");
  return response.json();
}

export async function getPlant(id: string): Promise<Plant> {
  if (isPreviewMode()) return getPreviewPlant(id);
  const response = await request(`/api/plant?plantId=${encodeURIComponent(id)}`);
  return response.json();
}

export async function getSavedPlants(): Promise<Plant[]> {
  if (isPreviewMode()) {
    const savedIds = readPreviewSavedIds();
    return previewPlants
      .filter((plant) => savedIds.includes(plant.PLANT_ID))
      .map((plant) => ({ ...plant }));
  }
  const response = await request("/api/plantList");
  return response.json();
}

export async function addPlantToList(id: string): Promise<void> {
  if (isPreviewMode()) {
    getPreviewPlant(id);
    writePreviewSavedIds([...new Set([...readPreviewSavedIds(), id])]);
    return;
  }
  await request("/api/plantList", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plantId: id }),
  });
}

export async function removePlantFromList(id: string): Promise<void> {
  if (isPreviewMode()) {
    getPreviewPlant(id);
    writePreviewSavedIds(readPreviewSavedIds().filter((savedId) => savedId !== id));
    return;
  }
  await request(`/api/plantList?plantId=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
