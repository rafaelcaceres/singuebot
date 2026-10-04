import React, { useState, useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { ConversationHeader } from './ConversationHeader';
import { ParticipantDetails } from './ParticipantDetails';
import { MessageThread, type ThreadMessage } from '../conversation/MessageThread';
import { MessageComposer } from '../conversation/MessageComposer';
import { CLOSED_WINDOW, type ConversationWindow } from '@/admin/lib/messageWindow';
import { toast } from 'sonner';

interface ConversationDetail {
  participant: {
    _id: Id<'participants'>;
    name?: string;
    phone: string;
    consent: boolean;
    cargo?: string;
    empresa?: string;
    setor?: string;
    tags: string[];
  };
  messages: ThreadMessage[];
  cluster: { id: string; name: string } | null;
  session: { step: string; startedAt: number } | null;
  context: {
    needsHuman: boolean;
    operatorMode: boolean;
    escalationReason?: string;
    escalatedAt?: number;
    operatorTookOverAt?: number;
  };
  profile: any;
  window?: ConversationWindow;
  stats: {
    totalConversations: number;
    totalMessages: number;
    lastActivity?: number;
  };
}

interface ConversationPanelProps {
  conversation: ConversationDetail;
  participantId: Id<'participants'>;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  conversation,
  participantId,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const takeOver = useMutation(api.operatorDashboard.takeOverConversation);
  const release = useMutation(api.operatorDashboard.releaseConversation);
  const toggleAttention = useMutation(api.operatorDashboard.toggleNeedsAttention);
  const markAsRead = useMutation(api.operatorDashboard.markConversationAsRead);

  useEffect(() => {
    markAsRead({ participantId }).catch(() => {
      // Read receipts are best-effort; failing to clear the badge is not worth
      // interrupting the operator over.
    });
  }, [participantId, markAsRead]);

  const handleTakeOver = async () => {
    try {
      await takeOver({ participantId });
    } catch (error) {
      toast.error('Não foi possível assumir a conversa', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  const handleRelease = async () => {
    try {
      await release({ participantId });
    } catch (error) {
      toast.error('Não foi possível devolver para a IA', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  const handleToggleAttention = async () => {
    try {
      await toggleAttention({
        participantId,
        needsHuman: !conversation.context.needsHuman,
      });
    } catch (error) {
      toast.error('Não foi possível atualizar o sinalizador', {
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  const messageWindow = conversation.window ?? CLOSED_WINDOW;

  return (
    <div className="flex-1 flex flex-col bg-card h-full min-w-0">
      <ConversationHeader
        participant={conversation.participant}
        context={conversation.context}
        window={messageWindow}
        onToggleAttention={handleToggleAttention}
        onToggleDetails={() => setShowDetails(!showDetails)}
        showDetails={showDetails}
        participantId={participantId}
      />

      {/* `relative` anchors the details panel, which overlays the thread on
          narrower screens instead of squeezing it. */}
      <div className="relative flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <MessageThread
            messages={conversation.messages}
            conversationKey={participantId}
          />
          <MessageComposer
            participantId={participantId}
            operatorMode={conversation.context.operatorMode}
            window={messageWindow}
            onTakeOver={handleTakeOver}
            onRelease={handleRelease}
          />
        </div>

        {showDetails && (
          <ParticipantDetails
            participant={conversation.participant}
            cluster={conversation.cluster}
            session={conversation.session}
            profile={conversation.profile}
            stats={conversation.stats}
          />
        )}
      </div>
    </div>
  );
};
