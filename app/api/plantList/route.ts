import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/plantListItems - Get plant list items for a user
export async function GET(req: NextRequest) {
  try {
    // Get list of plantids from list
    const plantListItems = await prisma.plant_list_item.findMany({
      where: { plant_list_id: 1 }, // you may replace 1 with dynamic user ID later
    })

    // Get plant records for the plantids from the list
    const plants = await prisma.plant.findMany({
  where: {
    PLANT_ID: {
      in: plantListItems.map(plantListItem => plantListItem.plant_id)
    }
  }
})
    return NextResponse.json(plants, { status: 200 })
  } catch (error) {
    console.error('Error fetching plantListItems:', error)
    return NextResponse.json({ message: 'Failed to fetch plantListItems' }, { status: 500 })
  }
}

// POST /api/plantListItems - Add a new plant_list_item
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { plantId } = body

    if (!plantId) {
      return NextResponse.json({ message: 'plantId is required' }, { status: 400 })
    }

    // Check if plant exists
    const plantExists = await prisma.plant.findUnique({ where: { PLANT_ID: plantId } })
    if (!plantExists) {
      return NextResponse.json({ message: 'Invalid plantId' }, { status: 400 })
    }

    // Add new plant_list_item
    const newItem = await prisma.plant_list_item.create({
      data: {
        plant_list_id: 1, // replace with dynamic user list ID if needed
        plant_id: plantId,
      },
    })

    return NextResponse.json(newItem, { status: 201 })
  } catch (error) {
    console.error('Error adding plantListItem:', error)
    return NextResponse.json({ message: 'Failed to add plantListItem' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Correct way to get query params in App Router
    const url = new URL(req.url);
    const plantId = url.searchParams.get("plantId");
    console.log(plantId)

    if (!plantId) {
      return NextResponse.json(
        { message: "plantId query param is required" },
        { status: 400 }
      );
    }

    // Check if plant exists
    const plantExists = await prisma.plant.findUnique({
      where: { PLANT_ID: plantId },
    });
    if (!plantExists) {
      return NextResponse.json({ message: "Invalid plantId" }, { status: 400 });
    }

    // Delete the item
    const deletedItem = await prisma.plant_list_item.deleteMany({
      where: { plant_list_id: 1, plant_id: plantId },
    });

    return NextResponse.json(
      { message: "Deleted successfully", deletedCount: deletedItem.count },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting plantListItem:", error);
    return NextResponse.json(
      { message: "Failed to delete plantListItem" },
      { status: 500 }
    );
  }
}