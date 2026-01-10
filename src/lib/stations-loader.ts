import type { Station } from "@/types";
import stationsData from "@/data/stations.json";

// Type for the stations data structure
interface StationsData {
  stations: Station[];
  indexes: {
    byId: Record<string, Station>;
    byCity: Record<string, string[]>;
    byProvince: Record<string, string[]>;
  };
  metadata: {
    totalStations: number;
    countries: string[];
    companies: string[];
    generatedAt: string;
  };
}

const data = stationsData as StationsData;

/**
 * Get a station by its ID
 */
export function getStationById(id: string): Station | undefined {
  return data.indexes.byId[id];
}

/**
 * Get all stations in a city
 */
export function getStationsByCity(city: string): Station[] {
  const ids = data.indexes.byCity[city] || [];
  return ids.map((id) => data.indexes.byId[id]).filter(Boolean);
}

/**
 * Get all stations in a province
 */
export function getStationsByProvince(province: string): Station[] {
  const ids = data.indexes.byProvince[province] || [];
  return ids.map((id) => data.indexes.byId[id]).filter(Boolean);
}

/**
 * Search stations by query (name, city, or province)
 */
export function searchStations(
  query: string,
  options: {
    limit?: number;
    country?: string;
  } = {}
): Station[] {
  const { limit = 10, country } = options;

  if (!query || query.length < 2) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Score stations based on match quality
  const scored = data.stations
    .filter((station) => {
      // Filter by country if specified
      if (country && station.country.toLowerCase() !== country.toLowerCase()) {
        return false;
      }
      return true;
    })
    .map((station) => {
      let score = 0;
      const name = station.name.toLowerCase();
      const city = station.city.toLowerCase();
      const province = station.province.toLowerCase();

      // Exact match gets highest score
      if (name === normalizedQuery) score += 100;
      else if (city === normalizedQuery) score += 90;
      else if (province === normalizedQuery) score += 80;

      // Starts with query
      if (name.startsWith(normalizedQuery)) score += 50;
      else if (city.startsWith(normalizedQuery)) score += 45;
      else if (province.startsWith(normalizedQuery)) score += 40;

      // Contains query
      if (name.includes(normalizedQuery)) score += 20;
      else if (city.includes(normalizedQuery)) score += 15;
      else if (province.includes(normalizedQuery)) score += 10;

      // Word boundary match (e.g., "bangkok" in "Bangkok Bus Terminal")
      const words = [
        ...name.split(/\s+/),
        ...city.split(/\s+/),
        ...province.split(/\s+/),
      ];
      if (words.some((word) => word.startsWith(normalizedQuery))) {
        score += 30;
      }

      return { station, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ station }) => station);

  return scored;
}

/**
 * Get unique cities
 */
export function getAllCities(): string[] {
  return Object.keys(data.indexes.byCity).sort();
}

/**
 * Get unique provinces
 */
export function getAllProvinces(): string[] {
  return Object.keys(data.indexes.byProvince).sort();
}

/**
 * Get all stations
 */
export function getAllStations(): Station[] {
  return data.stations;
}

/**
 * Get metadata
 */
export function getMetadata() {
  return data.metadata;
}

// City type for city-level search
export interface City {
  name: string;
  province: string;
  country: string;
  stationCount: number;
  stations: Station[];
}

/**
 * Get city info with all its stations
 */
export function getCityInfo(cityName: string): City | null {
  const stations = getStationsByCity(cityName);
  if (stations.length === 0) return null;

  return {
    name: cityName,
    province: stations[0].province,
    country: stations[0].country,
    stationCount: stations.length,
    stations,
  };
}

/**
 * Search cities by query
 */
export function searchCities(
  query: string,
  options: { limit?: number } = {}
): City[] {
  const { limit = 10 } = options;

  if (!query || query.length < 2) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const allCities = getAllCities();

  // Score cities based on match quality
  const scored = allCities
    .map((cityName) => {
      let score = 0;
      const city = cityName.toLowerCase();

      // Exact match
      if (city === normalizedQuery) score += 100;
      // Starts with query
      else if (city.startsWith(normalizedQuery)) score += 50;
      // Contains query
      else if (city.includes(normalizedQuery)) score += 20;

      return { cityName, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ cityName }) => getCityInfo(cityName)!)
    .filter(Boolean);

  return scored;
}
