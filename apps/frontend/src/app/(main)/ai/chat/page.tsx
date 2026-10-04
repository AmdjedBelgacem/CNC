import { AiChatWorkspace } from '@/components/ai/chat-workspace/ai-chat-workspace';

/** `/ai/chat` starts a new thread and still shows the full history rail. */
export default function AiChatIndexPage() {
  return <AiChatWorkspace conversationId={null} />;
}
