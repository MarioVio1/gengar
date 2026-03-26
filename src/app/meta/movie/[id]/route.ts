import { NextRequest, NextResponse } from "next/server";
import { parseERDBConfig, applyERDBTransform } from "@/lib/erdb";

const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const genreMap: Record<number, string> = {
  28: "Azione", 12: "Avventura", 16: "Animazione", 35: "Commedia",
  80: "Crimine", 99: "Documentario", 18: "Drammatico", 10751: "Famiglia",
  14: "Fantastico", 36: "Storico", 27: "Horror", 10402: "Musica",
  9648: "Mistero", 10749: "Romantico", 878: "Fantascienza",
  53: "Thriller", 10752: "Guerra", 37: "Western",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Get ERDB config from query params
  const url = new URL(request.url);
  const erdbParam = url.searchParams.get("e");
  const erdbConfig = parseERDBConfig(erdbParam);
  
  // Extract TMDB ID from the format "tmdb12345"
  const tmdbId = id.replace(".json", "").replace("tmdb", "");
  
  if (!tmdbId || isNaN(parseInt(tmdbId))) {
    return NextResponse.json({ meta: null }, { status: 400, headers: corsHeaders });
  }

  try {
    const tmdbUrl = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
    tmdbUrl.searchParams.set("api_key", TMDB_API_KEY);
    tmdbUrl.searchParams.set("language", "it-IT");
    tmdbUrl.searchParams.set("append_to_response", "credits,videos");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(tmdbUrl.toString(), {
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return NextResponse.json({ meta: null }, { status: 404, headers: corsHeaders });
    }
    
    const movie = await response.json();
    
    const genres = movie.genres?.map((g: { id: number; name: string }) => genreMap[g.id] || g.name).filter(Boolean);
    
    // Get trailer
    const trailer = movie.videos?.results?.find(
      (v: { type: string; site: string; key: string }) => 
        v.type === "Trailer" && v.site === "YouTube"
    );

    let meta: {
      id: string;
      type: string;
      name: string;
      poster: string | null;
      background: string | null;
      description: string;
      releaseInfo: string;
      imdbRating: string;
      genres?: string[];
      runtime?: string;
      country?: string;
      director?: string;
      cast?: string[];
      trailer?: string;
    } = {
      id: `tmdb${movie.id}`,
      type: "movie",
      name: movie.title,
      poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
      background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
      description: movie.overview,
      releaseInfo: movie.release_date?.split("-")[0] || "",
      imdbRating: movie.vote_average?.toFixed(1),
      genres: genres?.length > 0 ? genres : undefined,
      runtime: movie.runtime ? `${movie.runtime} min` : undefined,
      country: movie.production_countries?.[0]?.name,
      director: movie.credits?.crew?.find((c: { job: string }) => c.job === "Director")?.name,
      cast: movie.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
      trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    };

    // Apply ERDB transformation if configured
    if (erdbConfig.enabled) {
      meta = applyERDBTransform(meta, "movie", erdbConfig) as typeof meta;
    }

    return NextResponse.json({ meta }, { headers: corsHeaders });
  } catch (error) {
    console.error("TMDB meta error:", error);
    return NextResponse.json({ meta: null }, { status: 500, headers: corsHeaders });
  }
}
