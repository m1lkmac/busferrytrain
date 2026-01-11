"use client";

import { motion } from "framer-motion";
import { ExternalLink, BookOpen } from "lucide-react";
import type { Article } from "@/types";

interface EmbeddedArticleCardProps {
  article: Article;
}

export function EmbeddedArticleCard({ article }: EmbeddedArticleCardProps) {
  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="block bg-off-white rounded-xl overflow-hidden border border-gray-light/50
                 hover:border-teal-light transition-all"
    >
      {/* Image */}
      {article.imageUrl ? (
        <div className="relative h-32 w-full overflow-hidden bg-gray-light">
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error, show fallback
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className="h-24 w-full bg-gradient-to-br from-teal/20 to-coral/20
                        flex items-center justify-center">
          <BookOpen size={32} className="text-teal/50" />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {/* Destination tag */}
        {article.destination && (
          <span className="inline-block px-2 py-0.5 bg-teal/10 text-teal text-xs
                         font-medium rounded-full mb-2">
            {article.destination}
          </span>
        )}

        {/* Title */}
        <h4 className="font-semibold text-dark text-sm leading-tight line-clamp-2">
          {article.title}
        </h4>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="mt-1 text-xs text-gray line-clamp-2">
            {article.excerpt}
          </p>
        )}

        {/* Read more link */}
        <div className="mt-2 flex items-center gap-1 text-teal text-xs font-medium">
          Read article
          <ExternalLink size={12} />
        </div>
      </div>
    </motion.a>
  );
}
