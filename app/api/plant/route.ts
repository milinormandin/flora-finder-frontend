import { NextRequest, NextResponse } from "next/server";
import { getCatalogPlant } from "@/lib/plant-catalog";

// GET /api/plant?plantId=123
export async function GET(req: NextRequest) {
  try {
    const plantId = req.nextUrl.searchParams.get("plantId");
    if (!plantId) {
      return NextResponse.json(
        { message: "plant_id is required" },
        { status: 400 },
      );
    }

    const plant = getCatalogPlant(plantId);
    if (!plant) {
      return NextResponse.json(
        { message: "Plant not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(plant, { status: 200 });
  } catch (error) {
    console.error("Error fetching plant:", error);
    return NextResponse.json(
      { message: "Failed to fetch plant" },
      { status: 500 },
    );
  }
}
