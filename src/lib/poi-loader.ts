/**
 * POI Loader - Fetches and caches Thailand POIs from the TC API
 */

const TC_API_BASE = "https://api.travelier.com/v1/tc_prod";
const TC_API_KEY = process.env.TC_API_KEY || "";

interface Station {
  id: string;
  name: string;
  transportationType: string;
  address: {
    country: string;
    province: string;
    streetAndNumber: string;
    timeZone: string;
  };
  coordinates: {
    longitude: number;
    latitude: number;
  };
}

interface POI {
  id: string;
  name: string;
  country: string;
  stations: Station[];
}

interface POICache {
  pois: POI[];
  byId: Map<string, POI>;
  byName: Map<string, POI>;
  byNameLower: Map<string, POI>;
  loadedAt: number;
}

// In-memory cache
let poiCache: POICache | null = null;
let loadingPromise: Promise<POICache> | null = null;

/**
 * Normalize a place name for matching
 * - Converts to lowercase
 * - Handles "Ko"/"Koh" variations
 * - Removes hyphens and extra spaces
 * - Removes common suffixes
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, "") // Remove hyphens (Pha-ngan -> Phangan)
    .replace(/^koh\s*/i, "ko ") // Normalize "Koh " to "ko "
    .replace(/^ko\s*/i, "ko ") // Ensure "Ko " is lowercase
    .replace(/\s+island$/i, "")
    .replace(/\s+beach$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch all Thailand POIs from the API
 */
async function fetchAllThailandPOIs(): Promise<POI[]> {
  if (!TC_API_KEY) {
    throw new Error("TC_API_KEY not configured");
  }

  const allPOIs: POI[] = [];
  const limit = 1000;
  let offset = 0;
  let totalCount = 0;

  console.log("Starting to fetch Thailand POIs from TC API...");

  do {
    const url = `${TC_API_BASE}/inventory-catalog/pois?limit=${limit}&offset=${offset}`;
    const response = await fetch(url, {
      headers: {
        "x-api-key": TC_API_KEY,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch POIs: ${response.status}`);
    }

    const data = await response.json();
    totalCount = data.totalCount;

    // Filter for Thailand POIs only
    const thPOIs = (data.data || []).filter(
      (poi: POI) => poi.country === "TH"
    );
    allPOIs.push(...thPOIs);

    offset += limit;

    // Log progress every 10k records
    if (offset % 10000 === 0) {
      console.log(`Fetched ${offset}/${totalCount} records, found ${allPOIs.length} TH POIs so far...`);
    }
  } while (offset < totalCount);

  console.log(`Finished loading ${allPOIs.length} Thailand POIs`);

  return allPOIs;
}

/**
 * Build lookup maps from POI list
 */
function buildCache(pois: POI[]): POICache {
  const byId = new Map<string, POI>();
  const byName = new Map<string, POI>();
  const byNameLower = new Map<string, POI>();

  for (const poi of pois) {
    byId.set(poi.id, poi);
    byName.set(poi.name, poi);

    // Create normalized name lookup
    const normalized = normalizeName(poi.name);
    byNameLower.set(normalized, poi);

    // Also add variations for islands
    if (poi.name.startsWith("Ko ") || poi.name.startsWith("Koh ")) {
      // Add both "Ko X" and "Koh X" variations
      const baseName = poi.name.replace(/^Ko[h]?\s+/i, "");
      byNameLower.set(`ko ${baseName.toLowerCase()}`, poi);
      byNameLower.set(`koh ${baseName.toLowerCase()}`, poi);
    }
  }

  return {
    pois,
    byId,
    byName,
    byNameLower,
    loadedAt: Date.now(),
  };
}

/**
 * Load POIs (with caching)
 */
export async function loadPOIs(): Promise<POICache> {
  // Return cached if available
  if (poiCache) {
    return poiCache;
  }

  // If already loading, wait for it
  if (loadingPromise) {
    return loadingPromise;
  }

  // Start loading
  loadingPromise = (async () => {
    const pois = await fetchAllThailandPOIs();
    poiCache = buildCache(pois);
    loadingPromise = null;
    return poiCache;
  })();

  return loadingPromise;
}

/**
 * Find POI by exact name
 */
export async function findPOIByName(name: string): Promise<POI | null> {
  const cache = await loadPOIs();

  // Try exact match first
  const exact = cache.byName.get(name);
  if (exact) return exact;

  // Try normalized match
  const normalized = normalizeName(name);
  return cache.byNameLower.get(normalized) || null;
}

/**
 * Find POI by ID
 */
export async function findPOIById(id: string): Promise<POI | null> {
  const cache = await loadPOIs();
  return cache.byId.get(id) || null;
}

/**
 * Search POIs by partial name match
 */
export async function searchPOIs(query: string, limit = 10): Promise<POI[]> {
  const cache = await loadPOIs();
  const queryLower = query.toLowerCase();
  const queryNormalized = normalizeName(query);

  const results: POI[] = [];

  for (const poi of cache.pois) {
    const nameLower = poi.name.toLowerCase();
    const nameNormalized = normalizeName(poi.name);

    if (
      nameLower.includes(queryLower) ||
      nameNormalized.includes(queryNormalized)
    ) {
      results.push(poi);
      if (results.length >= limit) break;
    }
  }

  return results;
}

/**
 * Translate a place name to POI ID
 * This is the main function to replace AI translation
 */
export async function translateToPOI(
  placeName: string,
  _country?: string // Ignored since we only have TH POIs
): Promise<{ poi: string; name: string; confidence: "exact" | "normalized" | "partial" | "none" } | null> {
  const cache = await loadPOIs();

  // Try exact match
  const exact = cache.byName.get(placeName);
  if (exact) {
    return { poi: exact.id, name: exact.name, confidence: "exact" };
  }

  // Try normalized match
  const normalized = normalizeName(placeName);
  const normalizedMatch = cache.byNameLower.get(normalized);
  if (normalizedMatch) {
    return { poi: normalizedMatch.id, name: normalizedMatch.name, confidence: "normalized" };
  }

  // Try partial match (first result)
  const partialMatches = await searchPOIs(placeName, 1);
  if (partialMatches.length > 0) {
    return { poi: partialMatches[0].id, name: partialMatches[0].name, confidence: "partial" };
  }

  return null;
}

/**
 * Get all loaded POIs (for debugging)
 */
export async function getAllPOIs(): Promise<POI[]> {
  const cache = await loadPOIs();
  return cache.pois;
}

/**
 * Check if POIs are loaded
 */
export function isPOIsCached(): boolean {
  return poiCache !== null;
}

/**
 * Clear POI cache (for testing)
 */
export function clearPOICache(): void {
  poiCache = null;
  loadingPromise = null;
}
