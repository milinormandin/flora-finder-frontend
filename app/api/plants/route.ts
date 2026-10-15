import { NextRequest, NextResponse } from "next/server";
import { getCatalogPlants } from "@/lib/plant-catalog";
import { filterCatalogPlants, plantIslands, type PlantFilters } from "@/lib/plant-filters";
import { normalizePlantText } from "@/lib/plant-text";
import type { PlantPage } from "@/types/PlantPage";

// GET /api/plants - Get all plants, or a page with optional letter/island filters.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    if (!["offset", "limit", "letter", "island"].some((key) => searchParams.has(key))) {
      return NextResponse.json(getCatalogPlants(), { status: 200 });
    }

    const rawLetter = searchParams.get("letter");
    const letter = rawLetter ? normalizePlantText(rawLetter) : undefined;
    if (rawLetter && !/^[a-z]$/.test(letter ?? "")) {
      return NextResponse.json(
        { message: "letter must be a single letter from A to Z" },
        { status: 400 }
      );
    }

    const rawIsland = searchParams.get("island");
    if (
      rawIsland !== null &&
      rawIsland !== "unrecorded" &&
      !plantIslands.some((island) => island.id === rawIsland)
    ) {
      return NextResponse.json(
        { message: "island must be a supported island or unrecorded" },
        { status: 400 }
      );
    }

    const rawOffset = searchParams.get("offset") ?? "0";
    const rawLimit = searchParams.get("limit") ?? "24";
    const offset = Number(rawOffset);
    const limit = Number(rawLimit);

    if (
      !/^\d+$/.test(rawOffset) ||
      !Number.isSafeInteger(offset) ||
      !/^\d+$/.test(rawLimit) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return NextResponse.json(
        {
          message:
            "offset must be a nonnegative safe integer and limit must be an integer from 1 to 100",
        },
        { status: 400 }
      );
    }

    const plants = filterCatalogPlants(getCatalogPlants(), {
      letter,
      island: rawIsland === null ? undefined : rawIsland as PlantFilters["island"],
    });
    const pagePlants = plants.slice(offset, offset + limit);
    const nextOffset = offset + pagePlants.length;
    const page: PlantPage = {
      plants: pagePlants,
      total: plants.length,
      nextOffset: nextOffset < plants.length ? nextOffset : null,
    };

    return NextResponse.json(page, { status: 200 });
  } catch (error) {
    console.error("Error fetching plants:", error);
    return NextResponse.json(
      { message: "Failed to fetch plants" },
      { status: 500 }
    );
  }
}
