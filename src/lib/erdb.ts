/**
 * ERDB (Enhanced Ratings Database) Integration
 * API Reference: https://marcogian-erpb.hf.space/
 * 
 * ERDB provides enhanced poster/backdrop ratings for streaming content
 */

const ERDB_BASE_URL = "https://marcogian-erpb.hf.space";

export interface ERDBConfig {
  enabled: boolean;
  configString?: string; // Base64url encoded config
}

/**
 * Parse ERDB config string from URL parameter
 */
export function parseERDBConfig(configParam: string | null): ERDBConfig {
  if (!configParam) {
    return { enabled: false };
  }
  
  try {
    // The config string is base64url encoded
    return {
      enabled: true,
      configString: configParam,
    };
  } catch (e) {
    console.error("Error parsing ERDB config:", e);
    return { enabled: false };
  }
}

/**
 * Get ERDB poster URL for a movie/series
 * Returns the ERDB-enhanced poster URL or null if not available
 */
export function getERDBPosterUrl(
  tmdbId: number,
  type: "movie" | "series",
  config: ERDBConfig
): string | null {
  if (!config.enabled || !config.configString) {
    return null;
  }
  
  // ERDB format: base_url/type/tmdb_id?config=xxx
  const stremioType = type === "movie" ? "movie" : "series";
  return `${ERDB_BASE_URL}/poster/${stremioType}/${tmdbId}?c=${config.configString}`;
}

/**
 * Get ERDB backdrop URL for a movie/series
 */
export function getERDBBackdropUrl(
  tmdbId: number,
  type: "movie" | "series",
  config: ERDBConfig
): string | null {
  if (!config.enabled || !config.configString) {
    return null;
  }
  
  const stremioType = type === "movie" ? "movie" : "series";
  return `${ERDB_BASE_URL}/backdrop/${stremioType}/${tmdbId}?c=${config.configString}`;
}

/**
 * Apply ERDB transformation to a Stremio meta object
 */
export function applyERDBTransform(
  meta: {
    id: string;
    poster?: string;
    background?: string;
  },
  type: "movie" | "series",
  config: ERDBConfig
): typeof meta {
  if (!config.enabled) {
    return meta;
  }
  
  // Extract TMDB ID from Stremio ID (format: tmdb12345 or tmdb:12345)
  const tmdbIdMatch = meta.id.match(/tmdb:?(\d+)/);
  if (!tmdbIdMatch) {
    return meta;
  }
  
  const tmdbId = parseInt(tmdbIdMatch[1], 10);
  
  const result = { ...meta };
  
  // Replace poster with ERDB version if available
  const erdbPoster = getERDBPosterUrl(tmdbId, type, config);
  if (erdbPoster) {
    result.poster = erdbPoster;
  }
  
  // Replace background/backdrop with ERDB version if available
  const erdbBackdrop = getERDBBackdropUrl(tmdbId, type, config);
  if (erdbBackdrop) {
    result.background = erdbBackdrop;
  }
  
  return result;
}

/**
 * Batch apply ERDB transformation to multiple items
 */
export function batchApplyERDB(
  items: Array<{
    id: string;
    poster?: string;
    background?: string;
  }>,
  type: "movie" | "series",
  config: ERDBConfig
): Array<typeof items[0]> {
  if (!config.enabled) {
    return items;
  }
  
  return items.map(item => applyERDBTransform(item, type, config));
}

/**
 * Generate ERDB config string for manifest
 */
export function generateERDBManifestConfig(config: ERDBConfig): string | null {
  if (!config.enabled || !config.configString) {
    return null;
  }
  return config.configString;
}
