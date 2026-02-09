import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { usePermissions } from '../../hooks/useAuth';
import { Pencil, X, Check } from 'lucide-react';

interface ConversationViewerProps {
  participantId: string;
  onClose: () => void;
}

interface Message {
  _id: string;
  from: string;
  to: string;
  body: string;
  _creationTime: number;
  direction: 'inbound' | 'outbound';
  status?: string;
  mediaUrl?: string;
  mediaContentType?: string;
  stateSnapshot?: any;
}

export const ConversationViewer: React.FC<ConversationViewerProps> = ({
  participantId,
  onClose,
}) => {
  const { canManageUsers, canViewAnalytics } = usePermissions();
  const [newMessage, setNewMessage] = useState('');
  const [showStateSnapshot, setShowStateSnapshot] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const isInitialLoad = useRef(true);

  // Fetch conversation messages
  const conversationData = useQuery(api.admin.getConversationMessages, {
    participantId: participantId as any,
  });

  // Extract messages and participant from the conversation data
  const messages = conversationData?.messages || [];
  const participant = conversationData?.participant || null;

  // Mutations and actions
  const sendMessage = useAction(api.admin.sendManualMessage);
  const updateParticipant = useMutation(api.admin.updateParticipant);

  // Initialize edited name when participant loads
  useEffect(() => {
    if (participant?.name) {
      setEditedName(participant.name);
    }
  }, [participant?.name]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const scrollToBottom = (smooth = false) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  // Scroll to bottom - instant on initial load, smooth for new messages
  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        scrollToBottom(false);
        isInitialLoad.current = false;
      } else {
        scrollToBottom(true);
      }
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!newMessage.trim() || !canManageUsers) return;

    sendMessage({
      participantId: participantId as any,
      message: newMessage.trim(),
    })
      .then(() => {
        setNewMessage('');
      })
      .catch((error) => {
        console.error('Failed to send message:', error);
        alert('Erro ao enviar mensagem. Tente novamente.');
      });
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || isSavingName) return;

    setIsSavingName(true);
    try {
      await updateParticipant({
        participantId: participantId as any,
        updates: { name: editedName.trim() },
      });
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Erro ao salvar nome. Tente novamente.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(participant?.name || '');
    setIsEditingName(false);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const getStatusIcon = (status?: string) => {
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

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace('whatsapp:', '').replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone.replace('whatsapp:', '');
  };

  if (!participant) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 shadow-lg">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent mx-auto" />
          <p className="mt-3 text-sm text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
              {participant.name ? participant.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="text-base font-medium border-b-2 border-blue-500 bg-transparent focus:outline-none px-0 py-0.5 w-40"
                    placeholder="Digite o nome..."
                    disabled={isSavingName}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={isSavingName || !editedName.trim()}
                    className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSavingName}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2
                    onClick={() => canManageUsers && setIsEditingName(true)}
                    className={`text-base font-medium text-gray-900 ${
                      canManageUsers ? 'cursor-pointer hover:text-blue-600' : ''
                    }`}
                    title={canManageUsers ? 'Clique para editar' : undefined}
                  >
                    {participant.name || 'Sem nome'}
                  </h2>
                  {canManageUsers && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-500">{formatPhone(participant.phone)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages - scrollable */}
        <div className="grow overflow-y-auto p-4 space-y-3 bg-gray-50">
          {messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Nenhuma mensagem ainda
            </div>
          ) : (
            messages.map((message) => (
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
                  {/* Media content */}
                  {message.mediaUrl && (
                    <div className="mb-2">
                      {message.mediaContentType?.startsWith('image/') ? (
                        <img
                          src={message.mediaUrl}
                          alt="Media"
                          className="max-w-full h-auto rounded-lg"
                        />
                      ) : (
                        <a
                          href={message.mediaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-sm underline ${
                            message.direction === 'outbound' ? 'text-blue-100' : 'text-blue-600'
                          }`}
                        >
                          Arquivo anexo
                        </a>
                      )}
                    </div>
                  )}

                  {/* Message text */}
                  <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>

                  {/* Timestamp and status */}
                  <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                    message.direction === 'outbound' ? 'text-blue-200' : 'text-gray-400'
                  }`}>
                    <span>{formatTimestamp(message._creationTime)}</span>
                    {message.direction === 'outbound' && (
                      <span>{getStatusIcon(message.status)}</span>
                    )}
                  </div>

                  {/* State snapshot (admin only) */}
                  {canViewAnalytics && message.stateSnapshot && (
                    <>
                      <button
                        onClick={() => setShowStateSnapshot(
                          showStateSnapshot === message._id ? null : message._id
                        )}
                        className="mt-1 text-xs opacity-60 hover:opacity-100 underline"
                      >
                        {showStateSnapshot === message._id ? 'Ocultar' : 'Debug'}
                      </button>
                      {showStateSnapshot === message._id && (
                        <div className="mt-2 p-2 bg-black/10 rounded text-xs max-h-32 overflow-auto">
                          <pre className="whitespace-pre-wrap">
                            {JSON.stringify(message.stateSnapshot, null, 2)}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input - fixed */}
        {canManageUsers && (
          <div className="shrink-0 p-3 border-t bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="px-5 py-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
