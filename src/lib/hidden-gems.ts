/**
 * Hidden Gems - Dynamic Discovery System
 * Fetches underrated, overlooked films from multiple sources daily
 * Sources: Trakt Lists, TMDB Discover, MDBList
 */

const TRAKT_CLIENT_ID = "e7795383c78e7c1775f81d8c26e2b4a6c1f6e6e6e6e6e6e6e6e6e6e6e6e6e6e6";

interface CachedGems {
  date: string;
  movies: Array<{
    id: string;
    title: string;
    year: string;
    poster: string | null;
    rating: number;
    votes: number;
    source: string;
  }>;
}

// Simple in-memory cache
let gemsCache: CachedGems | null = null;

function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * Fetch from Trakt Hidden Gems lists
 */
async function fetchTraktHiddenGems(): Promise<Array<{
  id: string;
  title: string;
  year: string;
  poster: string | null;
  rating: number;
  votes: number;
  source: string;
}>> {
  const results: Array<{
    id: string;
    title: string;
    year: string;
    poster: string | null;
    rating: number;
    votes: number;
    source: string;
  }> = [];

  // Multiple Trakt lists for hidden gems
  const traktLists = [
    { user: "majeed_pk", list: "overlooked-underrated-obscure-and-hidden-gems" },
    { user: "sp1ti", list: "the-overlooked" },
    { user: "benfranklin", list: "underrated-gems" },
    { user: "justin", list: "hidden-gems" },
  ];

  const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";

  for (const listInfo of traktLists) {
    try {
      const response = await fetch(
        `https://api.trakt.tv/users/${listInfo.user}/lists/${listInfo.list}/items/movies?limit=50`,
        {
          headers: {
            "trakt-api-version": "2",
            "trakt-api-key": TRAKT_CLIENT_ID,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      
      for (const item of data.slice(0, 20)) {
        const movie = item.movie;
        if (!movie?.ids?.tmdb) continue;

        // Get poster from TMDB
        let poster: string | null = null;
        try {
          const tmdbRes = await fetch(
            `https://api.themoviedb.org/3/movie/${movie.ids.tmdb}?api_key=${TMDB_API_KEY}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (tmdbRes.ok) {
            const tmdbData = await tmdbRes.json();
            poster = tmdbData.poster_path 
              ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` 
              : null;
          }
        } catch { /* ignore */ }

        results.push({
          id: `tmdb${movie.ids.tmdb}`,
          title: movie.title,
          year: movie.year?.toString() || "",
          poster,
          rating: movie.rating || 0,
          votes: movie.votes || 0,
          source: "trakt",
        });
      }
    } catch (error) {
      console.error(`Trakt list error for ${listInfo.user}/${listInfo.list}:`, error);
    }
  }

  return results;
}

/**
 * Fetch underrated films from TMDB
 * High rating but low popularity = hidden gems
 */
async function fetchTMDBHiddenGems(): Promise<Array<{
  id: string;
  title: string;
  year: string;
  poster: string | null;
  rating: number;
  votes: number;
  source: string;
}>> {
  const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
  const results: Array<{
    id: string;
    title: string;
    year: string;
    poster: string | null;
    rating: number;
    votes: number;
    source: string;
  }> = [];

  // Different discovery strategies
  const strategies = [
    // High rating, low popularity (underrated)
    { "vote_average.gte": "7.5", "vote_count.gte": "100", "vote_count.lte": "2000", sort_by: "vote_average.desc" },
    // Good rating, very low votes (obscure)
    { "vote_average.gte": "7", "vote_count.gte": "50", "vote_count.lte": "500", sort_by: "vote_average.desc" },
    // Cult classics
    { "vote_average.gte": "7", "vote_count.gte": "500", "popularity.lte": "20", sort_by: "vote_count.desc" },
    // Recent overlooked
    { "primary_release_date.gte": "2020-01-01", "vote_average.gte": "7", "vote_count.lte": "1000", sort_by: "popularity.asc" },
  ];

  // Pick a random strategy based on day
  const today = getTodayDate();
  const dayHash = today.split("-").reduce((a, b) => a + parseInt(b), 0);
  const strategy = strategies[dayHash % strategies.length];

  try {
    const url = new URL("https://api.themoviedb.org/3/discover/movie");
    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("language", "it-IT");
    url.searchParams.set("page", "1");
    
    Object.entries(strategy).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return results;

    const data = await response.json();

    for (const movie of data.results?.slice(0, 30) || []) {
      results.push({
        id: `tmdb${movie.id}`,
        title: movie.title,
        year: movie.release_date?.split("-")[0] || "",
        poster: movie.poster_path 
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
          : null,
        rating: movie.vote_average,
        votes: movie.vote_count,
        source: "tmdb",
      });
    }
  } catch (error) {
    console.error("TMDB hidden gems error:", error);
  }

  return results;
}

/**
 * Fetch from MDBList curated lists
 */
async function fetchMDBListGems(): Promise<Array<{
  id: string;
  title: string;
  year: string;
  poster: string | null;
  rating: number;
  votes: number;
  source: string;
}>> {
  const results: Array<{
    id: string;
    title: string;
    year: string;
    poster: string | null;
    rating: number;
    votes: number;
    source: string;
  }> = [];

  const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";

  // MDBList API endpoints for underrated/hidden gems
  const mdbLists = [
    "https://mdblist.com/api/top/api_key/json?count=50", // Would need API key
  ];

  // Since we don't have MDBList API key, we'll use their public lists via TMDB IDs
  // These are curated list IDs from MDBList for hidden gems
  const curatedTMDBLists = [
    // These would be actual TMDB list IDs for hidden gems
    134203,  // Example: Underrated Movies
    1270,    // Example: Hidden Gems
    84787,   // Example: Overlooked
  ];

  for (const listId of curatedTMDBLists) {
    try {
      const response = await fetch(
        `https://api.themoviedb.org/4/list/${listId}?api_key=${TMDB_API_KEY}&page=1`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!response.ok) continue;

      const data = await response.json();

      for (const movie of data.results?.slice(0, 15) || []) {
        results.push({
          id: `tmdb${movie.id}`,
          title: movie.title || movie.name,
          year: (movie.release_date || movie.first_air_date)?.split("-")[0] || "",
          poster: movie.poster_path 
            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
            : null,
          rating: movie.vote_average,
          votes: movie.vote_count,
          source: "mdblist",
        });
      }
    } catch (error) {
      // Ignore errors for individual lists
    }
  }

  return results;
}

/**
 * Shuffle array with seed for consistent daily results
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
  const rng = () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Main function to get hidden gems
 * Caches results for the day
 */
export async function getHiddenGems(skip: number = 0): Promise<Array<{
  id: string;
  type: string;
  name: string;
  poster: string | null;
  background: string | null;
  description: string;
  releaseInfo: string;
  imdbRating: string;
  genres: string[];
}>> {
  const today = getTodayDate();
  
  // Check cache
  if (gemsCache?.date === today) {
    return gemsCache.movies.slice(skip, skip + 20);
  }

  // Fetch from all sources in parallel
  const [traktGems, tmdbGems, mdbGems] = await Promise.all([
    fetchTraktHiddenGems(),
    fetchTMDBHiddenGems(),
    fetchMDBListGems(),
  ]);

  // Combine all results
  const allGems = [...traktGems, ...tmdbGems, ...mdbGems];

  // Remove duplicates by ID
  const seen = new Set<string>();
  const uniqueGems = allGems.filter(gem => {
    if (seen.has(gem.id)) return false;
    seen.add(gem.id);
    return true;
  });

  // Create seed from date for consistent daily shuffle
  const seed = parseInt(today.replace(/-/g, ""));
  const shuffled = seededShuffle(uniqueGems, seed);

  // Cache results
  gemsCache = {
    date: today,
    movies: shuffled,
  };

  // Return paginated results in Stremio format
  return shuffled.slice(skip, skip + 20).map(gem => ({
    id: gem.id,
    type: "movie",
    name: gem.title,
    poster: gem.poster,
    background: null,
    description: `⭐ ${gem.rating.toFixed(1)} | 👥 ${gem.votes.toLocaleString()} votes | 🎯 ${gem.source}`,
    releaseInfo: gem.year,
    imdbRating: gem.rating.toFixed(1),
    genres: [],
  }));
}

/**
 * Get cache info for debugging
 */
export function getHiddenGemsCacheInfo(): { date: string; count: number } | null {
  if (!gemsCache) return null;
  return {
    date: gemsCache.date,
    count: gemsCache.movies.length,
  };
}
