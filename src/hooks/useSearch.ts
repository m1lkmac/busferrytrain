"use client";

import { useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { create } from "zustand";
import type { Place, TripOption, FilterState } from "@/types";

interface SearchStore {
  // Search inputs (place-based)
  origin: Place | null;
  destination: Place | null;
  date: string;
  passengers: number;

  // Results
  results: TripOption[];
  filteredResults: TripOption[];

  // UI state
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;

  // Search metadata
  searchMeta: {
    totalTrips?: number;
    originPoi?: string;
    destinationPoi?: string;
  } | null;

  // Filters
  filters: FilterState;

  // Actions
  setOrigin: (place: Place | null) => void;
  setDestination: (place: Place | null) => void;
  setDate: (date: string) => void;
  setPassengers: (count: number) => void;
  setResults: (results: TripOption[], meta?: SearchStore["searchMeta"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasSearched: (hasSearched: boolean) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  swapPlaces: () => void;
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

  swapPlaces: () => {
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
    const date = searchParams.get("date");
    const pax = searchParams.get("pax");

    if (date) {
      store.setDate(date);
    }

    if (pax) {
      store.setPassengers(parseInt(pax) || 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const performSearch = useCallback(
    async (origin: Place, destination: Place, date: string, passengers: number) => {
      store.setLoading(true);
      store.setError(null);
      store.setHasSearched(true);
      store.setResults([]);

      try {
        const params = new URLSearchParams({
          origin: origin.name,
          destination: destination.name,
          date,
          pax: String(passengers),
        });

        const response = await fetch(`/api/search?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Search failed");
        }

        store.setResults(data.trips || [], {
          totalTrips: data.meta?.totalTrips,
          originPoi: data.origin?.poi,
          destinationPoi: data.destination?.poi,
        });
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

    // Update URL for deep-linking
    const params = new URLSearchParams({
      from: origin.name,
      to: destination.name,
      date,
      pax: String(passengers),
    });
    router.push(`/?${params.toString()}`, { scroll: false });

    await performSearch(origin, destination, date, passengers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, performSearch]);

  return {
    ...store,
    search,
  };
}
