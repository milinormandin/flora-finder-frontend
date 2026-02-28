// app/api/plants/route.ts (App Router)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/plants - Get all plants
export async function GET(req: NextRequest) {
  try {
    const plants = await prisma.plant.findMany({
      take: 10,
      where: {
        NOT: {
          EARLY_HAWAIIAN_USE: null
        }
      }
    });
    return NextResponse.json(plants, { status: 200 });
  } catch (error) {
    console.error("Error fetching plants:", error);
    return NextResponse.json(
      { message: "Failed to fetch plants" },
      { status: 500 }
    );
  }
}
