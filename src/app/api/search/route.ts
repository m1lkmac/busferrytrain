import { NextRequest, NextResponse } from "next/server";
import { searchItineraries } from "@/lib/tc-api-client";
import { translateToPOI } from "@/lib/poi-loader";
import type { TripOption } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const originName = searchParams.get("origin");
  const destinationName = searchParams.get("destination");
  const date = searchParams.get("date");
  const pax = parseInt(searchParams.get("pax") || "1");

  // Validate required parameters
  if (!originName) {
    return NextResponse.json(
      { error: "Missing required parameter: origin" },
      { status: 400 }
    );
  }

  if (!destinationName) {
    return NextResponse.json(
      { error: "Missing required parameter: destination" },
      { status: 400 }
    );
  }

  if (!date) {
    return NextResponse.json(
      { error: "Missing required parameter: date" },
      { status: 400 }
    );
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD" },
      { status: 400 }
    );
  }

  try {
    // Translate place names to POI IDs using cached POI data
    console.log(`Translating: ${originName} → POI`);
    const originResult = await translateToPOI(originName);

    if (!originResult) {
      return NextResponse.json(
        { error: `Could not find POI for: ${originName}. Try a different city name.` },
        { status: 400 }
      );
    }
    console.log(`Origin POI: ${originResult.poi} (${originResult.name}, ${originResult.confidence})`);

    console.log(`Translating: ${destinationName} → POI`);
    const destResult = await translateToPOI(destinationName);

    if (!destResult) {
      return NextResponse.json(
        { error: `Could not find POI for: ${destinationName}. Try a different city name.` },
        { status: 400 }
      );
    }
    console.log(`Destination POI: ${destResult.poi} (${destResult.name}, ${destResult.confidence})`);

    // Search using the TC API
    console.log(`Searching: ${originResult.poi} → ${destResult.poi} on ${date}`);
    const trips = await searchItineraries({
      departurePoi: originResult.poi,
      arrivalPoi: destResult.poi,
      departureDate: date,
      pax,
    });

    console.log(`Found ${trips.length} trips`);

    // Enrich trip data with city names
    const enrichedTrips: TripOption[] = trips.map((trip) => ({
      ...trip,
      origin: {
        ...trip.origin,
        city: originResult.name,
      },
      destination: {
        ...trip.destination,
        city: destResult.name,
      },
      segments: trip.segments.map((seg, idx) => ({
        ...seg,
        origin: {
          ...seg.origin,
          city: idx === 0 ? originResult.name : seg.origin.city,
        },
        destination: {
          ...seg.destination,
          city: idx === trip.segments.length - 1 ? destResult.name : seg.destination.city,
        },
      })),
    }));

    return NextResponse.json({
      trips: enrichedTrips,
      origin: {
        name: originResult.name,
        poi: originResult.poi,
        confidence: originResult.confidence,
      },
      destination: {
        name: destResult.name,
        poi: destResult.poi,
        confidence: destResult.confidence,
      },
      date,
      searchId: `${originResult.poi}-${destResult.poi}-${date}-${Date.now()}`,
      meta: {
        totalTrips: trips.length,
      },
    });
  } catch (error) {
    console.error("Search error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Search failed. Please try again.";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, date, pax } = body;

    // Build URL params and delegate to GET
    const params = new URLSearchParams();
    if (origin) params.set("origin", origin);
    if (destination) params.set("destination", destination);
    if (date) params.set("date", date);
    if (pax) params.set("pax", String(pax));

    const url = new URL(request.url);
    url.search = params.toString();
    const getRequest = new NextRequest(url);

    return GET(getRequest);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}
