// Curated Lists using TMDB (simulating Trakt-style lists)
const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// List definitions with TMDB parameters
export const TRAKT_LISTS = {
  // Anime (TV shows)
  anime: {
    id: "trakt_anime_list",
    name: "🎌 A Lot of Anime",
    type: "shows" as const,
    endpoint: "/discover/tv",
    params: {
      with_genres: "16",
      with_original_language: "ja",
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    },
  },
  // Decades
  films_50s: {
    id: "trakt_50s",
    name: "📽️ Anni '50 Classici",
    type: "movies" as const,
    endpoint: "/discover/movie",
    params: {
      "primary_release_date.gte": "1950-01-01",
      "primary_release_date.lte": "1959-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": "100",
    },
  },
  films_70s: {
    id: "trakt_70s",
    name: "📽️ Anni '70 Classici",
    type: "movies" as const,
    endpoint: "/discover/movie",
    params: {
      "primary_release_date.gte": "1970-01-01",
      "primary_release_date.lte": "1979-12-31",
      sort_by: "vote_average.desc",
      "vote_count.gte": "100",
    },
  },
  films_80s: {
    id: "trakt_80s",
    name: "📽️ Anni '80 Classici",
    type: "movies" as const,
    endpoint: "/discover/movie",
    params: {
      "primary_release_date.gte": "1980-01-01",
      "primary_release_date.lte": "1989-12-31",
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    },
  },
  films_90s: {
    id: "trakt_90s",
    name: "📽️ Anni '90 Classici",
    type: "movies" as const,
    endpoint: "/discover/movie",
    params: {
      "primary_release_date.gte": "1990-01-01",
      "primary_release_date.lte": "1999-12-31",
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    },
  },
  films_2000s: {
    id: "trakt_2000s",
    name: "💿 Anni 2000 Hit",
    type: "movies" as const,
    endpoint: "/discover/movie",
    params: {
      "primary_release_date.gte": "2000-01-01",
      "primary_release_date.lte": "2009-12-31",
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    },
  },
  // Marvel Cinematic Universe
  marvel: {
    id: "trakt_marvel",
    name: "🦸 Marvel Universe",
    type: "movies" as const,
    endpoint: "/collection/86311",
    isCollection: true,
  },
  // Top 1000 (simulated with top rated)
  top_1000: {
    id: "trakt_top1000",
    name: "🏆 Top Film",
    type: "movies" as const,
    endpoint: "/movie/top_rated",
    params: {},
  },
};

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
}

interface TMDBShow {
  id: number;
  name: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

interface TMDBCollection {
  id: number;
  name: string;
  parts: TMDBMovie[];
}

interface TMDBResponse {
  page: number;
  results: (TMDBMovie | TMDBShow)[];
  total_pages: number;
}

interface ExternalIds {
  imdb_id?: string;
}

// Genre mappings
const genreMap: Record<number, string> = {
  28: "Azione", 12: "Avventura", 16: "Animazione", 35: "Commedia",
  80: "Crimine", 99: "Documentario", 18: "Drammatico", 10751: "Famiglia",
  14: "Fantastico", 36: "Storico", 27: "Horror", 10402: "Musica",
  9648: "Mistero", 10749: "Romantico", 878: "Fantascienza",
  53: "Thriller", 10752: "Guerra", 37: "Western",
  10759: "Azione & Avventura", 10762: "Kids", 10763: "News",
  10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
  10767: "Talk", 10768: "War & Politics",
};

// Cache for IMDB IDs
const imdbCache = new Map<number, string>();

// Fetch with timeout
async function fetchWithTimeout(url: string, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Get IMDB ID for a TMDB ID
async function getImdbId(tmdbId: number, type: "movie" | "tv" = "movie"): Promise<string | null> {
  if (imdbCache.has(tmdbId)) return imdbCache.get(tmdbId)!;
  
  try {
    const url = `${TMDB_BASE}/${type}/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
    const response = await fetchWithTimeout(url, 5000);
    
    if (!response.ok) return null;
    
    const data: ExternalIds = await response.json();
    if (data.imdb_id) {
      imdbCache.set(tmdbId, data.imdb_id);
      return data.imdb_id;
    }
    return null;
  } catch {
    return null;
  }
}

// Batch fetch IMDB IDs
async function batchGetImdbIds(ids: number[], type: "movie" | "tv" = "movie"): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  const limit = 5;
  
  for (let i = 0; i < ids.length; i += limit) {
    const batch = ids.slice(i, i + limit);
    const promises = batch.map(async (id) => {
      const imdbId = await getImdbId(id, type);
      if (imdbId) results.set(id, imdbId);
    });
    await Promise.all(promises);
  }
  
  return results;
}

// Convert to Stremio format
function toStremioMeta(
  item: TMDBMovie | TMDBShow,
  imdbId: string | undefined,
  type: "movie" | "series"
) {
  const isMovie = type === "movie";
  const title = isMovie ? (item as TMDBMovie).title : (item as TMDBShow).name;
  const releaseDate = isMovie 
    ? (item as TMDBMovie).release_date 
    : (item as TMDBShow).first_air_date;
  
  const genres = item.genre_ids?.map(id => genreMap[id]).filter(Boolean);
  const id = imdbId || `tmdb${item.id}`;
  
  return {
    id,
    type,
    name: title,
    poster: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
    background: item.backdrop_path 
      ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` 
      : null,
    description: item.overview || "",
    releaseInfo: releaseDate?.split("-")[0] || "",
    imdbRating: item.vote_average?.toFixed(1),
    genres: genres?.length > 0 ? genres : undefined,
  };
}

// Seeded random for shuffle
function seededRandom(seed: number): () => number {
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

// Get catalog from curated list
export async function getTraktCatalog(
  listKey: keyof typeof TRAKT_LISTS,
  skip: number = 0,
  shuffle: boolean = false
): Promise<Array<ReturnType<typeof toStremioMeta>>> {
  const list = TRAKT_LISTS[listKey];
  if (!list) return [];
  
  const page = Math.floor(skip / 20) + 1;
  const tmdbType = list.type === "shows" ? "tv" : "movie";
  const stremioType = list.type === "shows" ? "series" : "movie";
  
  try {
    let items: (TMDBMovie | TMDBShow)[] = [];
    
    if (list.isCollection) {
      // Fetch collection
      const url = `${TMDB_BASE}${list.endpoint}?api_key=${TMDB_API_KEY}&language=it-IT`;
      const response = await fetchWithTimeout(url);
      
      if (!response.ok) return [];
      
      const collection: TMDBCollection = await response.json();
      items = collection.parts || [];
    } else {
      // Fetch discover/top_rated
      const url = new URL(`${TMDB_BASE}${list.endpoint}`);
      url.searchParams.set("api_key", TMDB_API_KEY);
      url.searchParams.set("language", "it-IT");
      url.searchParams.set("page", String(page));
      
      if (list.params) {
        Object.entries(list.params).forEach(([key, value]) => {
          url.searchParams.set(key, String(value));
        });
      }
      
      const response = await fetchWithTimeout(url.toString());
      
      if (!response.ok) return [];
      
      const data: TMDBResponse = await response.json();
      items = data.results as (TMDBMovie | TMDBShow)[];
    }
    
    // Shuffle if requested
    if (shuffle) {
      const seed = Date.now();
      items = seededShuffle(items, seed);
    }
    
    // Get IMDB IDs
    const ids = items.map(item => item.id);
    const imdbIds = await batchGetImdbIds(ids, tmdbType);
    
    // Convert to Stremio format
    const metas = items.map(item => 
      toStremioMeta(item, imdbIds.get(item.id), stremioType)
    );
    
    return metas;
  } catch (error) {
    console.error("Curated list error:", error);
    return [];
  }
}

// Get all list keys
export function getTraktCatalogIds(): string[] {
  return Object.keys(TRAKT_LISTS).map(key => TRAKT_LISTS[key as keyof typeof TRAKT_LISTS].id);
}

// Check if catalog ID is a curated list
export function isTraktCatalog(catalogId: string): boolean {
  return Object.values(TRAKT_LISTS).some(list => list.id === catalogId);
}

// Get list key from catalog ID
export function getTraktListKey(catalogId: string): keyof typeof TRAKT_LISTS | null {
  for (const [key, list] of Object.entries(TRAKT_LISTS)) {
    if (list.id === catalogId) {
      return key as keyof typeof TRAKT_LISTS;
    }
  }
  return null;
}
