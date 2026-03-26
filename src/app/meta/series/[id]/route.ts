import { NextRequest, NextResponse } from "next/server";
import { parseERDBConfig, applyERDBTransform } from "@/lib/erdb";

const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const genreMap: Record<number, string> = {
  10759: "Azione & Avventura", 16: "Animazione", 35: "Commedia",
  80: "Crimine", 99: "Documentario", 18: "Drammatico", 10751: "Famiglia",
  10762: "Kids", 9648: "Mistero", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics", 37: "Western",
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
    const tmdbUrl = new URL(`${TMDB_BASE_URL}/tv/${tmdbId}`);
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
    
    const show = await response.json();
    
    const genres = show.genres?.map((g: { id: number; name: string }) => genreMap[g.id] || g.name).filter(Boolean);
    
    // Get trailer
    const trailer = show.videos?.results?.find(
      (v: { type: string; site: string; key: string }) => 
        v.type === "Trailer" && v.site === "YouTube"
    );
    
    // Build videos list for Stremio
    const videos = [];
    if (show.seasons) {
      for (const season of show.seasons) {
        // Skip season 0 (specials) if no episodes
        if (season.season_number === 0 && season.episode_count === 0) continue;
        
        // Get season details
        try {
          const seasonUrl = new URL(`${TMDB_BASE_URL}/tv/${tmdbId}/season/${season.season_number}`);
          seasonUrl.searchParams.set("api_key", TMDB_API_KEY);
          seasonUrl.searchParams.set("language", "it-IT");
          
          const seasonResponse = await fetch(seasonUrl.toString(), {
            headers: { "Accept": "application/json" },
            cache: "no-store",
          });
          
          if (seasonResponse.ok) {
            const seasonData = await seasonResponse.json();
            
            for (const episode of (seasonData.episodes || [])) {
              videos.push({
                id: `${show.id}:${season.season_number}:${episode.episode_number}`,
                title: episode.name || `Episodio ${episode.episode_number}`,
                season: season.season_number,
                episode: episode.episode_number,
                released: episode.air_date ? new Date(episode.air_date).toISOString() : undefined,
                overview: episode.overview,
                thumbnail: episode.still_path ? `https://image.tmdb.org/t/p/w500${episode.still_path}` : undefined,
              });
            }
          }
        } catch {
          // Skip season on error
        }
      }
    }

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
      country?: string;
      status?: string;
      seasons?: number;
      episodes?: number;
      videos?: typeof videos;
      trailer?: string;
    } = {
      id: `tmdb${show.id}`,
      type: "series",
      name: show.name,
      poster: show.poster_path ? `${TMDB_IMAGE_BASE}${show.poster_path}` : null,
      background: show.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : null,
      description: show.overview,
      releaseInfo: show.first_air_date?.split("-")[0] || "",
      imdbRating: show.vote_average?.toFixed(1),
      genres: genres?.length > 0 ? genres : undefined,
      country: show.origin_country?.[0],
      status: show.status,
      seasons: show.number_of_seasons,
      episodes: show.number_of_episodes,
      videos: videos.length > 0 ? videos : undefined,
      trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
    };

    // Apply ERDB transformation if configured
    if (erdbConfig.enabled) {
      meta = applyERDBTransform(meta, "series", erdbConfig) as typeof meta;
    }

    return NextResponse.json({ meta }, { headers: corsHeaders });
  } catch (error) {
    console.error("TMDB TV meta error:", error);
    return NextResponse.json({ meta: null }, { status: 500, headers: corsHeaders });
  }
}
