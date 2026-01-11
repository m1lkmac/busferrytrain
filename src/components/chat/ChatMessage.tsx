"use client";

import { motion } from "framer-motion";
import { User, Bot } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";
import { EmbeddedTripCard } from "./EmbeddedTripCard";
import { EmbeddedArticleCard } from "./EmbeddedArticleCard";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
      data-role={message.role}
      data-timestamp={message.timestamp}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${isUser ? "bg-coral" : "bg-teal"}`}
      >
        {isUser ? (
          <User size={16} className="text-dark" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block px-4 py-3 rounded-2xl
            ${
              isUser
                ? "bg-coral text-dark rounded-br-md"
                : "bg-white border border-gray-light text-dark rounded-bl-md"
            }`}
        >
          {/* Text content with markdown-like formatting */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {formatMessage(message.content)}
          </div>
        </div>

        {/* Embedded trips */}
        {message.embeddedTrips && message.embeddedTrips.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.embeddedTrips.map((trip) => (
              <EmbeddedTripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}

        {/* Embedded articles */}
        {message.embeddedArticles && message.embeddedArticles.length > 0 && (
          <div className="mt-3 grid gap-2 grid-cols-1 sm:grid-cols-2">
            {message.embeddedArticles.map((article) => (
              <EmbeddedArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Simple markdown-like formatting
function formatMessage(content: string): React.ReactNode {
  if (!content) return null;

  // Split by newlines and process each line
  const lines = content.split("\n");

  return lines.map((line, index) => {
    // Bold text: **text**
    let formatted: React.ReactNode = line;

    if (line.includes("**")) {
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      formatted = parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold">
            {part}
          </strong>
        ) : (
          part
        )
      );
    }

    return (
      <span key={index}>
        {formatted}
        {index < lines.length - 1 && <br />}
      </span>
    );
  });
}
