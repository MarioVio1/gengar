import { NextRequest, NextResponse } from "next/server";
import { getAnimeCatalog } from "@/lib/anime";
import { getTraktCatalog, TRAKT_LISTS } from "@/lib/trakt";
import { parseERDBConfig, batchApplyERDB } from "@/lib/erdb";

const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// Genre mappings
const genreMap: Record<number, string> = {
  28: "Azione", 12: "Avventura", 16: "Animazione", 35: "Commedia",
  80: "Crimine", 99: "Documentario", 18: "Drammatico", 10751: "Famiglia",
  14: "Fantastico", 36: "Storico", 27: "Horror", 10402: "Musica",
  9648: "Mistero", 10749: "Romantico", 878: "Fantascienza",
  53: "Thriller", 10752: "Guerra", 37: "Western",
};

const genreNameToId: Record<string, string> = {
  "Azione": "28", "Avventura": "12", "Animazione": "16", "Commedia": "35",
  "Crimine": "80", "Documentario": "99", "Drammatico": "18", "Famiglia": "10751",
  "Fantastico": "14", "Storico": "36", "Horror": "27", "Musica": "10402",
  "Mistero": "9648", "Romantico": "10749", "Fantascienza": "878",
  "Thriller": "53", "Guerra": "10752", "Western": "37",
};

const tvGenreNameToId: Record<string, string> = {
  "Azione & Avventura": "10759", "Animazione": "16", "Commedia": "35",
  "Crimine": "80", "Documentario": "99", "Drammatico": "18", "Famiglia": "10751",
  "Kids": "10762", "Mistero": "9648", "News": "10763", "Reality": "10764",
  "Sci-Fi & Fantasy": "10765", "Soap": "10766", "Talk": "10767",
  "War & Politics": "10768", "Western": "37",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=3600",
};

// Parse config from base64 ID
function parseConfig(configId: string) {
  try {
    let base64 = configId.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) base64 += "=";
    
    const json = Buffer.from(base64, "base64").toString("utf8");
    const parts = JSON.parse(json) as string[];
    
    return {
      types: parts[0] || "all",
      topStreamingKey: parts[1] || "",
      shuffleEnabled: parts[2] === "1",
      erdbConfig: parts[3] || "",
    };
  } catch {
    return null;
  }
}

// Fetch IMDb ID from TMDB
async function fetchImdbId(tmdbId: number, type: string): Promise<string | null> {
  try {
    const data = await fetchTMDB(`/${type}/${tmdbId}/external_ids`);
    return data.imdb_id || null;
  } catch {
    return null;
  }
}

// TMDB functions
async function fetchTMDB(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const response = await fetch(url.toString(), { headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
  return response.json();
}

function tmdbToStremio(movie: { id: number; title?: string; name?: string; poster_path: string | null; backdrop_path: string | null; overview: string; release_date?: string; first_air_date?: string; vote_average: number; genre_ids: number[] }, type: string = "movie", imdbId?: string) {
  return {
    id: imdbId || `tmdb${movie.id}`,
    tmdb_id: movie.id,
    type,
    name: movie.title || movie.name || "N/A",
    poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
    description: movie.overview,
    releaseInfo: (movie.release_date || movie.first_air_date)?.split("-")[0] || "",
    imdbRating: movie.vote_average?.toFixed(1),
    genres: movie.genre_ids?.map(id => genreMap[id]).filter(Boolean),
  };
}

// Convert TMDB item to Stremio with IMDb ID fetched
async function tmdbToStremioAsync(movie: { id: number; title?: string; name?: string; poster_path: string | null; backdrop_path: string | null; overview: string; release_date?: string; first_air_date?: string; vote_average: number; genre_ids: number[] }, type: string = "movie"): Promise<ReturnType<typeof tmdbToStremio>> {
  const tmdbType = type === "series" ? "tv" : type;
  const imdbId = await fetchImdbId(movie.id, tmdbType);
  return tmdbToStremio(movie, type, imdbId || undefined);
}

function removeDuplicates(movies: unknown[]) {
  const seen = new Set<number>();
  return (movies as { id: number }[]).filter(m => !seen.has(m.id) && seen.add(m.id));
}

function seededRandom(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const rng = seededRandom(seed);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function getRandomNightSeed(): number {
  const now = new Date();
  const hour = now.getHours();
  const seedDate = new Date(now);
  if (hour < 2) seedDate.setDate(seedDate.getDate() - 1);
  return seedDate.getFullYear() * 10000 + (seedDate.getMonth() + 1) * 100 + seedDate.getDate();
}

// Check if catalog is a Trakt-style catalog
function isTraktCatalog(catalogId: string): boolean {
  return Object.values(TRAKT_LISTS).some(list => list.id === catalogId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string; path: string[] }> }
) {
  const { configId, path } = await params;
  const config = parseConfig(configId);
  
  if (!config) {
    return NextResponse.json({ error: "Invalid config" }, { status: 400, headers: corsHeaders });
  }
  
  const erdbConfig = parseERDBConfig(config.erdbConfig || null);
  
  // Get host for logo
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const publicHost = forwardedHost || host || "localhost:3000";
  const logoUrl = "https://iili.io/qXpzmcG.jpg";
  
  // Resource being requested
  const resource = path?.[0] || "";
  
  // MANIFEST
  if (path.length === 0 || resource === "manifest.json") {
    const includeMovies = config.types === "all" || config.types === "movie" || config.types === "both";
    const includeSeries = config.types === "all" || config.types === "series" || config.types === "both";
    const includeAnime = config.types === "all" || config.types === "anime" || config.types === "series";
    
    const types: string[] = [];
    if (includeMovies) types.push("movie");
    if (includeSeries) types.push("series");
    // Anime uses "series" type for Stremio compatibility
    
    let description = "🎬 Film, Serie TV, Anime in italiano!";
    if (config.topStreamingKey) description += " ⚡ TopStreaming";
    if (config.shuffleEnabled) description += " 🎲 Shuffle";
    if (config.erdbConfig) description += " 🎬 ERDB";
    
    // Build catalogs
    const catalogs: Array<{ type: string; id: string; name: string; extra: Array<{ name: string; isRequired: boolean }> }> = [];
    
    // Nomi cataloghi con emoji
    const CATALOG_NAMES: Record<string, string> = {
      // Film - Main
      "top": "🔍 Cerca Film", "trending": "👻 Trending", "top_rated": "💜 Top Rated", "now_playing": "🎬 Al Cinema",
      "romantic": "💕 Romantico", "hidden_gems": "💎 Hidden Gems",
      // Film - Genres
      "genre_action": "💥 Azione", "genre_adventure": "🗺️ Avventura", "genre_animation": "🎨 Animazione",
      "genre_comedy": "😂 Commedia", "genre_crime": "🔫 Crimine", "genre_documentary": "📹 Documentario",
      "genre_drama": "🎭 Drammatico", "genre_family": "👨‍👩‍👧‍👦 Famiglia", "genre_fantasy": "🧙 Fantastico",
      "genre_history": "📜 Storico", "genre_horror": "👻 Horror", "genre_music": "🎵 Musica",
      "genre_mystery": "🔍 Mistero", "genre_scifi": "🚀 Fantascienza", "genre_thriller": "🔪 Thriller",
      "genre_war": "⚔️ Guerra", "genre_western": "🤠 Western",
      // Film - Expert
      "mubi": "🎭 MUBI Picks", "award_winners": "🏆 Award Winners", "cannes": "🎖️ Cannes Winners",
      "venice": "🦁 Venezia", "criterion": "📽️ Criterion Style", "a24": "🎨 A24 Films",
      // Film - World
      "korean": "🇰🇷 Korean Cinema", "italian_classics": "🇮🇹 Italian Classics", "french_new_wave": "🇫🇷 French New Wave",
      "asian_horror": "👹 Asian Horror", "ghibli": "✨ Animation Masters",
      // Film - Cult
      "midnight": "🌙 Midnight Movies", "cult": "💀 Cult Classics",
      // Film - Decades
      "best_80s": "📼 Anni '80", "best_90s": "📼 Anni '90", "best_2000s": "💿 Anni 2000",
      "best_2010s": "📱 Anni 2010", "best_2020s": "🎬 Anni 2020",
      // Film - Trakt
      "trakt_50s": "🎞️ Anni '50", "trakt_70s": "📽️ Anni '70", "trakt_80s": "📼 Anni '80 (Trakt)",
      "trakt_90s": "📼 Anni '90 (Trakt)", "trakt_2000s": "💿 Anni 2000 (Trakt)",
      "trakt_marvel": "🦸 Marvel Universe", "trakt_top1000": "🌟 Top 1000",
      // Random
      "random_night": "🎲 Random Night",
      // Serie TV
      "tv_top": "🔍 Cerca Serie", "tv_trending": "👻 Trending TV", "tv_top_rated": "💜 Top Rated TV",
      "tv_on_the_air": "📺 In Onda", "tv_netflix": "🔴 Netflix", "tv_hbo": "🟣 HBO",
      "tv_apple": "🍎 Apple TV+", "tv_disney": "🏰 Disney+", "tv_kdrama": "🇰🇷 K-Drama", "tv_random_night": "🎲 Random TV Night",
      // Anime
      "anime_top": "🔍 Cerca Anime", "anime_trending": "🔥 Anime Trending", "anime_top_rated": "💜 Top Anime",
      "anime_airing": "📺 In Corso", "anime_upcoming": "📅 Prossime Uscite", "anime_popular": "⭐ Più Popolari",
      "anime_action": "⚔️ Azione", "anime_romance": "💕 Romantico", "anime_horror": "👻 Horror",
      "anime_mystery": "🔍 Mistero", "anime_scifi": "🚀 Fantascienza", "anime_fantasy": "🧙 Fantastico",
      "anime_comedy": "😂 Commedia", "anime_drama": "🎭 Drammatico", "anime_mecha": "🤖 Mecha",
      "anime_slice_of_life": "🌸 Slice of Life", "anime_movies": "🎬 Film Anime", "anime_classics": "📼 Anime Classici",
      "anime_random": "🎲 Random Anime",
    };
    
    if (includeMovies) {
      // Catalogo TOP per ricerca
      catalogs.push({ type: "movie", id: "top", name: CATALOG_NAMES["top"], extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }] });
      const movieCatalogs = [
        "trending", "top_rated", "now_playing", "romantic", "hidden_gems",
        "genre_action", "genre_adventure", "genre_animation", "genre_comedy", "genre_crime",
        "genre_documentary", "genre_drama", "genre_family", "genre_fantasy", "genre_history",
        "genre_horror", "genre_music", "genre_mystery", "genre_scifi", "genre_thriller",
        "genre_war", "genre_western",
        "mubi", "award_winners", "cannes", "venice", "criterion", "a24",
        "korean", "italian_classics", "french_new_wave", "asian_horror", "ghibli",
        "midnight", "cult",
        "best_80s", "best_90s", "best_2000s", "best_2010s", "best_2020s",
        "trakt_50s", "trakt_70s", "trakt_80s", "trakt_90s", "trakt_2000s",
        "trakt_marvel", "trakt_top1000",
        "random_night",
      ];
      movieCatalogs.forEach(id => {
        catalogs.push({ type: "movie", id, name: CATALOG_NAMES[id] || id.replace(/_/g, " "), extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }] });
      });
    }
    
    if (includeSeries) {
      catalogs.push({ type: "series", id: "tv_top", name: CATALOG_NAMES["tv_top"], extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }] });
      const seriesCatalogs = [
        "tv_trending", "tv_top_rated", "tv_on_the_air",
        "tv_netflix", "tv_hbo", "tv_apple", "tv_disney",
        "tv_kdrama", "tv_random_night",
      ];
      seriesCatalogs.forEach(id => {
        catalogs.push({ type: "series", id, name: CATALOG_NAMES[id] || id.replace(/_/g, " "), extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }] });
      });
    }
    
    if (includeAnime) {
      catalogs.push({ type: "series", id: "anime_top", name: CATALOG_NAMES["anime_top"], extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }] });
      const animeCatalogs = [
        "anime_trending", "anime_top_rated", "anime_airing", "anime_upcoming", "anime_popular",
        "anime_action", "anime_romance", "anime_horror", "anime_mystery", "anime_scifi",
        "anime_fantasy", "anime_comedy", "anime_drama", "anime_mecha", "anime_slice_of_life",
        "anime_movies", "anime_classics", "anime_random",
      ];
      animeCatalogs.forEach(id => {
        catalogs.push({ type: "series", id, name: CATALOG_NAMES[id] || id.replace(/_/g, " "), extra: [{ name: "skip", isRequired: false }, { name: "search", isRequired: false }] });
      });
    }

    return NextResponse.json({
      id: "it.gengar.discovery.addon",
      version: "15.0.0",
      name: "Gengar Discovery ITA",
      description,
      logo: logoUrl,
      background: logoUrl,
      types,
      catalogs,
      resources: ["catalog", "meta", "stream"],
      idPrefixes: ["imdb", "tmdb", "kitsu", "mal", "anilist"],
      behaviorHints: { configurable: false, configurationRequired: false, adult: false },
    }, { headers: corsHeaders });
  }
  
  // CATALOG
  if (resource === "catalog") {
    const type = path[1];
    let catalogId = path[2]?.replace(".json", "") || "";
    
    let skip = 0;
    for (let i = 3; i < path.length; i++) {
      if (path[i].startsWith("skip=")) skip = parseInt(path[i].replace(".json", "").split("=")[1]) || 0;
    }
    
    const page = Math.floor(skip / 20) + 1;
    
    try {
      // Trakt catalogs
      if (isTraktCatalog(catalogId)) {
        const listKeyMap: Record<string, keyof typeof TRAKT_LISTS> = {
          "trakt_50s": "films_50s", "trakt_70s": "films_70s", "trakt_80s": "films_80s",
          "trakt_90s": "films_90s", "trakt_2000s": "films_2000s",
          "trakt_marvel": "marvel", "trakt_top1000": "top_1000", "trakt_anime_list": "anime",
        };
        
        const listKey = listKeyMap[catalogId];
        if (listKey) {
          let metas = await getTraktCatalog(listKey, skip, config.shuffleEnabled);
          if (erdbConfig.enabled) metas = batchApplyERDB(metas, "movie", erdbConfig);
          return NextResponse.json({ metas }, { headers: corsHeaders });
        }
      }
      
      // Anime catalogs
      if (type === "anime") {
        let metas = await getAnimeCatalog(catalogId, skip);
        if (config.shuffleEnabled) metas = seededShuffle(metas as unknown[], getRandomNightSeed()) as typeof metas;
        let typedMetas = (metas as unknown[]).map(m => ({ ...m, type: "anime" }));
        if (erdbConfig.enabled) typedMetas = batchApplyERDB(typedMetas as Array<{ id: string; tmdb_id?: number; poster?: string }>, "series", erdbConfig);
        return NextResponse.json({ metas: typedMetas }, { headers: corsHeaders });
      }
      
      // TV Series
      if (type === "series") {
        let response;
        const baseParams = { page: String(page) };
        
        switch (catalogId) {
          case "tv_trending": response = await fetchTMDB("/trending/tv/week", baseParams); break;
          case "tv_top_rated": response = await fetchTMDB("/tv/top_rated", baseParams); break;
          case "tv_on_the_air": response = await fetchTMDB("/tv/on_the_air", baseParams); break;
          case "tv_netflix": response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "213", sort_by: "popularity.desc" }); break;
          case "tv_hbo": response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "49", sort_by: "popularity.desc" }); break;
          case "tv_apple": response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "2552", sort_by: "popularity.desc" }); break;
          case "tv_disney": response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "2739", sort_by: "popularity.desc" }); break;
          case "tv_kdrama": response = await fetchTMDB("/discover/tv", { ...baseParams, with_original_language: "ko", sort_by: "popularity.desc" }); break;
          case "tv_random_night":
            const seed = getRandomNightSeed();
            response = await fetchTMDB("/discover/tv", { page: String(Math.floor(seededRandom(seed)() * 10) + 1), sort_by: "popularity.desc", "vote_count.gte": "50" });
            break;
          default: return NextResponse.json({ metas: [] }, { headers: corsHeaders });
        }
        
        let movies = response.results.map((s: { name?: string; title?: string; first_air_date?: string; release_date?: string }) => ({
          ...s,
          title: s.name || s.title,
          release_date: s.first_air_date || s.release_date,
        }));
        
        if (catalogId === "tv_random_night") movies = seededShuffle(removeDuplicates(movies), getRandomNightSeed());
        
        let metas = await Promise.all(movies.map((m: { id: number; title?: string; name?: string; poster_path: string | null; backdrop_path: string | null; overview: string; release_date?: string; first_air_date?: string; vote_average: number; genre_ids: number[] }) => tmdbToStremioAsync(m, "series")));
        if (erdbConfig.enabled) metas = batchApplyERDB(metas, "series", erdbConfig);
        return NextResponse.json({ metas }, { headers: corsHeaders });
      }
      
      // Movies
      let response;
      const baseParams = { page: String(page) };
      
      switch (catalogId) {
        case "trending": response = await fetchTMDB("/trending/movie/week", baseParams); break;
        case "top_rated": response = await fetchTMDB("/movie/top_rated", baseParams); break;
        case "now_playing": response = await fetchTMDB("/movie/now_playing", baseParams); break;
        case "hidden_gems": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", "vote_average.gte": "7", sort_by: "vote_average.desc" }); break;
        case "mubi": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "30", "vote_average.gte": "7", with_genres: "18", sort_by: "vote_average.desc" }); break;
        case "award_winners": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "300", "vote_average.gte": "7.5", sort_by: "popularity.desc" }); break;
        case "cannes": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", with_genres: "18", sort_by: "vote_average.desc" }); break;
        case "venice": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", with_genres: "18,36", sort_by: "vote_average.desc" }); break;
        case "criterion": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", "vote_average.gte": "7.5", sort_by: "vote_average.desc" }); break;
        case "a24": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", "vote_average.gte": "7", "popularity.lte": "150", sort_by: "vote_average.desc" }); break;
        case "korean": response = await fetchTMDB("/discover/movie", { ...baseParams, with_original_language: "ko", "vote_count.gte": "20", sort_by: "popularity.desc" }); break;
        case "italian_classics": response = await fetchTMDB("/discover/movie", { ...baseParams, with_original_language: "it", "vote_count.gte": "20", sort_by: "vote_average.desc" }); break;
        case "french_new_wave": response = await fetchTMDB("/discover/movie", { ...baseParams, with_original_language: "fr", "vote_count.gte": "20", "vote_average.gte": "6.5", sort_by: "vote_average.desc" }); break;
        case "asian_horror": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "27", with_original_language: "ja", "vote_count.gte": "20", sort_by: "popularity.desc" }); break;
        case "ghibli": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "16", with_original_language: "ja", "vote_count.gte": "50", sort_by: "vote_average.desc" }); break;
        case "midnight": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", with_genres: "27,53,878", sort_by: "popularity.desc" }); break;
        case "cult": response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", sort_by: "vote_count.desc" }); break;
        case "best_80s": response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "1980-01-01", "primary_release_date.lte": "1989-12-31", sort_by: "popularity.desc" }); break;
        case "best_90s": response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "1990-01-01", "primary_release_date.lte": "1999-12-31", sort_by: "popularity.desc" }); break;
        case "best_2000s": response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "2000-01-01", "primary_release_date.lte": "2009-12-31", sort_by: "popularity.desc" }); break;
        case "best_2010s": response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "2010-01-01", "primary_release_date.lte": "2019-12-31", sort_by: "popularity.desc" }); break;
        case "best_2020s": response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "2020-01-01", "primary_release_date.lte": "2029-12-31", sort_by: "popularity.desc" }); break;
        // Genre catalogs
        case "genre_action": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "28", sort_by: "popularity.desc" }); break;
        case "genre_adventure": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "12", sort_by: "popularity.desc" }); break;
        case "genre_animation": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "16", sort_by: "popularity.desc" }); break;
        case "genre_comedy": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "35", sort_by: "popularity.desc" }); break;
        case "genre_crime": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "80", sort_by: "popularity.desc" }); break;
        case "genre_documentary": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "99", sort_by: "popularity.desc" }); break;
        case "genre_drama": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "18", sort_by: "popularity.desc" }); break;
        case "genre_family": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "10751", sort_by: "popularity.desc" }); break;
        case "genre_fantasy": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "14", sort_by: "popularity.desc" }); break;
        case "genre_history": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "36", sort_by: "popularity.desc" }); break;
        case "genre_horror": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "27", sort_by: "popularity.desc" }); break;
        case "genre_music": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "10402", sort_by: "popularity.desc" }); break;
        case "genre_mystery": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "9648", sort_by: "popularity.desc" }); break;
        case "genre_scifi": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "878", sort_by: "popularity.desc" }); break;
        case "genre_thriller": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "53", sort_by: "popularity.desc" }); break;
        case "genre_war": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "10752", sort_by: "popularity.desc" }); break;
        case "genre_western": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "37", sort_by: "popularity.desc" }); break;
        // Romantic catalog
        case "romantic": response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "10749", sort_by: "popularity.desc" }); break;
        case "random_night":
          const seed = getRandomNightSeed();
          response = await fetchTMDB("/discover/movie", { page: String(Math.floor(seededRandom(seed)() * 10) + 1), sort_by: "popularity.desc", "vote_count.gte": "50" });
          break;
        default: return NextResponse.json({ metas: [] }, { headers: corsHeaders });
      }
      
      let movies = catalogId === "random_night" ? seededShuffle(removeDuplicates(response.results), getRandomNightSeed()) : response.results;
      let metas = await Promise.all(movies.map((m: { id: number; title?: string; name?: string; poster_path: string | null; backdrop_path: string | null; overview: string; release_date?: string; first_air_date?: string; vote_average: number; genre_ids: number[] }) => tmdbToStremioAsync(m, "movie")));
      if (erdbConfig.enabled) metas = batchApplyERDB(metas, "movie", erdbConfig);
      return NextResponse.json({ metas }, { headers: corsHeaders });
      
    } catch (error) {
      console.error("Catalog error:", error);
      return NextResponse.json({ metas: [] }, { headers: corsHeaders });
    }
  }
  
  // META
  if (resource === "meta") {
    const type = path[1];
    const rawId = path[2]?.replace(".json", "") || "";
    
    try {
      // Extract TMDB ID from various formats
      let tmdbId = "";
      if (rawId.startsWith("tmdb")) {
        tmdbId = rawId.replace("tmdb", "");
      } else if (rawId.startsWith("tt")) {
        // IMDb ID - find TMDB ID
        const findUrl = `${TMDB_BASE_URL}/find/${rawId}?api_key=${TMDB_API_KEY}&language=it-IT&external_source=imdb_id`;
        const findResponse = await fetch(findUrl);
        if (findResponse.ok) {
          const findData = await findResponse.json();
          const results = type === "movie" ? findData.movie_results : findData.tv_results;
          if (results?.[0]) {
            tmdbId = String(results[0].id);
          }
        }
      } else {
        tmdbId = rawId;
      }
      
      if (!tmdbId) {
        return NextResponse.json({ meta: null }, { headers: corsHeaders });
      }
      
      const tmdbType = type === "anime" || type === "series" ? "tv" : type;
      const tmdbUrl = `${TMDB_BASE_URL}/${tmdbType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT&append_to_response=credits,videos,external_ids`;
      const response = await fetch(tmdbUrl);
      if (!response.ok) return NextResponse.json({ meta: null }, { headers: corsHeaders });
      
      const data = await response.json();
      const imdbId = data.external_ids?.imdb_id;
      
      // CRITICAL: Keep the same ID that was requested (for Stremio compatibility)
      const metaId = rawId.startsWith("tt") ? rawId : `tmdb${data.id}`;
      
      // Convert "anime" to "series" for Stremio compatibility
      const stremioType = type === "anime" ? "series" : type;
      
      const meta: Record<string, unknown> = {
        id: metaId,
        tmdb_id: data.id,
        type: stremioType,
        name: data.title || data.name,
        poster: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : null,
        background: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : null,
        description: data.overview,
        releaseInfo: (data.release_date || data.first_air_date)?.split("-")[0] || "",
        imdbRating: data.vote_average?.toFixed(1),
      };
      
      // Add IMDb ID for Stremio addon discovery - other addons will use this
      if (imdbId) {
        meta.imdb_id = imdbId;
      }
      
      // Apply ERDB if configured
      if (erdbConfig.enabled && erdbConfig.decoded) {
        const stremioType = type === "anime" ? "series" : type;
        const erdbId = `tmdb:${stremioType}:${data.id}`;
        
        const params = new URLSearchParams();
        params.set("tmdbKey", erdbConfig.decoded.tmdbKey);
        params.set("mdblistKey", erdbConfig.decoded.mdblistKey);
        if (erdbConfig.decoded.lang) params.set("lang", erdbConfig.decoded.lang);
        if (erdbConfig.decoded.ratings) params.set("ratings", erdbConfig.decoded.ratings);
        if (erdbConfig.decoded.posterRatingStyle) params.set("ratingStyle", erdbConfig.decoded.posterRatingStyle);
        
        meta.poster = `${erdbConfig.decoded.baseUrl}/poster/${erdbId}.jpg?${params.toString()}`;
        
        const backdropParams = new URLSearchParams();
        backdropParams.set("tmdbKey", erdbConfig.decoded.tmdbKey);
        backdropParams.set("mdblistKey", erdbConfig.decoded.mdblistKey);
        if (erdbConfig.decoded.lang) backdropParams.set("lang", erdbConfig.decoded.lang);
        if (erdbConfig.decoded.backdropRatingStyle) backdropParams.set("ratingStyle", erdbConfig.decoded.backdropRatingStyle);
        
        meta.background = `${erdbConfig.decoded.baseUrl}/backdrop/${erdbId}.jpg?${backdropParams.toString()}`;
      }
      
      return NextResponse.json({ meta }, { headers: corsHeaders });
    } catch {
      return NextResponse.json({ meta: null }, { headers: corsHeaders });
    }
  }
  
  // STREAM
  if (resource === "stream") {
    const type = path[1];
    const id = path[2]?.replace(".json", "").replace("tmdb", "") || "";
    
    const streams: Array<{ name: string; title: string; externalUrl?: string; behaviorHints?: { notWebReady: boolean } }> = [];
    
    try {
      const tmdbUrl = `${TMDB_BASE_URL}/${type === "anime" ? "tv" : type}/${id}?api_key=${TMDB_API_KEY}&language=it-IT&append_to_response=external_ids,videos`;
      const response = await fetch(tmdbUrl);
      
      if (response.ok) {
        const data = await response.json();
        const title = data.title || data.name;
        const year = (data.release_date || data.first_air_date)?.split("-")[0] || "";
        const imdbId = data.external_ids?.imdb_id;
        
        // Top Streaming if configured
        if (config.topStreamingKey && imdbId) {
          streams.push({
            name: "⚡ TopStreaming",
            title: `${title} (${year})`,
            externalUrl: `https://top-streaming.stream/watch/${imdbId}`,
            behaviorHints: { notWebReady: true },
          });
        }
        
        // IMDb link
        if (imdbId) {
          streams.push({
            name: "🔗 IMDb",
            title: `${title} (${year}) - Cerca su IMDb`,
            externalUrl: `https://www.imdb.com/title/${imdbId}`,
            behaviorHints: { notWebReady: true },
          });
        }
        
        // Trailer
        const trailer = data.videos?.results?.find((v: { type: string; site: string; key: string }) => v.type === "Trailer" && v.site === "YouTube");
        if (trailer) {
          streams.push({
            name: "▶️ YouTube",
            title: `Trailer: ${title}`,
            externalUrl: `https://www.youtube.com/watch?v=${trailer.key}`,
            behaviorHints: { notWebReady: true },
          });
        }
      }
    } catch {
      // Ignore errors
    }
    
    return NextResponse.json({ streams }, { headers: corsHeaders });
  }
  
  return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
