import type { Conversation, ChatMessage } from "@/types";

const STORAGE_KEY = "busferrytrain_conversations";
const MAX_CONVERSATIONS = 50;

// Generate a unique ID
function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Generate title from first user message
function generateTitle(message: string): string {
  const truncated = message.slice(0, 50);
  return truncated.length < message.length ? `${truncated}...` : truncated;
}

// Get all conversations from localStorage
export function getConversations(): Conversation[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const conversations = JSON.parse(data) as Conversation[];
    // Sort by updatedAt descending (most recent first)
    return conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error("Failed to load conversations:", error);
    return [];
  }
}

// Get a single conversation by ID
export function getConversation(id: string): Conversation | null {
  const conversations = getConversations();
  return conversations.find((c) => c.id === id) || null;
}

// Create a new conversation
export function createConversation(
  firstMessage?: ChatMessage
): Conversation {
  const now = new Date().toISOString();
  const conversation: Conversation = {
    id: generateId(),
    title: firstMessage ? generateTitle(firstMessage.content) : "New conversation",
    messages: firstMessage ? [firstMessage] : [],
    createdAt: now,
    updatedAt: now,
  };

  const conversations = getConversations();
  conversations.unshift(conversation);

  // Limit to MAX_CONVERSATIONS
  const trimmed = conversations.slice(0, MAX_CONVERSATIONS);
  saveConversations(trimmed);

  return conversation;
}

// Update a conversation
export function updateConversation(
  id: string,
  updates: Partial<Pick<Conversation, "title" | "messages">>
): Conversation | null {
  const conversations = getConversations();
  const index = conversations.findIndex((c) => c.id === id);

  if (index === -1) return null;

  const updated: Conversation = {
    ...conversations[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Update title if it's the default and we have a user message
  if (
    updated.title === "New conversation" &&
    updated.messages.length > 0
  ) {
    const firstUserMessage = updated.messages.find((m) => m.role === "user");
    if (firstUserMessage) {
      updated.title = generateTitle(firstUserMessage.content);
    }
  }

  conversations[index] = updated;
  saveConversations(conversations);

  return updated;
}

// Add a message to a conversation
export function addMessage(
  conversationId: string,
  message: Omit<ChatMessage, "id" | "timestamp">
): ChatMessage {
  const fullMessage: ChatMessage = {
    ...message,
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  updateConversation(conversationId, {
    messages: [...conversation.messages, fullMessage],
  });

  return fullMessage;
}

// Update the last assistant message (for streaming)
export function updateLastAssistantMessage(
  conversationId: string,
  content: string,
  embeddedTrips?: ChatMessage["embeddedTrips"]
): void {
  const conversation = getConversation(conversationId);
  if (!conversation) return;

  const messages = [...conversation.messages];
  const lastIndex = messages.length - 1;

  if (lastIndex >= 0 && messages[lastIndex].role === "assistant") {
    messages[lastIndex] = {
      ...messages[lastIndex],
      content,
      embeddedTrips,
    };
    updateConversation(conversationId, { messages });
  }
}

// Delete a conversation
export function deleteConversation(id: string): boolean {
  const conversations = getConversations();
  const filtered = conversations.filter((c) => c.id !== id);

  if (filtered.length === conversations.length) {
    return false; // Not found
  }

  saveConversations(filtered);
  return true;
}

// Clear all conversations
export function clearAllConversations(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// Save conversations to localStorage
function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch (error) {
    console.error("Failed to save conversations:", error);

    // If storage is full, remove oldest conversations
    if (error instanceof Error && error.name === "QuotaExceededError") {
      const trimmed = conversations.slice(0, Math.floor(conversations.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  }
}

// Group conversations by date
export function groupConversationsByDate(
  conversations: Conversation[]
): Record<string, Conversation[]> {
  const groups: Record<string, Conversation[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    let key: string;

    if (date >= today) {
      key = "Today";
    } else if (date >= yesterday) {
      key = "Yesterday";
    } else if (date >= lastWeek) {
      key = "Last 7 days";
    } else if (date >= lastMonth) {
      key = "Last 30 days";
    } else {
      key = "Older";
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(conv);
  }

  return groups;
}
