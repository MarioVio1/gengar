import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Get or create user addon config
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    let userAddon = await db.userAddon.findUnique({
      where: { userId },
    });

    // Create default config if not exists
    if (!userAddon) {
      const defaultCatalogs = [
        "trending", "top_rated", "hidden_gems", "now_playing", 
        "upcoming", "best_80s", "best_90s", "best_2000s", 
        "best_2010s", "best_2020s", "random_night"
      ].join(",");
      
      userAddon = await db.userAddon.create({
        data: {
          userId,
          catalogs: defaultCatalogs,
        },
      });
    }

    return NextResponse.json({
      userId: userAddon.userId,
      catalogs: userAddon.catalogs.split(","),
      randomNight: userAddon.randomNight ? JSON.parse(userAddon.randomNight) : null,
    });
  } catch (error) {
    console.error("Error fetching user config:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

// Update user addon config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, catalogs, randomNight } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const updateData: {
      catalogs: string;
      randomNight?: string;
    } = {
      catalogs: catalogs?.join(",") || "",
    };

    if (randomNight) {
      updateData.randomNight = JSON.stringify(randomNight);
    }

    const userAddon = await db.userAddon.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        ...updateData,
      },
    });

    return NextResponse.json({
      success: true,
      userId: userAddon.userId,
      catalogs: userAddon.catalogs.split(","),
    });
  } catch (error) {
    console.error("Error updating user config:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
