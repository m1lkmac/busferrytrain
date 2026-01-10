"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  MapPin,
  ExternalLink,
  Bus,
  Ship,
  Train,
  Calendar,
} from "lucide-react";
import type { TripOption, VehicleType } from "@/types";

interface TripDetailModalProps {
  trip: TripOption | null;
  onClose: () => void;
}

const vehicleConfig: Record<
  VehicleType,
  { icon: typeof Bus; label: string; emoji: string }
> = {
  bus: { icon: Bus, label: "Bus", emoji: "🚌" },
  ferry: { icon: Ship, label: "Ferry", emoji: "⛴️" },
  train: { icon: Train, label: "Train", emoji: "🚂" },
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

function formatPrice(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    THB: "฿",
    USD: "$",
    EUR: "€",
  };
  return `${symbols[currency] || currency}${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function TripDetailModal({ trip, onClose }: TripDetailModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (trip) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [trip, onClose]);

  if (!trip) return null;

  const { emoji, label } = vehicleConfig[trip.vehicleType];

  return (
    <AnimatePresence>
      {trip && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-dark/50 z-50"
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.dialog
            ref={dialogRef}
            id="trip-detail-modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                       w-auto sm:w-full sm:max-w-lg max-h-[90vh] overflow-auto
                       bg-white rounded-2xl shadow-2xl z-50 p-0 m-0"
            aria-labelledby="trip-detail-title"
            aria-modal="true"
            open
          >
            {/* Header */}
            <header className="sticky top-0 bg-white border-b border-gray-light p-4 flex items-center justify-between">
              <h2
                id="trip-detail-title"
                className="text-lg font-semibold text-dark flex items-center gap-2"
              >
                <span>{emoji}</span>
                {trip.origin.city} → {trip.destination.city}
              </h2>
              <button
                onClick={onClose}
                id="trip-detail-close-button"
                className="p-2 text-gray hover:text-dark rounded-full hover:bg-off-white
                           transition-colors"
                aria-label="Close trip details"
              >
                <X size={20} />
              </button>
            </header>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Date */}
              <div
                id="trip-detail-date"
                className="flex items-center gap-2 text-dark-secondary"
              >
                <Calendar size={18} />
                <time dateTime={trip.departureDate}>
                  {formatDate(trip.departureDate)}
                </time>
              </div>

              {/* Timeline */}
              <div
                id="trip-detail-timeline"
                className="bg-off-white rounded-xl p-4"
                aria-label="Route timeline"
              >
                <div className="relative pl-8">
                  {/* Vertical line */}
                  <div
                    className="absolute left-3 top-2 bottom-2 w-0.5 bg-teal"
                    aria-hidden="true"
                  />

                  {/* Departure */}
                  <div className="relative mb-8">
                    <div
                      className="absolute left-[-20px] w-6 h-6 rounded-full bg-teal
                                  flex items-center justify-center"
                    >
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <time
                      className="text-xl font-bold text-dark"
                      dateTime={`${trip.departureDate}T${trip.departureTime}`}
                    >
                      {trip.departureTime}
                    </time>
                    <div className="text-dark-secondary font-medium mt-1">
                      {trip.origin.name}
                    </div>
                    <div className="text-sm text-gray">{trip.origin.city}</div>
                  </div>

                  {/* Duration */}
                  <div className="relative mb-8 text-sm text-gray flex items-center gap-2">
                    <Clock size={14} />
                    <span>{formatDuration(trip.duration)}</span>
                    <span>· {label}</span>
                  </div>

                  {/* Arrival */}
                  <div className="relative">
                    <div
                      className="absolute left-[-20px] w-6 h-6 rounded-full bg-coral
                                  flex items-center justify-center"
                    >
                      <MapPin size={14} className="text-dark" />
                    </div>
                    <time
                      className="text-xl font-bold text-dark"
                      dateTime={`${trip.arrivalDate}T${trip.arrivalTime}`}
                    >
                      {trip.arrivalTime}
                    </time>
                    <div className="text-dark-secondary font-medium mt-1">
                      {trip.destination.name}
                    </div>
                    <div className="text-sm text-gray">{trip.destination.city}</div>
                  </div>
                </div>
              </div>

              {/* Trip info */}
              <div className="flex items-center justify-between py-4 border-y border-gray-light">
                <div>
                  <div className="text-sm text-gray">Operator</div>
                  <div className="font-medium text-dark">{trip.operator}</div>
                </div>
              </div>

              {/* Price and booking */}
              <div
                id="trip-detail-booking-options"
                className="bg-teal-light/20 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-gray">Price from</div>
                    <div className="text-3xl font-bold text-teal">
                      {formatPrice(trip.price.amount, trip.price.currency)}
                    </div>
                  </div>
                </div>

                <motion.a
                  href={trip.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4
                             bg-coral text-dark rounded-xl font-semibold text-lg
                             hover:bg-coral-light transition-colors"
                  aria-label={`Book on ${trip.operator} for ${formatPrice(trip.price.amount, trip.price.currency)}`}
                >
                  Book on {trip.operator}
                  <ExternalLink size={18} />
                </motion.a>
              </div>
            </div>
          </motion.dialog>
        </>
      )}
    </AnimatePresence>
  );
}
