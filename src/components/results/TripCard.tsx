"use client";

import { motion } from "framer-motion";
import { Clock, ExternalLink, Bus, Ship, Train } from "lucide-react";
import type { TripOption, VehicleType } from "@/types";

interface TripCardProps {
  trip: TripOption;
  onSelect?: (trip: TripOption) => void;
  index?: number;
}

// Vehicle type icons and labels
const vehicleConfig: Record<
  VehicleType,
  { icon: typeof Bus; label: string; emoji: string }
> = {
  bus: { icon: Bus, label: "Bus", emoji: "🚌" },
  ferry: { icon: Ship, label: "Ferry", emoji: "⛴️" },
  train: { icon: Train, label: "Train", emoji: "🚂" },
};

// Format duration in minutes to human readable
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// Format price with currency
function formatPrice(amount: number, currency: string): string {
  // Currency symbols
  const symbols: Record<string, string> = {
    THB: "฿",
    USD: "$",
    EUR: "€",
    ARS: "$",
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toFixed(0)}`;
}

export function TripCard({ trip, onSelect, index = 0 }: TripCardProps) {
  const VehicleIcon = vehicleConfig[trip.vehicleType].icon;
  const vehicleEmoji = vehicleConfig[trip.vehicleType].emoji;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ scale: 1.01, boxShadow: "0 8px 30px rgba(0,0,0,0.1)" }}
      onClick={() => onSelect?.(trip)}
      className="bg-white rounded-xl border border-gray-light/50 p-4 sm:p-5 cursor-pointer
                 transition-all duration-200 hover:border-teal-light"
      // AI-optimized data attributes
      data-testid="trip-card"
      data-trip-id={trip.id}
      data-price={trip.price.amount}
      data-currency={trip.price.currency}
      data-duration={trip.duration}
      data-operator={trip.operator}
      data-transport-type={trip.vehicleType}
      data-departure-time={trip.departureTime}
      data-arrival-time={trip.arrivalTime}
      // Schema.org structured data
      itemScope
      itemType="https://schema.org/Trip"
      role="listitem"
      aria-label={`${trip.operator} ${trip.vehicleType} from ${trip.origin.city} to ${trip.destination.city},
                   ${formatDuration(trip.duration)}, ${formatPrice(trip.price.amount, trip.price.currency)}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Vehicle type badge */}
        <div
          className="flex items-center justify-center w-12 h-12 rounded-xl bg-off-white
                      text-dark-secondary flex-shrink-0"
          aria-label={vehicleConfig[trip.vehicleType].label}
        >
          <span className="text-2xl" aria-hidden="true">
            {vehicleEmoji}
          </span>
        </div>

        {/* Times and route */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            {/* Departure time */}
            <time
              className="text-2xl font-bold text-dark"
              dateTime={`${trip.departureDate}T${trip.departureTime}`}
              itemProp="departureTime"
            >
              {trip.departureTime}
            </time>

            {/* Duration indicator */}
            <div className="flex items-center gap-1 text-gray text-sm">
              <div className="w-8 h-px bg-gray-light" aria-hidden="true" />
              <Clock size={14} aria-hidden="true" />
              <span>{formatDuration(trip.duration)}</span>
              <div className="w-8 h-px bg-gray-light" aria-hidden="true" />
            </div>

            {/* Arrival time */}
            <time
              className="text-2xl font-bold text-dark"
              dateTime={`${trip.arrivalDate}T${trip.arrivalTime}`}
              itemProp="arrivalTime"
            >
              {trip.arrivalTime}
            </time>
          </div>

          {/* Route */}
          <div className="mt-1 text-sm text-dark-secondary">
            <span itemProp="departureStation">{trip.origin.name}</span>
            <span className="mx-2 text-gray" aria-hidden="true">
              →
            </span>
            <span itemProp="arrivalStation">{trip.destination.name}</span>
          </div>

          {/* Operator and availability */}
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span
              className="text-dark-secondary font-medium"
              itemProp="provider"
            >
              {trip.operator}
            </span>
          </div>
        </div>

        {/* Price and action */}
        <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2">
          <div
            className="text-right"
            itemProp="offers"
            itemScope
            itemType="https://schema.org/Offer"
          >
            <span
              className="text-2xl font-bold text-teal"
              itemProp="price"
              content={String(trip.price.amount)}
            >
              {formatPrice(trip.price.amount, trip.price.currency)}
            </span>
            <meta itemProp="priceCurrency" content={trip.price.currency} />
          </div>

          <motion.a
            href={trip.redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-1 px-4 py-2 bg-coral text-dark
                       rounded-lg font-medium text-sm hover:bg-coral-light
                       transition-colors"
            aria-label={`Book on ${trip.operator} for ${formatPrice(trip.price.amount, trip.price.currency)}`}
          >
            Book
            <ExternalLink size={14} aria-hidden="true" />
          </motion.a>
        </div>
      </div>
    </motion.article>
  );
}
