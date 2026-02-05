import { useState, useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export interface SimilarParticipant {
  participantId: Id<"participants">;
  score: number;
  participant: {
    name?: string;
    cargo?: string;
    empresa?: string;
    setor?: string;
    programaMarca?: string;
  };
  textPreview: string;
  updatedAt: number;
  highlights: string[];
}

export interface SemanticSearchResult {
  results: SimilarParticipant[];
  query: string;
  timestamp: number;
}

export function useSemanticSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SimilarParticipant[]>([]);
  const [lastQuery, setLastQuery] = useState<string>('');

  // Use Convex action directly
  const searchAction = useAction(api.functions.participantRAG.searchSimilarPublic);

  const searchByText = useCallback(async (query: string, limit = 50) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);
    setLastQuery(query);

    try {
      const data = await searchAction({ query, limit });
      setResults(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search';
      setError(errorMessage);
      console.error('Semantic search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchAction]);

  const searchSimilarTo = useCallback(async (participantId: Id<"participants">, limit = 50) => {
    setIsSearching(true);
    setError(null);
    setLastQuery(`Similar to ${participantId}`);

    try {
      const data = await searchAction({ participantId, limit });
      setResults(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search';
      setError(errorMessage);
      console.error('Semantic search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchAction]);

  const clearResults = useCallback(() => {
    setResults([]);
    setLastQuery('');
    setError(null);
  }, []);

  return {
    searchByText,
    searchSimilarTo,
    clearResults,
    isSearching,
    error,
    results,
    lastQuery,
    hasResults: results.length > 0,
  };
}
