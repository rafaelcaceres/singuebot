import React from 'react';
import { Id } from '../../../../convex/_generated/dataModel';
import { ConversationListItem } from './ConversationListItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type FilterType = 'all' | 'active' | 'needs_attention' | 'unread';

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

interface ConversationSidebarProps {
  conversations: Conversation[];
  selectedParticipantId: Id<'participants'> | null;
  onSelectConversation: (id: Id<'participants'>) => void;
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isLoading: boolean;
}

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Ativas' },
  { value: 'needs_attention', label: 'Precisam atenção' },
  { value: 'unread', label: 'Não lidas' },
];

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  selectedParticipantId,
  onSelectConversation,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  isLoading,
}) => {
  return (
    <div className="w-80 bg-card border-r border-border flex flex-col">
      {/* Filters */}
      <div className="p-4 border-b border-border">
        <div className="flex flex-wrap gap-2 mb-3">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              variant={filter === option.value ? 'default' : 'secondary'}
              size="sm"
              aria-pressed={filter === option.value}
              className="rounded-full"
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            aria-label="Buscar por nome ou telefone"
            className="pl-10 focus-visible:ring-2"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-24 mb-2" />
                    <div className="h-3 bg-muted rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.participantId}
                conversation={conversation}
                isSelected={selectedParticipantId === conversation.participantId}
                onClick={() => onSelectConversation(conversation.participantId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer with count */}
      <div className="p-3 border-t border-border bg-muted">
        <p className="text-xs text-muted-foreground text-center">
          {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};
