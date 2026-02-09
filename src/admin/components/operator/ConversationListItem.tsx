import React from 'react';
import { Id } from '../../../../convex/_generated/dataModel';

interface Conversation {
  participantId: Id<'participants'>;
  contact: {
    name: string | null;
    phone: string;
  };
  lastMessage: {
    text: string;
    timestamp: number;
    direction: 'inbound' | 'outbound';
  } | null;
  unreadCount: number;
  status: 'active' | 'fallback' | 'needs_attention' | 'inactive';
  needsHuman: boolean;
  operatorMode: boolean;
}

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

export const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isSelected,
  onClick,
}) => {
  const { contact, lastMessage, unreadCount, status, operatorMode } = conversation;

  const statusColors = {
    active: 'bg-green-500',
    fallback: 'bg-yellow-500',
    needs_attention: 'bg-red-500 animate-pulse',
    inactive: 'bg-gray-400',
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const getInitial = (): string => {
    if (contact.name) {
      return contact.name.charAt(0).toUpperCase();
    }
    return contact.phone.slice(-2);
  };

  const formatPhone = (phone: string): string => {
    // Format Brazilian phone: +55 11 99999-9999
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar with status indicator */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
            {getInitial()}
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusColors[status]}`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-gray-900 truncate">
                {contact.name || 'Sem nome'}
              </span>
              {operatorMode && (
                <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                  Operador
                </span>
              )}
            </div>
            {lastMessage && (
              <span className="text-xs text-gray-500 flex-shrink-0">
                {formatTimeAgo(lastMessage.timestamp)}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-500 truncate">{formatPhone(contact.phone)}</p>

          {lastMessage && (
            <p className="text-sm text-gray-600 truncate mt-1">
              {lastMessage.direction === 'outbound' && (
                <span className="text-gray-400 mr-1">Você:</span>
              )}
              {lastMessage.text}
            </p>
          )}
        </div>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
      </div>
    </button>
  );
};
