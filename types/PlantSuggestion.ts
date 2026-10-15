import type { Plant } from "@/types/Plant";

export type PlantSuggestion = Pick<
  Plant,
  "PLANT_ID" | "NAME" | "COMMON_NAME" | "FAMILY"
>;
