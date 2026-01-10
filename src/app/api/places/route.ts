import { NextRequest, NextResponse } from "next/server";
import type { Place } from "@/types";

export const runtime = "edge";

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || "";

// Mapbox Geocoding API types
interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
  properties?: {
    short_code?: string;
  };
}

interface MapboxResponse {
  features: MapboxFeature[];
}

// Southeast Asia bounding box for biasing results
const SOUTHEAST_ASIA_BBOX = "92.0,0.0,141.0,28.0"; // [minLng, minLat, maxLng, maxLat]

function parseMapboxFeature(feature: MapboxFeature): Place {
  // Extract country from context
  const countryContext = feature.context?.find((c) => c.id.startsWith("country"));
  const regionContext = feature.context?.find(
    (c) => c.id.startsWith("region") || c.id.startsWith("place")
  );

  // Get country code from context or properties
  let countryCode = countryContext?.short_code?.toUpperCase() || "";
  if (!countryCode && feature.properties?.short_code) {
    countryCode = feature.properties.short_code.toUpperCase();
  }

  return {
    id: feature.id,
    name: feature.text,
    fullName: feature.place_name,
    country: countryContext?.text || "",
    countryCode,
    region: regionContext?.text,
    coordinates: {
      lng: feature.center[0],
      lat: feature.center[1],
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.length < 2) {
    return NextResponse.json({ places: [] });
  }

  if (!MAPBOX_ACCESS_TOKEN) {
    console.error("MAPBOX_ACCESS_TOKEN not configured");
    return NextResponse.json(
      { error: "Places search not configured" },
      { status: 500 }
    );
  }

  try {
    // Use Mapbox Geocoding API
    // Filter to places (cities, towns) and localities
    const url = new URL(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
    );
    url.searchParams.set("access_token", MAPBOX_ACCESS_TOKEN);
    url.searchParams.set("types", "place,locality,region");
    url.searchParams.set("limit", "8");
    url.searchParams.set("bbox", SOUTHEAST_ASIA_BBOX);
    url.searchParams.set("language", "en");

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error("Mapbox API error:", response.status);
      return NextResponse.json(
        { error: "Failed to search places" },
        { status: 500 }
      );
    }

    const data: MapboxResponse = await response.json();

    const places: Place[] = data.features.map(parseMapboxFeature);

    return NextResponse.json({ places });
  } catch (error) {
    console.error("Places search error:", error);
    return NextResponse.json(
      { error: "Failed to search places" },
      { status: 500 }
    );
  }
}
