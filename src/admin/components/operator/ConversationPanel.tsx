import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { ConversationHeader } from './ConversationHeader';
import { ParticipantDetails } from './ParticipantDetails';

interface Message {
  _id: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  timestamp: number;
  mediaUrl?: string;
  mediaContentType?: string;
  aiMetadata?: {
    model: string;
    tokens: number;
    processingTimeMs: number;
    fallbackUsed: boolean;
  };
  audioTranscription?: {
    transcribedText: string;
  };
}

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
  messages: Message[];
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
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const previousParticipantId = useRef(participantId);

  const sendMessage = useAction(api.operatorDashboard.sendOperatorMessage);
  const takeOver = useMutation(api.operatorDashboard.takeOverConversation);
  const release = useMutation(api.operatorDashboard.releaseConversation);
  const toggleAttention = useMutation(api.operatorDashboard.toggleNeedsAttention);
  const markAsRead = useMutation(api.operatorDashboard.markConversationAsRead);

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Reset initial load flag when participant changes
  useEffect(() => {
    if (previousParticipantId.current !== participantId) {
      isInitialLoad.current = true;
      previousParticipantId.current = participantId;
    }
  }, [participantId]);

  // Mark messages as read when conversation is opened
  useEffect(() => {
    markAsRead({ participantId }).catch((error) => {
      console.error('Failed to mark as read:', error);
    });
  }, [participantId, markAsRead]);

  // Scroll to bottom - instant on initial load, smooth for new messages
  useEffect(() => {
    if (isInitialLoad.current) {
      scrollToBottom(false);
      isInitialLoad.current = false;
    } else {
      scrollToBottom(true);
    }
  }, [conversation.messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendMessage({
        participantId,
        message: newMessage.trim(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const handleTakeOver = async () => {
    try {
      await takeOver({ participantId });
    } catch (error) {
      console.error('Failed to take over:', error);
    }
  };

  const handleRelease = async () => {
    try {
      await release({ participantId });
    } catch (error) {
      console.error('Failed to release:', error);
    }
  };

  const handleToggleAttention = async () => {
    try {
      await toggleAttention({
        participantId,
        needsHuman: !conversation.context.needsHuman,
      });
    } catch (error) {
      console.error('Failed to toggle attention:', error);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'delivered':
        return '\u2713';
      case 'read':
        return '\u2713\u2713';
      case 'failed':
        return '\u2717';
      default:
        return '\u25CB';
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full">
      {/* Header */}
      <ConversationHeader
        participant={conversation.participant}
        context={conversation.context}
        onToggleAttention={handleToggleAttention}
        onToggleDetails={() => setShowDetails(!showDetails)}
        showDetails={showDetails}
        participantId={participantId}
      />

      <div className="flex-1 flex min-h-0">
        {/* Messages */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="grow overflow-y-auto p-4 bg-gray-50">
            <div className="max-w-3xl mx-auto space-y-3">
              {conversation.messages.map((message) => (
                <div
                  key={message._id}
                  className={`flex ${
                    message.direction === 'outbound' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                      message.direction === 'outbound'
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-white text-gray-900 rounded-bl-md shadow-sm'
                    }`}
                  >
                    {/* Media */}
                    {message.mediaUrl && (
                      <div className="mb-2">
                        {message.mediaContentType?.startsWith('image/') ? (
                          <img
                            src={message.mediaUrl}
                            alt="Media"
                            className="max-w-full h-auto rounded"
                          />
                        ) : (
                          <a
                            href={message.mediaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`underline ${
                              message.direction === 'outbound'
                                ? 'text-blue-100'
                                : 'text-blue-600'
                            }`}
                          >
                            Arquivo anexo
                          </a>
                        )}
                      </div>
                    )}

                    {/* Audio transcription notice */}
                    {message.audioTranscription && (
                      <div
                        className={`text-xs mb-1 ${
                          message.direction === 'outbound'
                            ? 'text-blue-200'
                            : 'text-gray-400'
                        }`}
                      >
                        (Audio transcrito)
                      </div>
                    )}

                    {/* Message text */}
                    <p className="text-sm whitespace-pre-wrap">{message.body}</p>

                    {/* Timestamp and status */}
                    <div
                      className={`flex items-center justify-between gap-2 mt-1 text-xs ${
                        message.direction === 'outbound'
                          ? 'text-blue-200'
                          : 'text-gray-400'
                      }`}
                    >
                      <span>{formatTimestamp(message.timestamp)}</span>
                      <div className="flex items-center gap-1">
                        {message.aiMetadata && (
                          <span
                            className={`px-1 rounded ${
                              message.direction === 'outbound'
                                ? 'bg-blue-400/30'
                                : 'bg-gray-100'
                            }`}
                            title={`${message.aiMetadata.model} - ${message.aiMetadata.tokens} tokens`}
                          >
                            IA
                          </span>
                        )}
                        {message.direction === 'outbound' && (
                          <span>{getStatusIcon(message.status)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Message input / Take over area */}
          <div className="shrink-0 border-t bg-white">
            {conversation.context.operatorMode ? (
              /* Operator mode: show message input and release button */
              <div className="p-3">
                <div className="max-w-3xl mx-auto">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={isSending}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isSending}
                      className="px-5 py-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                    >
                      {isSending ? (
                        <svg
                          className="animate-spin h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      ) : (
                        'Enviar'
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-purple-600">
                      Você está no controle. A IA está pausada para este participante.
                    </p>
                    <button
                      onClick={handleRelease}
                      className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Devolver para IA
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Not in operator mode: show take over prompt */
              <div className="p-4">
                <div className="max-w-3xl mx-auto">
                  <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Para enviar mensagens, você precisa assumir a conversa.
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        A IA será pausada e não responderá mais automaticamente.
                      </p>
                    </div>
                    <button
                      onClick={handleTakeOver}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Assumir conversa
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Details Panel */}
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
