import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

// Save a random generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, genre, year, movieIds } = body;

    if (!userId || !movieIds) {
      return NextResponse.json({ error: "userId and movieIds required" }, { status: 400 });
    }

    const generation = await db.randomGeneration.create({
      data: {
        userId,
        genre: genre || null,
        year: year || null,
        movieIds: JSON.stringify(movieIds),
      },
    });

    return NextResponse.json({
      success: true,
      generationId: generation.id,
    });
  } catch (error) {
    console.error("Error saving random generation:", error);
    return NextResponse.json({ error: "Failed to save generation" }, { status: 500 });
  }
}

// Get user's random generations
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const generations = await db.randomGeneration.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const results = await Promise.all(
      generations.map(async (gen) => {
        const movieIds: number[] = JSON.parse(gen.movieIds);
        
        // Fetch movie details for each ID
        const movies = await Promise.all(
          movieIds.slice(0, 12).map(async (tmdbId) => {
            try {
              const url = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
              url.searchParams.set("api_key", TMDB_API_KEY);
              url.searchParams.set("language", "it-IT");
              
              const res = await fetch(url.toString());
              const data = await res.json();
              
              return {
                id: `tmdb${data.id}`,
                name: data.title,
                poster: data.poster_path 
                  ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
                  : null,
                year: data.release_date?.split("-")[0],
                rating: data.vote_average?.toFixed(1),
              };
            } catch {
              return null;
            }
          })
        );

        return {
          id: gen.id,
          genre: gen.genre,
          year: gen.year,
          movies: movies.filter(Boolean),
          createdAt: gen.createdAt,
        };
      })
    );

    return NextResponse.json({ generations: results });
  } catch (error) {
    console.error("Error fetching generations:", error);
    return NextResponse.json({ error: "Failed to fetch generations" }, { status: 500 });
  }
}
