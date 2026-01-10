import https from "https";
import fs from "fs";
import path from "path";
import type { TripOption, Station, VehicleType } from "@/types";
import { getStationById } from "./stations-loader";

// API Configuration
const CERT_PATH =
  process.env.MTLS_CERT_PATH ||
  "./certs/24-08-2025_google_integration_client.pem";
const KEY_PATH =
  process.env.MTLS_KEY_PATH ||
  "./certs/24-08-2025_google_integration_client.key";
const REQUEST_TIMEOUT = 30000;

// API endpoints
const API_ENDPOINTS = {
  p10: "https://google-integration.travelier.com/v1/search/Plataforma10",
  "12go": "https://google-integration.travelier.com/v1/search/OneTwoGo",
} as const;

const REDIRECT_ENDPOINTS = {
  p10: "https://google-integration-redirect.travelier.com/v1/redirect/Plataforma10",
  "12go": "https://google-integration-redirect.travelier.com/v1/redirect/OneTwoGo",
} as const;

type Company = keyof typeof API_ENDPOINTS;

// Singleton HTTPS agent
let httpsAgent: https.Agent | null = null;

function getHttpsAgent(): https.Agent {
  if (!httpsAgent) {
    try {
      const certPath = path.resolve(process.cwd(), CERT_PATH);
      const keyPath = path.resolve(process.cwd(), KEY_PATH);

      const cert = fs.readFileSync(certPath);
      const key = fs.readFileSync(keyPath);

      httpsAgent = new https.Agent({
        cert,
        key,
        keepAlive: true,
        maxSockets: 50,
      });
    } catch (error) {
      console.error("Failed to load mTLS certificates:", error);
      throw new Error("mTLS certificates not found or invalid");
    }
  }
  return httpsAgent;
}

// Helper functions
function formatTime(timeObj: { hours?: number; minutes?: number } | null): string {
  if (!timeObj) return "00:00";
  const hours = String(timeObj.hours || 0).padStart(2, "0");
  const minutes = String(timeObj.minutes || 0).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDate(dateObj: { year: number; month: number; day: number } | null): string {
  if (!dateObj) return "0000-00-00";
  const year = dateObj.year;
  const month = String(dateObj.month || 1).padStart(2, "0");
  const day = String(dateObj.day || 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculatePrice(amountObj: { units?: string; nanos?: number; currency_code?: string } | null): number {
  if (!amountObj) return 0;
  const units = parseFloat(amountObj.units || "0");
  const nanos = parseFloat(String(amountObj.nanos || 0)) / 1e9;
  return units + nanos;
}

function generateRedirectUrl(
  bookingToken: string,
  company: Company,
  details: {
    origin: string;
    destination: string;
    serviceDate: string;
    boardingTime: string;
    arrivalTime: string;
  }
): string {
  const redirectBase = REDIRECT_ENDPOINTS[company];

  // Format service_date as YYYYMMDD (no dashes)
  const serviceDateCompact = details.serviceDate.replace(/-/g, "");

  // Format times as ISO 8601 with timezone (YYYY-MM-DDTHH:MM:SS+00:00)
  const boardingTimeISO = `${details.serviceDate}T${details.boardingTime}:00+00:00`;
  const arrivalTimeISO = `${details.serviceDate}T${details.arrivalTime}:00+00:00`;

  // All values except booking_token must be JSON arrays
  const queryParams = new URLSearchParams({
    booking_token: bookingToken,
    from_ticketing_stop_time_id: JSON.stringify([details.origin]),
    to_ticketing_stop_time_id: JSON.stringify([details.destination]),
    service_date: JSON.stringify([serviceDateCompact]),
    boarding_time: JSON.stringify([boardingTimeISO]),
    arrival_time: JSON.stringify([arrivalTimeISO]),
  });
  return `${redirectBase}?${queryParams.toString()}`;
}

function calculateDuration(
  departureTime: string,
  arrivalTime: string,
  departureDate: string,
  arrivalDate: string
): number {
  const depDateTime = new Date(`${departureDate}T${departureTime}:00`);
  const arrDateTime = new Date(`${arrivalDate}T${arrivalTime}:00`);
  return Math.round((arrDateTime.getTime() - depDateTime.getTime()) / 60000);
}

// Determine vehicle type from operator name (heuristic)
function inferVehicleType(operatorName: string): VehicleType {
  const name = operatorName.toLowerCase();
  if (name.includes("ferry") || name.includes("boat") || name.includes("catamaran")) {
    return "ferry";
  }
  if (name.includes("train") || name.includes("rail")) {
    return "train";
  }
  return "bus"; // Default to bus
}

interface SearchParams {
  origin: string;
  destination: string;
  date: string;
  company?: Company;
}

interface SearchResult {
  trips: TripOption[];
  origin: Station | null;
  destination: Station | null;
  date: string;
  searchId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseApiResponse(
  response: any,
  origin: string,
  destination: string,
  date: string,
  company: Company
): TripOption[] {
  const trips: TripOption[] = [];

  const itineraryResponses =
    response?.bulk_trip_options_result?.itinerary_responses || [];

  for (const itineraryResp of itineraryResponses) {
    const segmentKey = itineraryResp.itinerary?.segment_keys?.[0];
    if (!segmentKey) continue;

    const boarding = segmentKey.boarding_time;
    const arrival = segmentKey.arrival_time;
    const serviceDate = segmentKey.service_date;

    const tripOptions = itineraryResp.trip_option_set?.trip_options || [];
    if (tripOptions.length === 0) continue;

    // Process each trip option
    for (const opt of tripOptions) {
      const price = calculatePrice(opt.lowest_standard_fare?.total_amount);
      if (price <= 0) continue;

      const bookingToken = opt.booking_token;
      const currency =
        opt.lowest_standard_fare?.total_amount?.currency_code || "THB";
      const availableSeats =
        opt.availability?.available?.available_seat_count || 0;

      const departureTime = formatTime(boarding);
      const arrivalTime = formatTime(arrival);
      const departureDate = formatDate(serviceDate);
      const arrivalDate = formatDate(arrival) || departureDate;

      const originStation = getStationById(origin);
      const destStation = getStationById(destination);

      // Get operator name from the option (if available)
      const operatorName = opt.operator_name || "12Go Asia";

      const trip: TripOption = {
        id: `${origin}-${destination}-${departureTime}-${bookingToken.slice(-8)}`,
        bookingToken,
        departureTime,
        arrivalTime,
        departureDate,
        arrivalDate,
        duration: calculateDuration(
          departureTime,
          arrivalTime,
          departureDate,
          arrivalDate
        ),
        price: {
          amount: price,
          currency,
        },
        operator: operatorName,
        vehicleType: inferVehicleType(operatorName),
        availableSeats,
        amenities: [], // Not available from API
        segments: [
          {
            origin: {
              id: origin,
              name: originStation?.name || origin,
              city: originStation?.city || "",
            },
            destination: {
              id: destination,
              name: destStation?.name || destination,
              city: destStation?.city || "",
            },
            departureTime,
            arrivalTime,
            vehicleType: inferVehicleType(operatorName),
            operator: operatorName,
          },
        ],
        redirectUrl: generateRedirectUrl(bookingToken, company, {
          origin,
          destination,
          serviceDate: departureDate,
          boardingTime: departureTime,
          arrivalTime,
        }),
        origin: {
          id: origin,
          name: originStation?.name || origin,
          city: originStation?.city || "",
        },
        destination: {
          id: destination,
          name: destStation?.name || destination,
          city: destStation?.city || "",
        },
      };

      trips.push(trip);
    }
  }

  // Sort by departure time
  trips.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

  return trips;
}

export async function searchRoutes(params: SearchParams): Promise<SearchResult> {
  const { origin, destination, date, company = "12go" } = params;

  const apiUrl = API_ENDPOINTS[company];
  const [year, month, day] = date.split("-").map(Number);

  const payload = {
    known_itineraries: [],
    market_dates: [
      {
        departure_date: { day, month, year },
        destination_ticketing_stop_id: destination,
        origin_ticketing_stop_id: origin,
      },
    ],
    only_known_itineraries: false,
  };

  const agent = getHttpsAgent();

  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl);

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      agent,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      timeout: REQUEST_TIMEOUT,
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          const trips = parseApiResponse(response, origin, destination, date, company);

          resolve({
            trips,
            origin: getStationById(origin) || null,
            destination: getStationById(destination) || null,
            date,
            searchId: `${origin}-${destination}-${date}-${Date.now()}`,
          });
        } catch (error) {
          console.error("Failed to parse API response:", error);
          reject(new Error("Failed to parse search results"));
        }
      });
    });

    req.on("error", (error) => {
      console.error("API request failed:", error);
      reject(new Error("Search request failed"));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Search request timed out"));
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

// Export for testing
export { getHttpsAgent, parseApiResponse };
