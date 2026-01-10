"use client";

import { motion } from "framer-motion";
import { ArrowRightLeft, Search, Calendar, Users, Loader2 } from "lucide-react";
import { CityAutocomplete } from "./CityAutocomplete";
import { useSearch } from "@/hooks/useSearch";

export function SearchBar() {
  const {
    origin,
    destination,
    date,
    passengers,
    isLoading,
    setOrigin,
    setDestination,
    setDate,
    setPassengers,
    swapCities,
    search,
  } = useSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];

  return (
    <motion.section
      id="search-section"
      aria-label="Trip search form"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-5xl mx-auto"
    >
      <form
        id="search-form"
        role="search"
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-lg p-6 border border-gray-light/50"
      >
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Origin */}
          <CityAutocomplete
            id="search-origin-input"
            label="From"
            placeholder="Departure city"
            value={origin}
            onChange={setOrigin}
            data-field="origin"
          />

          {/* Swap button */}
          <div className="flex items-end justify-center lg:pb-3">
            <motion.button
              type="button"
              onClick={swapCities}
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="p-2 rounded-full bg-off-white hover:bg-teal-light text-dark-secondary
                         hover:text-dark transition-colors"
              aria-label="Swap origin and destination"
            >
              <ArrowRightLeft size={20} aria-hidden="true" />
            </motion.button>
          </div>

          {/* Destination */}
          <CityAutocomplete
            id="search-destination-input"
            label="To"
            placeholder="Arrival city"
            value={destination}
            onChange={setDestination}
            data-field="destination"
          />

          {/* Date */}
          <div className="flex-1 min-w-[150px]" data-field="date">
            <label
              htmlFor="search-date-input"
              className="block text-sm font-medium text-dark-secondary mb-1"
            >
              Date
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="h-5 w-5 text-gray" aria-hidden="true" />
              </div>
              <input
                type="date"
                id="search-date-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={today}
                aria-label="Departure date"
                className="w-full pl-10 pr-4 py-3 border border-gray-light rounded-xl
                           bg-white text-dark
                           focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent
                           transition-all duration-200"
              />
            </div>
          </div>

          {/* Passengers */}
          <div className="w-[100px]" data-field="passengers">
            <label
              htmlFor="search-passengers-input"
              className="block text-sm font-medium text-dark-secondary mb-1"
            >
              Passengers
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Users className="h-5 w-5 text-gray" aria-hidden="true" />
              </div>
              <select
                id="search-passengers-input"
                value={passengers}
                onChange={(e) => setPassengers(parseInt(e.target.value))}
                aria-label="Number of passengers"
                className="w-full pl-10 pr-4 py-3 border border-gray-light rounded-xl
                           bg-white text-dark appearance-none
                           focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent
                           transition-all duration-200"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search button */}
          <div className="flex items-end">
            <motion.button
              type="submit"
              id="search-submit-button"
              disabled={isLoading || !origin || !destination || !date}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label="Search for trips"
              className="w-full lg:w-auto px-8 py-3 bg-teal text-white font-semibold rounded-xl
                         hover:bg-teal-dark disabled:bg-gray disabled:cursor-not-allowed
                         transition-colors duration-200 flex items-center justify-center gap-2
                         shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" aria-hidden="true" />
                  <span>Search</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </form>
    </motion.section>
  );
}
