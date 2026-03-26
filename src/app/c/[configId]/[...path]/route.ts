import { NextRequest, NextResponse } from "next/server";
import { decodeConfig, AddonConfig } from "@/lib/config";
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

interface TMDBMovie {
  id: number;
  title: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date: string;
  first_air_date?: string;
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

async function fetchTMDB(endpoint: string, params: Record<string, string> = {}): Promise<TMDBResponse> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  
  const response = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });
  
  if (!response.ok) throw new Error(`TMDB API error: ${response.status}`);
  return response.json();
}

function tmdbToStremio(movie: TMDBMovie, type: string = "movie") {
  return {
    id: `tmdb${movie.id}`,
    type,
    name: movie.title || movie.name,
    poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
    description: movie.overview,
    releaseInfo: (movie.release_date || movie.first_air_date)?.split("-")[0] || "",
    imdbRating: movie.vote_average?.toFixed(1),
    genres: movie.genre_ids.map(id => genreMap[id]).filter(Boolean),
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

function isTraktCatalog(catalogId: string): boolean {
  return Object.values(TRAKT_LISTS).some(list => list.id === catalogId);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string; path: string[] }> }
) {
  const { configId, path } = await params;
  const config = decodeConfig(configId);
  
  // Extract config params
  const topStreamingKey = config.ts || "";
  const shuffleEnabled = config.s || false;
  const erdbConfigString = config.e || "";
  const erdbConfig = parseERDBConfig(erdbConfigString || null);
  
  const resource = path[0];
  const type = path[1];
  const idWithExt = path[2];
  const id = idWithExt?.replace(".json", "") || "";
  
  // Extra path params (skip, genre)
  let skip = 0;
  let genre: string | null = null;
  for (let i = 3; i < path.length; i++) {
    const param = path[i];
    if (param.startsWith("skip=")) skip = parseInt(param.slice(5)) || 0;
    else if (param.startsWith("genre=")) genre = param.slice(6);
  }
  
  try {
    // CATALOG
    if (resource === "catalog") {
      const page = Math.floor(skip / 20) + 1;
      const genreId = genre ? (type === "series" ? tvGenreNameToId[genre] : genreNameToId[genre]) : null;
      const baseParams: Record<string, string> = { page: page.toString() };
      if (genreId) baseParams.with_genres = genreId;
      
      const getShuffleSeed = () => {
        const now = new Date();
        const dateSeed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        return dateSeed + id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      };
      
      let metas: unknown[] = [];
      
      // Trakt catalogs
      if (isTraktCatalog(id)) {
        const listKeyMap: Record<string, keyof typeof TRAKT_LISTS> = {
          "trakt_50s": "films_50s", "trakt_70s": "films_70s", "trakt_80s": "films_80s",
          "trakt_90s": "films_90s", "trakt_2000s": "films_2000s",
          "trakt_marvel": "marvel", "trakt_top1000": "top_1000", "trakt_anime_list": "anime",
        };
        const listKey = listKeyMap[id];
        if (listKey) {
          metas = await getTraktCatalog(listKey, skip, shuffleEnabled);
          metas = metas.map(m => ({ ...m, type: type === "anime" ? "anime" : m.type }));
          if (shuffleEnabled) metas = seededShuffle(metas as unknown[], getShuffleSeed());
          if (erdbConfig.enabled) metas = batchApplyERDB(metas as Array<{id: string}>, type as "movie" | "series", erdbConfig);
        }
        return NextResponse.json({ metas }, { headers: corsHeaders });
      }
      
      // Anime catalogs
      if (type === "anime") {
        metas = await getAnimeCatalog(id, skip);
        metas = (metas as unknown[]).map(m => ({ ...m, type: "anime" }));
        if (shuffleEnabled) metas = seededShuffle(metas as unknown[], getShuffleSeed());
        if (erdbConfig.enabled) metas = batchApplyERDB(metas as Array<{id: string}>, "series", erdbConfig);
        return NextResponse.json({ metas }, { headers: corsHeaders });
      }
      
      // Series catalogs
      if (type === "series") {
        let response: TMDBResponse;
        let movies: TMDBMovie[] = [];
        
        switch (id) {
          case "tv_trending":
            response = await fetchTMDB("/trending/tv/week", baseParams);
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_top_rated":
            response = await fetchTMDB("/tv/top_rated", baseParams);
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_on_the_air":
            response = await fetchTMDB("/tv/on_the_air", baseParams);
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_netflix":
            response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "213", sort_by: "popularity.desc" });
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_hbo":
            response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "49", sort_by: "popularity.desc" });
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_apple":
            response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "2552", sort_by: "popularity.desc" });
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_disney":
            response = await fetchTMDB("/discover/tv", { ...baseParams, with_networks: "2739", sort_by: "popularity.desc" });
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_kdrama":
            response = await fetchTMDB("/discover/tv", { ...baseParams, with_original_language: "ko", sort_by: "popularity.desc" });
            movies = response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date }));
            break;
          case "tv_random_night":
            const tvSeed = getRandomNightSeed();
            response = await fetchTMDB("/discover/tv", { page: String(Math.floor(seededRandom(tvSeed)() * 10) + 1), sort_by: "popularity.desc", "vote_count.gte": "50" });
            movies = seededShuffle(response.results.map(s => ({ ...s, title: (s as unknown as { name: string }).name || s.title, release_date: (s as unknown as { first_air_date: string }).first_air_date || s.release_date })), tvSeed);
            break;
          default:
            return NextResponse.json({ metas: [] }, { headers: corsHeaders });
        }
        
        metas = movies.map(m => tmdbToStremio(m, "series"));
        if (erdbConfig.enabled) metas = batchApplyERDB(metas, "series", erdbConfig);
        return NextResponse.json({ metas }, { headers: corsHeaders });
      }
      
      // Movie catalogs
      let response: TMDBResponse;
      let movies: TMDBMovie[] = [];
      
      switch (id) {
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
        case "mubi":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "30", "vote_average.gte": "7", with_genres: genreId || "18", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "award_winners":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "300", "vote_average.gte": "7.5", sort_by: "popularity.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "cannes":
        case "venice":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "criterion":
        case "a24":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", "vote_average.gte": "7", sort_by: "vote_average.desc" });
          movies = removeDuplicates(response.results);
          break;
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
        case "midnight":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "50", with_genres: genreId || "27,53,878", sort_by: "popularity.desc" });
          movies = removeDuplicates(response.results);
          break;
        case "cult":
          response = await fetchTMDB("/discover/movie", { ...baseParams, "vote_count.gte": "100", "vote_average.gte": "7", sort_by: "vote_count.desc" });
          movies = removeDuplicates(response.results);
          break;
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
          for (const decade of shuffledDecades.slice(0, 3)) {
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
          return NextResponse.json({ metas: [] }, { headers: corsHeaders });
      }
      
      metas = movies.map(m => tmdbToStremio(m, "movie"));
      if (shuffleEnabled) metas = seededShuffle(metas as unknown[], getShuffleSeed());
      if (erdbConfig.enabled) metas = batchApplyERDB(metas, "movie", erdbConfig);
      return NextResponse.json({ metas }, { headers: corsHeaders });
    }
    
    // META
    if (resource === "meta") {
      const tmdbId = id.replace("tmdb", "");
      
      if (type === "movie") {
        const movieUrl = new URL(`${TMDB_BASE_URL}/movie/${tmdbId}`);
        movieUrl.searchParams.set("api_key", TMDB_API_KEY);
        movieUrl.searchParams.set("language", "it-IT");
        movieUrl.searchParams.set("append_to_response", "credits,videos");
        
        const movieResponse = await fetch(movieUrl.toString(), { headers: { "Accept": "application/json" }, cache: "no-store" });
        if (!movieResponse.ok) return NextResponse.json({ meta: null }, { headers: corsHeaders });
        const movie = await movieResponse.json();
        
        const trailer = movie.videos?.results?.find((v: { type: string; site: string }) => v.type === "Trailer" && v.site === "YouTube");
        
        let meta = {
          id: `tmdb${movie.id}`,
          type: "movie",
          name: movie.title,
          poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
          background: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : null,
          description: movie.overview,
          releaseInfo: movie.release_date?.split("-")[0] || "",
          imdbRating: movie.vote_average?.toFixed(1),
          genres: movie.genres?.map((g: { name: string }) => g.name),
          runtime: movie.runtime ? `${movie.runtime} min` : undefined,
          director: movie.credits?.crew?.find((c: { job: string }) => c.job === "Director")?.name,
          cast: movie.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name),
          trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
        };
        
        if (erdbConfig.enabled) meta = { ...meta, poster: `https://marcogian-erpb.hf.space/poster/movie/${movie.id}?c=${erdbConfigString}` };
        return NextResponse.json({ meta }, { headers: corsHeaders });
      }
      
      if (type === "series") {
        const showUrl = new URL(`${TMDB_BASE_URL}/tv/${tmdbId}`);
        showUrl.searchParams.set("api_key", TMDB_API_KEY);
        showUrl.searchParams.set("language", "it-IT");
        showUrl.searchParams.set("append_to_response", "credits,videos");
        
        const showResponse = await fetch(showUrl.toString(), { headers: { "Accept": "application/json" }, cache: "no-store" });
        if (!showResponse.ok) return NextResponse.json({ meta: null }, { headers: corsHeaders });
        const show = await showResponse.json();
        
        const trailer = show.videos?.results?.find((v: { type: string; site: string }) => v.type === "Trailer" && v.site === "YouTube");
        
        let meta = {
          id: `tmdb${show.id}`,
          type: "series",
          name: show.name,
          poster: show.poster_path ? `${TMDB_IMAGE_BASE}${show.poster_path}` : null,
          background: show.backdrop_path ? `https://image.tmdb.org/t/p/original${show.backdrop_path}` : null,
          description: show.overview,
          releaseInfo: show.first_air_date?.split("-")[0] || "",
          imdbRating: show.vote_average?.toFixed(1),
          genres: show.genres?.map((g: { name: string }) => g.name),
          status: show.status,
          seasons: show.number_of_seasons,
          trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : undefined,
        };
        
        if (erdbConfig.enabled) meta = { ...meta, poster: `https://marcogian-erpb.hf.space/poster/series/${show.id}?c=${erdbConfigString}` };
        return NextResponse.json({ meta }, { headers: corsHeaders });
      }
      
      if (type === "anime") {
        const kitsuId = id.replace("kitsu:", "");
        const kitsuUrl = new URL(`https://kitsu.io/api/edge/anime/${kitsuId}`);
        
        const kitsuResponse = await fetch(kitsuUrl.toString(), {
          headers: { "Accept": "application/vnd.api+json" },
          cache: "no-store",
        });
        if (!kitsuResponse.ok) return NextResponse.json({ meta: null }, { headers: corsHeaders });
        const data = await kitsuResponse.json();
        const attrs = data.data.attributes;
        
        const meta = {
          id: `kitsu:${kitsuId}`,
          type: "anime",
          name: attrs.titles?.en || attrs.titles?.en_jp || attrs.canonicalTitle || "Unknown",
          poster: attrs.posterImage?.large || attrs.posterImage?.medium,
          background: attrs.coverImage?.large || null,
          description: attrs.synopsis,
          releaseInfo: attrs.startDate?.split("-")[0] || "",
          imdbRating: attrs.averageRating ? (parseFloat(attrs.averageRating) / 10).toFixed(1) : undefined,
          genres: attrs.categories?.slice(0, 3) || [],
          status: attrs.status,
          episodes: attrs.episodeCount,
          trailer: attrs.youtubeVideoId ? `https://www.youtube.com/watch?v=${attrs.youtubeVideoId}` : undefined,
        };
        
        return NextResponse.json({ meta }, { headers: corsHeaders });
      }
    }
    
    // STREAM
    if (resource === "stream") {
      const streams: Array<{ name: string; title: string; externalUrl?: string; behaviorHints?: { notWebReady?: boolean } }> = [];
      
      // Extract TMDB/Kitsu ID
      const tmdbMatch = id.match(/tmdb(\d+)/);
      const kitsuMatch = id.match(/kitsu:(\d+)/);
      const idParts = id.split(":");
      const season = idParts[1] ? parseInt(idParts[1]) : undefined;
      const episode = idParts[2] ? parseInt(idParts[2]) : undefined;
      
      let title = "Unknown";
      let year = "";
      let imdbId = "";
      
      // Get movie/show info
      if (tmdbMatch && type === "movie") {
        const movieUrl = new URL(`${TMDB_BASE_URL}/movie/${tmdbMatch[1]}`);
        movieUrl.searchParams.set("api_key", TMDB_API_KEY);
        movieUrl.searchParams.set("language", "it-IT");
        movieUrl.searchParams.set("append_to_response", "external_ids,videos");
        
        const movieResponse = await fetch(movieUrl.toString(), { headers: { "Accept": "application/json" }, cache: "no-store" });
        if (movieResponse.ok) {
          const movie = await movieResponse.json();
          title = movie.title;
          year = movie.release_date?.split("-")[0] || "";
          imdbId = movie.external_ids?.imdb_id || "";
        }
      } else if (tmdbMatch && type === "series") {
        const showUrl = new URL(`${TMDB_BASE_URL}/tv/${tmdbMatch[1]}`);
        showUrl.searchParams.set("api_key", TMDB_API_KEY);
        showUrl.searchParams.set("language", "it-IT");
        showUrl.searchParams.set("append_to_response", "external_ids");
        
        const showResponse = await fetch(showUrl.toString(), { headers: { "Accept": "application/json" }, cache: "no-store" });
        if (showResponse.ok) {
          const show = await showResponse.json();
          title = show.name;
          year = show.first_air_date?.split("-")[0] || "";
          imdbId = show.external_ids?.imdb_id || "";
        }
      } else if (kitsuMatch) {
        const kitsuUrl = new URL(`https://kitsu.io/api/edge/anime/${kitsuMatch[1]}`);
        const kitsuResponse = await fetch(kitsuUrl.toString(), { headers: { "Accept": "application/vnd.api+json" }, cache: "no-store" });
        if (kitsuResponse.ok) {
          const data = await kitsuResponse.json();
          const attrs = data.data.attributes;
          title = attrs.titles?.en || attrs.canonicalTitle || "Unknown";
          year = attrs.startDate?.split("-")[0] || "";
        }
      }
      
      // Top Streaming API
      if (topStreamingKey) {
        try {
          const tsUrl = new URL("https://api.top-streaming.stream/api/search");
          tsUrl.searchParams.set("api_key", topStreamingKey);
          if (imdbId) tsUrl.searchParams.set("imdb_id", imdbId);
          tsUrl.searchParams.set("title", title);
          tsUrl.searchParams.set("year", year);
          
          const tsResponse = await fetch(tsUrl.toString(), { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8000) });
          if (tsResponse.ok) {
            const tsData = await tsResponse.json();
            if (tsData.streams && Array.isArray(tsData.streams)) {
              for (const stream of tsData.streams.slice(0, 3)) {
                streams.push({
                  name: "🎬 TopStream",
                  title: `${title} - ${stream.quality || "HD"}`,
                  externalUrl: stream.url,
                  behaviorHints: { notWebReady: true },
                });
              }
            }
          }
        } catch (e) {
          console.log("Top Streaming error:", e);
        }
      }
      
      // Add reference links
      if (imdbId) {
        streams.push({
          name: "🔗 IMDb",
          title: `${title} (${year}) - Cerca su IMDb`,
          externalUrl: `https://www.imdb.com/title/${imdbId}`,
          behaviorHints: { notWebReady: true },
        });
      }
      
      streams.push({
        name: "🎬 TMDB",
        title: `${title} (${year}) - Info`,
        externalUrl: `https://www.themoviedb.org/${type === "series" ? "tv" : "movie"}/${tmdbMatch?.[1] || ""}`,
        behaviorHints: { notWebReady: true },
      });
      
      streams.push({
        name: "🔍 Real-Debrid",
        title: `${title} - Cerca`,
        externalUrl: `https://real-debrid.com/streaming#${imdbId || title}`,
        behaviorHints: { notWebReady: true },
      });
      
      return NextResponse.json({ streams }, { headers: corsHeaders });
    }
    
    return NextResponse.json({ error: "Not found" }, { status: 404 });
    
  } catch (error) {
    console.error("Config route error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
