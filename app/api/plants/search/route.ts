import { NextRequest, NextResponse } from "next/server";
import { getPlantSuggestions } from "@/lib/plant-search";

// GET /api/plants/search?q=... - Get lightweight plant name suggestions.
export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get("q") ?? "";
    if (query.length > 100) {
      return NextResponse.json(
        { message: "Search query must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    return NextResponse.json(getPlantSuggestions(query), { status: 200 });
  } catch (error) {
    console.error("Error searching plants:", error);
    return NextResponse.json(
      { message: "Failed to search plants" },
      { status: 500 }
    );
  }
}
