import { NextRequest, NextResponse } from "next/server";
import { searchRoutes } from "@/lib/api-client";
import { getCityInfo, getStationById } from "@/lib/stations-loader";
import type { TripOption } from "@/types";

export const runtime = "nodejs"; // Required for mTLS
export const maxDuration = 120; // Allow up to 120s for multi-station searches with streaming

// Deduplicate trips by creating a unique key
function deduplicateTrips(trips: TripOption[]): TripOption[] {
  const seen = new Map<string, TripOption>();

  for (const trip of trips) {
    // Create unique key based on departure time, arrival time, operator, price
    const key = `${trip.departureTime}-${trip.arrivalTime}-${trip.operator}-${trip.price.amount}`;

    // Keep the trip with more seats available if duplicate
    const existing = seen.get(key);
    if (!existing || trip.availableSeats > existing.availableSeats) {
      seen.set(key, trip);
    }
  }

  return Array.from(seen.values());
}

// Get trip key for deduplication
function getTripKey(trip: TripOption): string {
  return `${trip.departureTime}-${trip.arrivalTime}-${trip.operator}-${trip.price.amount}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Support both city names and station IDs
  const originCity = searchParams.get("originCity");
  const destinationCity = searchParams.get("destinationCity");
  const origin = searchParams.get("origin"); // Station ID (legacy)
  const destination = searchParams.get("destination"); // Station ID (legacy)
  const date = searchParams.get("date");
  const company = (searchParams.get("company") || "12go") as "12go" | "p10";
  const stream = searchParams.get("stream") === "true";

  // Validate date
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
    // City-to-city search (new behavior)
    if (originCity && destinationCity) {
      const originCityInfo = getCityInfo(originCity);
      const destCityInfo = getCityInfo(destinationCity);

      if (!originCityInfo) {
        return NextResponse.json(
          { error: `Origin city not found: ${originCity}` },
          { status: 404 }
        );
      }

      if (!destCityInfo) {
        return NextResponse.json(
          { error: `Destination city not found: ${destinationCity}` },
          { status: 404 }
        );
      }

      // Build all station combinations
      const searchPairs: { originId: string; destId: string }[] = [];
      for (const originStation of originCityInfo.stations) {
        for (const destStation of destCityInfo.stations) {
          searchPairs.push({
            originId: originStation.id,
            destId: destStation.id,
          });
        }
      }

      console.log(
        `City search: ${originCity} (${originCityInfo.stationCount} stations) → ` +
          `${destinationCity} (${destCityInfo.stationCount} stations) = ${searchPairs.length} combinations`
      );

      // Streaming mode: return results as they come in via SSE
      if (stream) {
        const encoder = new TextEncoder();
        const seenKeys = new Set<string>();

        const responseStream = new ReadableStream({
          async start(controller) {
            // Send initial metadata
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "meta",
                  originCity: originCityInfo,
                  destinationCity: destCityInfo,
                  date,
                  searchId: `${originCity}-${destinationCity}-${date}-${Date.now()}`,
                  totalCombinations: searchPairs.length,
                })}\n\n`
              )
            );

            const CONCURRENCY = 5;
            let completedSearches = 0;
            let totalTripsFound = 0;
            const errors: string[] = [];

            for (let i = 0; i < searchPairs.length; i += CONCURRENCY) {
              const batch = searchPairs.slice(i, i + CONCURRENCY);
              const results = await Promise.allSettled(
                batch.map((pair) =>
                  searchRoutes({
                    origin: pair.originId,
                    destination: pair.destId,
                    date,
                    company,
                  })
                )
              );

              const newTrips: TripOption[] = [];

              for (const result of results) {
                completedSearches++;
                if (result.status === "fulfilled") {
                  for (const trip of result.value.trips) {
                    totalTripsFound++;
                    const key = getTripKey(trip);
                    if (!seenKeys.has(key)) {
                      seenKeys.add(key);
                      newTrips.push(trip);
                    }
                  }
                } else {
                  errors.push(result.reason?.message || "Search failed");
                }
              }

              // Send new trips if any
              if (newTrips.length > 0) {
                // Sort new trips by departure time
                newTrips.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "trips",
                      trips: newTrips,
                    })}\n\n`
                  )
                );
              }

              // Send progress update
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "progress",
                    completed: completedSearches,
                    total: searchPairs.length,
                    uniqueTripsFound: seenKeys.size,
                    totalTripsFound,
                  })}\n\n`
                )
              );
            }

            // Send completion message
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "complete",
                  meta: {
                    stationCombinations: searchPairs.length,
                    totalTripsFound,
                    uniqueTrips: seenKeys.size,
                    errors: errors.length > 0 ? errors : undefined,
                  },
                })}\n\n`
              )
            );

            controller.close();
          },
        });

        return new Response(responseStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Non-streaming mode: wait for all results
      const CONCURRENCY = 5;
      const allTrips: TripOption[] = [];
      const errors: string[] = [];

      for (let i = 0; i < searchPairs.length; i += CONCURRENCY) {
        const batch = searchPairs.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map((pair) =>
            searchRoutes({
              origin: pair.originId,
              destination: pair.destId,
              date,
              company,
            })
          )
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            allTrips.push(...result.value.trips);
          } else {
            errors.push(result.reason?.message || "Search failed");
          }
        }
      }

      // Deduplicate and sort
      const uniqueTrips = deduplicateTrips(allTrips);
      uniqueTrips.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

      return NextResponse.json({
        trips: uniqueTrips,
        originCity: originCityInfo,
        destinationCity: destCityInfo,
        date,
        searchId: `${originCity}-${destinationCity}-${date}-${Date.now()}`,
        meta: {
          stationCombinations: searchPairs.length,
          totalTripsFound: allTrips.length,
          uniqueTrips: uniqueTrips.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    }

    // Station-to-station search (legacy behavior)
    if (!origin) {
      return NextResponse.json(
        { error: "Missing required parameter: origin or originCity" },
        { status: 400 }
      );
    }

    if (!destination) {
      return NextResponse.json(
        { error: "Missing required parameter: destination or destinationCity" },
        { status: 400 }
      );
    }

    const result = await searchRoutes({
      origin,
      destination,
      date,
      company,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 }
    );
  }
}

// Also support POST for more complex queries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { originCity, destinationCity, origin, destination, date, company = "12go" } = body;

    if (!date) {
      return NextResponse.json(
        { error: "Missing required parameter: date" },
        { status: 400 }
      );
    }

    // Redirect to GET handler logic by constructing URL
    const params = new URLSearchParams({ date, company });
    if (originCity) params.set("originCity", originCity);
    if (destinationCity) params.set("destinationCity", destinationCity);
    if (origin) params.set("origin", origin);
    if (destination) params.set("destination", destination);

    // Create a new request with GET params
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
