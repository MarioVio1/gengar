import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Get Top Streaming API key from query params
  const url = new URL(request.url);
  const topStreamingKey = url.searchParams.get("ts");
  
  // Extract TMDB ID from the format "tmdb12345"
  const tmdbId = id.replace(".json", "").replace("tmdb", "");
  
  if (!tmdbId || isNaN(parseInt(tmdbId))) {
    return NextResponse.json({ streams: [] }, { headers: corsHeaders });
  }

  try {
    // Get movie info
    const tmdbUrl = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
    tmdbUrl.searchParams.set("api_key", TMDB_API_KEY);
    tmdbUrl.searchParams.set("language", "it-IT");
    tmdbUrl.searchParams.set("append_to_response", "videos,external_ids");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(tmdbUrl.toString(), {
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return NextResponse.json({ streams: [] }, { headers: corsHeaders });
    }
    
    const movie = await response.json();
    const streams: Array<{
      name: string;
      title: string;
      externalUrl?: string;
      behaviorHints?: { notWebReady?: boolean; proxyHeaders?: Record<string, string> };
      infoHash?: string;
      fileIdx?: number;
    }> = [];
    
    const year = movie.release_date?.split("-")[0] || "";
    const title = movie.title;
    const imdbId = movie.external_ids?.imdb_id;
    
    // 1. Top Streaming API (if key provided)
    if (topStreamingKey) {
      try {
        const tsUrl = new URL("https://api.top-streaming.stream/api/search");
        tsUrl.searchParams.set("api_key", topStreamingKey);
        tsUrl.searchParams.set("imdb_id", imdbId || `tt${movie.imdb_id || ""}`);
        tsUrl.searchParams.set("title", title);
        tsUrl.searchParams.set("year", year);
        
        const tsResponse = await fetch(tsUrl.toString(), {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        
        if (tsResponse.ok) {
          const tsData = await tsResponse.json();
          
          // Add streams from Top Streaming
          if (tsData.streams && Array.isArray(tsData.streams)) {
            for (const stream of tsData.streams) {
              streams.push({
                name: "🎬 TopStream",
                title: `${title} (${year}) - ${stream.quality || "HD"}`,
                externalUrl: stream.url,
                behaviorHints: { 
                  notWebReady: true,
                  proxyHeaders: stream.headers ? { request: stream.headers } : undefined,
                },
              });
            }
          }
        }
      } catch (e) {
        console.log("Top Streaming API error:", e);
      }
    }
    
    // 2. Add IMDb link for finding on other addons
    if (imdbId) {
      streams.push({
        name: "🔗 IMDb",
        title: `${title} (${year}) - Cerca su IMDb`,
        externalUrl: `https://www.imdb.com/title/${imdbId}`,
        behaviorHints: { notWebReady: true },
      });
    }
    
    // 3. Add TMDB link
    streams.push({
      name: "🎬 TMDB",
      title: `${title} (${year}) - Info su TMDB`,
      externalUrl: `https://www.themoviedb.org/movie/${movie.id}`,
      behaviorHints: { notWebReady: true },
    });
    
    // 4. Add trailer if available
    const trailer = movie.videos?.results?.find(
      (v: { type: string; site: string; key: string }) => 
        v.type === "Trailer" && v.site === "YouTube"
    );
    
    if (trailer) {
      streams.push({
        name: "▶️ YouTube",
        title: `Trailer: ${title}`,
        externalUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
        behaviorHints: { notWebReady: true },
      });
    }
    
    // 5. Debrid search links (for manual addon selection)
    streams.push({
      name: "🔍 Real-Debrid",
      title: `${title} (${year}) - Cerca su Real-Debrid`,
      externalUrl: `https://real-debrid.com/streaming#${imdbId || movie.id}`,
      behaviorHints: { notWebReady: true },
    });
    
    // 6. Torrentio style search (for other addons to pick up)
    if (imdbId) {
      streams.push({
        name: "📡 Aggiungi Addon",
        title: `Installa altri addon per guardare "${title}"`,
        externalUrl: `stremio:///addons`,
        behaviorHints: { notWebReady: true },
      });
    }

    return NextResponse.json({ streams }, { headers: corsHeaders });
  } catch (error) {
    console.error("Stream error:", error);
    return NextResponse.json({ streams: [] }, { headers: corsHeaders });
  }
}
