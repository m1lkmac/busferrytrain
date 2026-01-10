"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";
import { useStations } from "@/hooks/useStations";
import type { City } from "@/types";

interface CityAutocompleteProps {
  label: string;
  placeholder?: string;
  value: City | null;
  onChange: (city: City | null) => void;
  id: string;
  "data-field"?: string;
}

export function CityAutocomplete({
  label,
  placeholder = "Enter city",
  value,
  onChange,
  id,
  "data-field": dataField,
}: CityAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { query, setQuery, cityResults, isLoading } = useStations({ mode: "city" });

  // Sync input value with selected city
  useEffect(() => {
    if (value) {
      setInputValue(value.name);
    }
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setQuery(newValue);
      setIsOpen(true);
      setHighlightedIndex(-1);
      if (!newValue) {
        onChange(null);
      }
    },
    [onChange, setQuery]
  );

  const handleSelect = useCallback(
    (city: City) => {
      onChange(city);
      setInputValue(city.name);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || cityResults.length === 0) {
        if (e.key === "ArrowDown" && cityResults.length > 0) {
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < cityResults.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : cityResults.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < cityResults.length) {
            handleSelect(cityResults[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, cityResults, highlightedIndex, handleSelect]
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const showDropdown = isOpen && (cityResults.length > 0 || isLoading);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-w-[200px]"
      data-field={dataField}
    >
      <label
        htmlFor={id}
        className="block text-sm font-medium text-dark-secondary mb-1"
      >
        {label}
      </label>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className="h-5 w-5 text-gray" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          type="text"
          id={id}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined
          }
          aria-label={`${label} - ${placeholder}`}
          className="w-full pl-10 pr-10 py-3 border border-gray-light rounded-xl
                     bg-white text-dark placeholder:text-gray
                     focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent
                     transition-all duration-200"
        />

        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <Loader2 className="h-5 w-5 text-gray animate-spin" aria-hidden="true" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.ul
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={`${label} suggestions`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-1 bg-white border border-gray-light
                       rounded-xl shadow-lg max-h-60 overflow-auto"
          >
            {isLoading && cityResults.length === 0 ? (
              <li className="px-4 py-3 text-gray text-sm">Searching...</li>
            ) : cityResults.length === 0 ? (
              <li className="px-4 py-3 text-gray text-sm">No cities found</li>
            ) : (
              cityResults.map((city, index) => (
                <li
                  key={`${city.name}-${index}`}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  onClick={() => handleSelect(city)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-3 cursor-pointer transition-colors
                    ${
                      highlightedIndex === index
                        ? "bg-teal-light/30"
                        : "hover:bg-off-white"
                    }
                    ${index !== cityResults.length - 1 ? "border-b border-gray-light/50" : ""}
                  `}
                  data-city-name={city.name}
                >
                  <div className="flex items-start gap-3">
                    <MapPin
                      className="h-5 w-5 text-teal mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-dark">{city.name}</div>
                        <div className="text-xs text-teal bg-teal/10 px-2 py-0.5 rounded-full">
                          {city.stationCount} station{city.stationCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="text-sm text-gray">
                        {city.province}, {city.country}
                      </div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
