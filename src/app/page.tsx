"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Film, 
  Shuffle, 
  Play, 
  Star, 
  Download,
  Sparkles,
  Heart,
  Calendar,
  Loader2,
  Copy,
  Check,
  Settings,
  Link2,
  Tv,
  Ghost,
  Moon,
  Zap,
  Save,
  Trash2,
  FolderOpen
} from "lucide-react";

// Saved Configuration interface
interface SavedConfig {
  id: string;
  name: string;
  contentType: string;
  selectedCatalogs: string[];
  topStreamingKey: string;
  shuffleEnabled: boolean;
  erdbConfig: string;
  erdbPoster: boolean;
  erdbBackdrop: boolean;
  erdbLogo: boolean;
  rotation: string;
  createdAt: string;
}

// Storage keys
const STORAGE_KEYS = {
  SAVED_CONFIGS: "gengar_saved_configs",
  LAST_CONFIG: "gengar_last_config",
};

// TMDB Movie type
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

// Genre mapping
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

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// Movie catalogs configuration - Gengar themed
const MOVIE_CATALOGS = [
  // Main catalogs
  { id: "trending", name: "Trending", emoji: "👻", color: "text-purple-400", group: "main" },
  { id: "top_rated", name: "Top Rated", emoji: "💜", color: "text-violet-400", group: "main" },
  { id: "now_playing", name: "Al Cinema", emoji: "🎬", color: "text-fuchsia-400", group: "main" },
  { id: "hidden_gems", name: "Hidden Gems", emoji: "💎", color: "text-indigo-400", group: "main" },
  { id: "romantic", name: "Romantico", emoji: "💕", color: "text-pink-400", group: "main" },
  // Genres
  { id: "genre_action", name: "Azione", emoji: "💥", color: "text-red-400", group: "genre" },
  { id: "genre_adventure", name: "Avventura", emoji: "🗺️", color: "text-emerald-400", group: "genre" },
  { id: "genre_animation", name: "Animazione", emoji: "🎨", color: "text-cyan-400", group: "genre" },
  { id: "genre_comedy", name: "Commedia", emoji: "😂", color: "text-yellow-400", group: "genre" },
  { id: "genre_crime", name: "Crimine", emoji: "🔫", color: "text-slate-400", group: "genre" },
  { id: "genre_documentary", name: "Documentario", emoji: "📹", color: "text-gray-400", group: "genre" },
  { id: "genre_drama", name: "Drammatico", emoji: "🎭", color: "text-rose-400", group: "genre" },
  { id: "genre_family", name: "Famiglia", emoji: "👨‍👩‍👧‍👦", color: "text-amber-400", group: "genre" },
  { id: "genre_fantasy", name: "Fantastico", emoji: "🧙", color: "text-purple-300", group: "genre" },
  { id: "genre_history", name: "Storico", emoji: "📜", color: "text-amber-500", group: "genre" },
  { id: "genre_horror", name: "Horror", emoji: "👻", color: "text-red-500", group: "genre" },
  { id: "genre_music", name: "Musica", emoji: "🎵", color: "text-pink-300", group: "genre" },
  { id: "genre_mystery", name: "Mistero", emoji: "🔍", color: "text-indigo-400", group: "genre" },
  { id: "genre_scifi", name: "Fantascienza", emoji: "🚀", color: "text-cyan-300", group: "genre" },
  { id: "genre_thriller", name: "Thriller", emoji: "🔪", color: "text-red-300", group: "genre" },
  { id: "genre_war", name: "Guerra", emoji: "⚔️", color: "text-orange-400", group: "genre" },
  { id: "genre_western", name: "Western", emoji: "🤠", color: "text-amber-600", group: "genre" },
  // Expert picks
  { id: "mubi", name: "MUBI Picks", emoji: "🎭", color: "text-purple-300", group: "expert" },
  { id: "award_winners", name: "Award Winners", emoji: "🏆", color: "text-yellow-400", group: "expert" },
  { id: "cannes", name: "Cannes Winners", emoji: "🎖️", color: "text-amber-400", group: "expert" },
  { id: "venice", name: "Venezia", emoji: "🦁", color: "text-orange-400", group: "expert" },
  { id: "criterion", name: "Criterion Style", emoji: "📽️", color: "text-slate-400", group: "expert" },
  { id: "a24", name: "A24 Films", emoji: "🎨", color: "text-lime-400", group: "expert" },
  // World cinema
  { id: "korean", name: "Korean Cinema", emoji: "🇰🇷", color: "text-blue-400", group: "world" },
  { id: "italian_classics", name: "Italian Classics", emoji: "🇮🇹", color: "text-green-400", group: "world" },
  { id: "french_new_wave", name: "French Cinema", emoji: "🇫🇷", color: "text-indigo-400", group: "world" },
  { id: "asian_horror", name: "Asian Horror", emoji: "👹", color: "text-red-400", group: "world" },
  { id: "ghibli", name: "Animation Masters", emoji: "✨", color: "text-cyan-400", group: "world" },
  // Cult & Special
  { id: "midnight", name: "Midnight Movies", emoji: "🌙", color: "text-violet-400", group: "cult" },
  { id: "cult", name: "Cult Classics", emoji: "💀", color: "text-purple-300", group: "cult" },
  // Decades
  { id: "best_80s", name: "Anni '80", emoji: "📼", color: "text-pink-400", group: "decade" },
  { id: "best_90s", name: "Anni '90", emoji: "📼", color: "text-purple-400", group: "decade" },
  { id: "best_2000s", name: "Anni 2000", emoji: "💿", color: "text-violet-400", group: "decade" },
  { id: "best_2010s", name: "Anni 2010", emoji: "📱", color: "text-indigo-400", group: "decade" },
  { id: "best_2020s", name: "Anni 2020", emoji: "🎬", color: "text-fuchsia-400", group: "decade" },
  // Trakt Lists
  { id: "trakt_50s", name: "Anni '50", emoji: "🎞️", color: "text-gray-400", group: "trakt" },
  { id: "trakt_70s", name: "Anni '70", emoji: "📽️", color: "text-amber-400", group: "trakt" },
  { id: "trakt_80s", name: "Anni '80 (Trakt)", emoji: "📼", color: "text-pink-400", group: "trakt" },
  { id: "trakt_90s", name: "Anni '90 (Trakt)", emoji: "📼", color: "text-purple-400", group: "trakt" },
  { id: "trakt_2000s", name: "Anni 2000 (Trakt)", emoji: "💿", color: "text-violet-400", group: "trakt" },
  { id: "trakt_marvel", name: "Marvel Universe", emoji: "🦸", color: "text-red-400", group: "trakt" },
  { id: "trakt_top1000", name: "Top 1000", emoji: "🌟", color: "text-yellow-400", group: "trakt" },
  // Random
  { id: "random_night", name: "Random Night", emoji: "🎲", color: "text-purple-400", group: "random" },
];

// TV Series catalogs configuration
const SERIES_CATALOGS = [
  { id: "tv_trending", name: "Trending TV", emoji: "👻", color: "text-purple-400", group: "main" },
  { id: "tv_top_rated", name: "Top Rated TV", emoji: "💜", color: "text-violet-400", group: "main" },
  { id: "tv_on_the_air", name: "In Onda", emoji: "📺", color: "text-blue-400", group: "main" },
  // Platforms
  { id: "tv_netflix", name: "Netflix", emoji: "🔴", color: "text-red-500", group: "platform" },
  { id: "tv_hbo", name: "HBO", emoji: "🟣", color: "text-purple-500", group: "platform" },
  { id: "tv_apple", name: "Apple TV+", emoji: "🍎", color: "text-gray-400", group: "platform" },
  { id: "tv_disney", name: "Disney+", emoji: "🏰", color: "text-blue-400", group: "platform" },
  // International
  { id: "tv_anime", name: "Anime", emoji: "🎌", color: "text-pink-400", group: "world" },
  { id: "tv_kdrama", name: "K-Drama", emoji: "🇰🇷", color: "text-purple-400", group: "world" },
  // Random
  { id: "tv_random_night", name: "Random TV Night", emoji: "🎲", color: "text-violet-400", group: "random" },
];

// Anime catalogs configuration - Kitsu powered
const ANIME_CATALOGS = [
  { id: "anime_trending", name: "Anime Trending", emoji: "🔥", color: "text-orange-400", group: "main" },
  { id: "anime_top", name: "Top Anime", emoji: "💜", color: "text-violet-400", group: "main" },
  { id: "anime_airing", name: "In Corso", emoji: "📺", color: "text-green-400", group: "main" },
  { id: "anime_upcoming", name: "Prossime Uscite", emoji: "📅", color: "text-blue-400", group: "main" },
  { id: "anime_popular", name: "Più Popolari", emoji: "⭐", color: "text-yellow-400", group: "main" },
  // Genres
  { id: "anime_action", name: "Azione", emoji: "⚔️", color: "text-red-400", group: "genre" },
  { id: "anime_romance", name: "Romantico", emoji: "💕", color: "text-pink-400", group: "genre" },
  { id: "anime_horror", name: "Horror", emoji: "👻", color: "text-purple-400", group: "genre" },
  { id: "anime_mystery", name: "Mistero", emoji: "🔍", color: "text-indigo-400", group: "genre" },
  { id: "anime_scifi", name: "Fantascienza", emoji: "🚀", color: "text-cyan-400", group: "genre" },
  { id: "anime_fantasy", name: "Fantastico", emoji: "🧙", color: "text-purple-300", group: "genre" },
  { id: "anime_comedy", name: "Commedia", emoji: "😂", color: "text-yellow-300", group: "genre" },
  { id: "anime_drama", name: "Drammatico", emoji: "🎭", color: "text-rose-400", group: "genre" },
  { id: "anime_mecha", name: "Mecha", emoji: "🤖", color: "text-slate-400", group: "genre" },
  { id: "anime_slice_of_life", name: "Slice of Life", emoji: "🌸", color: "text-pink-300", group: "genre" },
  // Special
  { id: "anime_movies", name: "Film Anime", emoji: "🎬", color: "text-amber-400", group: "special" },
  { id: "anime_classics", name: "Anime Classici", emoji: "📼", color: "text-slate-300", group: "special" },
  { id: "anime_random", name: "Random Anime", emoji: "🎲", color: "text-purple-400", group: "special" },
  // Trakt Anime
  { id: "trakt_anime_list", name: "A Lot of Anime", emoji: "🎌", color: "text-red-300", group: "trakt" },
];

// Content type options
const CONTENT_TYPES = [
  { value: "movie", label: "Film", icon: Film },
  { value: "anime", label: "Anime", icon: Sparkles },
  { value: "series", label: "Serie TV", icon: Tv },
  { value: "both", label: "Film + Serie", icon: Ghost },
  { value: "all", label: "Tutto", icon: Moon },
];

// Genre options for filter
const GENRE_OPTIONS = [
  { value: "all", label: "Tutti i generi" },
  { value: "28", label: "Azione" },
  { value: "35", label: "Commedia" },
  { value: "18", label: "Drammatico" },
  { value: "27", label: "Horror" },
  { value: "10749", label: "Romantico" },
  { value: "878", label: "Fantascienza" },
  { value: "53", label: "Thriller" },
  { value: "14", label: "Fantastico" },
  { value: "16", label: "Animazione" },
];

// Convert TMDB movie to display format
function movieToDisplay(movie: TMDBMovie) {
  return {
    id: movie.id,
    name: movie.title || movie.name || "N/A",
    poster: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    description: movie.overview,
    year: (movie.release_date || movie.first_air_date)?.split("-")[0] || "N/A",
    rating: movie.vote_average?.toFixed(1),
    genre: movie.genre_ids[0] ? genreMap[movie.genre_ids[0]] : null,
    popularity: movie.popularity,
  };
}

// Movie Card Component - Gengar themed
function MovieCard({ movie }: { movie: ReturnType<typeof movieToDisplay> }) {
  return (
    <Card className="group overflow-hidden bg-purple-950/30 hover:bg-purple-900/40 transition-all duration-300 border-purple-500/20 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/20">
      <div className="relative aspect-[2/3] overflow-hidden">
        {movie.poster ? (
          <img
            src={movie.poster}
            alt={movie.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = "https://via.placeholder.com/300x450/2d1b4e/ffffff?text=👻";
            }}
          />
        ) : (
          <div className="w-full h-full bg-purple-950 flex items-center justify-center">
            <Ghost className="w-12 h-12 text-purple-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-purple-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {movie.rating && (
          <div className="absolute top-2 right-2 bg-purple-950/80 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1 border border-purple-500/30">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold text-purple-100">{movie.rating}</span>
          </div>
        )}
      </div>
      <CardContent className="p-3 bg-gradient-to-b from-purple-900/20 to-purple-950/30">
        <h3 className="font-semibold text-sm truncate text-purple-100">{movie.name}</h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-purple-300">{movie.year}</span>
          {movie.genre && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-800/50 text-purple-200 border-purple-500/30">
              {movie.genre}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Fetch TMDB data
async function fetchTMDB(endpoint: string, params: Record<string, string> = {}): Promise<TMDBResponse> {
  const TMDB_API_KEY = "9f6dbcbddf9565f6a0f004fca81f83ee";
  const TMDB_BASE_URL = "https://api.themoviedb.org/3";
  
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  url.searchParams.set("language", "it-IT");
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  return response.json();
}

// Get seed for random night (changes at 2 AM)
function getRandomNightSeed(): number {
  const now = new Date();
  const hour = now.getHours();
  const seedDate = new Date(now);
  
  if (hour < 2) {
    seedDate.setDate(seedDate.getDate() - 1);
  }
  
  const year = seedDate.getFullYear();
  const month = seedDate.getMonth() + 1;
  const day = seedDate.getDate();
  
  return year * 10000 + month * 100 + day;
}

// Seeded random number generator
function seededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Shuffle array with seed
function seededShuffle<T>(array: T[], seed: number): T[] {
  const rng = seededRandom(seed);
  const result = [...array];
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

// Remove duplicates
function removeDuplicates(movies: TMDBMovie[]): TMDBMovie[] {
  const seen = new Set<number>();
  return movies.filter(movie => {
    if (seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
}

// Gengar decoration component
function GengarDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
      <img src="/gengar-mini.jpg" alt="" className="absolute top-10 left-10 w-16 h-16 animate-pulse opacity-50" />
      <img src="/gengar-mini.jpg" alt="" className="absolute top-20 right-20 w-12 h-12 animate-pulse opacity-40" style={{ animationDelay: "0.5s" }} />
      <img src="/gengar-mini.jpg" alt="" className="absolute bottom-20 left-1/4 w-14 h-14 animate-pulse opacity-45" style={{ animationDelay: "1s" }} />
      <img src="/gengar-mini.jpg" alt="" className="absolute top-1/3 right-10 w-10 h-10 animate-pulse opacity-35" style={{ animationDelay: "1.5s" }} />
      <img src="/gengar-mini.jpg" alt="" className="absolute bottom-10 right-1/3 w-12 h-12 animate-pulse opacity-40" style={{ animationDelay: "2s" }} />
    </div>
  );
}

// Catalog Section Component with Genre Filter - Gengar themed
function CatalogSection({ 
  title, 
  emoji, 
  fetchFn,
  color = "text-purple-400",
  showGenreFilter = true 
}: { 
  title: string; 
  emoji: string; 
  fetchFn: (genre?: string) => Promise<TMDBResponse>;
  color?: string;
  showGenreFilter?: boolean;
}) {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState("all");

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      try {
        const genreParam = selectedGenre === "all" ? undefined : selectedGenre;
        const data = await fetchFn(genreParam);
        if (!cancelled) {
          const unique = removeDuplicates(data.results || []);
          setMovies(unique);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [fetchFn, selectedGenre]);

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <h3 className={`text-lg font-bold ${color}`}>{title}</h3>
        </div>
        <p className="text-purple-400">👻 Ops! Qualcosa è andato storto...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <h3 className={`text-lg font-bold ${color}`}>{title}</h3>
        </div>
        {showGenreFilter && (
          <select 
            value={selectedGenre} 
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="px-2 py-1 text-xs rounded-md border-purple-500/30 bg-purple-950/50 text-purple-100"
          >
            {GENRE_OPTIONS.map((genre) => (
              <option key={genre.value} value={genre.value}>
                {genre.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="relative">
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                <div className="aspect-[2/3] bg-purple-950/50 animate-pulse rounded-lg border border-purple-500/20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent">
            {movies.map((movie) => (
              <div key={movie.id} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                <MovieCard movie={movieToDisplay(movie)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Decade Tabs Component - Gengar themed
function DecadeTabs() {
  const [selectedDecade, setSelectedDecade] = useState("2020");
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState("all");

  const decades = [
    { id: "1980", label: "'80s", start: 1980, end: 1989 },
    { id: "1990", label: "'90s", start: 1990, end: 1999 },
    { id: "2000", label: "2000s", start: 2000, end: 2009 },
    { id: "2010", label: "2010s", start: 2010, end: 2019 },
    { id: "2020", label: "2020s", start: 2020, end: 2029 },
  ];

  useEffect(() => {
    let cancelled = false;
    const decade = decades.find(d => d.id === selectedDecade) || decades[4];
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          page: "1",
          "primary_release_date.gte": `${decade.start}-01-01`,
          "primary_release_date.lte": `${decade.end}-12-31`,
          sort_by: "popularity.desc",
        };
        
        if (selectedGenre !== "all") {
          params.with_genres = selectedGenre;
        }
        
        const data = await fetchTMDB("/discover/movie", params);
        if (!cancelled) {
          const unique = removeDuplicates(data.results || []);
          setMovies(unique);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [selectedDecade, selectedGenre]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ghost className="w-6 h-6 text-purple-400" />
          <div>
            <h3 className="text-lg font-bold text-purple-300">📼 Best of the Decade</h3>
            <p className="text-sm text-purple-400">I migliori film per ogni decennio</p>
          </div>
        </div>
        <select 
          value={selectedGenre} 
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="px-2 py-1 text-xs rounded-md border-purple-500/30 bg-purple-950/50 text-purple-100"
        >
          {GENRE_OPTIONS.map((genre) => (
            <option key={genre.value} value={genre.value}>
              {genre.label}
            </option>
          ))}
        </select>
      </div>
      <Tabs value={selectedDecade} onValueChange={setSelectedDecade} className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-lg bg-purple-950/50 border border-purple-500/20">
          {decades.map((decade) => (
            <TabsTrigger 
              key={decade.id} 
              value={decade.id} 
              className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              {decade.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={selectedDecade} className="mt-4">
          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                  <div className="aspect-[2/3] bg-purple-950/50 animate-pulse rounded-lg border border-purple-500/20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent">
              {movies.map((movie) => (
                <div key={movie.id} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                  <MovieCard movie={movieToDisplay(movie)} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Random Movie Night Component - Gengar themed
function RandomMovieNight() {
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [selectedGenre, setSelectedGenre] = useState("all");

  const fetchRandomMovies = useCallback(async (genre?: string) => {
    const seed = getRandomNightSeed();
    const rng = seededRandom(seed);
    const randomPage = Math.floor(rng() * 10) + 1;
    
    const params: Record<string, string> = {
      page: randomPage.toString(),
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    };
    
    if (genre) {
      params.with_genres = genre;
    }
    
    const data = await fetchTMDB("/discover/movie", params);
    let results = removeDuplicates(data.results || []);
    results = seededShuffle(results, seed);
    
    const now = new Date();
    const hour = now.getHours();
    const displayDate = new Date(now);
    if (hour < 2) {
      displayDate.setDate(displayDate.getDate() - 1);
    }
    const dateStr = displayDate.toLocaleDateString("it-IT", { 
      weekday: "long", 
      day: "numeric", 
      month: "long" 
    });
    
    return { results, dateStr };
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const genreParam = selectedGenre === "all" ? undefined : selectedGenre;
        const { results, dateStr } = await fetchRandomMovies(genreParam);
        if (!cancelled) {
          setMovies(results);
          setLastUpdate(dateStr);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [fetchRandomMovies, selectedGenre]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/gengar-mini.jpg" alt="Gengar" className="w-10 h-10 animate-bounce" />
          <div>
            <h3 className="text-lg font-bold text-purple-300">🎲 Random Night</h3>
            <p className="text-sm text-purple-400">
              Nuova selezione ogni notte alle 2:00 • {lastUpdate && (
                <span className="text-purple-300 font-medium capitalize">{lastUpdate}</span>
              )}
            </p>
          </div>
        </div>
        <select 
          value={selectedGenre} 
          onChange={(e) => setSelectedGenre(e.target.value)}
          className="px-2 py-1 text-xs rounded-md border-purple-500/30 bg-purple-950/50 text-purple-100"
        >
          {GENRE_OPTIONS.map((genre) => (
            <option key={genre.value} value={genre.value}>
              {genre.label}
            </option>
          ))}
        </select>
      </div>

      <div className="relative">
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                <div className="aspect-[2/3] bg-purple-950/50 animate-pulse rounded-lg border border-purple-500/20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent">
            {movies.map((movie) => (
              <div key={movie.id} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                <MovieCard movie={movieToDisplay(movie)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// TV Series Random Night Component - Gengar themed
function TVRandomNight() {
  const [shows, setShows] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const fetchRandomShows = useCallback(async () => {
    const seed = getRandomNightSeed();
    const rng = seededRandom(seed);
    const randomPage = Math.floor(rng() * 10) + 1;
    
    const data = await fetchTMDB("/discover/tv", {
      page: randomPage.toString(),
      sort_by: "popularity.desc",
      "vote_count.gte": "50",
    });
    
    let results = removeDuplicates(data.results || []);
    results = seededShuffle(results, seed);
    
    const now = new Date();
    const hour = now.getHours();
    const displayDate = new Date(now);
    if (hour < 2) {
      displayDate.setDate(displayDate.getDate() - 1);
    }
    const dateStr = displayDate.toLocaleDateString("it-IT", { 
      weekday: "long", 
      day: "numeric", 
      month: "long" 
    });
    
    return { results, dateStr };
  }, []);

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const { results, dateStr } = await fetchRandomShows();
        if (!cancelled) {
          setShows(results);
          setLastUpdate(dateStr);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, [fetchRandomShows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Tv className="w-6 h-6 text-purple-400" />
        <div>
          <h3 className="text-lg font-bold text-purple-300">🎲 Random TV Night</h3>
          <p className="text-sm text-purple-400">
            Nuova selezione ogni notte alle 2:00 • {lastUpdate && (
              <span className="text-purple-300 font-medium capitalize">{lastUpdate}</span>
            )}
          </p>
        </div>
      </div>

      <div className="relative">
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                <div className="aspect-[2/3] bg-purple-950/50 animate-pulse rounded-lg border border-purple-500/20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500/30 scrollbar-track-transparent">
            {shows.map((show) => (
              <div key={show.id} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                <MovieCard movie={movieToDisplay(show)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Config Panel - Gengar themed
function ConfigPanel({ 
  selectedCatalogs, 
  onToggle,
  contentType,
  onContentTypeChange,
  manifestUrl,
  topStreamingKey,
  onTopStreamingKeyChange,
  shuffleEnabled,
  onShuffleChange,
  rotation,
  onRotationChange,
  erdbConfig,
  onErdbConfigChange,
  erdbPoster,
  onErdbPosterChange,
  erdbBackdrop,
  onErdbBackdropChange,
  erdbLogo,
  onErdbLogoChange,
}: { 
  selectedCatalogs: string[];
  onToggle: (id: string) => void;
  contentType: string;
  onContentTypeChange: (type: string) => void;
  manifestUrl: string;
  topStreamingKey: string;
  onTopStreamingKeyChange: (key: string) => void;
  shuffleEnabled: boolean;
  onShuffleChange: (enabled: boolean) => void;
  rotation: string;
  onRotationChange: (rotation: string) => void;
  erdbConfig: string;
  onErdbConfigChange: (config: string) => void;
  erdbPoster: boolean;
  onErdbPosterChange: (enabled: boolean) => void;
  erdbBackdrop: boolean;
  onErdbBackdropChange: (enabled: boolean) => void;
  erdbLogo: boolean;
  onErdbLogoChange: (enabled: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(manifestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = manifestUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const stremioUrl = `stremio://${manifestUrl.replace(/^https?:\/\//, "")}`;

  const getMovieCatalogsByGroup = (group: string) => MOVIE_CATALOGS.filter(c => c.group === group);
  const getSeriesCatalogsByGroup = (group: string) => SERIES_CATALOGS.filter(c => c.group === group);
  const getAnimeCatalogsByGroup = (group: string) => ANIME_CATALOGS.filter(c => c.group === group);

  return (
    <Card className="p-6 bg-gradient-to-b from-purple-950/50 to-purple-950/30 border-purple-500/30">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-bold text-purple-200">👻 Configura il tuo Addon</h3>
      </div>
      <p className="text-sm text-purple-400 mb-4">
        Seleziona il tipo di contenuto e i cataloghi, poi copia l&apos;URL
      </p>
      
      {/* Content Type Selection */}
      <div className="mb-6">
        <Label className="text-sm font-semibold mb-3 block text-purple-300">Tipo di Contenuto</Label>
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                key={type.value}
                variant={contentType === type.value ? "default" : "outline"}
                size="sm"
                onClick={() => onContentTypeChange(type.value)}
                className={`gap-2 ${contentType === type.value ? 'bg-purple-600 hover:bg-purple-700' : 'border-purple-500/30 text-purple-300 hover:bg-purple-900/50'}`}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Shuffle Toggle */}
      <div className="mb-6 p-4 bg-purple-950/30 rounded-lg border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shuffle className="w-4 h-4 text-purple-400" />
            <Label className="text-sm font-semibold text-purple-300">🎲 Shuffle Modalità</Label>
          </div>
          <button
            onClick={() => onShuffleChange(!shuffleEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              shuffleEnabled ? 'bg-purple-600' : 'bg-purple-900/50'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                shuffleEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
        <p className="text-xs text-purple-400 mt-2">
          Mescola i risultati in modo casuale (cambia ogni giorno)
        </p>
      </div>

      {/* Rotation Dropdown */}
      <div className="mb-6 p-4 bg-purple-950/30 rounded-lg border border-purple-500/20">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔄</span>
          <Label className="text-sm font-semibold text-purple-300">Rotazione Contenuti</Label>
        </div>
        <select
          value={rotation}
          onChange={(e) => onRotationChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-purple-950/50 border border-purple-500/30 rounded-md text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        >
          <option value="none">Nessuna rotazione</option>
          <option value="daily">Giornaliera (cambia ogni giorno)</option>
          <option value="weekly">Settimanale (cambia ogni lunedì)</option>
        </select>
        <p className="text-xs text-purple-400 mt-2">
         决定了 i contenuti cambiano automaticamente dopo il periodo selezionato
        </p>
      </div>

      {/* ERDB Config */}
      <div className="mb-6 p-4 bg-purple-950/30 rounded-lg border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🎬</span>
          <Label className="text-sm font-semibold text-purple-300">ERDB Ratings (opzionale)</Label>
        </div>
        <p className="text-xs text-purple-400 mb-3">
          Config string da{" "}
          <a 
            href="https://marcogian-erpb.hf.space/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-purple-200 underline"
          >
            marcogian-erpb.hf.space
          </a>
        </p>
        <input
          type="text"
          value={erdbConfig}
          onChange={(e) => onErdbConfigChange(e.target.value)}
          placeholder="Inserisci config string (base64url)..."
          className="w-full px-3 py-2 text-sm bg-purple-950/50 border border-purple-500/30 rounded-md text-purple-100 placeholder-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 mb-3"
        />
        
        {/* ERDB Type Toggles */}
        {erdbConfig && (
          <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t border-purple-500/20">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onErdbPosterChange(!erdbPoster)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  erdbPoster ? 'bg-purple-600' : 'bg-purple-900/50'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    erdbPoster ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <Label className="text-xs text-purple-300">Poster</Label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onErdbBackdropChange(!erdbBackdrop)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  erdbBackdrop ? 'bg-purple-600' : 'bg-purple-900/50'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    erdbBackdrop ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <Label className="text-xs text-purple-300">Backdrop</Label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onErdbLogoChange(!erdbLogo)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  erdbLogo ? 'bg-purple-600' : 'bg-purple-900/50'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    erdbLogo ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
              <Label className="text-xs text-purple-300">Logo</Label>
            </div>
          </div>
        )}
      </div>

      {/* Top Streaming API Key */}
      <div className="mb-6 p-4 bg-purple-950/30 rounded-lg border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <Label className="text-sm font-semibold text-purple-300">🔑 Top Streaming API Key (opzionale)</Label>
        </div>
        <p className="text-xs text-purple-400 mb-3">
          Ottieni la tua API key su{" "}
          <a 
            href="https://api.top-streaming.stream/api-redoc" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-300 hover:text-purple-200 underline"
          >
            api.top-streaming.stream/api-redoc
          </a>
        </p>
        <input
          type="text"
          value={topStreamingKey}
          onChange={(e) => onTopStreamingKeyChange(e.target.value)}
          placeholder="Inserisci la tua API key..."
          className="w-full px-3 py-2 text-sm bg-purple-950/50 border border-purple-500/30 rounded-md text-purple-100 placeholder-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>

      {/* Movie Catalogs */}
      {(contentType === "movie" || contentType === "both" || contentType === "all") && (
        <div className="space-y-4 mb-6">
          {["main", "genre", "expert", "world", "cult", "decade", "trakt", "random"].map(group => {
            const catalogs = getMovieCatalogsByGroup(group);
            if (catalogs.length === 0) return null;
            
            const groupLabels: Record<string, string> = {
              main: "📋 Principali",
              genre: "🎭 Per Genere",
              expert: "🎬 Esperti",
              world: "🌍 Cinema Mondiale",
              cult: "💀 Cult & Speciali",
              decade: "📅 Per Decennio",
              trakt: "🎬 Liste Speciali (Marvel, Top, Anni 50-2000)",
              random: "🎲 Casuali",
            };
            
            return (
              <div key={group}>
                <Label className="text-sm font-semibold mb-2 block text-purple-300">{groupLabels[group]}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {catalogs.map((catalog) => (
                    <div key={catalog.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-purple-900/30 transition-colors border border-transparent hover:border-purple-500/20">
                      <Checkbox 
                        id={catalog.id}
                        checked={selectedCatalogs.includes(catalog.id)}
                        onCheckedChange={() => onToggle(catalog.id)}
                        className="border-purple-500/50 data-[state=checked]:bg-purple-600"
                      />
                      <Label htmlFor={catalog.id} className="cursor-pointer flex items-center gap-1 text-sm text-purple-200">
                        <span>{catalog.emoji}</span>
                        <span className={catalog.color}>{catalog.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TV Series catalogs */}
      {(contentType === "series" || contentType === "both" || contentType === "all") && (
        <div className="space-y-4 mb-6">
          {["main", "platform", "world", "random"].map(group => {
            const catalogs = getSeriesCatalogsByGroup(group);
            if (catalogs.length === 0) return null;
            
            const groupLabels: Record<string, string> = {
              main: "📋 Principali",
              platform: "📺 Piattaforme",
              world: "🌍 Internazionali",
              random: "🎲 Casuali",
            };
            
            return (
              <div key={group}>
                <Label className="text-sm font-semibold mb-2 block text-purple-300">{groupLabels[group]}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {catalogs.map((catalog) => (
                    <div key={catalog.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-purple-900/30 transition-colors border border-transparent hover:border-purple-500/20">
                      <Checkbox 
                        id={catalog.id}
                        checked={selectedCatalogs.includes(catalog.id)}
                        onCheckedChange={() => onToggle(catalog.id)}
                        className="border-purple-500/50 data-[state=checked]:bg-purple-600"
                      />
                      <Label htmlFor={catalog.id} className="cursor-pointer flex items-center gap-1 text-sm text-purple-200">
                        <span>{catalog.emoji}</span>
                        <span className={catalog.color}>{catalog.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Anime catalogs */}
      {(contentType === "anime" || contentType === "all") && (
        <div className="space-y-4 mb-6">
          {["main", "genre", "special", "trakt"].map(group => {
            const catalogs = getAnimeCatalogsByGroup(group);
            if (catalogs.length === 0) return null;
            
            const groupLabels: Record<string, string> = {
              main: "🔥 Popolari",
              genre: "🎭 Per Genere",
              special: "✨ Speciali",
              trakt: "🎌 Liste Anime",
            };
            
            return (
              <div key={group}>
                <Label className="text-sm font-semibold mb-2 block text-purple-300">{groupLabels[group]}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {catalogs.map((catalog) => (
                    <div key={catalog.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-purple-900/30 transition-colors border border-transparent hover:border-purple-500/20">
                      <Checkbox 
                        id={catalog.id}
                        checked={selectedCatalogs.includes(catalog.id)}
                        onCheckedChange={() => onToggle(catalog.id)}
                        className="border-purple-500/50 data-[state=checked]:bg-purple-600"
                      />
                      <Label htmlFor={catalog.id} className="cursor-pointer flex items-center gap-1 text-sm text-purple-200">
                        <span>{catalog.emoji}</span>
                        <span className={catalog.color}>{catalog.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected count */}
      <div className="text-sm text-purple-400 mb-4">
        <strong className="text-purple-300">{selectedCatalogs.length}</strong> cataloghi selezionati 👻
      </div>

      {/* Manifest URL Display */}
      <div className="bg-purple-950/50 rounded-lg p-4 mb-4 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">URL Manifest</span>
        </div>
        <code className="block text-xs bg-purple-950 p-2 rounded border border-purple-500/20 break-all text-purple-200">
          {manifestUrl}
        </code>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          variant="default" 
          size="lg" 
          className="gap-2 flex-1 bg-purple-600 hover:bg-purple-700"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-green-400" />
              Copiato! 👻
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copia URL
            </>
          )}
        </Button>
        <Button asChild size="lg" className="gap-2 flex-1 bg-violet-600 hover:bg-violet-700">
          <a href={stremioUrl}>
            <Download className="w-4 h-4" />
            Installa in Stremio
          </a>
        </Button>
      </div>
    </Card>
  );
}

// Stats Component - Gengar themed
function Stats() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-purple-950/30 rounded-lg p-4 text-center border border-purple-500/20 hover:border-purple-400/40 transition-colors">
        <Ghost className="w-8 h-8 mx-auto mb-2 text-purple-400" />
        <div className="text-2xl font-bold text-purple-200">23</div>
        <div className="text-sm text-purple-400">Cataloghi Film</div>
      </div>
      <div className="bg-purple-950/30 rounded-lg p-4 text-center border border-purple-500/20 hover:border-purple-400/40 transition-colors">
        <Tv className="w-8 h-8 mx-auto mb-2 text-purple-400" />
        <div className="text-2xl font-bold text-purple-200">10</div>
        <div className="text-sm text-purple-400">Cataloghi TV</div>
      </div>
      <div className="bg-purple-950/30 rounded-lg p-4 text-center border border-purple-500/20 hover:border-purple-400/40 transition-colors">
        <Zap className="w-8 h-8 mx-auto mb-2 text-purple-400" />
        <div className="text-2xl font-bold text-purple-200">18</div>
        <div className="text-sm text-purple-400">Generi</div>
      </div>
      <div className="bg-purple-950/30 rounded-lg p-4 text-center border border-purple-500/20 hover:border-purple-400/40 transition-colors">
        <Sparkles className="w-8 h-8 mx-auto mb-2 text-purple-400" />
        <div className="text-2xl font-bold text-purple-200">IT</div>
        <div className="text-sm text-purple-400">In Italiano</div>
      </div>
    </div>
  );
}

// Save Config Dialog Component
function SaveConfigDialog({
  open,
  onOpenChange,
  onSave,
  defaultName
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => void;
  defaultName: string;
}) {
  const [name, setName] = useState("");

  // Update name when defaultName changes (controlled by parent)
  const displayName = open ? (name || defaultName) : name;

  const handleSave = () => {
    if (displayName.trim()) {
      onSave(displayName.trim());
      setName("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-purple-950 border-purple-500/30">
        <DialogHeader>
          <DialogTitle className="text-purple-200">💾 Salva Configurazione</DialogTitle>
          <DialogDescription className="text-purple-400">
            Dai un nome alla tua configurazione per ritrovarla facilmente
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={displayName}
            onChange={(e) => setName(e.target.value)}
            placeholder="Es. Film Serata, Anime Weekend..."
            className="bg-purple-900/50 border-purple-500/30 text-purple-100 placeholder-purple-500"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-purple-500/30 text-purple-300"
          >
            Annulla
          </Button>
          <Button
            onClick={handleSave}
            disabled={!displayName.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Saved Configs Section Component
function SavedConfigsSection({
  savedConfigs,
  onLoad,
  onDelete,
  onClearAll
}: {
  savedConfigs: SavedConfig[];
  onLoad: (config: SavedConfig) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}) {
  if (savedConfigs.length === 0) {
    return null;
  }

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      movie: "Film",
      series: "Serie TV",
      anime: "Anime",
      both: "Film + Serie",
      all: "Tutto"
    };
    return labels[type] || type;
  };

  return (
    <Card className="p-4 bg-purple-950/30 border-purple-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-purple-200">Configurazioni Salvate</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/30"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Cancella tutto
        </Button>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {savedConfigs.map((config) => (
          <div
            key={config.id}
            className="flex items-center justify-between p-3 bg-purple-900/30 rounded-lg border border-purple-500/20 hover:border-purple-400/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-purple-200 truncate">{config.name}</span>
                <Badge variant="secondary" className="text-xs bg-purple-800/50 text-purple-300 border-purple-500/30">
                  {getContentTypeLabel(config.contentType)}
                </Badge>
              </div>
              <div className="text-xs text-purple-400 mt-1">
                {config.selectedCatalogs.length} cataloghi • {new Date(config.createdAt).toLocaleDateString('it-IT')}
              </div>
            </div>
            <div className="flex gap-2 ml-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onLoad(config)}
                className="border-purple-500/30 text-purple-300 hover:bg-purple-800/50"
              >
                Carica
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(config.id)}
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Helper to get initial catalogs
const getInitialCatalogs = () => MOVIE_CATALOGS.map(c => c.id);

// Main Page Component
export default function StremioDiscoveryPage() {
  const [baseUrl, setBaseUrl] = useState("");
  const [contentType, setContentType] = useState("movie");
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>(getInitialCatalogs);
  const [topStreamingKey, setTopStreamingKey] = useState("");
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [rotation, setRotation] = useState("none");
  const [erdbConfig, setErdbConfig] = useState("");
  const [erdbPoster, setErdbPoster] = useState(true);
  const [erdbBackdrop, setErdbBackdrop] = useState(true);
  const [erdbLogo, setErdbLogo] = useState(true);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Load saved configs from localStorage on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setBaseUrl(window.location.origin);
      
      // Load saved configs
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.SAVED_CONFIGS);
        if (saved) {
          setSavedConfigs(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Error loading saved configs:", e);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Save current configuration
  const saveCurrentConfig = (name: string) => {
    const newConfig: SavedConfig = {
      id: Date.now().toString(),
      name,
      contentType,
      selectedCatalogs,
      topStreamingKey,
      shuffleEnabled,
      rotation,
      erdbConfig,
      erdbPoster,
      erdbBackdrop,
      erdbLogo,
      createdAt: new Date().toISOString(),
    };
    
    const updatedConfigs = [...savedConfigs, newConfig];
    setSavedConfigs(updatedConfigs);
    localStorage.setItem(STORAGE_KEYS.SAVED_CONFIGS, JSON.stringify(updatedConfigs));
  };

  // Load a saved configuration
  const loadConfig = (config: SavedConfig) => {
    setContentType(config.contentType);
    setSelectedCatalogs(config.selectedCatalogs);
    setTopStreamingKey(config.topStreamingKey);
    if (config.shuffleEnabled !== undefined) setShuffleEnabled(config.shuffleEnabled);
    if (config.rotation !== undefined) setRotation(config.rotation);
    if (config.erdbConfig) setErdbConfig(config.erdbConfig);
    if (config.erdbPoster !== undefined) setErdbPoster(config.erdbPoster);
    if (config.erdbBackdrop !== undefined) setErdbBackdrop(config.erdbBackdrop);
    if (config.erdbLogo !== undefined) setErdbLogo(config.erdbLogo);
  };

  // Delete a saved configuration
  const deleteConfig = (id: string) => {
    const updatedConfigs = savedConfigs.filter(c => c.id !== id);
    setSavedConfigs(updatedConfigs);
    localStorage.setItem(STORAGE_KEYS.SAVED_CONFIGS, JSON.stringify(updatedConfigs));
  };

  // Clear all saved configurations
  const clearAllConfigs = () => {
    setSavedConfigs([]);
    localStorage.removeItem(STORAGE_KEYS.SAVED_CONFIGS);
  };

  // Get default name for save dialog
  const getDefaultConfigName = () => {
    const typeLabels: Record<string, string> = {
      movie: "Film",
      series: "Serie TV",
      anime: "Anime",
      both: "Film+Serie",
      all: "Tutto"
    };
    const date = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    return `${typeLabels[contentType] || 'Config'} ${date}`;
  };

  // Handle content type change
  const handleContentTypeChange = (type: string) => {
    setContentType(type);
    if (type === "movie") {
      setSelectedCatalogs(MOVIE_CATALOGS.map(c => c.id));
    } else if (type === "series") {
      setSelectedCatalogs(SERIES_CATALOGS.map(c => c.id));
    } else if (type === "anime") {
      setSelectedCatalogs(ANIME_CATALOGS.map(c => c.id));
    } else if (type === "both") {
      setSelectedCatalogs([...MOVIE_CATALOGS.map(c => c.id), ...SERIES_CATALOGS.map(c => c.id)]);
    } else {
      // "all" - show everything
      setSelectedCatalogs([...MOVIE_CATALOGS.map(c => c.id), ...SERIES_CATALOGS.map(c => c.id), ...ANIME_CATALOGS.map(c => c.id)]);
    }
  };

  // Generate config ID from settings
  const generateConfigId = useCallback(() => {
    const config = [
      contentType,
      topStreamingKey,
      shuffleEnabled ? "1" : "0",
      erdbConfig,
      rotation,
      erdbPoster ? "1" : "0",
      erdbBackdrop ? "1" : "0",
      erdbLogo ? "1" : "0",
    ];
    const json = JSON.stringify(config);
    const base64 = btoa(json)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return base64;
  }, [contentType, topStreamingKey, shuffleEnabled, erdbConfig, rotation, erdbPoster, erdbBackdrop, erdbLogo]);

  // Generate dynamic manifest URL with config ID
  const manifestUrl = useMemo(() => {
    if (!baseUrl) return "";
    const configId = generateConfigId();
    return `${baseUrl}/m/${configId}/manifest.json`;
  }, [baseUrl, generateConfigId]);

  const toggleCatalog = (id: string) => {
    setSelectedCatalogs(prev => 
      prev.includes(id) 
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  if (!baseUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-950 to-purple-950/95">
        <div className="text-center">
          <img src="/gengar-logo.jpg" alt="Gengar" className="w-24 h-24 animate-bounce mx-auto mb-4" />
          <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
        </div>
      </div>
    );
  }

  const showMovies = contentType === "movie" || contentType === "both" || contentType === "all";
  const showSeries = contentType === "series" || contentType === "both" || contentType === "all";
  const showAnime = contentType === "anime" || contentType === "all";

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-purple-950 via-purple-900/95 to-purple-950">
      {/* Hero Section - Gengar themed */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-600/20 via-purple-800/10 to-transparent" />
        <GengarDecoration />
        
        <div className="relative container mx-auto px-4 py-12 lg:py-16">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            {/* Gengar Logo */}
            <div className="flex justify-center mb-4">
              <img src="/gengar-logo.jpg" alt="Gengar Discovery" className="w-32 h-32 md:w-40 md:h-40 animate-bounce drop-shadow-[0_0_30px_rgba(147,51,234,0.5)]" />
            </div>
            
            <div className="inline-flex items-center gap-2 bg-purple-600/30 border border-purple-400/30 rounded-full px-4 py-1.5 text-sm">
              <Ghost className="w-4 h-4 text-purple-300" />
              <span className="text-purple-200">Stremio Addon per Esperti del Cinema</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="text-purple-300">Gengar</span>{" "}
              <span className="text-violet-400">Discovery</span>{" "}
              <span className="text-purple-200">ITA</span>
            </h1>
            
            <p className="text-lg md:text-xl text-purple-300/80 max-w-2xl mx-auto italic">
              &quot;Non lasciare solo un Gengar!&quot; 👻💜
            </p>
            
            <p className="text-base text-purple-400 max-w-2xl mx-auto">
              Cannes, Venezia, Criterion, A24, Korean Cinema + Sottocategorie di Genere
            </p>
            
            <div className="flex flex-wrap justify-center gap-2 text-sm">
              <Badge variant="secondary" className="gap-1 bg-purple-800/50 text-purple-200 border-purple-500/30">👻 23 Cataloghi Film</Badge>
              <Badge variant="secondary" className="gap-1 bg-purple-800/50 text-purple-200 border-purple-500/30">📺 10 Cataloghi TV</Badge>
              <Badge variant="secondary" className="gap-1 bg-purple-800/50 text-purple-200 border-purple-500/30">💜 18 Generi</Badge>
              <Badge variant="secondary" className="gap-1 bg-purple-800/50 text-purple-200 border-purple-500/30">🌍 Cinema Mondiale</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        {/* Config Panel */}
        <section>
          <ConfigPanel 
            selectedCatalogs={selectedCatalogs}
            onToggle={toggleCatalog}
            contentType={contentType}
            onContentTypeChange={handleContentTypeChange}
            manifestUrl={manifestUrl}
            topStreamingKey={topStreamingKey}
            onTopStreamingKeyChange={setTopStreamingKey}
            shuffleEnabled={shuffleEnabled}
            onShuffleChange={setShuffleEnabled}
            rotation={rotation}
            onRotationChange={setRotation}
            erdbConfig={erdbConfig}
            onErdbConfigChange={setErdbConfig}
            erdbPoster={erdbPoster}
            onErdbPosterChange={setErdbPoster}
            erdbBackdrop={erdbBackdrop}
            onErdbBackdropChange={setErdbBackdrop}
            erdbLogo={erdbLogo}
            onErdbLogoChange={setErdbLogo}
          />
          
          {/* Save Config Button */}
          <div className="mt-4 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(true)}
              className="border-purple-500/30 text-purple-300 hover:bg-purple-800/50"
            >
              <Save className="w-4 h-4 mr-2" />
              Salva Configurazione
            </Button>
          </div>
        </section>

        {/* Saved Configs Section */}
        <SavedConfigsSection
          savedConfigs={savedConfigs}
          onLoad={loadConfig}
          onDelete={deleteConfig}
          onClearAll={clearAllConfigs}
        />

        <Separator className="bg-purple-500/20" />

        {/* Stats */}
        <Stats />

        <Separator className="bg-purple-500/20" />

        {/* Movie Catalogs Preview */}
        {showMovies && (
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <Ghost className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-purple-200">Anteprima Film</h2>
            </div>
            
            <div className="space-y-8">
              {selectedCatalogs.includes("trending") && (
                <CatalogSection
                  title="Trending"
                  emoji="👻"
                  fetchFn={(genre) => fetchTMDB("/trending/movie/week", genre ? { with_genres: genre } : {})}
                  color="text-purple-400"
                />
              )}
              {selectedCatalogs.includes("top_rated") && (
                <CatalogSection
                  title="Top Rated"
                  emoji="💜"
                  fetchFn={(genre) => fetchTMDB("/movie/top_rated", genre ? { with_genres: genre } : {})}
                  color="text-violet-400"
                />
              )}
              {selectedCatalogs.includes("now_playing") && (
                <CatalogSection
                  title="Al Cinema"
                  emoji="🎬"
                  fetchFn={(genre) => fetchTMDB("/movie/now_playing", genre ? { with_genres: genre } : {})}
                  color="text-fuchsia-400"
                />
              )}
              {selectedCatalogs.includes("mubi") && (
                <CatalogSection
                  title="MUBI Picks"
                  emoji="🎭"
                  fetchFn={(genre) => fetchTMDB("/discover/movie", {
                    "vote_count.gte": "30",
                    "vote_average.gte": "7",
                    with_genres: genre || "18",
                    sort_by: "vote_average.desc",
                  })}
                  color="text-purple-300"
                />
              )}
              {selectedCatalogs.includes("award_winners") && (
                <CatalogSection
                  title="Award Winners"
                  emoji="🏆"
                  fetchFn={(genre) => fetchTMDB("/discover/movie", {
                    "vote_count.gte": "500",
                    "vote_average.gte": "8",
                    sort_by: "popularity.desc",
                    ...(genre && { with_genres: genre }),
                  })}
                  color="text-yellow-400"
                />
              )}
              {selectedCatalogs.includes("cannes") && (
                <CatalogSection
                  title="Cannes Winners"
                  emoji="🎖️"
                  fetchFn={(genre) => fetchTMDB("/discover/movie", {
                    "vote_count.gte": "100",
                    "vote_average.gte": "7",
                    with_genres: genre || "18",
                    sort_by: "vote_average.desc",
                  })}
                  color="text-amber-400"
                />
              )}
              {selectedCatalogs.includes("a24") && (
                <CatalogSection
                  title="A24 Films"
                  emoji="🎨"
                  fetchFn={() => fetchTMDB("/discover/movie", {
                    with_companies: "41077",
                    sort_by: "popularity.desc",
                  })}
                  color="text-lime-400"
                />
              )}
              {selectedCatalogs.includes("korean") && (
                <CatalogSection
                  title="Korean Cinema"
                  emoji="🇰🇷"
                  fetchFn={(genre) => fetchTMDB("/discover/movie", {
                    with_original_language: "ko",
                    "vote_count.gte": "50",
                    sort_by: "popularity.desc",
                    ...(genre && { with_genres: genre }),
                  })}
                  color="text-blue-400"
                />
              )}
              {selectedCatalogs.includes("ghibli") && (
                <CatalogSection
                  title="Animation Masters"
                  emoji="✨"
                  fetchFn={() => fetchTMDB("/discover/movie", {
                    with_genres: "16",
                    with_original_language: "ja",
                    "vote_count.gte": "100",
                    sort_by: "vote_average.desc",
                  })}
                  color="text-cyan-400"
                  showGenreFilter={false}
                />
              )}
            </div>
          </section>
        )}

        {/* TV Series Catalogs Preview */}
        {showSeries && (
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <Tv className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-purple-200">Anteprima Serie TV</h2>
            </div>
            
            <div className="space-y-8">
              {selectedCatalogs.includes("tv_trending") && (
                <CatalogSection
                  title="Trending TV"
                  emoji="👻"
                  fetchFn={() => fetchTMDB("/trending/tv/week")}
                  color="text-purple-400"
                />
              )}
              {selectedCatalogs.includes("tv_top_rated") && (
                <CatalogSection
                  title="Top Rated TV"
                  emoji="💜"
                  fetchFn={() => fetchTMDB("/tv/top_rated")}
                  color="text-violet-400"
                />
              )}
              {selectedCatalogs.includes("tv_on_the_air") && (
                <CatalogSection
                  title="In Onda"
                  emoji="📺"
                  fetchFn={() => fetchTMDB("/tv/on_the_air")}
                  color="text-blue-400"
                />
              )}
              {selectedCatalogs.includes("tv_netflix") && (
                <CatalogSection
                  title="Netflix"
                  emoji="🔴"
                  fetchFn={() => fetchTMDB("/discover/tv", {
                    with_networks: "213",
                    sort_by: "popularity.desc",
                  })}
                  color="text-red-400"
                />
              )}
              {selectedCatalogs.includes("tv_anime") && (
                <CatalogSection
                  title="Anime"
                  emoji="🎌"
                  fetchFn={() => fetchTMDB("/discover/tv", {
                    with_genres: "16",
                    with_original_language: "ja",
                    sort_by: "popularity.desc",
                  })}
                  color="text-pink-400"
                  showGenreFilter={false}
                />
              )}
            </div>
          </section>
        )}

        <Separator className="bg-purple-500/20" />

        {/* Best of Decade */}
        {showMovies && selectedCatalogs.some(id => id.startsWith("best_")) && (
          <>
            <section>
              <DecadeTabs />
            </section>
            <Separator className="bg-purple-500/20" />
          </>
        )}

        {/* Random Night */}
        {showMovies && selectedCatalogs.includes("random_night") && (
          <>
            <section>
              <RandomMovieNight />
            </section>
            <Separator className="bg-purple-500/20" />
          </>
        )}

        {/* Random TV Night */}
        {showSeries && selectedCatalogs.includes("tv_random_night") && (
          <>
            <section>
              <TVRandomNight />
            </section>
            <Separator className="bg-purple-500/20" />
          </>
        )}

        {/* Anime Catalogs Preview */}
        {showAnime && (
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-purple-200">Anteprima Anime</h2>
            </div>
            
            <div className="bg-purple-950/30 rounded-lg p-4 border border-purple-500/20">
              <p className="text-purple-300">
                🎌 Gli anime appaiono nella categoria separata <strong>&quot;Anime&quot;</strong> in Stremio!
              </p>
              <p className="text-sm text-purple-400 mt-2">
                Include cataloghi Kitsu + la lista &quot;A Lot of Anime&quot; da Trakt con descrizioni in italiano.
              </p>
            </div>
          </section>
        )}

        {/* Installation Instructions */}
        <section className="bg-purple-950/30 rounded-xl p-6 md:p-8 border border-purple-500/20">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-purple-200">
            <Play className="w-6 h-6 text-purple-400" />
            Come Installare 👻
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 font-bold shrink-0 border border-purple-500/30">1</div>
                <div>
                  <h3 className="font-semibold text-purple-200">Seleziona tipo e cataloghi</h3>
                  <p className="text-sm text-purple-400">Scegli film, serie TV o entrambi + cataloghi esperti.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 font-bold shrink-0 border border-purple-500/30">2</div>
                <div>
                  <h3 className="font-semibold text-purple-200">Copia l&apos;URL</h3>
                  <p className="text-sm text-purple-400">Clicca &quot;Copia URL&quot;.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 font-bold shrink-0 border border-purple-500/30">3</div>
                <div>
                  <h3 className="font-semibold text-purple-200">Apri Stremio</h3>
                  <p className="text-sm text-purple-400">Impostazioni → Addons.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 flex items-center justify-center text-purple-300 font-bold shrink-0 border border-purple-500/30">4</div>
                <div>
                  <h3 className="font-semibold text-purple-200">Incolla e Installa</h3>
                  <p className="text-sm text-purple-400">Ogni catalogo ha sottocategorie di genere! 👻</p>
                </div>
              </div>
            </div>
            
            <div className="bg-purple-950/50 rounded-lg p-4 border border-purple-500/20">
              <h3 className="font-semibold mb-2 text-purple-200">🎬 Cataloghi Esperti</h3>
              <ul className="space-y-1 text-sm text-purple-300">
                <li>🎭 MUBI Picks - Cinema d&apos;autore</li>
                <li>🎖️ Cannes Winners - Palma d&apos;Oro style</li>
                <li>🦁 Venezia - Leone d&apos;Oro</li>
                <li>📽️ Criterion Style - Classici d&apos;autore</li>
                <li>🎨 A24 Films - Indie cinema</li>
                <li>🇰🇷 Korean Cinema - New Wave</li>
                <li>🇮🇹 Italian Classics - Golden Age</li>
                <li>🇫🇷 French Cinema - Nouvelle Vague</li>
                <li>👹 Asian Horror - J/K-Horror</li>
                <li>✨ Animation Masters - Ghibli style</li>
                <li>🌙 Midnight Movies - Cult & Weird</li>
                <li>💀 Cult Classics - Beloved & Bizarre</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Gengar themed */}
      <footer className="bg-purple-950/50 border-t border-purple-500/20 py-8 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center mb-3">
            <img src="/gengar-mini.jpg" alt="Gengar" className="w-12 h-12 animate-pulse opacity-80" />
          </div>
          <p className="text-purple-300 font-medium">
            Gengar Discovery ITA • Non lasciare solo un Gengar!
          </p>
          <p className="text-sm text-purple-400/60 mt-2">
            Powered by TMDB 👻💜
          </p>
        </div>
      </footer>

      {/* Save Config Dialog */}
      <SaveConfigDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={saveCurrentConfig}
        defaultName={getDefaultConfigName()}
      />
    </div>
  );
}
