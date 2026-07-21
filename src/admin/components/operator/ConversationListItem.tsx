import React from 'react';
import { Id } from '../../../../convex/_generated/dataModel';
import { StatusBadge } from '@/components/ui/status-badge';

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

  const statusDot: Record<Conversation['status'], string> = {
    active: 'bg-success',
    fallback: 'bg-warning',
    needs_attention: 'bg-destructive animate-pulse',
    inactive: 'bg-muted-foreground',
  };

  const statusLabel: Record<Conversation['status'], string> = {
    active: 'Ativa',
    fallback: 'Em fallback',
    needs_attention: 'Precisa de atenção',
    inactive: 'Inativa',
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
      aria-current={isSelected ? 'true' : undefined}
      className={`w-full text-left p-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset ${
        isSelected ? 'bg-primary/10' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar with status indicator */}
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium">
            {getInitial()}
          </div>
          <div
            aria-hidden="true"
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${statusDot[status]}`}
          />
          <span className="sr-only">Status: {statusLabel[status]}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-foreground truncate">
                {contact.name || 'Sem nome'}
              </span>
              {operatorMode && <StatusBadge tone="info">Operador</StatusBadge>}
            </div>
            {lastMessage && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatTimeAgo(lastMessage.timestamp)}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground truncate">{formatPhone(contact.phone)}</p>

          {lastMessage && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {lastMessage.direction === 'outbound' && (
                <span className="text-muted-foreground mr-1">Você:</span>
              )}
              {lastMessage.text}
            </p>
          )}
        </div>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <div className="flex-shrink-0">
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-destructive-foreground bg-destructive rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
              <span className="sr-only"> mensagens não lidas</span>
            </span>
          </div>
        )}
      </div>
    </button>
  );
};
