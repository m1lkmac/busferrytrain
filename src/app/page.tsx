"use client";

import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { SearchBar } from "@/components/search/SearchBar";
import { ResultsList } from "@/components/results/ResultsList";
import { FiltersSidebar } from "@/components/results/FiltersSidebar";
import { TripDetailModal } from "@/components/trip/TripDetailModal";
import { useSearch } from "@/hooks/useSearch";
import type { TripOption } from "@/types";

function HeroSection() {
  return (
    <div className="text-center mb-8">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-3xl sm:text-4xl lg:text-5xl font-bold text-dark mb-4"
      >
        Find your journey by{" "}
        <span className="text-teal">bus</span>,{" "}
        <span className="text-coral">ferry</span>, or{" "}
        <span className="text-teal-dark">train</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-lg text-dark-secondary max-w-2xl mx-auto"
      >
        Search and compare ground transportation across Southeast Asia.
        Find the best prices and schedules for your trip.
      </motion.p>
    </div>
  );
}

function SearchResults({
  onSelectTrip,
}: {
  onSelectTrip: (trip: TripOption) => void;
}) {
  const { hasSearched, results } = useSearch();

  if (!hasSearched) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col lg:flex-row gap-6 mt-8"
    >
      {/* Filters sidebar - only show on desktop when there are results */}
      {results.length > 0 && (
        <div className="hidden lg:block">
          <FiltersSidebar />
        </div>
      )}

      {/* Results */}
      <div className="flex-1">
        <ResultsList onSelectTrip={onSelectTrip} />
      </div>
    </motion.div>
  );
}

function HomeContent() {
  const [selectedTrip, setSelectedTrip] = useState<TripOption | null>(null);

  return (
    <main className="min-h-screen bg-off-white">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <HeroSection />
        <SearchBar />
        <SearchResults onSelectTrip={setSelectedTrip} />
      </div>

      {/* Trip detail modal */}
      <TripDetailModal
        trip={selectedTrip}
        onClose={() => setSelectedTrip(null)}
      />
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-off-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
