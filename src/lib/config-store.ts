/**
 * Configuration Store for Stremio Addon
 */

interface AddonConfig {
  topStreamingKey: string;
  shuffleEnabled: boolean;
  erdbConfig: string;
}

// In-memory config store
const configStore = new Map<string, AddonConfig>();

/**
 * Encode config to a short ID
 */
export function encodeConfigToId(
  topStreamingKey: string,
  shuffleEnabled: boolean,
  erdbConfig: string
): string {
  const config: AddonConfig = {
    topStreamingKey,
    shuffleEnabled,
    erdbConfig,
  };
  
  // Create a simple hash from the config
  const configStr = JSON.stringify(config);
  let hash = 0;
  for (let i = 0; i < configStr.length; i++) {
    const char = configStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const id = Math.abs(hash).toString(36).padStart(6, "0");
  
  // Store config
  configStore.set(id, config);
  
  return id;
}

/**
 * Decode config ID to get the stored config
 */
export function decodeConfigId(id: string): AddonConfig | null {
  return configStore.get(id) || null;
}

/**
 * Extract config ID from catalog/meta/stream ID
 * Format: catalogId~c=configId
 */
export function extractConfigId(id: string): { baseId: string; config: AddonConfig | null } {
  const match = id.match(/^(.+)~c=(.+)$/);
  if (match) {
    const baseId = match[1];
    const configId = match[2];
    const config = decodeConfigId(configId);
    return { baseId, config };
  }
  return { baseId: id, config: null };
}

/**
 * Add config ID to a catalog/meta/stream ID
 */
export function addConfigId(id: string, configId: string): string {
  return `${id}~c=${configId}`;
}
