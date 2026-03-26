import { NextRequest, NextResponse } from "next/server";

const KITSU_BASE_URL = "https://kitsu.io/api/edge";

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
  
  // Extract Kitsu ID from the format "kitsu:12345"
  const kitsuId = id.replace(".json", "").replace("kitsu:", "");
  
  if (!kitsuId || isNaN(parseInt(kitsuId))) {
    return NextResponse.json({ meta: null }, { status: 400, headers: corsHeaders });
  }

  try {
    const url = new URL(`${KITSU_BASE_URL}/anime/${kitsuId}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url.toString(), {
      headers: { 
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return NextResponse.json({ meta: null }, { status: 404, headers: corsHeaders });
    }
    
    const data = await response.json();
    const anime = data.data;
    const attrs = anime.attributes;
    
    // Build videos list for episodes
    const videos = [];
    const episodeCount = attrs.episodeCount || attrs.episodes?.length || 0;
    
    for (let i = 1; i <= Math.min(episodeCount, 100); i++) {
      videos.push({
        id: `kitsu:${kitsuId}:1:${i}`,
        title: attrs.titles?.en || attrs.titles?.en_jp || attrs.canonicalTitle || `Episodio ${i}`,
        season: 1,
        episode: i,
        released: attrs.startDate || undefined,
      });
    }

    const meta = {
      id: `kitsu:${kitsuId}`,
      type: "anime",
      name: attrs.titles?.en || attrs.titles?.en_jp || attrs.canonicalTitle || "Unknown",
      poster: attrs.posterImage?.large || attrs.posterImage?.medium || attrs.posterImage?.original,
      background: attrs.coverImage?.large || attrs.coverImage?.original || null,
      description: attrs.synopsis,
      releaseInfo: attrs.startDate?.split("-")[0] || "",
      imdbRating: attrs.averageRating ? (parseFloat(attrs.averageRating) / 10).toFixed(1) : undefined,
      genres: attrs.categories?.slice(0, 3) || [],
      status: attrs.status,
      episodes: attrs.episodeCount,
      videos: videos.length > 0 ? videos : undefined,
      trailer: attrs.youtubeVideoId ? `https://www.youtube.com/watch?v=${attrs.youtubeVideoId}` : undefined,
    };

    return NextResponse.json({ meta }, { headers: corsHeaders });
  } catch (error) {
    console.error("Kitsu meta error:", error);
    return NextResponse.json({ meta: null }, { status: 500, headers: corsHeaders });
  }
}
