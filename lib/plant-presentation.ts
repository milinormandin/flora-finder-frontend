import type { Plant } from "@/types/Plant";

export type PlantPhoto = {
  src: string;
  attribution?: string;
};

export function getPlantName(plant: Plant): string {
  return plant.NAME?.trim() || plant.COMMON_NAME?.trim() || "Unnamed plant";
}

export function getPlantPhotos(plant: Plant): PlantPhoto[] {
  const photos = plant.PHOTOS_FLAT?.split("*") ?? [];
  const attributions = plant.PHOTOS_ATTRIBUTION_FLAT?.split("*") ?? [];

  return photos.flatMap((photo, index) => {
    const src = photo.trim();
    if (!src) return [];
    const attribution = attributions[index]?.trim();
    return [{ src, ...(attribution ? { attribution } : {}) }];
  });
}
