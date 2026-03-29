import { NextRequest, NextResponse } from "next/server";
import { decodeConfig } from "@/lib/config";

// Logo URL fisso - HTTPS richiesto da Stremio
const LOGO_URL = "https://iili.io/qXpzmcG.jpg";

// Genre options
const GENRE_OPTIONS = [
  "Azione", "Avventura", "Animazione", "Commedia", "Crimine",
  "Documentario", "Drammatico", "Famiglia", "Fantastico", "Storico",
  "Horror", "Musica", "Mistero", "Romantico", "Fantascienza",
  "Thriller", "Guerra", "Western",
];

const TV_GENRE_OPTIONS = [
  "Azione & Avventura", "Animazione", "Commedia", "Crimine",
  "Documentario", "Drammatico", "Famiglia", "Kids", "Mistero",
  "News", "Reality", "Sci-Fi & Fantasy", "Soap", "Talk",
  "War & Politics", "Western",
];

const ANIME_GENRE_OPTIONS = [
  "Azione", "Avventura", "Commedia", "Drammatico", "Fantastico",
  "Horror", "Mistero", "Romantico", "Fantascienza", "Slice of Life",
  "Sport", "Supernaturale", "Thriller", "Ecchi", "Mecha", "Musicale",
];

// Movie catalogs
const MOVIE_CATALOGS = [
  { id: "trending", name: "🔥 Trending" },
  { id: "top_rated", name: "💜 Top Rated" },
  { id: "now_playing", name: "🎬 Al Cinema" },
  { id: "hidden_gems", name: "💎 Hidden Gems" },
  { id: "mubi", name: "🎭 MUBI Picks" },
  { id: "award_winners", name: "🏆 Award Winners" },
  { id: "cannes", name: "🎖️ Cannes" },
  { id: "venice", name: "🦁 Venezia" },
  { id: "criterion", name: "📽️ Criterion" },
  { id: "a24", name: "🎨 A24 Films" },
  { id: "korean", name: "🇰🇷 Korean Cinema" },
  { id: "italian_classics", name: "🇮🇹 Italian Classics" },
  { id: "french_new_wave", name: "🇫🇷 French Cinema" },
  { id: "asian_horror", name: "👹 Asian Horror" },
  { id: "ghibli", name: "✨ Animation Masters" },
  { id: "midnight", name: "🌙 Midnight Movies" },
  { id: "cult", name: "💀 Cult Classics" },
  { id: "trakt_50s", name: "📽️ Anni '50" },
  { id: "trakt_70s", name: "📽️ Anni '70" },
  { id: "trakt_80s", name: "📽️ Anni '80" },
  { id: "trakt_90s", name: "📽️ Anni '90" },
  { id: "trakt_2000s", name: "💿 Anni 2000" },
  { id: "best_2010s", name: "📱 Anni 2010" },
  { id: "best_2020s", name: "🎬 Anni 2020" },
  { id: "trakt_marvel", name: "🦸 Marvel Universe" },
  { id: "trakt_top1000", name: "🏆 Top Mondiali" },
  { id: "random_night", name: "🎲 Random Night" },
];

const SERIES_CATALOGS = [
  { id: "tv_trending", name: "🔥 Trending TV" },
  { id: "tv_top_rated", name: "💜 Top Rated TV" },
  { id: "tv_on_the_air", name: "📺 In Onda" },
  { id: "tv_netflix", name: "🔴 Netflix" },
  { id: "tv_hbo", name: "🟣 HBO" },
  { id: "tv_apple", name: "🍎 Apple TV+" },
  { id: "tv_disney", name: "🏰 Disney+" },
  { id: "tv_kdrama", name: "🇰🇷 K-Drama" },
  { id: "tv_random_night", name: "🎲 Random TV" },
];

const ANIME_CATALOGS = [
  { id: "anime_trending", name: "🔥 Anime Trending" },
  { id: "anime_top", name: "💜 Top Anime" },
  { id: "anime_airing", name: "📺 In Corso" },
  { id: "anime_upcoming", name: "📅 Prossime Uscite" },
  { id: "anime_popular", name: "⭐ Più Popolari" },
  { id: "anime_action", name: "⚔️ Azione" },
  { id: "anime_romance", name: "💕 Romantico" },
  { id: "anime_horror", name: "👻 Horror" },
  { id: "anime_mystery", name: "🔍 Mistero" },
  { id: "anime_scifi", name: "🚀 Fantascienza" },
  { id: "anime_fantasy", name: "🧙 Fantastico" },
  { id: "anime_comedy", name: "😂 Commedia" },
  { id: "anime_drama", name: "🎭 Drammatico" },
  { id: "anime_mecha", name: "🤖 Mecha" },
  { id: "anime_slice_of_life", name: "🌸 Slice of Life" },
  { id: "anime_movies", name: "🎬 Film Anime" },
  { id: "anime_classics", name: "📼 Anime Classici" },
  { id: "anime_random", name: "🎲 Random Anime" },
  { id: "trakt_anime_list", name: "🎌 A Lot of Anime" },
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  const { configId } = await params;
  const config = decodeConfig(configId);
  
  // Determine content types
  const typesParam = config.t || "all";
  const includeMovies = typesParam === "all" || typesParam === "movie" || typesParam === "both";
  const includeSeries = typesParam === "all" || typesParam === "series" || typesParam === "both";
  const includeAnime = typesParam === "all" || typesParam === "anime";
  
  // Build catalogs
  const catalogs: Array<{
    type: string;
    id: string;
    name: string;
    extra: Array<{ name: string; isRequired: boolean; options?: string[] }>;
  }> = [];
  
  if (includeMovies) {
    MOVIE_CATALOGS.forEach(c => {
      catalogs.push({
        type: "movie",
        id: c.id,
        name: c.name,
        extra: [
          { name: "skip", isRequired: false },
          { name: "genre", isRequired: false, options: GENRE_OPTIONS },
        ],
      });
    });
  }
  
  if (includeSeries) {
    SERIES_CATALOGS.forEach(c => {
      catalogs.push({
        type: "series",
        id: c.id,
        name: c.name,
        extra: [
          { name: "skip", isRequired: false },
          { name: "genre", isRequired: false, options: TV_GENRE_OPTIONS },
        ],
      });
    });
  }
  
  if (includeAnime) {
    ANIME_CATALOGS.forEach(c => {
      catalogs.push({
        type: "movie",
        id: c.id,
        name: c.name,
        extra: [
          { name: "skip", isRequired: false },
          { name: "genre", isRequired: false, options: ANIME_GENRE_OPTIONS },
        ],
      });
    });
  }
  
  // Build types
  const types: string[] = [];
  if (includeMovies) types.push("movie");
  if (includeSeries) types.push("series");
  if (includeAnime) types.push("anime");
  
  // Build description
  let description = "🎬 Film, Serie TV, Anime in italiano!";
  if (config.ts) description += " ⚡ TopStreaming!";
  if (config.s) description += " 🎲 Shuffle!";
  if (config.e) description += " 🎬 ERDB!";
  
  const manifest = {
    id: "it.gengar.discovery.addon",
    version: "15.0.0",
    name: "Gengar Discovery ITA",
    description,
    logo: LOGO_URL,
    background: LOGO_URL,
    types,
    catalogs,
    resources: ["catalog", "meta", "stream"],
    idPrefixes: ["imdb", "tmdb", "kitsu", "mal", "anilist"],
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
      adult: false,
    },
    configuration: {
      root: true,
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
