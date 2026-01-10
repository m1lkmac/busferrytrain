import { NextRequest, NextResponse } from "next/server";
import {
  searchStations,
  searchCities,
  getStationById,
  getCityInfo,
  getAllCities,
} from "@/lib/stations-loader";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q") || "";
  const id = searchParams.get("id");
  const city = searchParams.get("city");
  const mode = searchParams.get("mode") || "city"; // "city" or "station"
  const limit = parseInt(searchParams.get("limit") || "10");

  try {
    // Get station by ID
    if (id) {
      const station = getStationById(id);
      if (!station) {
        return NextResponse.json({ error: "Station not found" }, { status: 404 });
      }
      return NextResponse.json(station);
    }

    // Get city info by name
    if (city) {
      const cityInfo = getCityInfo(city);
      if (!cityInfo) {
        return NextResponse.json({ error: "City not found" }, { status: 404 });
      }
      return NextResponse.json(cityInfo);
    }

    // Search by query
    if (query) {
      if (mode === "city") {
        // Search cities (default)
        const results = searchCities(query, { limit });
        return NextResponse.json({
          results,
          count: results.length,
          mode: "city",
        });
      } else {
        // Search individual stations
        const results = searchStations(query, { limit });
        return NextResponse.json({
          results,
          count: results.length,
          mode: "station",
        });
      }
    }

    // Return list of cities for empty query
    const cities = getAllCities().slice(0, limit);
    return NextResponse.json({
      cities,
      count: cities.length,
    });
  } catch (error) {
    console.error("Station search error:", error);
    return NextResponse.json(
      { error: "Failed to search stations" },
      { status: 500 }
    );
  }
}
