// TMDB API Service
const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
}

export interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

// Genre mapping for Italian names
const genreMap: Record<number, string> = {
  28: "Azione",
  12: "Avventura",
  16: "Animazione",
  35: "Commedia",
  80: "Crimine",
  99: "Documentario",
  18: "Drammatico",
  10751: "Famiglia",
  14: "Fantastico",
  36: "Storico",
  27: "Horror",
  10402: "Musica",
  9648: "Mistero",
  10749: "Romantico",
  878: "Fantascienza",
  10770: "Film TV",
  53: "Thriller",
  10752: "Guerra",
  37: "Western",
};

// Fetch with caching
const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const cacheKey = `${endpoint}-${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  cache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}

// Convert TMDB movie to Stremio format
export function tmdbToStremio(movie: TMDBMovie) {
  const genres = movie.genre_ids
    .map(id => genreMap[id])
    .filter(Boolean);

  return {
    id: `tt${movie.id}`, // Using tmdb id with tt prefix for Stremio compatibility
    type: "movie",
    name: movie.title,
    poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
    description: movie.overview,
    releaseInfo: movie.release_date?.split("-")[0] || "",
    imdbRating: movie.vote_average?.toFixed(1),
    genres: genres,
    popularity: movie.popularity,
  };
}

// Get trending movies (for Reddit-style trending)
export async function getTrendingMovies(page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/trending/movie/week", { page: page.toString() });
}

// Get top rated movies (for AI recommended)
export async function getTopRatedMovies(page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/movie/top_rated", { page: page.toString() });
}

// Get popular movies
export async function getPopularMovies(page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/movie/popular", { page: page.toString() });
}

// Get movies by year range
export async function getMoviesByYear(startYear: number, endYear: number, page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/discover/movie", {
    page: page.toString(),
    "primary_release_date.gte": `${startYear}-01-01`,
    "primary_release_date.lte": `${endYear}-12-31`,
    sort_by: "popularity.desc",
  });
}

// Get movies by genre
export async function getMoviesByGenre(genreId: number, page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/discover/movie", {
    page: page.toString(),
    with_genres: genreId.toString(),
    sort_by: "popularity.desc",
  });
}

// Search movies
export async function searchMovies(query: string, page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/search/movie", {
    query,
    page: page.toString(),
  });
}

// Get now playing movies
export async function getNowPlayingMovies(page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/movie/now_playing", { page: page.toString() });
}

// Get upcoming movies
export async function getUpcomingMovies(page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/movie/upcoming", { page: page.toString() });
}

// Get hidden gems (low popularity but high rating)
export async function getHiddenGems(page: number = 1): Promise<TMDBResponse> {
  return fetchTMDB<TMDBResponse>("/discover/movie", {
    page: page.toString(),
    "vote_count.gte": "100",
    "vote_average.gte": "7",
    "popularity.lte": "50",
    sort_by: "vote_average.desc",
  });
}

// Get movie details with IMDB ID
export async function getMovieDetails(movieId: number): Promise<{
  imdb_id: string;
  runtime: number;
  budget: number;
  revenue: number;
  status: string;
}> {
  return fetchTMDB(`/movie/${movieId}`, {});
}

// Get all genres
export async function getGenres(): Promise<{ genres: { id: number; name: string }[] }> {
  return fetchTMDB("/genre/movie/list", {});
}

// Export genre ID map for filtering
export const genreIds = {
  azione: 28,
  avventura: 12,
  animazione: 16,
  commedia: 35,
  crimine: 80,
  documentario: 99,
  drammatico: 18,
  famiglia: 10751,
  fantastico: 14,
  storico: 36,
  horror: 27,
  musica: 10402,
  mistero: 9648,
  romantico: 10749,
  fantascienza: 878,
  thriller: 53,
  guerra: 10752,
  western: 37,
};

// Get decade ranges
export const decadeRanges = {
  "1980": { start: 1980, end: 1989 },
  "1990": { start: 1990, end: 1999 },
  "2000": { start: 2000, end: 2009 },
  "2010": { start: 2010, end: 2019 },
  "2020": { start: 2020, end: 2029 },
};
