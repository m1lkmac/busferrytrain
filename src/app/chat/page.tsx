"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { ChatConversation } from "@/components/chat/ChatConversation";
import { useConversations } from "@/hooks/useConversations";
import { useChat } from "@/hooks/useChat";

export default function ChatPage() {
  const router = useRouter();
  const { conversations, grouped, create, remove, refresh } = useConversations();

  // Handle new conversation creation
  const handleNewChat = useCallback(() => {
    const newConv = create();
    router.push(`/chat/${newConv.id}`);
  }, [create, router]);

  // Handle conversation deletion
  const handleDeleteChat = useCallback(
    (id: string) => {
      remove(id);
      refresh();
    },
    [remove, refresh]
  );

  // Chat hook for new conversation
  const handleConversationCreated = useCallback(
    (conv: { id: string }) => {
      router.push(`/chat/${conv.id}`);
    },
    [router]
  );

  const { messages, isLoading, isStreaming, error, sendMessage, stopGeneration, clearError } =
    useChat({
      onConversationCreated: handleConversationCreated,
    });

  return (
    <ChatLayout
      conversations={conversations}
      groupedConversations={grouped}
      onNewChat={handleNewChat}
      onDeleteChat={handleDeleteChat}
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
