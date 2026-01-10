"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Search } from "lucide-react";
import { TripCard } from "./TripCard";
import { useSearch } from "@/hooks/useSearch";
import type { TripOption } from "@/types";

interface ResultsListProps {
  onSelectTrip?: (trip: TripOption) => void;
}

export function ResultsList({ onSelectTrip }: ResultsListProps) {
  const { filteredResults, isLoading, error, hasSearched, origin, destination, date, searchMeta, searchProgress } =
    useSearch();

  // Loading state - show skeleton only if no results yet
  if (isLoading && filteredResults.length === 0) {
    return (
      <section
        id="search-results-section"
        aria-label="Search results"
        data-loading="true"
        className="w-full max-w-5xl mx-auto mt-8"
      >
        {/* Progress bar */}
        {searchProgress && (
          <div className="mb-4 bg-white rounded-xl border border-gray-light/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dark-secondary">
                Searching stations...
              </span>
              <span className="text-sm text-teal font-medium">
                {searchProgress.completed} / {searchProgress.total} combinations
              </span>
            </div>
            <div className="w-full bg-gray-light rounded-full h-2">
              <motion.div
                className="bg-teal h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(searchProgress.completed / searchProgress.total) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
            {searchProgress.uniqueTripsFound > 0 && (
              <p className="text-sm text-gray mt-2">
                Found {searchProgress.uniqueTripsFound} trips so far...
              </p>
            )}
          </div>
        )}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-light/50 p-5 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-off-white rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-6 bg-off-white rounded w-1/3" />
                  <div className="h-4 bg-off-white rounded w-1/2" />
                </div>
                <div className="h-8 bg-off-white rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section
        id="search-results-section"
        aria-label="Search results"
        className="w-full max-w-5xl mx-auto mt-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-coral p-6 text-center"
          role="alert"
        >
          <AlertCircle className="mx-auto h-12 w-12 text-coral mb-4" />
          <h3 className="text-lg font-semibold text-dark mb-2">Search Failed</h3>
          <p className="text-gray">{error}</p>
        </motion.div>
      </section>
    );
  }

  // No search yet
  if (!hasSearched) {
    return null;
  }

  // No results
  if (filteredResults.length === 0) {
    return (
      <section
        id="search-results-section"
        aria-label="Search results"
        data-results-count="0"
        className="w-full max-w-5xl mx-auto mt-8"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-light/50 p-8 text-center"
        >
          <Search className="mx-auto h-12 w-12 text-gray mb-4" />
          <h3 className="text-lg font-semibold text-dark mb-2">
            No trips found
          </h3>
          <p className="text-gray">
            We couldn&apos;t find any trips for this route on the selected date.
            <br />
            Try a different date or route.
          </p>
        </motion.div>
      </section>
    );
  }

  return (
    <section
      id="search-results-section"
      aria-label="Search results"
      data-loading="false"
      data-results-count={filteredResults.length}
      className="w-full max-w-5xl mx-auto mt-8"
    >
      {/* Progress bar when loading more results */}
      {isLoading && searchProgress && (
        <div className="mb-4 bg-white rounded-xl border border-teal/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-dark-secondary">
              Finding more trips...
            </span>
            <span className="text-sm text-teal font-medium">
              {searchProgress.completed} / {searchProgress.total} station combinations
            </span>
          </div>
          <div className="w-full bg-gray-light rounded-full h-2">
            <motion.div
              className="bg-teal h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${(searchProgress.completed / searchProgress.total) * 100}%`,
              }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Results header */}
      <div className="flex items-center justify-between mb-4">
        <div id="results-summary">
          <h2 className="text-lg font-semibold text-dark">
            {origin?.name} → {destination?.name}
          </h2>
          <p className="text-sm text-gray">
            <span id="results-count">{filteredResults.length} trips found</span>
            {isLoading && <span className="text-teal ml-1">(still searching...)</span>}
            {!isLoading && searchMeta?.stationCombinations && searchMeta.stationCombinations > 1 && (
              <span className="text-teal ml-2">
                (searched {searchMeta.stationCombinations} station combinations)
              </span>
            )}
            {" · "}
            {new Date(date).toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Results list */}
      <ul
        id="search-results-list"
        role="list"
        aria-label="Available trips"
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {filteredResults.map((trip, index) => (
            <TripCard
              key={trip.id}
              trip={trip}
              onSelect={onSelectTrip}
              index={index}
            />
          ))}
        </AnimatePresence>
      </ul>

      {/* JSON-LD for search results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            numberOfItems: filteredResults.length,
            itemListElement: filteredResults.slice(0, 10).map((trip, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "Trip",
                name: `${trip.origin.city} to ${trip.destination.city} by ${trip.vehicleType}`,
                departureTime: `${trip.departureDate}T${trip.departureTime}`,
                arrivalTime: `${trip.arrivalDate}T${trip.arrivalTime}`,
                provider: {
                  "@type": "Organization",
                  name: trip.operator,
                },
                offers: {
                  "@type": "Offer",
                  price: trip.price.amount,
                  priceCurrency: trip.price.currency,
                  availability:
                    trip.availableSeats > 0
                      ? "https://schema.org/InStock"
                      : "https://schema.org/OutOfStock",
                },
              },
            })),
          }),
        }}
      />
    </section>
  );
}
