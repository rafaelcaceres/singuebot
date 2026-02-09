import React from 'react';
import { Id } from '../../../../convex/_generated/dataModel';
import { ConversationListItem } from './ConversationListItem';

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
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 mb-3">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                filter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
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
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          {conversations.length} conversa{conversations.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};
