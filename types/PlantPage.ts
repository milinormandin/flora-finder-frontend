import type { Plant } from "@/types/Plant";

export interface PlantPage {
  plants: Plant[];
  total: number;
  nextOffset: number | null;
}
