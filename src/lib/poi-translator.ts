import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache for POI translations to avoid repeated LLM calls
const poiCache = new Map<string, string>();

// Known POI mappings for validation and examples
const KNOWN_POIS: Record<string, string> = {
  // Thailand
  "bangkok, thailand": "THBAG",
  "pattaya, thailand": "THPAY",
  "chiang mai, thailand": "THCHI",
  "phuket, thailand": "THPHU",
  "krabi, thailand": "THKRA",
  "koh samui, thailand": "THSAM",
  "koh phangan, thailand": "THPHA",
  "koh tao, thailand": "THTAO",
  "hua hin, thailand": "THHUA",
  "ayutthaya, thailand": "THAYU",
  "sukhothai, thailand": "THSUK",
  "chiang rai, thailand": "THCRI",
  "kanchanaburi, thailand": "THKAN",
  "surat thani, thailand": "THSUR",
  "hat yai, thailand": "THHAT",
  // Vietnam
  "ho chi minh city, vietnam": "VNHCM",
  "hanoi, vietnam": "VNHAN",
  "da nang, vietnam": "VNDAN",
  "nha trang, vietnam": "VNNHA",
  "hue, vietnam": "VNHUE",
  // Cambodia
  "phnom penh, cambodia": "KHPNH",
  "siem reap, cambodia": "KHSRP",
  "sihanoukville, cambodia": "KHSHV",
  // Malaysia
  "kuala lumpur, malaysia": "MYKUL",
  "penang, malaysia": "MYPEN",
  "langkawi, malaysia": "MYLAN",
  // Singapore
  "singapore, singapore": "SGSIN",
  // Indonesia
  "bali, indonesia": "IDDPS",
  "jakarta, indonesia": "IDJKT",
  // Laos
  "vientiane, laos": "LAVTE",
  "luang prabang, laos": "LALPB",
  // Myanmar
  "yangon, myanmar": "MMRGN",
  "bagan, myanmar": "MMBGN",
};

// Country code mapping
const COUNTRY_CODES: Record<string, string> = {
  thailand: "TH",
  vietnam: "VN",
  cambodia: "KH",
  malaysia: "MY",
  singapore: "SG",
  indonesia: "ID",
  laos: "LA",
  myanmar: "MM",
  philippines: "PH",
  brunei: "BN",
};

export interface TranslationResult {
  poi: string;
  confidence: "high" | "medium" | "low";
  source: "cache" | "known" | "llm";
}

/**
 * Translate a city/place name to POI ID
 * Uses cache first, then known mappings, then Claude LLM
 */
export async function translateToPoi(
  placeName: string,
  country: string
): Promise<TranslationResult> {
  const cacheKey = `${placeName.toLowerCase()}, ${country.toLowerCase()}`;

  // Check cache first
  const cached = poiCache.get(cacheKey);
  if (cached) {
    return { poi: cached, confidence: "high", source: "cache" };
  }

  // Check known mappings
  const known = KNOWN_POIS[cacheKey];
  if (known) {
    poiCache.set(cacheKey, known);
    return { poi: known, confidence: "high", source: "known" };
  }

  // Use Claude for translation
  const poi = await translateWithClaude(placeName, country);
  poiCache.set(cacheKey, poi);

  return { poi, confidence: "medium", source: "llm" };
}

async function translateWithClaude(placeName: string, country: string): Promise<string> {
  const countryCode = COUNTRY_CODES[country.toLowerCase()] || country.substring(0, 2).toUpperCase();

  // Build examples from known POIs
  const examples = Object.entries(KNOWN_POIS)
    .slice(0, 10)
    .map(([key, poi]) => `- ${key} → ${poi}`)
    .join("\n");

  const prompt = `You are a POI ID translator for a travel API. Convert city/place names to POI IDs.

Format: {2-letter country code}{3-letter city abbreviation}
- Country code: ISO 3166-1 alpha-2 (TH, VN, KH, MY, SG, ID, LA, MM)
- City abbreviation: 3 letters, typically first 3 consonants or recognizable abbreviation

Examples of known POI IDs:
${examples}

Rules:
1. Use standard 3-letter city abbreviations when they exist
2. For cities with common English names, use the English abbreviation
3. Avoid vowel-only abbreviations
4. Be consistent with existing patterns

Given: ${placeName}, ${country}
Country code: ${countryCode}

Return ONLY the 5-character POI ID (2 letters + 3 letters), nothing else.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 10,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const poi = content.text.trim().toUpperCase();
      // Validate format: 2 letters country + 3 letters city
      if (/^[A-Z]{2}[A-Z]{3}$/.test(poi)) {
        return poi;
      }
    }

    // Fallback: construct a basic POI
    return constructFallbackPoi(placeName, countryCode);
  } catch (error) {
    console.error("Claude translation error:", error);
    return constructFallbackPoi(placeName, countryCode);
  }
}

/**
 * Construct a fallback POI when LLM fails
 */
function constructFallbackPoi(placeName: string, countryCode: string): string {
  // Remove common words and get first 3 consonants
  const cleaned = placeName
    .toLowerCase()
    .replace(/\b(city|town|island|beach|province|state|ko|koh)\b/gi, "")
    .replace(/[^a-z]/g, "");

  // Extract first 3 consonants (or characters if not enough consonants)
  const consonants = cleaned.replace(/[aeiou]/g, "");
  const abbrev = consonants.length >= 3 ? consonants.substring(0, 3) : cleaned.substring(0, 3);

  return `${countryCode}${abbrev.toUpperCase()}`;
}

/**
 * Batch translate multiple places
 */
export async function translateBatch(
  places: Array<{ name: string; country: string }>
): Promise<Map<string, TranslationResult>> {
  const results = new Map<string, TranslationResult>();

  await Promise.all(
    places.map(async ({ name, country }) => {
      const result = await translateToPoi(name, country);
      results.set(`${name}, ${country}`, result);
    })
  );

  return results;
}

/**
 * Clear the POI cache (useful for testing)
 */
export function clearPoiCache(): void {
  poiCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: poiCache.size,
    entries: Array.from(poiCache.keys()),
  };
}
