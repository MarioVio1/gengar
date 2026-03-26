/**
 * Dynamic Catalogs System
 * Ogni categoria ha shuffle giornaliero per contenuti sempre diversi
 */

import { NextResponse } from "next/server";

const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// Cache per risultati giornalieri
interface DailyCache {
  date: string;
  catalogs: Record<string, unknown[]>;
}

let dailyCache: DailyCache = { date: "", catalogs: {} };

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDailySeed(catalogId: string): number {
  const today = getTodayDate();
  const hash = today.split("-").reduce((a, b) => a + parseInt(b), 0);
  const idHash = catalogId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash + idHash;
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

async function fetchTMDB(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const response = await fetch(url.toString(), { 
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(15000) 
  });
  if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
  return response.json();
}

function tmdbToStremio(movie: Record<string, unknown>, type: string = "movie") {
  const m = movie as { 
    id: number; 
    title?: string; 
    name?: string; 
    poster_path?: string; 
    backdrop_path?: string; 
    overview?: string; 
    release_date?: string; 
    first_air_date?: string; 
    vote_average?: number; 
    genre_ids?: number[];
  };
  
  const genreMap: Record<number, string> = {
    28: "Azione", 12: "Avventura", 16: "Animazione", 35: "Commedia",
    80: "Crimine", 99: "Documentario", 18: "Drammatico", 10751: "Famiglia",
    14: "Fantastico", 36: "Storico", 27: "Horror", 10402: "Musica",
    9648: "Mistero", 10749: "Romantico", 878: "Fantascienza",
    53: "Thriller", 10752: "Guerra", 37: "Western",
  };
  
  return {
    id: `tmdb${m.id}`,
    type,
    name: m.title || m.name || "N/A",
    poster: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : null,
    background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : null,
    description: m.overview,
    releaseInfo: (m.release_date || m.first_air_date)?.toString().split("-")[0] || "",
    imdbRating: m.vote_average?.toFixed(1),
    genres: m.genre_ids?.map(id => genreMap[id]).filter(Boolean),
  };
}

// Configurazione strategie per ogni catalogo
const CATALOG_STRATEGIES: Record<string, {
  sources: Array<{
    endpoint: string;
    params: Record<string, string>;
    weight: number;
  }>;
  shuffle: boolean;
}> = {
  // Main
  trending: {
    sources: [
      { endpoint: "/trending/movie/week", params: { page: "1" }, weight: 1 },
      { endpoint: "/trending/movie/day", params: { page: "1" }, weight: 0.5 },
    ],
    shuffle: true,
  },
  top_rated: {
    sources: [
      { endpoint: "/movie/top_rated", params: { page: "1" }, weight: 1 },
      { endpoint: "/movie/top_rated", params: { page: "2" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  now_playing: {
    sources: [
      { endpoint: "/movie/now_playing", params: { page: "1" }, weight: 1 },
    ],
    shuffle: true,
  },
  romantic: {
    sources: [
      { endpoint: "/discover/movie", params: { with_genres: "10749", sort_by: "popularity.desc", "vote_count.gte": "50" }, weight: 1 },
      { endpoint: "/discover/movie", params: { with_genres: "10749", sort_by: "vote_average.desc", "vote_count.gte": "100" }, weight: 0.8 },
    ],
    shuffle: true,
  },
  
  // Expert
  mubi: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "30", "vote_average.gte": "7", with_genres: "18", sort_by: "vote_average.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "vote_count.gte": "50", "vote_average.gte": "7.5", sort_by: "vote_average.desc" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  award_winners: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "300", "vote_average.gte": "7.5", sort_by: "popularity.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  cannes: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "100", "vote_average.gte": "7", with_genres: "18", sort_by: "vote_average.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  venice: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "100", "vote_average.gte": "7", with_genres: "18,36", sort_by: "vote_average.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  criterion: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "50", "vote_average.gte": "7.5", sort_by: "vote_average.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "vote_count.gte": "100", "vote_average.gte": "8", "popularity.lte": "50", sort_by: "vote_average.desc" }, weight: 0.8 },
    ],
    shuffle: true,
  },
  a24: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "50", "vote_average.gte": "7", "popularity.lte": "150", sort_by: "vote_average.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  
  // World Cinema
  korean: {
    sources: [
      { endpoint: "/discover/movie", params: { with_original_language: "ko", "vote_count.gte": "20", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { with_original_language: "ko", "vote_average.gte": "7", sort_by: "vote_average.desc" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  italian_classics: {
    sources: [
      { endpoint: "/discover/movie", params: { with_original_language: "it", "vote_count.gte": "20", sort_by: "vote_average.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { with_original_language: "it", "primary_release_date.lte": "1990-12-31", sort_by: "vote_average.desc" }, weight: 0.8 },
    ],
    shuffle: true,
  },
  french_cinema: {
    sources: [
      { endpoint: "/discover/movie", params: { with_original_language: "fr", "vote_count.gte": "20", "vote_average.gte": "6.5", sort_by: "vote_average.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { with_original_language: "fr", "vote_count.gte": "50", sort_by: "popularity.desc" }, weight: 0.6 },
    ],
    shuffle: true,
  },
  ghibli: {
    sources: [
      { endpoint: "/discover/movie", params: { with_genres: "16", with_original_language: "ja", "vote_count.gte": "50", sort_by: "vote_average.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { with_genres: "16", with_original_language: "ja", sort_by: "popularity.desc" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  
  // Cult
  midnight: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "50", with_genres: "27,53,878", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "vote_average.gte": "6.5", with_genres: "27,53", "popularity.lte": "100", sort_by: "vote_average.desc" }, weight: 0.8 },
    ],
    shuffle: true,
  },
  cult: {
    sources: [
      { endpoint: "/discover/movie", params: { "vote_count.gte": "100", "vote_average.gte": "7", sort_by: "vote_count.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "vote_count.gte": "200", "vote_average.gte": "7.5", "popularity.lte": "80", sort_by: "vote_count.desc" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  
  // Decades
  best_80s: {
    sources: [
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "1980-01-01", "primary_release_date.lte": "1989-12-31", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "1980-01-01", "primary_release_date.lte": "1989-12-31", sort_by: "vote_average.desc", "vote_count.gte": "100" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  best_90s: {
    sources: [
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "1990-01-01", "primary_release_date.lte": "1999-12-31", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "1990-01-01", "primary_release_date.lte": "1999-12-31", sort_by: "vote_average.desc", "vote_count.gte": "100" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  best_2000s: {
    sources: [
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "2000-01-01", "primary_release_date.lte": "2009-12-31", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "2000-01-01", "primary_release_date.lte": "2009-12-31", sort_by: "vote_average.desc", "vote_count.gte": "100" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  best_2010s: {
    sources: [
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "2010-01-01", "primary_release_date.lte": "2019-12-31", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "2010-01-01", "primary_release_date.lte": "2019-12-31", sort_by: "vote_average.desc", "vote_count.gte": "100" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  best_2020s: {
    sources: [
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "2020-01-01", "primary_release_date.lte": "2029-12-31", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/movie", params: { "primary_release_date.gte": "2020-01-01", "primary_release_date.lte": "2029-12-31", sort_by: "vote_average.desc", "vote_count.gte": "50" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  
  // TV Series
  tv_trending: {
    sources: [
      { endpoint: "/trending/tv/week", params: { page: "1" }, weight: 1 },
      { endpoint: "/trending/tv/day", params: { page: "1" }, weight: 0.5 },
    ],
    shuffle: true,
  },
  tv_top_rated: {
    sources: [
      { endpoint: "/tv/top_rated", params: { page: "1" }, weight: 1 },
      { endpoint: "/tv/top_rated", params: { page: "2" }, weight: 0.7 },
    ],
    shuffle: true,
  },
  tv_on_the_air: {
    sources: [
      { endpoint: "/tv/on_the_air", params: { page: "1" }, weight: 1 },
    ],
    shuffle: true,
  },
  tv_netflix: {
    sources: [
      { endpoint: "/discover/tv", params: { with_networks: "213", sort_by: "popularity.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  tv_hbo: {
    sources: [
      { endpoint: "/discover/tv", params: { with_networks: "49", sort_by: "popularity.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  tv_apple: {
    sources: [
      { endpoint: "/discover/tv", params: { with_networks: "2552", sort_by: "popularity.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  tv_disney: {
    sources: [
      { endpoint: "/discover/tv", params: { with_networks: "2739", sort_by: "popularity.desc" }, weight: 1 },
    ],
    shuffle: true,
  },
  tv_kdrama: {
    sources: [
      { endpoint: "/discover/tv", params: { with_original_language: "ko", sort_by: "popularity.desc" }, weight: 1 },
      { endpoint: "/discover/tv", params: { with_original_language: "ko", sort_by: "vote_average.desc", "vote_count.gte": "50" }, weight: 0.7 },
    ],
    shuffle: true,
  },
};

/**
 * Ottiene contenuti dinamici per un catalogo
 */
export async function getDynamicCatalog(
  catalogId: string,
  skip: number = 0,
  type: "movie" | "series" = "movie"
): Promise<unknown[]> {
  const today = getTodayDate();
  
  // Controlla cache
  if (dailyCache.date === today && dailyCache.catalogs[catalogId]) {
    return dailyCache.catalogs[catalogId].slice(skip, skip + 20);
  }
  
  // Reset cache se giorno nuovo
  if (dailyCache.date !== today) {
    dailyCache = { date: today, catalogs: {} };
  }
  
  const strategy = CATALOG_STRATEGIES[catalogId];
  if (!strategy) {
    // Fallback per cataloghi non configurati
    return [];
  }
  
  const seed = getDailySeed(catalogId);
  const allResults: unknown[] = [];
  
  // Fetch da tutte le fonti
  for (const source of strategy.sources) {
    try {
      const page = Math.floor(seededRandom(seed)() * 3) + 1;
      const data = await fetchTMDB(source.endpoint, { 
        ...source.params, 
        page: String(page) 
      });
      
      const results = (data.results || []).slice(0, Math.ceil(20 * source.weight));
      allResults.push(...results);
    } catch (error) {
      console.error(`Error fetching ${source.endpoint}:`, error);
    }
  }
  
  // Rimuovi duplicati
  const seen = new Set<number>();
  const unique = allResults.filter((item) => {
    const id = (item as { id: number }).id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  
  // Shuffle se richiesto
  const final = strategy.shuffle ? seededShuffle(unique, seed) : unique;
  
  // Salva in cache
  dailyCache.catalogs[catalogId] = final;
  
  // Converti in formato Stremio
  const startIdx = Math.min(skip, final.length);
  const endIdx = Math.min(skip + 20, final.length);
  
  return final.slice(startIdx, endIdx).map((item) => {
    if (type === "series" || catalogId.startsWith("tv_")) {
      const s = item as { name?: string; first_air_date?: string };
      return tmdbToStremio({
        ...item,
        title: s.name,
        release_date: s.first_air_date,
      } as Record<string, unknown>, "series");
    }
    return tmdbToStremio(item as Record<string, unknown>, type);
  });
}

/**
 * Ottiene info cache per debug
 */
export function getCacheInfo(): { date: string; catalogs: string[] } {
  return {
    date: dailyCache.date,
    catalogs: Object.keys(dailyCache.catalogs),
  };
}
