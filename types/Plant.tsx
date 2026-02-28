export interface Plant {
  PLANT_ID: string;
  NAME?: string;
  FAMILY?: string;
  CONSERVATION_STATUS?: string;
  NATIVE_STATUS?: string;
  NAME_NOTE?: string;
  CONSERVATION_STATUS_NOTE?: string;
  NATIVE_STATUS_NOTE?: string;
  SHAPEFILE_PATH?: string;
  INAT_TAXA_ID?: string;
  PHOTOS_FLAT?: string;
  PHOTOS_ATTRIBUTION_FLAT?: string;
  PLANT_FORM_GROWTH_HABIT?: string;
  FLOWER_TYPE?: string;
  PEST_AND_DISEASE_INFORMATION?: string;
  NATURAL_RANGE?: string;
  NATURAL_ZONES_ELEVATION_IN_FEET_RAINFALL_IN_INCHES?: string;
  HABITAT?: string;
  ADDITIONAL_HABITAT_INFORMATION?: string;
  EARLY_HAWAIIAN_USE?: string;
  MODERN_USE?: string;
  GENERAL_INFORMATION?: string;
  COMMON_NAME?: string;
}