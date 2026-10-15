import type { Plant } from "@/types/Plant";
import type { PlantPage } from "@/types/PlantPage";
import type { PlantSuggestion } from "@/types/PlantSuggestion";
import type { PlantFilters } from "@/lib/plant-filters";

export const plantPageSize = 24;

const savedPlantIdsStorageKey = "flora-finder:saved-plant-ids:v1";

export class PlantDataError extends Error {
  readonly status: number;

  constructor(status: number, message = "Unable to load plant data.") {
    super(message);
    this.name = "PlantDataError";
    this.status = status;
  }
}

function readSavedIds(): string[] {
  if (typeof window === "undefined") return [];

  // Storage access errors must reach the UI; only malformed contents reset the list.
  const stored = window.localStorage.getItem(savedPlantIdsStorageKey);
  if (stored === null) return [];

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === "string")) {
      return [];
    }
    return [...new Set(parsed)];
  } catch {
    return [];
  }
}

function writeSavedIds(ids: string[]): void {
  if (typeof window === "undefined") {
    throw new PlantDataError(0, "Browser storage is unavailable.");
  }
  window.localStorage.setItem(savedPlantIdsStorageKey, JSON.stringify(ids));
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

export async function getPlants(): Promise<Plant[]> {
  const response = await request("/api/plants");
  return response.json();
}

export async function getPlantsPage(offset: number, signal?: AbortSignal, filters: PlantFilters = {}): Promise<PlantPage> {
  const params = new URLSearchParams({ offset: String(offset), limit: String(plantPageSize) });
  if (filters.letter) params.set("letter", filters.letter);
  if (filters.island) params.set("island", filters.island);
  const response = await request(`/api/plants?${params}`, { signal });
  return response.json();
}

export async function getPlantSuggestions(query: string, signal?: AbortSignal): Promise<PlantSuggestion[]> {
  const response = await request(`/api/plants/search?q=${encodeURIComponent(query)}`, { signal });
  return response.json();
}

export async function getPlant(id: string): Promise<Plant> {
  const response = await request(`/api/plant?plantId=${encodeURIComponent(id)}`);
  return response.json();
}

export async function getSavedPlants(): Promise<Plant[]> {
  const savedIds = new Set(readSavedIds());
  if (savedIds.size === 0) return [];
  const plants = await getPlants();
  return plants.filter((plant) => savedIds.has(plant.PLANT_ID));
}

export async function addPlantToList(id: string): Promise<void> {
  await getPlant(id);
  writeSavedIds([...new Set([...readSavedIds(), id])]);
}

export async function removePlantFromList(id: string): Promise<void> {
  writeSavedIds(readSavedIds().filter((savedId) => savedId !== id));
}
