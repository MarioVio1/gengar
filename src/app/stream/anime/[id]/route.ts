import { NextRequest, NextResponse } from "next/server";

const KITSU_BASE_URL = "https://kitsu.io/api/edge";

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
  
  // Extract Kitsu ID from the format "kitsu:12345:season:episode"
  const idParts = id.replace(".json", "").split(":");
  const kitsuId = idParts[0].replace("kitsu", "") || idParts[1];
  const season = idParts[2] ? parseInt(idParts[2]) : 1;
  const episode = idParts[3] ? parseInt(idParts[3]) : 1;
  
  if (!kitsuId || isNaN(parseInt(kitsuId))) {
    return NextResponse.json({ streams: [] }, { headers: corsHeaders });
  }

  try {
    // Get anime info
    const kitsuUrl = new URL(`${KITSU_BASE_URL}/anime/${kitsuId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(kitsuUrl.toString(), {
      headers: { 
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return NextResponse.json({ streams: [] }, { headers: corsHeaders });
    }
    
    const data = await response.json();
    const anime = data.data;
    const attrs = anime.attributes;
    
    const streams: Array<{
      name: string;
      title: string;
      externalUrl?: string;
      behaviorHints?: { notWebReady?: boolean };
    }> = [];
    
    const title = attrs.titles?.en || attrs.titles?.en_jp || attrs.canonicalTitle || "Unknown";
    const episodeStr = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
    
    // 1. Top Streaming API (if key provided)
    if (topStreamingKey) {
      try {
        const tsUrl = new URL("https://api.top-streaming.stream/api/search/anime");
        tsUrl.searchParams.set("api_key", topStreamingKey);
        tsUrl.searchParams.set("kitsu_id", kitsuId);
        tsUrl.searchParams.set("title", title);
        tsUrl.searchParams.set("episode", String(episode));
        
        const tsResponse = await fetch(tsUrl.toString(), {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(8000),
        });
        
        if (tsResponse.ok) {
          const tsData = await tsResponse.json();
          
          if (tsData.streams && Array.isArray(tsData.streams)) {
            for (const stream of tsData.streams) {
              streams.push({
                name: "🎬 TopStream",
                title: `${title} ${episodeStr} - ${stream.quality || "HD"}`,
                externalUrl: stream.url,
                behaviorHints: { notWebReady: true },
              });
            }
          }
        }
      } catch (e) {
        console.log("Top Streaming API error:", e);
      }
    }
    
    // 2. Kitsu link
    streams.push({
      name: "🎌 Kitsu",
      title: `${title} - Info su Kitsu`,
      externalUrl: `https://kitsu.io/anime/${kitsuId}`,
      behaviorHints: { notWebReady: true },
    });
    
    // 3. MyAnimeList link (if available)
    if (attrs.myanimelistId) {
      streams.push({
        name: "📺 MAL",
        title: `${title} - MyAnimeList`,
        externalUrl: `https://myanimelist.net/anime/${attrs.myanimelistId}`,
        behaviorHints: { notWebReady: true },
      });
    }
    
    // 4. Trailer if available
    if (attrs.youtubeVideoId) {
      streams.push({
        name: "▶️ YouTube",
        title: `Trailer: ${title}`,
        externalUrl: `https://www.youtube.com/watch?v=${attrs.youtubeVideoId}`,
        behaviorHints: { notWebReady: true },
      });
    }
    
    // 5. Crunchyroll search
    streams.push({
      name: "🔴 Crunchyroll",
      title: `${title} ${episodeStr} - Cerca su Crunchyroll`,
      externalUrl: `https://www.crunchyroll.com/search?q=${encodeURIComponent(title)}`,
      behaviorHints: { notWebReady: true },
    });

    return NextResponse.json({ streams }, { headers: corsHeaders });
  } catch (error) {
    console.error("Anime stream error:", error);
    return NextResponse.json({ streams: [] }, { headers: corsHeaders });
  }
}
