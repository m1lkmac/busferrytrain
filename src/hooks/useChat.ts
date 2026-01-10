"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Conversation, ChatMessage, TripOption } from "@/types";
import {
  getConversation,
  createConversation,
  addMessage,
  updateLastAssistantMessage,
  updateConversation,
} from "@/lib/chat-storage";

interface UseChatOptions {
  conversationId?: string;
  onConversationCreated?: (conversation: Conversation) => void;
}

export function useChat(options: UseChatOptions = {}) {
  const { conversationId, onConversationCreated } = options;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation on mount or when ID changes
  useEffect(() => {
    if (conversationId) {
      const conv = getConversation(conversationId);
      setConversation(conv);
    } else {
      setConversation(null);
    }
  }, [conversationId]);

  // Ensure we have a conversation (create if needed)
  const ensureConversation = useCallback((): Conversation => {
    if (conversation) return conversation;

    const newConv = createConversation();
    setConversation(newConv);
    onConversationCreated?.(newConv);
    return newConv;
  }, [conversation, onConversationCreated]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setError(null);

      // Ensure we have a conversation
      const conv = ensureConversation();

      // Add user message
      const userMessage = addMessage(conv.id, {
        role: "user",
        content: content.trim(),
      });

      // Update local state
      setConversation((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, userMessage] }
          : null
      );

      // Create placeholder for assistant message
      const assistantPlaceholder: ChatMessage = {
        id: `temp_${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };

      setConversation((prev) =>
        prev
          ? { ...prev, messages: [...prev.messages, assistantPlaceholder] }
          : null
      );

      setIsLoading(true);
      setIsStreaming(true);

      try {
        abortControllerRef.current = new AbortController();

        // Get full message history for context
        const currentConv = getConversation(conv.id);
        const messageHistory = currentConv?.messages
          .filter((m) => m.id !== assistantPlaceholder.id)
          .map((m) => ({
            role: m.role,
            content: m.content,
          })) || [];

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            conversationHistory: messageHistory,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        let fullContent = "";
        let embeddedTrips: TripOption[] = [];

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === "text") {
                  fullContent += parsed.content;
                  // Update UI in real-time
                  setConversation((prev) => {
                    if (!prev) return null;
                    const messages = [...prev.messages];
                    const lastIdx = messages.length - 1;
                    if (messages[lastIdx]?.role === "assistant") {
                      messages[lastIdx] = {
                        ...messages[lastIdx],
                        content: fullContent,
                      };
                    }
                    return { ...prev, messages };
                  });
                } else if (parsed.type === "trips") {
                  embeddedTrips = parsed.trips;
                  // Update with embedded trips
                  setConversation((prev) => {
                    if (!prev) return null;
                    const messages = [...prev.messages];
                    const lastIdx = messages.length - 1;
                    if (messages[lastIdx]?.role === "assistant") {
                      messages[lastIdx] = {
                        ...messages[lastIdx],
                        embeddedTrips,
                      };
                    }
                    return { ...prev, messages };
                  });
                } else if (parsed.type === "error") {
                  throw new Error(parsed.message);
                }
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
              }
            }
          }
        }

        // Save final assistant message to storage
        const finalAssistantMessage = addMessage(conv.id, {
          role: "assistant",
          content: fullContent,
          embeddedTrips: embeddedTrips.length > 0 ? embeddedTrips : undefined,
        });

        // Remove the temporary placeholder and add the real message
        setConversation((prev) => {
          if (!prev) return null;
          const messages = prev.messages.filter(
            (m) => m.id !== assistantPlaceholder.id
          );
          return {
            ...prev,
            messages: [...messages, finalAssistantMessage],
          };
        });
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User cancelled
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Failed to send message";
        setError(errorMessage);

        // Remove the placeholder on error
        setConversation((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            messages: prev.messages.filter(
              (m) => m.id !== assistantPlaceholder.id
            ),
          };
        });
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [ensureConversation]
  );

  // Stop generation
  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    conversation,
    messages: conversation?.messages || [],
    isLoading,
    isStreaming,
    error,
    sendMessage,
    stopGeneration,
    clearError,
  };
}
