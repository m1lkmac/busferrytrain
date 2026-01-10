"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Loader2 } from "lucide-react";
import type { Place } from "@/types";

interface PlaceAutocompleteProps {
  label: string;
  placeholder?: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  id: string;
  "data-field"?: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
  properties?: {
    short_code?: string;
  };
}

interface MapboxResponse {
  features: MapboxFeature[];
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function PlaceAutocomplete({
  label,
  placeholder = "Enter city",
  value,
  onChange,
  id,
  "data-field": dataField,
}: PlaceAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(inputValue, 300);

  // Sync input value with selected place
  useEffect(() => {
    if (value) {
      setInputValue(value.name);
    }
  }, [value]);

  // Fetch suggestions from Mapbox
  useEffect(() => {
    async function fetchSuggestions() {
      if (debouncedQuery.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/places?q=${encodeURIComponent(debouncedQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.places || []);
        }
      } catch (error) {
        console.error("Failed to fetch places:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSuggestions();
  }, [debouncedQuery]);

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
      setIsOpen(true);
      setHighlightedIndex(-1);
      if (!newValue) {
        onChange(null);
      }
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (place: Place) => {
      onChange(place);
      setInputValue(place.name);
      setIsOpen(false);
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) {
        if (e.key === "ArrowDown" && suggestions.length > 0) {
          setIsOpen(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
            handleSelect(suggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, highlightedIndex, handleSelect]
  );

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const showDropdown = isOpen && (suggestions.length > 0 || isLoading);

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
          onFocus={() => inputValue.length >= 2 && setIsOpen(true)}
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
            {isLoading && suggestions.length === 0 ? (
              <li className="px-4 py-3 text-gray text-sm">Searching...</li>
            ) : suggestions.length === 0 ? (
              <li className="px-4 py-3 text-gray text-sm">No places found</li>
            ) : (
              suggestions.map((place, index) => (
                <li
                  key={place.id}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={highlightedIndex === index}
                  onClick={() => handleSelect(place)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-3 cursor-pointer transition-colors
                    ${
                      highlightedIndex === index
                        ? "bg-teal-light/30"
                        : "hover:bg-off-white"
                    }
                    ${index !== suggestions.length - 1 ? "border-b border-gray-light/50" : ""}
                  `}
                  data-place-name={place.name}
                >
                  <div className="flex items-start gap-3">
                    <MapPin
                      className="h-5 w-5 text-teal mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-dark">{place.name}</div>
                      <div className="text-sm text-gray">
                        {place.region ? `${place.region}, ` : ""}{place.country}
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
