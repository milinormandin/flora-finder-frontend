import type { Plant } from "@/types/Plant";
import type { PlantPage } from "@/types/PlantPage";
import type { PlantSuggestion } from "@/types/PlantSuggestion";
import { filterCatalogPlants, plantIslands, type PlantFilters } from "@/lib/plant-filters";
import { getPlantSuggestions as searchCatalogPlants } from "@/lib/plant-search";
import { normalizePlantText } from "@/lib/plant-text";

export const plantPageSize = 24;

const savedPlantIdsStorageKey = "flora-finder:saved-plant-ids:v1";
let catalogRequest: Promise<Plant[]> | undefined;

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

async function fetchCatalog(): Promise<Plant[]> {
  let response: Response;
  try {
    response = await fetch("/datasets/plants.json");
  } catch {
    throw new PlantDataError(0, "Unable to connect. Please try again.");
  }
  if (!response.ok) {
    throw new PlantDataError(
      // A missing catalog is a load failure, rather than a missing individual plant.
      response.status === 404 ? 503 : response.status,
      "Unable to load plant data. Please try again.",
    );
  }

  let plants: unknown;
  try {
    plants = await response.json();
  } catch {
    throw new PlantDataError(502, "Unable to load plant data. Please try again.");
  }
  if (!Array.isArray(plants) || !plants.every((plant) => (
    plant !== null && typeof plant === "object" && typeof plant.PLANT_ID === "string"
  ))) {
    throw new PlantDataError(502, "Unable to load plant data. Please try again.");
  }
  return plants;
}

function loadCatalog(): Promise<Plant[]> {
  if (!catalogRequest) {
    // Keep a successful catalog for every screen, but allow failed loads to retry.
    catalogRequest = fetchCatalog().catch((error: unknown) => {
      catalogRequest = undefined;
      throw error;
    });
  }
  return catalogRequest;
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortReason(signal);
}

function getCatalog(signal?: AbortSignal): Promise<Plant[]> {
  throwIfAborted(signal);
  const catalog = loadCatalog();
  if (!signal) return catalog;

  // Consumers cancel only their own wait; the shared catalog can still serve others.
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    catalog.then(
      (plants) => {
        signal.removeEventListener("abort", onAbort);
        if (signal.aborted) reject(abortReason(signal));
        else resolve(plants);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(signal.aborted ? abortReason(signal) : error);
      },
    );
  });
}

export async function getPlants(): Promise<Plant[]> {
  return getCatalog();
}

export async function getPlantsPage(offset: number, signal?: AbortSignal, filters: PlantFilters = {}): Promise<PlantPage> {
  throwIfAborted(signal);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new PlantDataError(400, "offset must be a nonnegative safe integer");
  }
  const letter = filters.letter ? normalizePlantText(filters.letter) : undefined;
  if (filters.letter && !/^[a-z]$/.test(letter ?? "")) {
    throw new PlantDataError(400, "letter must be a single letter from A to Z");
  }
  const island = filters.island;
  if (island && island !== "unrecorded" && !plantIslands.some((item) => item.id === island)) {
    throw new PlantDataError(400, "island must be a supported island or unrecorded");
  }

  const catalog = await getCatalog(signal);
  throwIfAborted(signal);
  const plants = filterCatalogPlants(catalog, { letter, island });
  const pagePlants = plants.slice(offset, offset + plantPageSize);
  const nextOffset = offset + pagePlants.length;
  return {
    plants: pagePlants,
    total: plants.length,
    nextOffset: nextOffset < plants.length ? nextOffset : null,
  };
}

export async function getPlantSuggestions(query: string, signal?: AbortSignal): Promise<PlantSuggestion[]> {
  throwIfAborted(signal);
  if (query.length > 100) {
    throw new PlantDataError(400, "Search query must be 100 characters or fewer");
  }
  if (normalizePlantText(query).length < 2) return [];
  const plants = await getCatalog(signal);
  throwIfAborted(signal);
  return searchCatalogPlants(plants, query);
}

export async function getPlant(id: string): Promise<Plant> {
  if (!id) throw new PlantDataError(400, "plant_id is required");
  const plants = await getCatalog();
  const plant = plants.find((record) => record.PLANT_ID === id);
  if (!plant) throw new PlantDataError(404, "This plant could not be found.");
  return plant;
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
