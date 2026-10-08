export interface Plant {
  PLANT_ID: string;
  NAME?: string | null;
  FAMILY?: string | null;
  CONSERVATION_STATUS?: string | null;
  NATIVE_STATUS?: string | null;
  NAME_NOTE?: string | null;
  CONSERVATION_STATUS_NOTE?: string | null;
  NATIVE_STATUS_NOTE?: string | null;
  SHAPEFILE_PATH?: string | null;
  INAT_TAXA_ID?: string | null;
  PHOTOS_FLAT?: string | null;
  PHOTOS_ATTRIBUTION_FLAT?: string | null;
  PLANT_FORM_GROWTH_HABIT?: string | null;
  FLOWER_TYPE?: string | null;
  PEST_AND_DISEASE_INFORMATION?: string | null;
  NATURAL_RANGE?: string | null;
  NATURAL_ZONES_ELEVATION_IN_FEET_RAINFALL_IN_INCHES?: string | null;
  HABITAT?: string | null;
  ADDITIONAL_HABITAT_INFORMATION?: string | null;
  EARLY_HAWAIIAN_USE?: string | null;
  MODERN_USE?: string | null;
  GENERAL_INFORMATION?: string | null;
  COMMON_NAME?: string | null;
}
