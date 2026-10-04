import React, { useState, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { useSearchParams } from 'react-router-dom';
import { MessagesSquare } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import { MetricsBar } from '../components/operator/MetricsBar';
import { ConversationSidebar } from '../components/operator/ConversationSidebar';
import { ConversationPanel } from '../components/operator/ConversationPanel';

type FilterType = 'all' | 'active' | 'needs_attention' | 'unread';

/**
 * The console's single inbox.
 *
 * The open conversation lives in the URL (`?participant=<id>`) rather than in
 * component state: the conversations table, the participants table and the
 * dashboard all link straight to a thread here, which is what let us delete the
 * second, parallel conversation viewer.
 */
const FILTERS: FilterType[] = ['all', 'active', 'needs_attention', 'unread'];

function parseFilter(value: string | null): FilterType {
  return FILTERS.includes(value as FilterType) ? (value as FilterType) : 'all';
}

export const OperatorDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  const selectedParticipantId = (searchParams.get('participant') ||
    null) as Id<'participants'> | null;
  // Also in the URL, so the dashboard can link straight to "needs attention".
  const filter = parseFilter(searchParams.get('filter'));

  const setFilter = useCallback(
    (next: FilterType) => {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          if (next === 'all') {
            params.delete('filter');
          } else {
            params.set('filter', next);
          }
          return params;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const selectConversation = useCallback(
    (participantId: Id<'participants'> | null) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (participantId) {
            next.set('participant', participantId);
          } else {
            next.delete('participant');
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const metrics = useQuery(api.operatorDashboard.getOperatorMetrics);

  const conversations = useQuery(api.operatorDashboard.getOperatorConversations, {
    filter,
    search: searchQuery || undefined,
    limit: 100,
  });

  const conversationDetail = useQuery(
    api.operatorDashboard.getConversationDetail,
    selectedParticipantId ? { participantId: selectedParticipantId } : 'skip'
  );

  // AdminLayout renders this route full-bleed, so the height comes from the
  // shell instead of a calc() that had to guess the header and padding sizes.
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="shrink-0 bg-card border-b border-border px-6 py-3">
        <h1 className="text-lg font-semibold text-foreground">Central de Atendimento</h1>
      </div>

      <div className="shrink-0">
        <MetricsBar metrics={metrics} />
      </div>

      <div className="flex-1 flex min-h-0">
        <ConversationSidebar
          conversations={conversations || []}
          selectedParticipantId={selectedParticipantId}
          onSelectConversation={selectConversation}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isLoading={conversations === undefined}
        />

        {/* min-w-0: without it this column refuses to shrink below its content's
            min-content width and pushes the panel off the right edge. */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {selectedParticipantId && conversationDetail ? (
            <ConversationPanel
              conversation={conversationDetail}
              participantId={selectedParticipantId}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-muted/40 p-6">
              <div className="text-center max-w-sm">
                <div
                  aria-hidden="true"
                  className="w-14 h-14 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center"
                >
                  <MessagesSquare className="w-7 h-7 text-muted-foreground" />
                </div>
                <h2 className="text-base font-medium text-foreground mb-1">
                  {selectedParticipantId
                    ? 'Carregando conversa...'
                    : 'Selecione uma conversa'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedParticipantId
                    ? 'Se ela não aparecer, o participante pode ter sido removido.'
                    : 'Escolha uma conversa na lista ao lado para ver as mensagens e responder.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
