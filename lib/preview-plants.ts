import type { Plant } from "@/types/Plant";

const sampleNote =
  "UI preview fixture. Descriptions, ranges, and status labels are sample content, not verified botanical guidance.";
const starrCredit = "Forest & Kim Starr · Wikimedia Commons · CC BY 3.0";

export const previewPlants: Plant[] = [
  {
    PLANT_ID: "preview-ohia",
    NAME: "Metrosideros polymorpha",
    COMMON_NAME: "ʻŌhiʻa lehua",
    FAMILY: "Myrtaceae",
    NAME_NOTE: sampleNote,
    PHOTOS_FLAT: "/preview/ohia-flowers.jpg**/preview/ohia-leaves.jpg",
    PHOTOS_ATTRIBUTION_FLAT:
      `Forest & Kim Starr · Wikimedia Commons · Public domain**${starrCredit}`,
    CONSERVATION_STATUS: "Least Concern",
    CONSERVATION_STATUS_NOTE: sampleNote,
    NATIVE_STATUS: "Sample native status",
    NATURAL_RANGE: "Sample island range",
    GENERAL_INFORMATION:
      "Sample text for the UI preview. This entry demonstrates a complete field-guide page with two credited photographs, a clear scientific name, and supporting information. The writing here is layout content rather than verified information about the species.\n\nA second paragraph gives the page enough reading depth to review line length, spacing, and the relationship between photography and text on both a phone and a larger screen.",
    ADDITIONAL_HABITAT_INFORMATION:
      "Sample habitat text. A verified account of growing conditions and habitat will appear here when the botanical database is available.",
    MODERN_USE:
      "Sample modern-use text for reviewing the information accordion. No practical or medicinal advice is provided by this preview.",
    EARLY_HAWAIIAN_USE:
      "Sample cultural-information text. Verified, appropriately sourced information will appear here when the botanical database is available.",
  },
  {
    PLANT_ID: "preview-hibiscus",
    NAME: "Hibiscus brackenridgei",
    COMMON_NAME: "Maʻo hau hele",
    FAMILY: "Malvaceae",
    NAME_NOTE: sampleNote,
    PHOTOS_FLAT: "/preview/hibiscus-flower.jpg",
    PHOTOS_ATTRIBUTION_FLAT: "KarlM · Wikimedia Commons · CC BY-SA 3.0",
    CONSERVATION_STATUS: "Endangered",
    CONSERVATION_STATUS_NOTE: sampleNote,
    NATIVE_STATUS: "Sample native status",
    NATURAL_RANGE: "Sample island range",
    GENERAL_INFORMATION:
      "Sample text for the UI preview. This entry demonstrates a flowering specimen, a longer common name, and a sample conservation label. These labels are included to review the interface and are not a current conservation assessment.",
    ADDITIONAL_HABITAT_INFORMATION:
      "Sample habitat text. The production record will supply verified habitat information.",
    MODERN_USE: null,
    EARLY_HAWAIIAN_USE: null,
  },
  {
    PLANT_ID: "preview-amau",
    NAME: "Sadleria cyatheoides",
    COMMON_NAME: "ʻAmaʻu",
    FAMILY: "Blechnaceae",
    NAME_NOTE: sampleNote,
    PHOTOS_FLAT: "/preview/amau-fronds.jpg",
    PHOTOS_ATTRIBUTION_FLAT: starrCredit,
    CONSERVATION_STATUS: null,
    NATIVE_STATUS: null,
    NATURAL_RANGE: "Sample island range",
    GENERAL_INFORMATION:
      "Sample text for the UI preview. This entry demonstrates a fern photograph and a partially populated record. Missing fields should remain readable without adding empty panels.",
    ADDITIONAL_HABITAT_INFORMATION: null,
    MODERN_USE: null,
    EARLY_HAWAIIAN_USE: null,
  },
  {
    PLANT_ID: "preview-koa",
    NAME: "Acacia koa",
    COMMON_NAME: "Koa",
    FAMILY: "Fabaceae",
    NAME_NOTE: sampleNote,
    PHOTOS_FLAT: "/preview/koa-leaves.jpg",
    PHOTOS_ATTRIBUTION_FLAT: "David Eickhoff · Wikimedia Commons · CC BY 2.0",
    CONSERVATION_STATUS: "Vulnerable",
    CONSERVATION_STATUS_NOTE: sampleNote,
    GENERAL_INFORMATION:
      "Sample text for the UI preview. This record is intentionally brief so the layout can be reviewed with a small amount of supporting information.",
  },
  {
    PLANT_ID: "preview-aalii",
    NAME: "Dodonaea viscosa",
    COMMON_NAME: "ʻAʻaliʻi",
    FAMILY: "Sapindaceae",
    NAME_NOTE: sampleNote,
    PHOTOS_FLAT: "/preview/aalii-leaves.jpg",
    PHOTOS_ATTRIBUTION_FLAT: "David Eickhoff · Wikimedia Commons · CC BY 2.0",
    CONSERVATION_STATUS: "Not assessed",
    CONSERVATION_STATUS_NOTE: sampleNote,
    GENERAL_INFORMATION:
      "Sample text for the UI preview. This entry provides another photograph and a short descriptive paragraph for checking the catalog grid.",
    ADDITIONAL_HABITAT_INFORMATION:
      "Sample habitat text. This paragraph is intentionally longer to show how an expanded information section behaves with several lines of text. It is demonstration copy and does not describe verified habitat, distribution, or growing requirements.",
  },
  {
    PLANT_ID: "preview-sparse",
    NAME: null,
    COMMON_NAME:
      "Sample specimen with a deliberately long name for checking small-screen layouts",
    FAMILY: null,
    NAME_NOTE: sampleNote,
    PHOTOS_FLAT: null,
    PHOTOS_ATTRIBUTION_FLAT: null,
    CONSERVATION_STATUS: null,
    NATIVE_STATUS: null,
    NATURAL_RANGE: null,
    GENERAL_INFORMATION: null,
    ADDITIONAL_HABITAT_INFORMATION: null,
    MODERN_USE: null,
    EARLY_HAWAIIAN_USE: null,
  },
];

export const previewSavedPlantIds = ["preview-hibiscus", "preview-amau"];
