/**
 * Configuration System for Stremio Addon
 * 
 * Stremio doesn't pass query params to catalog/meta/stream endpoints.
 * Solution: Encode config in the manifest URL path.
 * 
 * Pattern: /m/[configId]/manifest.json
 * Config ID = base64url(JSON config)
 */

export interface AddonConfig {
  types: string;           // all, movie, series, anime, both
  topStreamingKey: string; // Top Streaming API key
  shuffleEnabled: boolean; // Shuffle mode
  erdbConfig: string;      // ERDB config string (base64url)
  erdbPoster: boolean;     // Enable ERDB poster
  erdbBackdrop: boolean;  // Enable ERDB backdrop
  erdbLogo: boolean;      // Enable ERDB logo
  rotation: string;       // none, daily, weekly
}

// In-memory cache for decoded configs
const configCache = new Map<string, AddonConfig>();

/**
 * Encode config to a URL-safe ID
 */
export function encodeConfig(config: AddonConfig): string {
  const json = JSON.stringify([
    config.types,
    config.topStreamingKey,
    config.shuffleEnabled ? "1" : "0",
    config.erdbConfig,
    config.rotation || "none",
    config.erdbPoster !== false ? "1" : "0",  // default true
    config.erdbBackdrop !== false ? "1" : "0", // default true
    config.erdbLogo !== false ? "1" : "0",     // default true
  ]);
  
  const base64 = Buffer.from(json).toString("base64url");
  return base64;
}

/**
 * Decode config ID to get the configuration
 */
export function decodeConfig(configId: string): AddonConfig | null {
  // Check cache first
  if (configCache.has(configId)) {
    return configCache.get(configId)!;
  }
  
  try {
    // Decode base64url
    let base64 = configId.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }
    
    const json = Buffer.from(base64, "base64").toString("utf8");
    const parts = JSON.parse(json) as string[];
    
    const config: AddonConfig = {
      types: parts[0] || "all",
      topStreamingKey: parts[1] || "",
      shuffleEnabled: parts[2] === "1",
      erdbConfig: parts[3] || "",
      rotation: parts[4] || "none",
      erdbPoster: parts[5] !== "0",  // default true
      erdbBackdrop: parts[6] !== "0", // default true
      erdbLogo: parts[7] !== "0",    // default true
    };
    
    // Cache it
    configCache.set(configId, config);
    
    return config;
  } catch (e) {
    console.error("Failed to decode config:", e);
    return null;
  }
}

/**
 * Get config from request - checks multiple sources
 */
export function getConfigFromRequest(request: Request): AddonConfig {
  const url = new URL(request.url);
  
  // Try config ID in path: /m/[configId]/...
  const pathParts = url.pathname.split("/");
  const mIndex = pathParts.indexOf("m");
  if (mIndex !== -1 && pathParts.length > mIndex + 1) {
    const configId = pathParts[mIndex + 1];
    const config = decodeConfig(configId);
    if (config) return config;
  }
  
  // Try query params (for backwards compatibility)
  const tsParam = url.searchParams.get("ts");
  const sParam = url.searchParams.get("s");
  const eParam = url.searchParams.get("e");
  const tParam = url.searchParams.get("t");
  
  if (tsParam || sParam || eParam || tParam) {
    return {
      types: tParam || "all",
      topStreamingKey: tsParam || "",
      shuffleEnabled: sParam === "1",
      erdbConfig: eParam || "",
      rotation: "none",
      erdbPoster: true,
      erdbBackdrop: true,
      erdbLogo: true,
    };
  }
  
  // Default config
  return {
    types: "all",
    topStreamingKey: "",
    shuffleEnabled: true,
    erdbConfig: "",
    rotation: "none",
    erdbPoster: true,
    erdbBackdrop: true,
    erdbLogo: true,
  };
}

/**
 * Extract config ID from request path
 */
export function getConfigIdFromPath(pathname: string): string | null {
  const parts = pathname.split("/");
  const mIndex = parts.indexOf("m");
  if (mIndex !== -1 && parts.length > mIndex + 1) {
    return parts[mIndex + 1];
  }
  return null;
}

/**
 * Build manifest URL with config
 */
export function buildManifestUrl(baseUrl: string, config: AddonConfig): string {
  const configId = encodeConfig(config);
  return `${baseUrl}/m/${configId}/manifest.json`;
}
