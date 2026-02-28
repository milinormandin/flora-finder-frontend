// app/api/users/route.ts (App Router)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/users - Get all users
export async function GET(req: NextRequest) {
  try {
    const users = await prisma.user.findMany()
    return NextResponse.json(users, { status: 200 })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ message: 'Failed to fetch users' }, { status: 500 })
  }
}



