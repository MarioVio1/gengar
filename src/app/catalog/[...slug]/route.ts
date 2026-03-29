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

interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  vote_average: number;
  genre_ids: number[];
  popularity: number;
}

interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

// Fetch TMDB with timeout
async function fetchTMDB(endpoint: string, params: Record<string, string> = {}): Promise<TMDBResponse> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`);
    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

function tmdbToStremio(movie: TMDBMovie, type: string = "movie") {
  const genres = movie.genre_ids.map(id => genreMap[id]).filter(Boolean);
  return {
    id: `tmdb${movie.id}`,
    type,
    name: movie.title,
    poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
    description: movie.overview,
    releaseInfo: movie.release_date?.split("-")[0] || "",
    imdbRating: movie.vote_average?.toFixed(1),
    genres: genres.length > 0 ? genres : undefined,
  };
}

function getRandomNightSeed(): number {
  const now = new Date();
  const hour = now.getHours();
  const seedDate = new Date(now);
  if (hour < 2) seedDate.setDate(seedDate.getDate() - 1);
  return seedDate.getFullYear() * 10000 + (seedDate.getMonth() + 1) * 100 + seedDate.getDate();
}

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

function removeDuplicates(movies: TMDBMovie[]): TMDBMovie[] {
  const seen = new Set<number>();
  return movies.filter(m => !seen.has(m.id) && seen.add(m.id));
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

// Check if catalog is a Trakt-style catalog
function isTraktCatalog(catalogId: string): boolean {
  return Object.values(TRAKT_LISTS).some(list => list.id === catalogId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  if (slug.length < 2) return NextResponse.json({ metas: [] }, { status: 400, headers: corsHeaders });

  const type = slug[0];
  let catalogId = slug[1].replace(".json", "");
  let skip = 0;
  let genre: string | null = null;

  // Check if this is an anime catalog by catalogId
  const isAnimeCatalog = catalogId.startsWith("anime_");

  // Get shuffle and erdb from query params
  const url = new URL(request.url);
  const shuffleEnabled = url.searchParams.get("s") === "1";
  const erdbParam = url.searchParams.get("e");
  const erdbConfig = parseERDBConfig(erdbParam);

  for (let i = 2; i < slug.length; i++) {
    const param = slug[i];
    if (param.startsWith("skip=") && param.endsWith(".json")) skip = parseInt(param.slice(5, -5)) || 0;
    else if (param.startsWith("genre=") && param.endsWith(".json")) genre = param.slice(6, -5);
  }

  const page = Math.floor(skip / 20) + 1;
  const genreId = genre ? (type === "series" ? tvGenreNameToId[genre] : genreNameToId[genre]) : null;

  // Get seed for shuffle based on date + catalog
  const getShuffleSeed = () => {
    const now = new Date();
    const dateSeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    return dateSeed + catalogId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  };

  try {
    // Handle Trakt-style catalogs (Marvel, Decades, Top 1000, Anime)
    if (isTraktCatalog(catalogId)) {
      const listKeyMap: Record<string, keyof typeof TRAKT_LISTS> = {
        "trakt_50s": "films_50s",
        "trakt_70s": "films_70s",
        "trakt_80s": "films_80s",
        "trakt_90s": "films_90s",
        "trakt_2000s": "films_2000s",
        "trakt_marvel": "marvel",
        "trakt_top1000": "top_1000",
        "trakt_anime_list": "anime",
      };
      
      const listKey = listKeyMap[catalogId];
      if (listKey) {
        let metas = await getTraktCatalog(listKey, skip, catalogId.includes("random") || shuffleEnabled);
        
        // Apply shuffle if enabled
        if (shuffleEnabled && !catalogId.includes("random")) {
          metas = seededShuffle(metas, getShuffleSeed());
        }
        
        // Set correct type
        let typedMetas = metas.map(m => ({
          ...m,
          type: type === "anime" ? "movie" : m.type
        }));
        
        // Apply ERDB if configured
        if (erdbConfig.enabled) {
          typedMetas = batchApplyERDB(typedMetas, type === "anime" ? "movie" : type as "movie" | "series", erdbConfig);
        }
        
        return NextResponse.json({ metas: typedMetas }, { headers: corsHeaders });
      }
    }
    
    // Handle Anime type (Kitsu catalogs) - check by catalogId since we use type: "movie" in manifest
    if (isAnimeCatalog) {
      let animeMetas = await getAnimeCatalog(catalogId, skip);
      
      // Apply shuffle if enabled
      if (shuffleEnabled) {
        animeMetas = seededShuffle(animeMetas as unknown[], getShuffleSeed()) as unknown[];
      }
      
      // Set type to "movie" for stream compatibility
      let typedMetas = (animeMetas as unknown[]).map(m => ({
        ...m,
        type: "movie"
      }));
      
      // Apply ERDB if configured
      if (erdbConfig.enabled) {
        typedMetas = batchApplyERDB(typedMetas as Array<{id: string; poster?: string; background?: string}>, "movie", erdbConfig);
      }
      
      return NextResponse.json({ metas: typedMetas }, { headers: corsHeaders });
    }
    
    let movies: TMDBMovie[] = [];
    const baseParams: Record<string, string> = { page: page.toString() };
    if (genreId) baseParams.with_genres = genreId;

    // TV Series
    if (type === "series") {
      let response: TMDBResponse;
      
      switch (catalogId) {
        case "tv_trending":
          response = await fetchTMDB("/trending/tv/week", baseParams);
          break;
        case "tv_top_rated":
          response = await fetchTMDB("/tv/top_rated", baseParams);
          break;
        case "tv_on_the_air":
          response = await fetchTMDB("/tv/on_the_air", baseParams);
          break;
        case "tv_netflix":
          response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "213", sort_by: "popularity.desc" });
          break;
        case "tv_hbo":
          response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "49", sort_by: "popularity.desc" });
          break;
        case "tv_apple":
          response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "2552", sort_by: "popularity.desc" });
          break;
        case "tv_disney":
          response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "2739", sort_by: "popularity.desc" });
          break;
        case "tv_kdrama":
          response = await fetchTMDB("/discover/tv", { ...baseParams, with_original_language: "ko", sort_by: "popularity.desc" });
          break;
        case "tv_random_night":
          const tvSeed = getRandomNightSeed();
          response = await fetchTMDB("/discover/tv", {
            page: String(Math.floor(seededRandom(tvSeed)() * 10) + 1),
            sort_by: "popularity.desc", "vote_count.gte": "50"
          });
          movies = seededShuffle(removeDuplicates(response.results), tvSeed);
          break;
        default:
          return NextResponse.json({ metas: [] }, { status: 404, headers: corsHeaders });
      }
      
      if (catalogId !== "tv_random_night") {
        movies = response.results.map(s => ({
          ...s,
          title: (s as unknown as { name: string }).name || s.title,
          release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date,
        }));
      }
      
      let metas = movies.map(m => tmdbToStremio(m, "series"));
      
      // Apply ERDB if configured
      if (erdbConfig.enabled) {
        metas = batchApplyERDB(metas, "series", erdbConfig);
      }
      
      return NextResponse.json({ metas }, { headers: corsHeaders });
      
    } else {
      // Movies
      let response: TMDBResponse;
      
      switch (catalogId) {
        // Main
        case "trending":
          response = await fetchTMDB("/trending/movie/week", baseParams);
          movies = response.results;
          break;
        case "top_rated":
          response = await fetchTMDB("/movie/top_rated", baseParams);
          movies = response.results;
          break;
        case "now_playing":
          response = await fetchTMDB("/movie/now_playing", baseParams);
          movies = response.results;
          break;
        case "hidden_gems":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", "vote_average.gte": "7", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        // Expert
        case "mubi":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "30", "vote_average.gte": "7", with_genres: genreId || "18", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "award_winners":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "300", "vote_average.gte": "7.5", sort_by: "popularity.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "cannes":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", with_genres: genreId || "18", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "venice":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", with_genres: genreId || "18,36", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "criterion":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", "vote_average.gte": "7.5", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "a24":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", "vote_average.gte": "7", "popularity.lte": "150", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        // World
        case "korean":
          response = await fetchTMDB("/discover/movie", { ...baseParams, with_original_language: "ko", "vote_count.gte": "20", sort_by: "popularity.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "italian_classics":
          response = await fetchTMDB("/discover/movie", { ...baseParams, with_original_language: "it", "vote_count.gte": "20", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "french_new_wave":
          response = await fetchTMDB("/discover/movie", { ...baseParams, with_original_language: "fr", "vote_count.gte": "20", "vote_average.gte": "6.5", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "asian_horror":
          response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "27", with_original_language: "ja", "vote_count.gte": "20", sort_by: "popularity.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "ghibli":
          response = await fetchTMDB("/discover/movie", { ...baseParams, with_genres: "16", with_original_language: "ja", "vote_count.gte": "50", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        // Cult
        case "midnight":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", with_genres: genreId || "27,53,878", sort_by: "popularity.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "cult":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", sort_by: "vote_count.desc" });
          movies = removeDuplicates(response.results);
          break;
        // Decades
        case "best_80s":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "1980-01-01", "primary_release_date.lte": "1989-12-31", sort_by: "popularity.desc" });
          movies = response.results;
          break;
        case "best_90s":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "1990-01-01", "primary_release_date.lte": "1999-12-31", sort_by: "popularity.desc" });
          movies = response.results;
          break;
        case "best_2000s":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "2000-01-01", "primary_release_date.lte": "2009-12-31", sort_by: "popularity.desc" });
          movies = response.results;
          break;
        case "best_2010s":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "2010-01-01", "primary_release_date.lte": "2019-12-31", sort_by: "popularity.desc" });
          movies = response.results;
          break;
        case "best_2020s":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "primary_release_date.gte": "2020-01-01", "primary_release_date.lte": "2029-12-31", sort_by: "popularity.desc" });
          movies = response.results;
          break;
        // Random Night - Enhanced with multiple decades
        case "random_night":
          const seed = getRandomNightSeed();
          const rng = seededRandom(seed);
          
          const decades = [
            { start: "1950-01-01", end: "1959-12-31" },
            { start: "1960-01-01", end: "1969-12-31" },
            { start: "1970-01-01", end: "1979-12-31" },
            { start: "1980-01-01", end: "1989-12-31" },
            { start: "1990-01-01", end: "1999-12-31" },
            { start: "2000-01-01", end: "2009-12-31" },
            { start: "2010-01-01", end: "2019-12-31" },
            { start: "2020-01-01", end: "2029-12-31" },
          ];
          
          const allMovies: TMDBMovie[] = [];
          const shuffledDecades = seededShuffle(decades, seed);
          const selectedDecades = shuffledDecades.slice(0, 3);
          
          for (const decade of selectedDecades) {
            const decadeResponse = await fetchTMDB("/discover/movie", {
              page: String(Math.floor(rng() * 5) + 1),
              "primary_release_date.gte": decade.start,
              "primary_release_date.lte": decade.end,
              "vote_count.gte": "50",
              sort_by: "popularity.desc"
            });
            allMovies.push(...decadeResponse.results.slice(0, 10));
          }
          
          movies = seededShuffle(removeDuplicates(allMovies), seed);
          break;
        default:
          return NextResponse.json({ metas: [] }, { status: 404, headers: corsHeaders });
      }
      
      let metas = movies.map(m => tmdbToStremio(m, "movie"));
      
      // Apply ERDB if configured
      if (erdbConfig.enabled) {
        metas = batchApplyERDB(metas, "movie", erdbConfig);
      }
      
      return NextResponse.json({ metas }, { headers: corsHeaders });
    }
  } catch (error) {
    console.error("Catalog API error:", error);
    return NextResponse.json({ metas: [], error: "Failed to fetch" }, { status: 500, headers: corsHeaders });
  }
}
