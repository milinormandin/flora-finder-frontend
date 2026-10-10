import { NextRequest, NextResponse } from "next/server";
import { getCatalogPlants } from "@/lib/plant-catalog";
import type { PlantPage } from "@/types/PlantPage";

// GET /api/plants - Get all plants, or a page when offset or limit is supplied.
export async function GET(request: NextRequest) {
  try {
    const plants = getCatalogPlants();
    const { searchParams } = request.nextUrl;

    if (!searchParams.has("offset") && !searchParams.has("limit")) {
      return NextResponse.json(plants, { status: 200 });
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
