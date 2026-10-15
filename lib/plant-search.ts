import { normalizePlantText } from "@/lib/plant-text";
import type { Plant } from "@/types/Plant";
import type { PlantSuggestion } from "@/types/PlantSuggestion";

type SearchEntry = {
  suggestion: PlantSuggestion;
  names: string[];
};

const searchIndexes = new WeakMap<readonly Plant[], SearchEntry[]>();

function getSearchIndex(plants: readonly Plant[]): SearchEntry[] {
  let searchIndex = searchIndexes.get(plants);
  if (!searchIndex) {
    searchIndex = plants.map((plant) => ({
      suggestion: {
        PLANT_ID: plant.PLANT_ID,
        NAME: plant.NAME,
        COMMON_NAME: plant.COMMON_NAME,
        FAMILY: plant.FAMILY,
      },
      names: [plant.NAME, plant.COMMON_NAME]
        .filter((name): name is string => typeof name === "string")
        .map(normalizePlantText),
    }));
    searchIndexes.set(plants, searchIndex);
  }
  return searchIndex;
}

export function getPlantSuggestions(plants: readonly Plant[], query: string): PlantSuggestion[] {
  const normalizedQuery = normalizePlantText(query);
  if (normalizedQuery.length < 2) return [];

  const exact: PlantSuggestion[] = [];
  const prefix: PlantSuggestion[] = [];
  const substring: PlantSuggestion[] = [];

  // Each bucket retains catalog order; every plant belongs to its best match.
  for (const { suggestion, names } of getSearchIndex(plants)) {
    if (names.some((name) => name === normalizedQuery)) {
      exact.push(suggestion);
    } else if (names.some((name) => name.startsWith(normalizedQuery))) {
      prefix.push(suggestion);
    } else if (names.some((name) => name.includes(normalizedQuery))) {
      substring.push(suggestion);
    }
  }

  return [...exact, ...prefix, ...substring].slice(0, 6);
}
