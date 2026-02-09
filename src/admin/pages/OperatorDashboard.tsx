import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { MetricsBar } from '../components/operator/MetricsBar';
import { ConversationSidebar } from '../components/operator/ConversationSidebar';
import { ConversationPanel } from '../components/operator/ConversationPanel';

type FilterType = 'all' | 'active' | 'needs_attention' | 'unread';

export const OperatorDashboard: React.FC = () => {
  const [selectedParticipantId, setSelectedParticipantId] = useState<Id<'participants'> | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch metrics
  const metrics = useQuery(api.operatorDashboard.getOperatorMetrics);

  // Fetch conversations
  const conversations = useQuery(api.operatorDashboard.getOperatorConversations, {
    filter,
    search: searchQuery || undefined,
    limit: 100,
  });

  // Fetch selected conversation details
  const conversationDetail = useQuery(
    api.operatorDashboard.getConversationDetail,
    selectedParticipantId ? { participantId: selectedParticipantId } : 'skip'
  );

  // Use negative margins to break out of AdminLayout's container padding
  // Height: 100vh - header (64px) - container padding (32px top + 32px bottom)
  return (
    <div className="h-[calc(100vh-64px-64px)] flex flex-col bg-gray-50 -mx-6 -my-8">
      {/* Header */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-3">
        <h1 className="text-xl font-bold text-gray-900">Central de Atendimento</h1>
      </div>

      {/* Metrics Bar */}
      <div className="shrink-0">
        <MetricsBar metrics={metrics} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <ConversationSidebar
          conversations={conversations || []}
          selectedParticipantId={selectedParticipantId}
          onSelectConversation={setSelectedParticipantId}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoading={conversations === undefined}
        />

        {/* Main Panel */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedParticipantId && conversationDetail ? (
            <ConversationPanel
              conversation={conversationDetail}
              participantId={selectedParticipantId}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Selecione uma conversa
                </h3>
                <p className="text-gray-500">
                  Escolha uma conversa na lista ao lado para visualizar as mensagens
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
