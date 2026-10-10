import plantRecords from "@/public/datasets/plants.json";
import type { Plant } from "@/types/Plant";

const plants: Plant[] = plantRecords;
const plantsById = new Map(plants.map((plant) => [plant.PLANT_ID, plant]));

export function getCatalogPlants(): Plant[] {
  return plants;
}

export function getCatalogPlant(id: string): Plant | undefined {
  return plantsById.get(id);
}
