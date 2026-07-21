import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSemanticSearch, SimilarParticipant } from '@/hooks/useSemanticSearch';
import { SemanticSearch } from '../components/SemanticSearch';
import { Button } from '@/components/ui/button';
import { StatusBadge, type StatusTone } from '@/components/ui/status-badge';
import { PageHeader } from '../components/PageHeader';
import { StatCluster } from '../components/StatCluster';
import {
  Users,
  Sparkles,
  TrendingUp,
  MessageSquare,
  ExternalLink,
  Briefcase,
  Building2,
  Award,
  ArrowRight
} from 'lucide-react';

export function ParticipantExplorer() {
  const navigate = useNavigate();
  const { searchByText, isSearching, error, results, lastQuery, hasResults, clearResults } =
    useSemanticSearch();
  const [limit, setLimit] = React.useState(50);

  const handleSearch = (query: string) => {
    searchByText(query, limit);
  };

  const handleViewProfile = (participantId: string) => {
    navigate(`/participants/${participantId}`);
  };

  const getScoreTone = (score: number): StatusTone => {
    if (score >= 0.9) return 'success';
    if (score >= 0.7) return 'info';
    if (score >= 0.5) return 'warning';
    return 'neutral';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.9) return 'Altíssima';
    if (score >= 0.7) return 'Alta';
    if (score >= 0.5) return 'Média';
    return 'Baixa';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Explorador"
        description="Encontre participantes por busca semântica em linguagem natural."
      />

      {/* Search Section */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground max-w-md">
            Faça perguntas em linguagem natural para encontrar participantes relevantes.
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="limit" className="text-sm text-muted-foreground">
              Resultados:
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-1.5 border border-input bg-background rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
        <SemanticSearch
          onSearch={handleSearch}
          isLoading={isSearching}
          showExamples={!hasResults}
        />
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-border bg-destructive-muted px-4 py-3 text-sm text-destructive-muted-foreground"
        >
          <span className="font-semibold">Erro:</span> {error}
        </div>
      )}

      {/* Results Section */}
      {hasResults && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-sm font-medium text-muted-foreground">
                Resultados para
              </h2>
              {lastQuery && (
                <StatusBadge tone="neutral">"{lastQuery}"</StatusBadge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={clearResults}>
              Nova busca
            </Button>
          </div>

          <StatCluster
            className="md:grid-cols-3"
            stats={[
              { label: "Participantes encontrados", value: results.length, icon: Users },
              {
                label: "Similaridade média",
                value: `${Math.round(
                  (results.reduce((sum, r) => sum + r.score, 0) / results.length) * 100
                )}%`,
                icon: TrendingUp,
              },
              {
                label: "Maior similaridade",
                value: `${Math.round(Math.max(...results.map((r) => r.score)) * 100)}%`,
                icon: Award,
                tone: "success",
              },
            ]}
          />

          {/* Dense list, not a shadow-card grid: the score, name and matched
              snippets are scannable top-to-bottom, and the whole row is not a
              clickable card wrapping a button (the a11y trap the review flagged). */}
          <ol className="rounded-lg border border-border bg-card divide-y divide-border">
            {results.map((result: SimilarParticipant, index: number) => (
              <li
                key={result.participantId}
                className="flex items-start gap-4 p-4 hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm tabular-nums text-muted-foreground w-6 shrink-0 pt-0.5">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground truncate">
                      {result.participant.name || 'Sem nome'}
                    </span>
                    <StatusBadge tone={getScoreTone(result.score)}>
                      {Math.round(result.score * 100)}% · {getScoreLabel(result.score)}
                    </StatusBadge>
                  </div>

                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap text-sm text-muted-foreground">
                    {result.participant.cargo && (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{result.participant.cargo}</span>
                      </span>
                    )}
                    {result.participant.empresa && (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{result.participant.empresa}</span>
                      </span>
                    )}
                    {result.participant.programaMarca && (
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Award className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{result.participant.programaMarca}</span>
                      </span>
                    )}
                  </div>

                  {result.highlights?.length ? (
                    <div className="space-y-0.5 pt-0.5">
                      {result.highlights.slice(0, 2).map((snippet, highlightIndex) => (
                        <p
                          key={highlightIndex}
                          className="text-xs text-muted-foreground italic line-clamp-1"
                        >
                          "{snippet}"
                        </p>
                      ))}
                    </div>
                  ) : result.textPreview ? (
                    <p className="text-xs text-muted-foreground line-clamp-1 pt-0.5">
                      {result.textPreview}...
                    </p>
                  ) : null}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => handleViewProfile(result.participantId)}
                >
                  Ver perfil
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Empty State */}
      {!hasResults && !isSearching && !error && (
        <div className="rounded-lg border border-dashed border-border">
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <Sparkles className="h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
            <h3 className="text-base font-medium text-foreground mb-1">Comece sua busca</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Use a busca semântica acima para encontrar participantes relevantes.
              Tente perguntas como "CEOs em fintech" ou "mulheres em conselhos".
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
