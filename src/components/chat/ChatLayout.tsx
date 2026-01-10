"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { ChatSidebar } from "./ChatSidebar";
import type { Conversation } from "@/types";

interface ChatLayoutProps {
  children: React.ReactNode;
  conversations: Conversation[];
  groupedConversations: Record<string, Conversation[]>;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  currentConversationId?: string;
}

export function ChatLayout({
  children,
  conversations,
  groupedConversations,
  onNewChat,
  onDeleteChat,
  currentConversationId,
}: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-off-white">
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-light">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-dark-secondary hover:text-dark transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={24} />
        </button>

        <Link href="/" className="font-bold text-dark">
          <span className="text-lg">🚌</span> busferrytrain
          <span className="text-teal">.com</span>
        </Link>

        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex">
          <ChatSidebar
            conversations={conversations}
            groupedConversations={groupedConversations}
            onNewChat={onNewChat}
            onDeleteChat={onDeleteChat}
            currentConversationId={currentConversationId}
          />
        </div>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden fixed inset-0 bg-dark/50 z-40"
              />

              {/* Sidebar */}
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="lg:hidden fixed inset-y-0 left-0 z-50 w-64"
              >
                <div className="relative h-full">
                  <ChatSidebar
                    conversations={conversations}
                    groupedConversations={groupedConversations}
                    onNewChat={() => {
                      onNewChat();
                      setSidebarOpen(false);
                    }}
                    onDeleteChat={(id) => {
                      onDeleteChat(id);
                    }}
                    currentConversationId={currentConversationId}
                  />

                  {/* Close button */}
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="absolute top-4 right-4 p-2 text-gray hover:text-dark
                               transition-colors"
                    aria-label="Close sidebar"
                  >
                    <X size={20} />
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
