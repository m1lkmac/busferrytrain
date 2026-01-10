"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { create } from "zustand";
import type { City, TripOption, FilterState } from "@/types";

interface SearchStore {
  // Search inputs (now city-based)
  origin: City | null;
  destination: City | null;
  date: string;
  passengers: number;

  // Results
  results: TripOption[];
  filteredResults: TripOption[];

  // UI state
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;

  // Search progress (for streaming)
  searchProgress: {
    completed: number;
    total: number;
    uniqueTripsFound: number;
    totalTripsFound: number;
  } | null;

  // Search metadata
  searchMeta: {
    stationCombinations?: number;
    totalTripsFound?: number;
    uniqueTrips?: number;
    errors?: string[];
  } | null;

  // Filters
  filters: FilterState;

  // Actions
  setOrigin: (city: City | null) => void;
  setDestination: (city: City | null) => void;
  setDate: (date: string) => void;
  setPassengers: (count: number) => void;
  setResults: (results: TripOption[], meta?: SearchStore["searchMeta"]) => void;
  addResults: (newTrips: TripOption[]) => void;
  setSearchProgress: (progress: SearchStore["searchProgress"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasSearched: (hasSearched: boolean) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  swapCities: () => void;
  reset: () => void;
}

const defaultFilters: FilterState = {
  priceRange: [0, 10000],
  departureTimeRange: [0, 24],
  vehicleTypes: ["bus", "ferry", "train"],
  operators: [],
  sortBy: "departure",
  sortOrder: "asc",
};

// Get tomorrow's date in YYYY-MM-DD format
function getTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

// Apply filters and sort to results
function applyFilters(results: TripOption[], filters: FilterState): TripOption[] {
  let filtered = [...results];

  // Filter by price
  filtered = filtered.filter(
    (trip) =>
      trip.price.amount >= filters.priceRange[0] &&
      trip.price.amount <= filters.priceRange[1]
  );

  // Filter by departure time
  filtered = filtered.filter((trip) => {
    const hour = parseInt(trip.departureTime.split(":")[0]);
    return hour >= filters.departureTimeRange[0] && hour < filters.departureTimeRange[1];
  });

  // Filter by vehicle type
  if (filters.vehicleTypes.length > 0) {
    filtered = filtered.filter((trip) =>
      filters.vehicleTypes.includes(trip.vehicleType)
    );
  }

  // Filter by operator
  if (filters.operators.length > 0) {
    filtered = filtered.filter((trip) =>
      filters.operators.includes(trip.operator)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let comparison = 0;

    switch (filters.sortBy) {
      case "price":
        comparison = a.price.amount - b.price.amount;
        break;
      case "duration":
        comparison = a.duration - b.duration;
        break;
      case "departure":
        comparison = a.departureTime.localeCompare(b.departureTime);
        break;
    }

    return filters.sortOrder === "asc" ? comparison : -comparison;
  });

  return filtered;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  origin: null,
  destination: null,
  date: getTomorrow(),
  passengers: 1,
  results: [],
  filteredResults: [],
  isLoading: false,
  error: null,
  hasSearched: false,
  searchProgress: null,
  searchMeta: null,
  filters: defaultFilters,

  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  setDate: (date) => set({ date }),
  setPassengers: (passengers) => set({ passengers }),

  setResults: (results, meta) => {
    const { filters } = get();
    set({
      results,
      filteredResults: applyFilters(results, filters),
      searchMeta: meta || null,
    });
  },

  addResults: (newTrips) => {
    const { results, filters } = get();
    // Merge and sort all trips
    const allTrips = [...results, ...newTrips];
    allTrips.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    set({
      results: allTrips,
      filteredResults: applyFilters(allTrips, filters),
    });
  },

  setSearchProgress: (progress) => set({ searchProgress: progress }),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setHasSearched: (hasSearched) => set({ hasSearched }),

  setFilters: (newFilters) => {
    const { filters, results } = get();
    const updatedFilters = { ...filters, ...newFilters };
    set({
      filters: updatedFilters,
      filteredResults: applyFilters(results, updatedFilters),
    });
  },

  resetFilters: () => {
    const { results } = get();
    set({
      filters: defaultFilters,
      filteredResults: applyFilters(results, defaultFilters),
    });
  },

  swapCities: () => {
    const { origin, destination } = get();
    set({ origin: destination, destination: origin });
  },

  reset: () =>
    set({
      origin: null,
      destination: null,
      date: getTomorrow(),
      passengers: 1,
      results: [],
      filteredResults: [],
      isLoading: false,
      error: null,
      hasSearched: false,
      searchProgress: null,
      searchMeta: null,
      filters: defaultFilters,
    }),
}));

// Hook with URL sync and search function
export function useSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useSearchStore();

  // Sync URL params to store on mount
  useEffect(() => {
    const from = searchParams.get("from"); // city name
    const to = searchParams.get("to"); // city name
    const date = searchParams.get("date");
    const pax = searchParams.get("pax");

    if (date) {
      store.setDate(date);
    }

    if (pax) {
      store.setPassengers(parseInt(pax) || 1);
    }

    // Load cities from names if present
    if (from) {
      fetch(`/api/stations?city=${encodeURIComponent(from)}`)
        .then((res) => res.json())
        .then((city) => {
          if (city && !city.error) {
            store.setOrigin(city);
          }
        })
        .catch(console.error);
    }

    if (to) {
      fetch(`/api/stations?city=${encodeURIComponent(to)}`)
        .then((res) => res.json())
        .then((city) => {
          if (city && !city.error) {
            store.setDestination(city);
          }
        })
        .catch(console.error);
    }

    // Auto-search if URL has all required params
    if (from && to && date) {
      // Small delay to allow city loading
      setTimeout(() => {
        const currentStore = useSearchStore.getState();
        if (currentStore.origin && currentStore.destination && !currentStore.hasSearched) {
          performSearch(currentStore.origin, currentStore.destination, date);
        }
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSearch = useCallback(
    async (origin: City, destination: City, date: string) => {
      store.setLoading(true);
      store.setError(null);
      store.setHasSearched(true);
      store.setResults([]); // Clear previous results
      store.setSearchProgress(null);

      try {
        // Use city names for multi-station search with streaming
        const params = new URLSearchParams({
          originCity: origin.name,
          destinationCity: destination.name,
          date,
          stream: "true",
        });

        const response = await fetch(`/api/search?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Search failed");
        }

        // Handle SSE stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to read response stream");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                switch (data.type) {
                  case "meta":
                    // Initial metadata received
                    store.setSearchProgress({
                      completed: 0,
                      total: data.totalCombinations,
                      uniqueTripsFound: 0,
                      totalTripsFound: 0,
                    });
                    break;

                  case "trips":
                    // New trips found - add them to results
                    store.addResults(data.trips);
                    break;

                  case "progress":
                    // Update progress
                    store.setSearchProgress({
                      completed: data.completed,
                      total: data.total,
                      uniqueTripsFound: data.uniqueTripsFound,
                      totalTripsFound: data.totalTripsFound,
                    });
                    break;

                  case "complete":
                    // Search completed
                    const currentState = useSearchStore.getState();
                    store.setResults(currentState.results, data.meta);
                    store.setSearchProgress(null);
                    break;
                }
              } catch (parseError) {
                console.error("Failed to parse SSE data:", parseError);
              }
            }
          }
        }
      } catch (err) {
        store.setError(err instanceof Error ? err.message : "Search failed");
        store.setResults([]);
      } finally {
        store.setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const search = useCallback(async () => {
    const { origin, destination, date, passengers } = useSearchStore.getState();

    if (!origin || !destination || !date) {
      store.setError("Please fill in all search fields");
      return;
    }

    // Update URL for deep-linking (using city names)
    const params = new URLSearchParams({
      from: origin.name,
      to: destination.name,
      date,
      pax: String(passengers),
    });
    router.push(`/?${params.toString()}`, { scroll: false });

    await performSearch(origin, destination, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, performSearch]);

  return {
    ...store,
    search,
  };
}
