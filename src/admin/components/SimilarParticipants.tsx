import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  TrendingUp,
  Briefcase,
  Building2,
  Award,
  ArrowRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useSemanticSearch } from '@/hooks/useSemanticSearch';
import type { SimilarParticipant } from '@/hooks/useSemanticSearch';
import { Id } from '../../../convex/_generated/dataModel';

interface SimilarParticipantsProps {
  participantId: Id<"participants">;
  limit?: number;
}

export function SimilarParticipants({ participantId, limit = 5 }: SimilarParticipantsProps) {
  const navigate = useNavigate();
  const { searchSimilarTo, isSearching, error, results } = useSemanticSearch();

  useEffect(() => {
    if (participantId) {
      void searchSimilarTo(participantId, limit);
    }
  }, [participantId, limit, searchSimilarTo]);

  const handleViewProfile = (id: Id<"participants">) => {
    navigate(`/participants?highlight=${id}`);
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

  if (isSearching) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Participantes Similares
          </CardTitle>
          <CardDescription>
            Perfis com características e experiências relacionadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Participantes Similares
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Participantes Similares
          </CardTitle>
          <CardDescription>
            Perfis com características e experiências relacionadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum participante similar encontrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Participantes Similares
        </CardTitle>
        <CardDescription>
          {results.length} {results.length === 1 ? 'perfil relacionado' : 'perfis relacionados'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {results.map((result: SimilarParticipant) => (
          <div
            key={result.participantId}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => handleViewProfile(result.participantId)}
          >
            {/* Header with name and score */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">
                  {result.participant.name || 'Sem nome'}
                </h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <TrendingUp className="h-3 w-3" />
                  <span>Similaridade: {getScoreLabel(result.score)}</span>
                </div>
              </div>
              <Badge
                className={getScoreColor(result.score)}
                variant="secondary"
              >
                {Math.round(result.score * 100)}%
              </Badge>
            </div>

            {/* Professional Info */}
            <div className="space-y-1.5 text-xs mb-3">
              {result.participant.cargo && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-1">{result.participant.cargo}</span>
                </div>
              )}
              {result.participant.empresa && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-1">{result.participant.empresa}</span>
                </div>
              )}
              {result.participant.programaMarca && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Award className="h-3 w-3 flex-shrink-0" />
                  <span className="line-clamp-1">{result.participant.programaMarca}</span>
                </div>
              )}
            </div>

            {/* Similarity Highlights */}
            {result.highlights?.length ? (
              <div className="bg-muted/40 border border-muted rounded-md p-3 mb-3">
                <p className="text-[11px] uppercase tracking-wide font-medium text-muted-foreground mb-1">
                  Trechos relevantes
                </p>
                <div className="space-y-1">
                  {result.highlights.slice(0, 2).map((snippet, index) => (
                    <p
                      key={index}
                      className="text-xs text-muted-foreground italic line-clamp-2"
                    >
                      "{snippet}"
                    </p>
                  ))}
                </div>
              </div>
            ) : result.textPreview ? (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3 italic">
                "{result.textPreview}..."
              </p>
            ) : null}

            {/* Action Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleViewProfile(result.participantId);
              }}
            >
              Ver Perfil Completo
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
