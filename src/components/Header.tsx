"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

export function Header() {
  return (
    <header
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-light"
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center text-dark font-bold text-xl"
            aria-label="busferrytrain.com - Home"
          >
            <span className="hidden sm:inline">busferrytrain</span>
            <span className="text-teal">.com</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4" role="navigation">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/chat"
                className="flex items-center gap-2 px-4 py-2 bg-teal text-white rounded-full font-medium hover:bg-teal-dark transition-colors"
                aria-label="Open AI travel assistant"
              >
                <MessageCircle size={18} aria-hidden="true" />
                <span className="hidden sm:inline">Chat</span>
              </Link>
            </motion.div>
          </nav>
        </div>
      </div>
    </header>
  );
}
