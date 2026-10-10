import { NextResponse } from "next/server";
import { getCatalogPlants } from "@/lib/plant-catalog";

// GET /api/plants - Get all plants
export async function GET() {
  try {
    return NextResponse.json(getCatalogPlants(), { status: 200 });
  } catch (error) {
    console.error("Error fetching plants:", error);
    return NextResponse.json(
      { message: "Failed to fetch plants" },
      { status: 500 }
    );
  }
}
