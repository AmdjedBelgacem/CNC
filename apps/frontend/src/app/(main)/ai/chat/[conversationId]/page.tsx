import { AiChatWorkspace } from '@/components/ai/chat-workspace/ai-chat-workspace';

type AiChatConversationPageProps = {
  params: Promise<{ conversationId: string }>;
};

/**
 * Deep link to a saved thread. The id has to come from the route — rendering the
 * workspace with a hardcoded `null` left the URL changing while the transcript
 * stayed on the "new chat" state, so clicking a conversation did nothing.
 */
export default async function AiChatConversationPage({ params }: AiChatConversationPageProps) {
  const { conversationId } = await params;
  return <AiChatWorkspace conversationId={conversationId} />;
}
