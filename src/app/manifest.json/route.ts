import { NextRequest, NextResponse } from "next/server";

// Genre options for Stremio subcategories
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
  { id: "trending", name: "🔥 Trending", genres: true },
  { id: "top_rated", name: "💜 Top Rated", genres: true },
  { id: "now_playing", name: "🎬 Al Cinema", genres: true },
  { id: "hidden_gems", name: "💎 Hidden Gems", genres: true },
  { id: "mubi", name: "🎭 MUBI Picks", genres: true },
  { id: "award_winners", name: "🏆 Award Winners", genres: true },
  { id: "cannes", name: "🎖️ Cannes", genres: true },
  { id: "venice", name: "🦁 Venezia", genres: true },
  { id: "criterion", name: "📽️ Criterion", genres: true },
  { id: "a24", name: "🎨 A24 Films", genres: true },
  { id: "korean", name: "🇰🇷 Korean Cinema", genres: true },
  { id: "italian_classics", name: "🇮🇹 Italian Classics", genres: true },
  { id: "french_new_wave", name: "🇫🇷 French Cinema", genres: true },
  { id: "asian_horror", name: "👹 Asian Horror", genres: false },
  { id: "ghibli", name: "✨ Animation Masters", genres: false },
  { id: "midnight", name: "🌙 Midnight Movies", genres: true },
  { id: "cult", name: "💀 Cult Classics", genres: true },
  { id: "trakt_50s", name: "📽️ Anni '50", genres: false },
  { id: "trakt_70s", name: "📽️ Anni '70", genres: false },
  { id: "trakt_80s", name: "📽️ Anni '80", genres: false },
  { id: "trakt_90s", name: "📽️ Anni '90", genres: false },
  { id: "trakt_2000s", name: "💿 Anni 2000", genres: false },
  { id: "best_2010s", name: "📱 Anni 2010", genres: true },
  { id: "best_2020s", name: "🎬 Anni 2020", genres: true },
  { id: "trakt_marvel", name: "🦸 Marvel Universe", genres: false },
  { id: "trakt_top1000", name: "🏆 Top Mondiali", genres: false },
  { id: "random_night", name: "🎲 Random Night", genres: true },
];

const SERIES_CATALOGS = [
  { id: "tv_trending", name: "🔥 Trending TV", genres: true },
  { id: "tv_top_rated", name: "💜 Top Rated TV", genres: true },
  { id: "tv_on_the_air", name: "📺 In Onda", genres: true },
  { id: "tv_netflix", name: "🔴 Netflix", genres: true },
  { id: "tv_hbo", name: "🟣 HBO", genres: true },
  { id: "tv_apple", name: "🍎 Apple TV+", genres: true },
  { id: "tv_disney", name: "🏰 Disney+", genres: true },
  { id: "tv_kdrama", name: "🇰🇷 K-Drama", genres: false },
  { id: "tv_random_night", name: "🎲 Random TV", genres: true },
];

const ANIME_CATALOGS = [
  { id: "anime_trending", name: "🔥 Anime Trending", genres: true },
  { id: "anime_top", name: "💜 Top Anime", genres: true },
  { id: "anime_airing", name: "📺 In Corso", genres: true },
  { id: "anime_upcoming", name: "📅 Prossime Uscite", genres: true },
  { id: "anime_popular", name: "⭐ Più Popolari", genres: true },
  { id: "anime_action", name: "⚔️ Azione", genres: false },
  { id: "anime_romance", name: "💕 Romantico", genres: false },
  { id: "anime_horror", name: "👻 Horror", genres: false },
  { id: "anime_mystery", name: "🔍 Mistero", genres: false },
  { id: "anime_scifi", name: "🚀 Fantascienza", genres: false },
  { id: "anime_fantasy", name: "🧙 Fantastico", genres: false },
  { id: "anime_comedy", name: "😂 Commedia", genres: false },
  { id: "anime_drama", name: "🎭 Drammatico", genres: false },
  { id: "anime_mecha", name: "🤖 Mecha", genres: false },
  { id: "anime_slice_of_life", name: "🌸 Slice of Life", genres: false },
  { id: "anime_movies", name: "🎬 Film Anime", genres: true },
  { id: "anime_classics", name: "📼 Anime Classici", genres: false },
  { id: "anime_random", name: "🎲 Random Anime", genres: false },
  { id: "trakt_anime_list", name: "🎌 A Lot of Anime", genres: false },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const typeParam = searchParams.get("t") || "all";
  
  // Logo URL - HTTPS is required for Stremio
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const publicHost = forwardedHost || host || "localhost:3000";
  const logoUrl = `https://${publicHost}/gengar-logo.jpg`;
  
  // Determine what to include
  let includeMovies = false;
  let includeSeries = false;
  let includeAnime = false;
  
  switch (typeParam) {
    case "movie":
      includeMovies = true;
      break;
    case "series":
      includeSeries = true;
      break;
    case "anime":
      includeAnime = true;
      break;
    case "both":
      includeMovies = true;
      includeSeries = true;
      break;
    case "all":
    default:
      includeMovies = true;
      includeSeries = true;
      includeAnime = true;
      break;
  }
  
  // Build catalogs
  const catalogs: Array<{
    type: string;
    id: string;
    name: string;
    extra: Array<{ name: string; isRequired: boolean; options?: string[] }>;
  }> = [];
  
  if (includeMovies) {
    MOVIE_CATALOGS.forEach(c => {
      const extra: Array<{ name: string; isRequired: boolean; options?: string[] }> = [
        { name: "skip", isRequired: false },
      ];
      if (c.genres) {
        extra.push({ name: "genre", isRequired: false, options: GENRE_OPTIONS });
      }
      catalogs.push({ type: "movie", id: c.id, name: c.name, extra });
    });
  }
  
  if (includeSeries) {
    SERIES_CATALOGS.forEach(c => {
      const extra: Array<{ name: string; isRequired: boolean; options?: string[] }> = [
        { name: "skip", isRequired: false },
      ];
      if (c.genres) {
        extra.push({ name: "genre", isRequired: false, options: TV_GENRE_OPTIONS });
      }
      catalogs.push({ type: "series", id: c.id, name: c.name, extra });
    });
  }
  
  if (includeAnime) {
    ANIME_CATALOGS.forEach(c => {
      const extra: Array<{ name: string; isRequired: boolean; options?: string[] }> = [
        { name: "skip", isRequired: false },
      ];
      if (c.genres) {
        extra.push({ name: "genre", isRequired: false, options: ANIME_GENRE_OPTIONS });
      }
      catalogs.push({ type: "anime", id: c.id, name: c.name, extra });
    });
  }

  // Build types
  const types: string[] = [];
  if (includeMovies) types.push("movie");
  if (includeSeries) types.push("series");
  if (includeAnime) types.push("anime");

  const manifest = {
    id: "it.gengar.discovery.addon",
    version: "12.0.0",
    name: "Gengar Discovery ITA",
    description: "🎬 Film, Serie TV, Anime in italiano! Marvel, Top 1000, Anni 50-2000, Anime!",
    logo: logoUrl,
    background: logoUrl,
    types,
    catalogs,
    resources: ["catalog", "meta", "stream"],
    idPrefixes: ["imdb", "tmdb", "kitsu", "mal", "anilist"],
    behaviorHints: {
      configurable: true,
      configurationRequired: false,
      adult: false,
    },
    config: [
      {
        key: "t",
        type: "select",
        default: "all",
        title: "Tipo di Contenuto",
        options: [
          { id: "all", name: "🎬 Tutto" },
          { id: "movie", name: "🎥 Solo Film" },
          { id: "series", name: "📺 Solo Serie TV" },
          { id: "anime", name: "🎌 Solo Anime" },
          { id: "both", name: "🎬 Film e Serie TV" },
        ],
      },
    ],
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
