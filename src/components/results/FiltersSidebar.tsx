"use client";

import { motion } from "framer-motion";
import { Filter, X, Bus, Ship, Train } from "lucide-react";
import { useSearch } from "@/hooks/useSearch";
import type { VehicleType } from "@/types";

const vehicleOptions: { type: VehicleType; label: string; icon: typeof Bus }[] = [
  { type: "bus", label: "Bus", icon: Bus },
  { type: "ferry", label: "Ferry", icon: Ship },
  { type: "train", label: "Train", icon: Train },
];

const timeSlots = [
  { label: "Morning", range: [6, 12] as [number, number], desc: "6am - 12pm" },
  { label: "Afternoon", range: [12, 18] as [number, number], desc: "12pm - 6pm" },
  { label: "Evening", range: [18, 24] as [number, number], desc: "6pm - 12am" },
];

export function FiltersSidebar() {
  const { filters, setFilters, resetFilters, results, filteredResults } = useSearch();

  // Get unique operators from results
  const operators = [...new Set(results.map((r) => r.operator))];

  // Get max price from results
  const maxPrice = Math.max(...results.map((r) => r.price.amount), 500);

  const handleVehicleToggle = (type: VehicleType) => {
    const current = filters.vehicleTypes;
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setFilters({ vehicleTypes: updated });
  };

  const handleTimeToggle = (range: [number, number]) => {
    const [start, end] = range;
    const current = filters.departureTimeRange;

    // If clicking the same range, expand to full day
    if (current[0] === start && current[1] === end) {
      setFilters({ departureTimeRange: [0, 24] });
    } else {
      setFilters({ departureTimeRange: range });
    }
  };

  const handleOperatorToggle = (operator: string) => {
    const current = filters.operators;
    const updated = current.includes(operator)
      ? current.filter((o) => o !== operator)
      : [...current, operator];
    setFilters({ operators: updated });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sortBy, sortOrder] = e.target.value.split("-") as [
      "price" | "duration" | "departure",
      "asc" | "desc"
    ];
    setFilters({ sortBy, sortOrder });
  };

  // Don't show if no results
  if (results.length === 0) {
    return null;
  }

  return (
    <aside
      id="filters-sidebar"
      aria-label="Filter search results"
      className="w-full lg:w-64 bg-white rounded-xl border border-gray-light/50 p-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 id="filters-heading" className="flex items-center gap-2 font-semibold text-dark">
          <Filter size={18} aria-hidden="true" />
          Filters
        </h3>
        <button
          onClick={resetFilters}
          className="text-sm text-teal hover:text-teal-dark transition-colors"
          aria-label="Clear all filters"
        >
          Clear all
        </button>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray mb-4">
        Showing {filteredResults.length} of {results.length} trips
      </p>

      {/* Sort */}
      <div className="mb-6">
        <label
          htmlFor="results-sort-select"
          className="block text-sm font-medium text-dark-secondary mb-2"
        >
          Sort by
        </label>
        <select
          id="results-sort-select"
          value={`${filters.sortBy}-${filters.sortOrder}`}
          onChange={handleSortChange}
          className="w-full px-3 py-2 border border-gray-light rounded-lg bg-white text-dark
                     focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
          aria-label="Sort results"
        >
          <option value="departure-asc">Departure (earliest)</option>
          <option value="departure-desc">Departure (latest)</option>
          <option value="price-asc">Price (low to high)</option>
          <option value="price-desc">Price (high to low)</option>
          <option value="duration-asc">Duration (shortest)</option>
          <option value="duration-desc">Duration (longest)</option>
        </select>
      </div>

      {/* Transport type */}
      <fieldset id="filter-transport-type" className="mb-6">
        <legend className="text-sm font-medium text-dark-secondary mb-2">
          Transport Type
        </legend>
        <div className="space-y-2">
          {vehicleOptions.map(({ type, label, icon: Icon }) => (
            <label
              key={type}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={filters.vehicleTypes.includes(type)}
                onChange={() => handleVehicleToggle(type)}
                className="w-4 h-4 text-teal border-gray-light rounded
                           focus:ring-teal focus:ring-offset-0"
              />
              <Icon
                size={16}
                className="text-gray group-hover:text-dark-secondary transition-colors"
                aria-hidden="true"
              />
              <span className="text-sm text-dark-secondary group-hover:text-dark transition-colors">
                {label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Price range */}
      <fieldset id="filter-price-range" className="mb-6">
        <legend className="text-sm font-medium text-dark-secondary mb-2">
          Max Price
        </legend>
        <input
          type="range"
          id="filter-price-slider"
          min="0"
          max={maxPrice}
          value={filters.priceRange[1]}
          onChange={(e) =>
            setFilters({ priceRange: [0, parseInt(e.target.value)] })
          }
          className="w-full h-2 bg-off-white rounded-lg appearance-none cursor-pointer
                     accent-teal"
          aria-label="Maximum price"
        />
        <output
          htmlFor="filter-price-slider"
          className="block text-sm text-gray mt-1"
        >
          Up to ฿{filters.priceRange[1].toLocaleString()}
        </output>
      </fieldset>

      {/* Departure time */}
      <fieldset id="filter-departure-time" className="mb-6">
        <legend className="text-sm font-medium text-dark-secondary mb-2">
          Departure Time
        </legend>
        <div className="space-y-2">
          {timeSlots.map(({ label, range, desc }) => {
            const isSelected =
              filters.departureTimeRange[0] === range[0] &&
              filters.departureTimeRange[1] === range[1];
            return (
              <motion.button
                key={label}
                onClick={() => handleTimeToggle(range)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full px-3 py-2 text-left text-sm rounded-lg border transition-colors
                  ${
                    isSelected
                      ? "border-teal bg-teal-light/20 text-dark"
                      : "border-gray-light text-dark-secondary hover:border-teal-light"
                  }`}
              >
                <span className="font-medium">{label}</span>
                <span className="text-gray ml-2">({desc})</span>
              </motion.button>
            );
          })}
        </div>
      </fieldset>

      {/* Operators (if multiple) */}
      {operators.length > 1 && (
        <fieldset id="filter-operators">
          <legend className="text-sm font-medium text-dark-secondary mb-2">
            Operators
          </legend>
          <div className="space-y-2">
            {operators.map((operator) => (
              <label
                key={operator}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={
                    filters.operators.length === 0 ||
                    filters.operators.includes(operator)
                  }
                  onChange={() => handleOperatorToggle(operator)}
                  className="w-4 h-4 text-teal border-gray-light rounded
                             focus:ring-teal focus:ring-offset-0"
                />
                <span className="text-sm text-dark-secondary">{operator}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </aside>
  );
}
