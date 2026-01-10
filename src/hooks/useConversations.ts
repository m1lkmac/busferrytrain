"use client";

import { useState, useEffect, useCallback } from "react";
import type { Conversation } from "@/types";
import {
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  groupConversationsByDate,
} from "@/lib/chat-storage";

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load conversations on mount
  useEffect(() => {
    setConversations(getConversations());
    setIsLoading(false);
  }, []);

  // Refresh conversations
  const refresh = useCallback(() => {
    setConversations(getConversations());
  }, []);

  // Create new conversation
  const create = useCallback(() => {
    const newConv = createConversation();
    setConversations((prev) => [newConv, ...prev]);
    return newConv;
  }, []);

  // Delete conversation
  const remove = useCallback((id: string) => {
    const success = deleteConversation(id);
    if (success) {
      setConversations((prev) => prev.filter((c) => c.id !== id));
    }
    return success;
  }, []);

  // Get conversation by ID
  const get = useCallback((id: string) => {
    return getConversation(id);
  }, []);

  // Group conversations by date
  const grouped = groupConversationsByDate(conversations);

  return {
    conversations,
    grouped,
    isLoading,
    refresh,
    create,
    remove,
    get,
  };
}
