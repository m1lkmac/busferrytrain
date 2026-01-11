"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, StopCircle, AlertCircle } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/types";

// Fun loading messages that cycle while AI is thinking
const thinkingMessages = [
  "Thinking...",
  "Riding the neurons...",
  "Checking the schedules...",
  "Asking the locals...",
  "Packing bags...",
  "Reading maps...",
  "Catching ferries...",
];

interface ChatConversationProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  onSendMessage: (message: string) => void;
  onStopGeneration: () => void;
  onClearError: () => void;
}

// Suggested prompts for empty state
const suggestedPrompts = [
  "Find buses from Bangkok to Phuket tomorrow",
  "What's the cheapest way to get to Koh Samui?",
  "I need a ferry from Krabi to Koh Phi Phi",
  "Train options from Bangkok to Chiang Mai",
];

export function ChatConversation({
  messages,
  isLoading,
  isStreaming,
  error,
  onSendMessage,
  onStopGeneration,
  onClearError,
}: ChatConversationProps) {
  const [input, setInput] = useState("");
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cycle through thinking messages every 5 seconds
  useEffect(() => {
    if (!isLoading || isStreaming) {
      setThinkingIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setThinkingIndex((prev) => (prev + 1) % thinkingMessages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isLoading, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    onSendMessage(input);
    setInput("");
  };

  const handleSuggestedPrompt = (prompt: string) => {
    onSendMessage(prompt);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          // Empty state
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-4">🚌 ⛴️ 🚂</div>
            <h2 className="text-xl font-semibold text-dark mb-2">
              Travel Assistant
            </h2>
            <p className="text-gray max-w-md mb-6">
              I can help you find the best bus, ferry, and train routes across
              Thailand. Just ask me about your trip!
            </p>

            {/* Suggested prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg">
              {suggestedPrompts.map((prompt) => (
                <motion.button
                  key={prompt}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-3 text-left text-sm bg-white border border-gray-light
                             rounded-xl text-dark-secondary hover:border-teal-light
                             hover:bg-off-white transition-colors"
                >
                  {prompt}
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          // Messages list
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages
              .filter((message) => message.role === "user" || message.content)
              .map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

            {/* Loading indicator with cycling messages */}
            {isLoading && !isStreaming && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-teal flex items-center justify-center">
                  <Loader2 size={16} className="text-white animate-spin" />
                </div>
                <div className="px-4 py-3 bg-white border border-gray-light rounded-2xl rounded-bl-md min-w-[140px]">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={thinkingIndex}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.3 }}
                      className="text-gray text-sm block"
                    >
                      {thinkingMessages[thinkingIndex]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-4 p-3 bg-coral/10 border border-coral rounded-xl
                     flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-dark">
            <AlertCircle size={16} className="text-coral" />
            {error}
          </div>
          <button
            onClick={onClearError}
            className="text-coral hover:text-coral-light text-sm"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Input area */}
      <div className="border-t border-gray-light p-4 bg-white">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-center gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your trip..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-gray-light rounded-xl
                       bg-off-white text-dark placeholder:text-gray
                       focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent
                       disabled:bg-gray-light disabled:cursor-not-allowed"
            aria-label="Type your message"
          />

          {isStreaming ? (
            <motion.button
              type="button"
              onClick={onStopGeneration}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-coral text-dark rounded-xl hover:bg-coral-light
                         transition-colors"
              aria-label="Stop generating"
            >
              <StopCircle size={20} />
            </motion.button>
          ) : (
            <motion.button
              type="submit"
              disabled={!input.trim() || isLoading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 bg-teal text-white rounded-xl hover:bg-teal-dark
                         disabled:bg-gray disabled:cursor-not-allowed
                         transition-colors"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </motion.button>
          )}
        </form>
      </div>
    </div>
  );
}
