import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSemanticSearch, SimilarParticipant } from '@/hooks/useSemanticSearch';
import { SemanticSearch } from '../components/SemanticSearch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const { searchByText, isSearching, error, results, lastQuery, hasResults } = useSemanticSearch();
  const [limit, setLimit] = React.useState(50);

  const handleSearch = (query: string) => {
    searchByText(query, limit);
  };

  const handleViewProfile = (participantId: string) => {
    navigate(`/participants/${participantId}`);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 bg-green-50';
    if (score >= 0.7) return 'text-blue-600 bg-blue-50';
    if (score >= 0.5) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.9) return 'Altíssima';
    if (score >= 0.7) return 'Alta';
    if (score >= 0.5) return 'Média';
    return 'Baixa';
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Explorador de Participantes</h1>
            <p className="text-muted-foreground">
              Encontre conexões e padrões usando busca semântica inteligente
            </p>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Busca Semântica
              </CardTitle>
              <CardDescription>
                Faça perguntas em linguagem natural para encontrar participantes relevantes
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="limit" className="text-sm text-muted-foreground">
                Resultados:
              </label>
              <select
                id="limit"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-3 py-1.5 border rounded-md text-sm"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SemanticSearch
            onSearch={handleSearch}
            isLoading={isSearching}
            showExamples={!hasResults}
          />
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <span className="font-semibold">Erro:</span>
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Section */}
      {hasResults && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">
                {results.length} {results.length === 1 ? 'Resultado' : 'Resultados'}
              </h2>
              {lastQuery && (
                <Badge variant="secondary" className="ml-2">
                  "{lastQuery}"
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Nova Busca
            </Button>
          </div>

          {/* Results Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.map((result: SimilarParticipant, index: number) => (
              <Card
                key={result.participantId}
                className="hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleViewProfile(result.participantId)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">
                          {result.participant.name || 'Sem nome'}
                        </CardTitle>
                      </div>
                    </div>
                    <Badge
                      className={getScoreColor(result.score)}
                      variant="secondary"
                    >
                      {Math.round(result.score * 100)}%
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <TrendingUp className="h-3 w-3" />
                    Similaridade: {getScoreLabel(result.score)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Professional Info */}
                  <div className="space-y-2 text-sm">
                    {result.participant.cargo && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Briefcase className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">{result.participant.cargo}</span>
                      </div>
                    )}
                    {result.participant.empresa && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">{result.participant.empresa}</span>
                      </div>
                    )}
                    {result.participant.programaMarca && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Award className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">{result.participant.programaMarca}</span>
                      </div>
                    )}
                  </div>

                  {/* Similarity Highlights */}
                  {result.highlights?.length ? (
                    <div className="pt-3 border-t">
                      <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground">
                        Trechos relevantes
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {result.highlights.slice(0, 3).map((snippet, highlightIndex) => (
                          <p
                            key={highlightIndex}
                            className="text-xs text-muted-foreground italic line-clamp-2"
                          >
                            "{snippet}"
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : result.textPreview ? (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {result.textPreview}...
                      </p>
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProfile(result.participantId);
                      }}
                    >
                      Ver Perfil
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasResults && !isSearching && !error && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Comece sua busca</h3>
            <p className="text-muted-foreground max-w-md">
              Use a busca semântica acima para encontrar participantes relevantes.
              Tente perguntas como "CEOs em fintech" ou "mulheres em conselhos".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
