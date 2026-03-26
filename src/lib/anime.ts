// Anime integration using Kitsu API
const KITSU_BASE = "https://kitsu.io/api/edge";
const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// Increased pages for more content
const DEFAULT_PAGES = 15;

interface KitsuAnime {
  id: string;
  type: string;
  attributes: {
    canonicalTitle: string;
    titles: { en?: string; en_jp?: string; ja_jp?: string };
    posterImage?: { medium?: string; large?: string };
    coverImage?: { large?: string };
    synopsis?: string;
    startDate?: string;
    averageRating?: string;
    status?: string;
    episodeCount?: number;
    subtype?: string;
  };
}

interface KitsuResponse {
  data: KitsuAnime[];
  meta?: { count?: number };
  links?: { next?: string };
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
  original_language: string;
}

interface TMDBResponse {
  page: number;
  results: TMDBShow[];
  total_pages: number;
}

// Genre mappings for TV
const genreMap: Record<number, string> = {
  10759: "Azione & Avventura", 16: "Animazione", 35: "Commedia",
  80: "Crimine", 99: "Documentario", 18: "Drammatico", 10751: "Famiglia",
  10762: "Kids", 9648: "Mistero", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics", 37: "Western", 28: "Azione", 12: "Avventura",
  14: "Fantastico", 878: "Fantascienza", 27: "Horror", 10749: "Romantico",
};

// Kitsu genre mapping
const kitsuGenres: Record<string, string> = {
  "action": "Azione", "adventure": "Avventura", "comedy": "Commedia",
  "drama": "Drammatico", "fantasy": "Fantastico", "horror": "Horror",
  "mystery": "Mistero", "romance": "Romantico", "sci-fi": "Fantascienza",
  "slice-of-life": "Slice of Life", "sports": "Sport", "supernatural": "Supernaturale",
  "thriller": "Thriller", "ecchi": "Ecchi", "mecha": "Mecha", "music": "Musicale",
};

// Fetch from Kitsu
async function fetchKitsu(endpoint: string, params: Record<string, string> = {}): Promise<KitsuResponse> {
  const url = new URL(`${KITSU_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`Kitsu error: ${response.status}`);
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Fetch TMDB for anime
async function fetchTMDBAnime(endpoint: string, params: Record<string, string> = {}): Promise<TMDBResponse> {
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Fetch multiple pages for more content
async function fetchMultipleTMDBPages(endpoint: string, params: Record<string, string>, maxPages: number = 3): Promise<TMDBShow[]> {
  const results: TMDBShow[] = [];
  const seen = new Set<number>();
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      const response = await fetchTMDBAnime(endpoint, { ...params, page: String(page) });
      for (const show of response.results) {
        if (!seen.has(show.id)) {
          seen.add(show.id);
          results.push(show);
        }
      }
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e);
    }
  }
  
  return results;
}

// Get external IDs from TMDB
async function getImdbId(tmdbId: number): Promise<string | null> {
  try {
    const url = `${TMDB_BASE}/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const data = await response.json();
    return data.imdb_id || null;
  } catch {
    return null;
  }
}

// Convert Kitsu to Stremio
function kitsuToStremio(anime: KitsuAnime) {
  const attr = anime.attributes;
  const title = attr.titles?.en || attr.titles?.en_jp || attr.canonicalTitle;
  const year = attr.startDate?.split("-")[0];
  
  return {
    id: `kitsu:${anime.id}`,
    type: "anime",
    name: title,
    poster: attr.posterImage?.medium || null,
    background: attr.coverImage?.large || null,
    description: attr.synopsis || "",
    releaseInfo: year || "",
    imdbRating: attr.averageRating ? (parseFloat(attr.averageRating) / 10).toFixed(1) : undefined,
    status: attr.status,
    episodeCount: attr.episodeCount,
  };
}

// Convert TMDB anime to Stremio
async function tmdbToStremio(show: TMDBShow) {
  const genres = show.genre_ids?.map(id => genreMap[id]).filter(Boolean);
  const imdbId = await getImdbId(show.id);
  
  return {
    id: imdbId || `tmdb${show.id}`,
    tmdb_id: show.id,
    imdb_id: imdbId || undefined,
    type: "anime",
    name: show.name,
    poster: show.poster_path ? `${TMDB_IMAGE_BASE}${show.poster_path}` : null,
    background: show.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : null,
    description: show.overview || "",
    releaseInfo: show.first_air_date?.split("-")[0] || "",
    imdbRating: show.vote_average?.toFixed(1),
    genres: genres?.length > 0 ? genres : undefined,
  };
}

// Main catalog function
export async function getAnimeCatalog(catalogId: string, skip: number = 0): Promise<unknown[]> {
  const page = Math.floor(skip / 20) + 1;
  
  // Map catalog IDs to Kitsu/TMDB parameters
  try {
    switch (catalogId) {
      // Trending - use TMDB anime with multiple pages for more content
      case "anime_trending":
        const trendingShows = await fetchMultipleTMDBPages("/trending/tv/week", { with_genres: "16" }, 3);
        const trendingFiltered = trendingShows.filter(s => s.original_language === "ja");
        return Promise.all(trendingFiltered.slice(0, 60).map(tmdbToStremio));
      
      // Top rated anime - multiple pages
      case "anime_top":
        const topShows = await fetchMultipleTMDBPages("/tv/top_rated", { with_genres: "16" }, 3);
        const topFiltered = topShows.filter(s => s.original_language === "ja");
        return Promise.all(topFiltered.slice(0, 60).map(tmdbToStremio));
      
      // Currently airing
      case "anime_airing":
        const airing = await fetchTMDBAnime("/discover/tv", {
          with_genres: "16",
          with_original_language: "ja",
          "air_date.gte": new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          sort_by: "popularity.desc",
        });
        return Promise.all(airing.results.slice(0, 20).map(tmdbToStremio));
      
      // Upcoming
      case "anime_upcoming":
        const upcoming = await fetchTMDBAnime("/discover/tv", {
          with_genres: "16",
          with_original_language: "ja",
          "air_date.gte": new Date().toISOString().split("T")[0],
          sort_by: "popularity.desc",
        });
        return Promise.all(upcoming.results.slice(0, 20).map(tmdbToStremio));
      
      // Popular - multiple pages
      case "anime_popular":
        const popularShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(popularShows.slice(0, 60).map(tmdbToStremio));
      
      // By genre - using TMDB with multiple pages
      case "anime_action":
        const actionShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "10759",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(actionShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_romance":
        const romanceShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16,10749",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(romanceShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_horror":
        const horrorShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16,27",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(horrorShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_mystery":
        const mysteryShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16,9648",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(mysteryShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_scifi":
        const scifiShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16,878",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(scifiShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_fantasy":
        const fantasyShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16,14",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(fantasyShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_comedy":
        const comedyShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16,35",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(comedyShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_drama":
        const dramaShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16,18",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(dramaShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_mecha":
        const mechaShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "popularity.desc",
        }, 3);
        return Promise.all(mechaShows.slice(0, 60).map(tmdbToStremio));
      
      case "anime_slice_of_life":
        const sliceShows = await fetchMultipleTMDBPages("/discover/tv", {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "vote_average.desc",
          "vote_count.gte": "20",
        }, 3);
        return Promise.all(sliceShows.slice(0, 60).map(tmdbToStremio));
      
      // Movies
      case "anime_movies":
        const movies = await fetchTMDBAnime("/discover/movie", {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "popularity.desc",
          page: String(page),
        });
        return Promise.all(movies.results.slice(0, 20).map(async (m) => {
          const meta = await tmdbToStremio(m as unknown as TMDBShow);
          return { ...meta, type: "anime" };
        }));
      
      // Classics
      case "anime_classics":
        const classics = await fetchTMDBAnime("/discover/tv", {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "vote_average.desc",
          "vote_count.gte": "100",
          page: String(page),
        });
        return Promise.all(classics.results.slice(0, 20).map(tmdbToStremio));
      
      // Random
      case "anime_random":
        const randomPage = Math.floor(Math.random() * 10) + 1;
        const random = await fetchTMDBAnime("/discover/tv", {
          with_genres: "16",
          with_original_language: "ja",
          sort_by: "popularity.desc",
          page: String(randomPage),
        });
        return Promise.all(random.results.sort(() => Math.random() - 0.5).slice(0, 20).map(tmdbToStremio));
      
      default:
        // Default to trending anime
        const defaultData = await fetchTMDBAnime("/trending/tv/week", { with_genres: "16" });
        return Promise.all(defaultData.results.filter(s => s.original_language === "ja").slice(0, 20).map(tmdbToStremio));
    }
  } catch (error) {
    console.error("Anime catalog error:", error);
    return [];
  }
}

// Get anime meta by Kitsu ID
export async function getAnimeMeta(kitsuId: string) {
  try {
    const response = await fetch(`${KITSU_BASE}/anime/${kitsuId}`, {
      headers: {
        "Accept": "application/vnd.api+json",
      },
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return kitsuToStremio(data.data);
  } catch (error) {
    console.error("Anime meta error:", error);
    return null;
  }
}
