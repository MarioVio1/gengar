import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

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
  53: "Thriller",
  10752: "Guerra",
  37: "Western",
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

// Fetch TMDB with error handling
async function fetchTMDB(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<TMDBResponse> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  
  return response.json();
}

// Convert TMDB movie to Stremio format
function tmdbToStremio(movie: TMDBMovie) {
  const genres = movie.genre_ids
    .map(id => genreMap[id])
    .filter(Boolean);

  return {
    id: `tt${movie.id}`,
    type: "movie",
    name: movie.title,
    poster: movie.poster_path 
      ? `${TMDB_IMAGE_BASE}${movie.poster_path}` 
      : null,
    background: movie.backdrop_path 
      ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` 
      : null,
    description: movie.overview,
    releaseInfo: movie.release_date?.split("-")[0] || "",
    imdbRating: movie.vote_average?.toFixed(1),
    genres: genres.length > 0 ? genres : undefined,
  };
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "public, max-age=3600",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const skip = parseInt(searchParams.get("skip") || "0");
  const page = Math.floor(skip / 20) + 1;
  const genre = searchParams.get("genre");
  const year = searchParams.get("year");

  try {
    let response: TMDBResponse;
    let movies: TMDBMovie[] = [];

    switch (id) {
      case "trending":
        response = await fetchTMDB("/trending/movie/week", { page: page.toString() });
        movies = response.results;
        break;

      case "top_rated":
        response = await fetchTMDB("/movie/top_rated", { page: page.toString() });
        movies = response.results;
        break;

      case "hidden_gems":
        response = await fetchTMDB("/discover/movie", {
          page: page.toString(),
          "vote_count.gte": "100",
          "vote_average.gte": "7",
          "popularity.lte": "50",
          sort_by: "vote_average.desc",
        });
        movies = response.results;
        break;

      case "now_playing":
        response = await fetchTMDB("/movie/now_playing", { page: page.toString() });
        movies = response.results;
        break;

      case "upcoming":
        response = await fetchTMDB("/movie/upcoming", { page: page.toString() });
        movies = response.results;
        break;

      case "best_80s":
        response = await fetchTMDB("/discover/movie", {
          page: page.toString(),
          "primary_release_date.gte": "1980-01-01",
          "primary_release_date.lte": "1989-12-31",
          sort_by: "popularity.desc",
        });
        movies = response.results;
        break;

      case "best_90s":
        response = await fetchTMDB("/discover/movie", {
          page: page.toString(),
          "primary_release_date.gte": "1990-01-01",
          "primary_release_date.lte": "1999-12-31",
          sort_by: "popularity.desc",
        });
        movies = response.results;
        break;

      case "best_2000s":
        response = await fetchTMDB("/discover/movie", {
          page: page.toString(),
          "primary_release_date.gte": "2000-01-01",
          "primary_release_date.lte": "2009-12-31",
          sort_by: "popularity.desc",
        });
        movies = response.results;
        break;

      case "best_2010s":
        response = await fetchTMDB("/discover/movie", {
          page: page.toString(),
          "primary_release_date.gte": "2010-01-01",
          "primary_release_date.lte": "2019-12-31",
          sort_by: "popularity.desc",
        });
        movies = response.results;
        break;

      case "best_2020s":
        response = await fetchTMDB("/discover/movie", {
          page: page.toString(),
          "primary_release_date.gte": "2020-01-01",
          "primary_release_date.lte": "2029-12-31",
          sort_by: "popularity.desc",
        });
        movies = response.results;
        break;

      case "random_night":
        // Build params for random night
        const randomParams: Record<string, string> = {
          page: String(Math.floor(Math.random() * 10) + 1),
          sort_by: "popularity.desc",
        };

        if (genre && genre !== "all") {
          randomParams.with_genres = genre;
        }

        if (year && year !== "all") {
          if (year.includes("-")) {
            const [start, end] = year.split("-");
            randomParams["primary_release_date.gte"] = `${start}-01-01`;
            randomParams["primary_release_date.lte"] = `${end}-12-31`;
          } else {
            randomParams.primary_release_year = year;
          }
        }

        response = await fetchTMDB("/discover/movie", randomParams);
        // Shuffle results for randomness
        movies = response.results.sort(() => Math.random() - 0.5);
        break;

      default:
        return NextResponse.json(
          { metas: [], error: "Catalog not found" },
          { status: 404, headers: corsHeaders }
        );
    }

    // Convert to Stremio format
    const metas = movies.map(tmdbToStremio);

    return NextResponse.json(
      {
        metas,
        cacheMaxAge: 3600,
        staleRevalidate: 86400,
      },
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error("TMDB API error:", error);
    return NextResponse.json(
      { 
        metas: [], 
        error: error instanceof Error ? error.message : "Failed to fetch movies" 
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
