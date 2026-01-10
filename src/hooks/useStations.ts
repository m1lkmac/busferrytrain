"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Station, City } from "@/types";

interface UseStationsOptions {
  debounceMs?: number;
  limit?: number;
  mode?: "city" | "station";
}

export function useStations(options: UseStationsOptions = {}) {
  const { debounceMs = 300, limit = 10, mode = "city" } = options;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Station[]>([]);
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const searchStations = useCallback(
    async (searchQuery: string) => {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      if (!searchQuery || searchQuery.length < 2) {
        setResults([]);
        setCityResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      abortControllerRef.current = new AbortController();

      try {
        const params = new URLSearchParams({
          q: searchQuery,
          limit: String(limit),
          mode,
        });

        const response = await fetch(`/api/stations?${params}`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to fetch stations");
        }

        const data = await response.json();
        if (mode === "city") {
          setCityResults(data.results || []);
          setResults([]);
        } else {
          setResults(data.results || []);
          setCityResults([]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return; // Ignore abort errors
        }
        setError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setCityResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [limit, mode]
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchStations(query);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs, searchStations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setCityResults([]);
    setQuery("");
  }, []);

  return {
    query,
    setQuery,
    results,
    cityResults,
    isLoading,
    error,
    clearResults,
  };
}

// Hook to get a single station by ID
export function useStation(id: string | null) {
  const [station, setStation] = useState<Station | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setStation(null);
      return;
    }

    const fetchStation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/stations?id=${id}`);
        if (!response.ok) {
          throw new Error("Station not found");
        }
        const data = await response.json();
        setStation(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load station");
        setStation(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStation();
  }, [id]);

  return { station, isLoading, error };
}
