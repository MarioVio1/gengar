import { NextRequest, NextResponse } from "next/server";

// All available catalogs
const ALL_CATALOGS = [
  { id: "trending", name: "🔥 Trending della Settimana" },
  { id: "top_rated", name: "🧠 Top Rated (Consigliati AI)" },
  { id: "hidden_gems", name: "🍿 Hidden Gems" },
  { id: "now_playing", name: "🎬 Al Cinema Ora" },
  { id: "upcoming", name: "📅 Prossimamente" },
  { id: "best_80s", name: "📼 Best of '80s" },
  { id: "best_90s", name: "📼 Best of '90s" },
  { id: "best_2000s", name: "💿 Best of 2000s" },
  { id: "best_2010s", name: "📱 Best of 2010s" },
  { id: "best_2020s", name: "🎬 Best of 2020s" },
  { id: "random_night", name: "🎲 Random Movie Night" },
];

// Stremio Addon Manifest - Dynamic based on selected catalogs
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const catalogsParam = searchParams.get("catalogs");
  
  // Parse selected catalogs from query param
  let selectedIds: string[] = [];
  if (catalogsParam) {
    selectedIds = catalogsParam.split(",").filter(id => 
      ALL_CATALOGS.some(c => c.id === id)
    );
  }
  
  // If no catalogs selected, use all
  if (selectedIds.length === 0) {
    selectedIds = ALL_CATALOGS.map(c => c.id);
  }
  
  // Filter catalogs based on selection
  const catalogs = ALL_CATALOGS
    .filter(c => selectedIds.includes(c.id))
    .map(c => ({
      type: "movie",
      id: c.id,
      name: c.name,
      extra: [{ name: "skip", isRequired: false }],
    }));

  // Add extra fields for random_night
  const randomNightCatalog = catalogs.find(c => c.id === "random_night");
  if (randomNightCatalog) {
    randomNightCatalog.extra = [
      { name: "skip", isRequired: false },
      { name: "genre", isRequired: false },
      { name: "year", isRequired: false },
    ];
  }

  const manifest = {
    id: "it.stremiodiscovery.addon",
    version: "2.1.0",
    name: "Stremio Discovery ITA",
    description: "Cataloghi italiani con tutto il database TMDB: Trending, Top Rated, Best of Decade, Hidden Gems e Random Movie Night!",
    logo: "https://www.stremio.com/website/stremio-logo-small.png",
    background: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920",
    types: ["movie"],
    catalogs,
    resources: ["catalog"],
    idPrefixes: ["tt"],
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
      adult: false,
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
