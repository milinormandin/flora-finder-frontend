import { getCatalogPlants } from "@/lib/plant-catalog";
import type { PlantSuggestion } from "@/types/PlantSuggestion";

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/['\u02bb\u02bc\u2018\u2019\u201b]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const searchIndex = getCatalogPlants().map((plant) => ({
  suggestion: {
    PLANT_ID: plant.PLANT_ID,
    NAME: plant.NAME,
    COMMON_NAME: plant.COMMON_NAME,
    FAMILY: plant.FAMILY,
  } satisfies PlantSuggestion,
  names: [plant.NAME, plant.COMMON_NAME]
    .filter((name): name is string => typeof name === "string")
    .map(normalizeName),
}));

export function getPlantSuggestions(query: string): PlantSuggestion[] {
  const normalizedQuery = normalizeName(query);
  if (normalizedQuery.length < 2) return [];

  const exact: PlantSuggestion[] = [];
  const prefix: PlantSuggestion[] = [];
  const substring: PlantSuggestion[] = [];

  // Each bucket retains catalog order; every plant belongs to its best match.
  for (const { suggestion, names } of searchIndex) {
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
