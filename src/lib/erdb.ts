/**
 * ERDB (Enhanced Ratings Database) Integration
 * API Reference: https://marcogian-erpb.hf.space/
 * 
 * ERDB provides enhanced poster/backdrop/logo ratings for streaming content
 * Uses the Stateless API format
 */

export interface ERDBConfig {
  enabled: boolean;
  decoded: ERDBDecodedConfig | null;
  posterEnabled: boolean;
  backdropEnabled: boolean;
  logoEnabled: boolean;
}

export interface ERDBDecodedConfig {
  baseUrl: string;
  tmdbKey: string;
  mdblistKey: string;
  simklClientId?: string;
  ratings?: string;
  posterRatings?: string;
  backdropRatings?: string;
  logoRatings?: string;
  lang?: string;
  streamBadges?: string;
  posterStreamBadges?: string;
  backdropStreamBadges?: string;
  qualityBadgesSide?: string;
  posterQualityBadgesPosition?: string;
  qualityBadgesStyle?: string;
  posterQualityBadgesStyle?: string;
  backdropQualityBadgesStyle?: string;
  ratingStyle?: string;
  posterRatingStyle?: string;
  backdropRatingStyle?: string;
  logoRatingStyle?: string;
  imageText?: string;
  posterImageText?: string;
  backdropImageText?: string;
  posterRatingsLayout?: string;
  posterRatingsMaxPerSide?: string;
  backdropRatingsLayout?: string;
}

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Parse ERDB config string from URL parameter
 * Returns decoded config with toggle states
 */
export function parseERDBConfig(
  configParam: string | null,
  posterEnabled: boolean = true,
  backdropEnabled: boolean = true,
  logoEnabled: boolean = true
): ERDBConfig {
  if (!configParam) {
    return { enabled: false, decoded: null, posterEnabled: false, backdropEnabled: false, logoEnabled: false };
  }
  
  try {
    const decoded = JSON.parse(decodeBase64Url(configParam)) as ERDBDecodedConfig;
    return {
      enabled: true,
      decoded,
      posterEnabled,
      backdropEnabled,
      logoEnabled,
    };
  } catch (e) {
    console.error("Error parsing ERDB config:", e);
    return { enabled: false, decoded: null, posterEnabled: false, backdropEnabled: false, logoEnabled: false };
  }
}

/**
 * Build ERDB URL for a specific type (poster/backdrop/logo)
 */
export function buildERDBUrl(
  type: "poster" | "backdrop" | "logo",
  id: string,
  config: ERDBDecodedConfig
): string {
  const typeRatingStyle = type === "poster" 
    ? config.posterRatingStyle || config.ratingStyle || "glass"
    : type === "backdrop"
    ? config.backdropRatingStyle || config.ratingStyle || "glass"
    : config.logoRatingStyle || config.ratingStyle || "glass";

  const typeImageText = type === "backdrop" 
    ? config.backdropImageText || config.imageText || "original"
    : type === "poster"
    ? config.posterImageText || config.imageText || "original"
    : undefined;

  const typeRatings = type === "poster" 
    ? config.posterRatings || config.ratings || "all"
    : type === "backdrop"
    ? config.backdropRatings || config.ratings || "all"
    : config.logoRatings || config.ratings || "all";

  const params = new URLSearchParams();
  
  if (config.tmdbKey) params.set("tmdbKey", config.tmdbKey);
  if (config.mdblistKey) params.set("mdblistKey", config.mdblistKey);
  if (config.simklClientId) params.set("simklClientId", config.simklClientId);
  if (typeRatings) params.set("ratings", typeRatings);
  if (config.lang) params.set("lang", config.lang);
  if (config.streamBadges) params.set("streamBadges", config.streamBadges);
  if (type === "poster" && config.posterStreamBadges) params.set("posterStreamBadges", config.posterStreamBadges);
  if (type === "backdrop" && config.backdropStreamBadges) params.set("backdropStreamBadges", config.backdropStreamBadges);
  if (config.qualityBadgesSide) params.set("qualityBadgesSide", config.qualityBadgesSide);
  if (type === "poster" && config.posterQualityBadgesPosition) params.set("posterQualityBadgesPosition", config.posterQualityBadgesPosition);
  const qualityStyle = type === "poster" ? config.posterQualityBadgesStyle || config.qualityBadgesStyle : type === "backdrop" ? config.backdropQualityBadgesStyle || config.qualityBadgesStyle : config.qualityBadgesStyle;
  if (qualityStyle) params.set("qualityBadgesStyle", qualityStyle);
  params.set("ratingStyle", typeRatingStyle);
  if (typeImageText) params.set("imageText", typeImageText);
  if (type === "poster" && config.posterRatingsLayout) params.set("posterRatingsLayout", config.posterRatingsLayout);
  if (type === "poster" && config.posterRatingsMaxPerSide) params.set("posterRatingsMaxPerSide", config.posterRatingsMaxPerSide);
  if (type === "backdrop" && config.backdropRatingsLayout) params.set("backdropRatingsLayout", config.backdropRatingsLayout);

  const path = type === "logo" ? `logo/${id}.jpg` : `${type}/${id}.jpg`;
  return `${config.baseUrl}/${path}?${params.toString()}`;
}

/**
 * Get ERDB poster URL for a movie/series
 * Returns the ERDB-enhanced poster URL or null if not available
 */
export function getERDBPosterUrl(
  imdbId: string,
  config: ERDBConfig
): string | null {
  if (!config.enabled || !config.decoded || !config.posterEnabled) {
    return null;
  }
  
  return buildERDBUrl("poster", imdbId, config.decoded);
}

/**
 * Get ERDB backdrop URL for a movie/series
 */
export function getERDBBackdropUrl(
  imdbId: string,
  config: ERDBConfig
): string | null {
  if (!config.enabled || !config.decoded || !config.backdropEnabled) {
    return null;
  }
  
  return buildERDBUrl("backdrop", imdbId, config.decoded);
}

/**
 * Get ERDB logo URL for a movie/series
 */
export function getERDBLogoUrl(
  imdbId: string,
  config: ERDBConfig
): string | null {
  if (!config.enabled || !config.decoded || !config.logoEnabled) {
    return null;
  }
  
  return buildERDBUrl("logo", imdbId, config.decoded);
}

/**
 * Apply ERDB transformation to a Stremio meta object
 */
export function applyERDBTransform(
  meta: {
    id: string;
    poster?: string | null;
    background?: string | null;
  },
  config: ERDBConfig
): typeof meta {
  if (!config.enabled || !config.decoded) {
    return meta;
  }
  
  // Extract TMDB ID from Stremio ID (format: tmdb12345 or tmdb:12345 or tt...)
  const tmdbIdMatch = meta.id.match(/tmdb:?(\d+)/);
  const imdbIdMatch = meta.id.match(/^tt\d+$/);
  
  let erdbId = "";
  if (imdbIdMatch) {
    erdbId = meta.id;
  } else if (tmdbIdMatch) {
    erdbId = `tmdb:${tmdbIdMatch[1]}`;
  }
  
  if (!erdbId) {
    return meta;
  }
  
  const result = { ...meta };
  
  // Replace poster with ERDB version if available
  if (config.posterEnabled && result.poster) {
    const erdbPoster = getERDBPosterUrl(erdbId, config);
    if (erdbPoster) {
      result.poster = erdbPoster;
    }
  }
  
  // Replace background/backdrop with ERDB version if available
  if (config.backdropEnabled && result.background) {
    const erdbBackdrop = getERDBBackdropUrl(erdbId, config);
    if (erdbBackdrop) {
      result.background = erdbBackdrop;
    }
  }
  
  return result;
}

/**
 * Batch apply ERDB transformation to multiple items
 */
export function batchApplyERDB(
  items: Array<{
    id: string;
    poster?: string | null;
    background?: string | null;
  }>,
  config: ERDBConfig
): Array<typeof items[0]> {
  if (!config.enabled || !config.decoded) {
    return items;
  }
  
  return items.map(item => applyERDBTransform(item, config));
}
