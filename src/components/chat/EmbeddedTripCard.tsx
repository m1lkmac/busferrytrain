"use client";

import { motion } from "framer-motion";
import { Clock, ExternalLink, Bus, Ship, Train } from "lucide-react";
import type { TripOption, VehicleType } from "@/types";

interface EmbeddedTripCardProps {
  trip: TripOption;
}

const vehicleIcons: Record<VehicleType, { icon: typeof Bus; emoji: string }> = {
  bus: { icon: Bus, emoji: "🚌" },
  ferry: { icon: Ship, emoji: "⛴️" },
  train: { icon: Train, emoji: "🚂" },
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatPrice(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    THB: "฿",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toFixed(0)}`;
}

export function EmbeddedTripCard({ trip }: EmbeddedTripCardProps) {
  const { emoji } = vehicleIcons[trip.vehicleType];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-off-white rounded-xl p-3 border border-gray-light/50"
      data-trip-id={trip.id}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">
            {emoji}
          </span>
          <span className="font-medium text-dark text-sm">{trip.operator}</span>
        </div>
        <span className="font-bold text-teal">
          {formatPrice(trip.price.amount, trip.price.currency)}
        </span>
      </div>

      {/* Times */}
      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold text-dark">{trip.departureTime}</span>
        <div className="flex items-center gap-1 text-gray text-xs">
          <div className="w-4 h-px bg-gray-light" aria-hidden="true" />
          <Clock size={12} />
          <span>{formatDuration(trip.duration)}</span>
          <div className="w-4 h-px bg-gray-light" aria-hidden="true" />
        </div>
        <span className="font-bold text-dark">{trip.arrivalTime}</span>
      </div>

      {/* Route - station names */}
      <div className="text-xs text-dark-secondary mt-1">
        {trip.origin.name} → {trip.destination.name}
      </div>

      {/* Book button */}
      <motion.a
        href={trip.redirectUrl}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-2
                   bg-coral text-dark rounded-lg text-sm font-medium
                   hover:bg-coral-light transition-colors"
      >
        Book
        <ExternalLink size={14} />
      </motion.a>
    </motion.div>
  );
}
