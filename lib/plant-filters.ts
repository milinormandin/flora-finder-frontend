import { getPlantName } from "@/lib/plant-presentation";
import { normalizePlantText } from "@/lib/plant-text";
import type { Plant } from "@/types/Plant";

export const plantIslands = [
  { id: "niihau", label: "Niʻihau" },
  { id: "kauai", label: "Kauaʻi" },
  { id: "oahu", label: "Oʻahu" },
  { id: "molokai", label: "Molokaʻi" },
  { id: "lanai", label: "Lānaʻi" },
  { id: "maui", label: "Maui" },
  { id: "kahoolawe", label: "Kahoʻolawe" },
  { id: "hawaii", label: "Hawaiʻi" },
  { id: "northwestern-islands", label: "Northwestern Islands" },
] as const;

export type PlantIsland = (typeof plantIslands)[number]["id"];

export type PlantFilters = {
  letter?: string;
  island?: PlantIsland | "unrecorded";
};

const rangeTokenByIsland = new Map<PlantIsland, string>(
  plantIslands.map((island) => [
    island.id,
    island.id === "northwestern-islands"
      ? "northwest islands"
      : normalizePlantText(island.label),
  ])
);

export function filterCatalogPlants(plants: Plant[], filters: PlantFilters): Plant[] {
  const letter = filters.letter ? normalizePlantText(filters.letter) : undefined;
  const island = filters.island;

  return plants.filter((plant) => {
    if (letter && normalizePlantText(getPlantName(plant))[0] !== letter) {
      return false;
    }

    if (!island) return true;
    const range = plant.NATURAL_RANGE?.trim();
    if (island === "unrecorded") return !range;
    if (!range) return false;

    const islandToken = rangeTokenByIsland.get(island);
    return range.split(",").some((token) => normalizePlantText(token) === islandToken);
  });
}
