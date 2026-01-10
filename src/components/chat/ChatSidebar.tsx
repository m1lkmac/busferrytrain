"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageSquare, Trash2, MoreVertical } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Conversation } from "@/types";

interface ChatSidebarProps {
  conversations: Conversation[];
  groupedConversations: Record<string, Conversation[]>;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  currentConversationId?: string;
}

export function ChatSidebar({
  conversations,
  groupedConversations,
  onNewChat,
  onDeleteChat,
  currentConversationId,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const dateGroups = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Older"];

  return (
    <aside
      className="w-64 bg-white border-r border-gray-light flex flex-col h-full"
      aria-label="Conversations"
    >
      {/* New chat button */}
      <div className="p-4 border-b border-gray-light">
        <motion.button
          onClick={onNewChat}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3
                     bg-teal text-white rounded-xl font-medium
                     hover:bg-teal-dark transition-colors"
        >
          <Plus size={18} />
          New Chat
        </motion.button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-gray text-sm">
            No conversations yet.
            <br />
            Start a new chat!
          </div>
        ) : (
          <nav className="py-2">
            {dateGroups.map((group) => {
              const groupConversations = groupedConversations[group];
              if (!groupConversations || groupConversations.length === 0) {
                return null;
              }

              return (
                <div key={group} className="mb-4">
                  <h3 className="px-4 py-2 text-xs font-semibold text-gray uppercase tracking-wider">
                    {group}
                  </h3>
                  <ul>
                    {groupConversations.map((conv) => {
                      const isActive = currentConversationId === conv.id;
                      const isMenuOpen = menuOpen === conv.id;

                      return (
                        <li key={conv.id} className="relative">
                          <Link
                            href={`/chat/${conv.id}`}
                            className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg
                                       transition-colors group
                              ${
                                isActive
                                  ? "bg-teal-light/30 text-dark"
                                  : "hover:bg-off-white text-dark-secondary"
                              }`}
                          >
                            <MessageSquare
                              size={16}
                              className={isActive ? "text-teal" : "text-gray"}
                            />
                            <span className="flex-1 truncate text-sm">
                              {conv.title}
                            </span>

                            {/* Menu button */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMenuOpen(isMenuOpen ? null : conv.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded
                                         hover:bg-gray-light transition-opacity"
                              aria-label="Conversation options"
                            >
                              <MoreVertical size={14} />
                            </button>
                          </Link>

                          {/* Dropdown menu */}
                          <AnimatePresence>
                            {isMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute right-4 top-full mt-1 z-10
                                           bg-white rounded-lg shadow-lg border border-gray-light
                                           overflow-hidden"
                              >
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteChat(conv.id);
                                    setMenuOpen(null);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 w-full
                                             text-left text-sm text-coral hover:bg-off-white
                                             transition-colors"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {/* Back to search */}
      <div className="p-4 border-t border-gray-light">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 px-4 py-2
                     text-dark-secondary hover:text-dark text-sm
                     transition-colors"
        >
          ← Back to Search
        </Link>
      </div>
    </aside>
  );
}
