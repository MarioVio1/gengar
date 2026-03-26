// Top Streaming API integration
// API Documentation: https://api.top-streaming.stream/api-redoc

const TOP_STREAMING_BASE_URL = "https://api.top-streaming.stream";

interface TopStreamingMovie {
  id: string;
  title: string;
  year?: string;
  poster?: string;
  backdrop?: string;
  description?: string;
  imdb_id?: string;
  tmdb_id?: string;
  rating?: number;
  genres?: string[];
}

interface TopStreamingResponse {
  results: TopStreamingMovie[];
  page?: number;
  total_pages?: number;
}

// Fetch from Top Streaming API
export async function fetchTopStreaming(
  apiKey: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<TopStreamingResponse | null> {
  if (!apiKey) return null;

  try {
    const url = new URL(`${TOP_STREAMING_BASE_URL}${endpoint}`);
    url.searchParams.set("api_key", apiKey);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Top Streaming API error: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error("Top Streaming API fetch error:", error);
    return null;
  }
}

// Get popular movies from Top Streaming
export async function getTopStreamingPopular(
  apiKey: string,
  page: number = 1
): Promise<TopStreamingMovie[] | null> {
  const data = await fetchTopStreaming(apiKey, "/movies/popular", {
    page: page.toString(),
  });
  return data?.results || null;
}

// Get trending movies from Top Streaming
export async function getTopStreamingTrending(
  apiKey: string,
  page: number = 1
): Promise<TopStreamingMovie[] | null> {
  const data = await fetchTopStreaming(apiKey, "/movies/trending", {
    page: page.toString(),
  });
  return data?.results || null;
}

// Search movies on Top Streaming
export async function searchTopStreaming(
  apiKey: string,
  query: string,
  page: number = 1
): Promise<TopStreamingMovie[] | null> {
  const data = await fetchTopStreaming(apiKey, "/search", {
    query,
    page: page.toString(),
  });
  return data?.results || null;
}

// Get movie details from Top Streaming
export async function getTopStreamingMovie(
  apiKey: string,
  movieId: string
): Promise<TopStreamingMovie | null> {
  try {
    const response = await fetch(
      `${TOP_STREAMING_BASE_URL}/movie/${movieId}?api_key=${apiKey}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// Convert Top Streaming movie to Stremio format
export function topStreamingToStremio(movie: TopStreamingMovie, type: string = "movie") {
  return {
    id: movie.imdb_id || movie.tmdb_id ? 
      (movie.imdb_id || `tmdb${movie.tmdb_id}`) : 
      `ts_${movie.id}`,
    type,
    name: movie.title,
    poster: movie.poster || null,
    background: movie.backdrop || null,
    description: movie.description || "",
    releaseInfo: movie.year || "",
    imdbRating: movie.rating?.toFixed(1),
    genres: movie.genres,
  };
}

// Check if API key is valid
export async function validateTopStreamingKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;

  try {
    const response = await fetch(
      `${TOP_STREAMING_BASE_URL}/user?api_key=${apiKey}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
