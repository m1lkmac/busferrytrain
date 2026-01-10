"use client";

import { useRouter, useParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.id as string;

  const { conversations, grouped, create, remove, refresh, get } = useConversations();

  // Check if conversation exists
  useEffect(() => {
    const conv = get(conversationId);
    if (!conv && conversations.length > 0) {
      // Conversation not found, redirect to new chat
      router.push("/chat");
    }
  }, [conversationId, conversations, get, router]);

  // Handle new conversation creation
  const handleNewChat = useCallback(() => {
    const newConv = create();
    router.push(`/chat/${newConv.id}`);
  }, [create, router]);

  // Handle conversation deletion
  const handleDeleteChat = useCallback(
    (id: string) => {
      const wasCurrentChat = id === conversationId;
      remove(id);
      refresh();

      if (wasCurrentChat) {
        // If we deleted the current chat, go to new chat
        router.push("/chat");
      }
    },
    [remove, refresh, conversationId, router]
  );

  // Chat hook for this conversation
  const { messages, isLoading, isStreaming, error, sendMessage, stopGeneration, clearError } =
    useChat({
      conversationId,
    });

  return (
    <ChatLayout
      conversations={conversations}
      groupedConversations={grouped}
      onNewChat={handleNewChat}
      onDeleteChat={handleDeleteChat}
      currentConversationId={conversationId}
    >
      <ChatConversation
        messages={messages}
        isLoading={isLoading}
        isStreaming={isStreaming}
        error={error}
        onSendMessage={sendMessage}
        onStopGeneration={stopGeneration}
        onClearError={clearError}
      />
    </ChatLayout>
  );
}
