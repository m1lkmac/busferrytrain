// Station types
export interface Station {
  id: string;
  name: string;
  city: string;
  province: string;
  country: string;
  lat: number;
  lon: number;
  company: "12go" | "p10";
}

// City type (aggregates stations)
export interface City {
  name: string;
  province: string;
  country: string;
  stationCount: number;
  stations: Station[];
}

// Place type (from Mapbox)
export interface Place {
  id: string;
  name: string;
  fullName: string; // e.g., "Bangkok, Thailand"
  country: string;
  countryCode: string;
  region?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

// Search types
export interface SearchParams {
  origin: string;
  destination: string;
  date: string;
  passengers?: number;
  company?: "12go" | "p10";
}

export interface SearchResult {
  trips: TripOption[];
  origin: Station;
  destination: Station;
  date: string;
  searchId: string;
}

// Trip types
export type VehicleType = "bus" | "ferry" | "train";

export interface TripOption {
  id: string;
  bookingToken: string;
  departureTime: string;
  arrivalTime: string;
  departureDate: string;
  arrivalDate: string;
  duration: number; // minutes
  price: {
    amount: number;
    currency: string;
  };
  operator: string;
  operatorLogo?: string;
  vehicleType: VehicleType;
  availableSeats: number;
  amenities: string[];
  segments: TripSegment[];
  redirectUrl: string;
  origin: {
    id: string;
    name: string;
    city: string;
  };
  destination: {
    id: string;
    name: string;
    city: string;
  };
}

export interface TripSegment {
  origin: {
    id: string;
    name: string;
    city: string;
  };
  destination: {
    id: string;
    name: string;
    city: string;
  };
  departureTime: string;
  arrivalTime: string;
  vehicleType: VehicleType;
  operator: string;
}

// Filter types
export interface FilterState {
  priceRange: [number, number];
  departureTimeRange: [number, number]; // hours 0-24
  vehicleTypes: VehicleType[];
  operators: string[];
  sortBy: "price" | "departure" | "duration";
  sortOrder: "asc" | "desc";
}

// Article type for travel content
export interface Article {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  excerpt?: string;
  destination?: string;
}

// Chat types
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  embeddedTrips?: TripOption[];
  embeddedArticles?: Article[];
  timestamp: string;
}

// UI State types
export interface SearchState {
  origin: Station | null;
  destination: Station | null;
  date: string;
  passengers: number;
  results: TripOption[];
  isLoading: boolean;
  error: string | null;
}

// API response types
export interface APIItineraryResponse {
  bulk_trip_options_result: {
    itinerary_responses: Array<{
      trip_option_set: Array<{
        booking_token: string;
        lowest_standard_fare: {
          price: {
            currency: string;
            whole_units: string;
            nano: number;
          };
        };
        availability: {
          available: string;
        };
      }>;
      boarding_time: {
        hour: number;
        minute: number;
      };
      arrival_time: {
        hour: number;
        minute: number;
      };
      service_date: {
        year: number;
        month: number;
        day: number;
      };
    }>;
  };
}
