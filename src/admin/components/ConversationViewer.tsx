import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { usePermissions } from '../../hooks/useAuth';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversation messages
  const conversationData = useQuery(api.admin.getConversationMessages, {
    participantId: participantId as any,
  });

  // Extract messages and participant from the conversation data
  const messages = conversationData?.messages || [];
  const participant = conversationData?.participant || null;

  // Send manual message mutation
  const sendMessage = useMutation(api.admin.sendManualMessage);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'delivered':
        return 'text-green-500';
      case 'read':
        return 'text-blue-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'delivered':
        return '✓';
      case 'read':
        return '✓✓';
      case 'failed':
        return '✗';
      default:
        return '○';
    }
  };

  if (!participant) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Carregando conversa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
              {participant.name ? participant.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {participant.name || 'Participante sem nome'}
              </h2>
              <p className="text-sm text-gray-500">
                {participant.phone.replace('whatsapp:', '')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              participant.consent 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {participant.consent ? 'Com consentimento' : 'Sem consentimento'}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages?.map((message) => (
            <div
              key={message._id}
              className={`flex ${
                message.direction === 'outbound' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.direction === 'outbound'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                {/* Media content */}
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
                        className="text-blue-300 underline"
                      >
                        📎 Arquivo anexo
                      </a>
                    )}
                  </div>
                )}

                {/* Message text */}
                <p className="text-sm whitespace-pre-wrap">{message.body}</p>

                {/* Timestamp and status */}
                <div className={`flex items-center justify-between mt-1 text-xs ${
                  message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  <span>{formatTimestamp(message._creationTime)}</span>
                  {message.direction === 'outbound' && (
                    <span className={getStatusColor(message.status)}>
                      {getStatusIcon(message.status)}
                    </span>
                  )}
                </div>

                {/* State snapshot button (admin only) */}
                {canViewAnalytics && message.stateSnapshot && (
                  <button
                    onClick={() => setShowStateSnapshot(
                      showStateSnapshot === message._id ? null : message._id
                    )}
                    className="mt-2 text-xs underline opacity-75 hover:opacity-100"
                  >
                    {showStateSnapshot === message._id ? 'Ocultar' : 'Ver'} estado
                  </button>
                )}

                {/* State snapshot display */}
                {showStateSnapshot === message._id && message.stateSnapshot && (
                  <div className="mt-2 p-2 bg-black bg-opacity-20 rounded text-xs">
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(message.stateSnapshot, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Message input */}
        {canManageUsers && (
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Esta mensagem será enviada diretamente para o WhatsApp do participante.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};