import type { TripOption, VehicleType, TripSegment } from "@/types";

// API Configuration
const TC_API_BASE = "https://api.travelier.com/v1/tc_prod";
const TC_API_KEY = process.env.TC_API_KEY || "";

// API Response Types
interface TCVehicle {
  id: string;
  name: string;
  operating_carrier_id: string;
  operating_carrier_name: string;
  image_url?: string;
}

interface TCSegment {
  id: string;
  from_station: string;
  to_station: string;
  departure_time: string; // ISO format: 2026-01-15T11:30
  arrival_time: string;
  travel_duration: string; // ISO 8601 duration: PT3H
  vehicle_id: string;
  operating_carrier_id: string;
  operating_carrier_name?: string;
  seat_class_id: string;
  transportation_types: string[];
}

interface TCPrice {
  currency: string;
  amount: string;
}

interface TCItinerary {
  id: string;
  departure_segments: string[];
  connection_guaranteed?: boolean;
  number_of_available_seats: number;
  pricing: {
    gross_price: TCPrice;
    net_price: TCPrice;
  };
  confirmation_type: string;
  ticket_type: string;
  cancellation_policies?: Array<{
    refund_percentage: number;
    deadline: string;
  }>;
}

interface TCApiResponse {
  vehicles: TCVehicle[];
  segments: TCSegment[];
  itineraries: TCItinerary[];
}

export interface ItineraryParams {
  departurePoi: string;
  arrivalPoi: string;
  departureDate: string; // YYYY-MM-DD
  pax?: number;
}

// Parse ISO 8601 duration (PT3H, PT3H30M, etc.) to minutes
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  return hours * 60 + minutes;
}

// Map transportation type to VehicleType
function mapVehicleType(transportationTypes: string[]): VehicleType {
  const types = transportationTypes.map((t) => t.toLowerCase());

  if (types.some((t) => t.includes("ferry") || t.includes("boat") || t.includes("catamaran"))) {
    return "ferry";
  }
  if (types.some((t) => t.includes("train") || t.includes("rail"))) {
    return "train";
  }
  // Default to bus for bus, van, minivan, etc.
  return "bus";
}

// Extract time from ISO datetime (2026-01-15T11:30 -> 11:30)
function extractTime(isoDateTime: string): string {
  const timePart = isoDateTime.split("T")[1];
  return timePart ? timePart.substring(0, 5) : "00:00";
}

// Extract date from ISO datetime (2026-01-15T11:30 -> 2026-01-15)
function extractDate(isoDateTime: string): string {
  return isoDateTime.split("T")[0];
}

// Parse station ID to get city name (best effort)
function parseStationName(stationId: string): string {
  // Station IDs like THBANBSF - extract readable part
  // This is a placeholder - actual station names come from context
  return stationId;
}

export async function searchItineraries(params: ItineraryParams): Promise<TripOption[]> {
  const { departurePoi, arrivalPoi, departureDate, pax = 1 } = params;

  if (!TC_API_KEY) {
    throw new Error("TC_API_KEY not configured");
  }

  const url = new URL(`${TC_API_BASE}/itineraries`);
  url.searchParams.set("departure_poi", departurePoi);
  url.searchParams.set("arrival_poi", arrivalPoi);
  url.searchParams.set("departure_date", departureDate);
  url.searchParams.set("pax", String(pax));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-api-key": TC_API_KEY,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("TC API error:", response.status, errorText);
    throw new Error(`API request failed: ${response.status}`);
  }

  const data: TCApiResponse = await response.json();

  return parseItinerariesResponse(data, departurePoi, arrivalPoi);
}

function parseItinerariesResponse(
  data: TCApiResponse,
  departurePoi: string,
  arrivalPoi: string
): TripOption[] {
  const { vehicles, segments, itineraries } = data;

  // Create lookup maps for efficient access
  const vehicleMap = new Map<string, TCVehicle>();
  for (const v of vehicles) {
    vehicleMap.set(v.id, v);
  }

  const segmentMap = new Map<string, TCSegment>();
  for (const s of segments) {
    segmentMap.set(s.id, s);
  }

  const trips: TripOption[] = [];

  for (const itinerary of itineraries) {
    // Get all segments for this itinerary
    const itinerarySegments = itinerary.departure_segments
      .map((segId) => segmentMap.get(segId))
      .filter((s): s is TCSegment => s !== undefined);

    if (itinerarySegments.length === 0) continue;

    // Get first and last segment for overall trip times
    const firstSegment = itinerarySegments[0];
    const lastSegment = itinerarySegments[itinerarySegments.length - 1];

    // Get vehicle info for the first segment
    const vehicle = vehicleMap.get(firstSegment.vehicle_id);
    const operatorName = vehicle?.operating_carrier_name || firstSegment.operating_carrier_id;

    // Calculate total duration
    const totalDuration = itinerarySegments.reduce(
      (sum, seg) => sum + parseDuration(seg.travel_duration),
      0
    );

    // Map segments to TripSegment format
    const tripSegments: TripSegment[] = itinerarySegments.map((seg) => {
      const segVehicle = vehicleMap.get(seg.vehicle_id);
      return {
        origin: {
          id: seg.from_station,
          name: parseStationName(seg.from_station),
          city: departurePoi, // Will be enriched later
        },
        destination: {
          id: seg.to_station,
          name: parseStationName(seg.to_station),
          city: arrivalPoi, // Will be enriched later
        },
        departureTime: extractTime(seg.departure_time),
        arrivalTime: extractTime(seg.arrival_time),
        vehicleType: mapVehicleType(seg.transportation_types),
        operator: segVehicle?.operating_carrier_name || seg.operating_carrier_id,
      };
    });

    // Use gross_price for display (includes all fees)
    const price = parseFloat(itinerary.pricing.gross_price.amount);
    const currency = itinerary.pricing.gross_price.currency;

    const trip: TripOption = {
      id: itinerary.id,
      bookingToken: itinerary.id, // Use itinerary ID as booking token for now
      departureTime: extractTime(firstSegment.departure_time),
      arrivalTime: extractTime(lastSegment.arrival_time),
      departureDate: extractDate(firstSegment.departure_time),
      arrivalDate: extractDate(lastSegment.arrival_time),
      duration: totalDuration,
      price: {
        amount: price,
        currency,
      },
      operator: operatorName,
      operatorLogo: vehicle?.image_url,
      vehicleType: mapVehicleType(firstSegment.transportation_types),
      availableSeats: itinerary.number_of_available_seats,
      amenities: [], // Not available from this API
      segments: tripSegments,
      redirectUrl: "", // Will be generated separately
      origin: {
        id: firstSegment.from_station,
        name: parseStationName(firstSegment.from_station),
        city: departurePoi,
      },
      destination: {
        id: lastSegment.to_station,
        name: parseStationName(lastSegment.to_station),
        city: arrivalPoi,
      },
    };

    trips.push(trip);
  }

  // Sort by departure time
  trips.sort((a, b) => {
    const timeCompare = a.departureTime.localeCompare(b.departureTime);
    if (timeCompare !== 0) return timeCompare;
    // Secondary sort by price
    return a.price.amount - b.price.amount;
  });

  return trips;
}

// Export for testing
export { parseItinerariesResponse, parseDuration, mapVehicleType };
