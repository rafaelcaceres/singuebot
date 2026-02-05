import React, { useState, KeyboardEvent } from 'react';
import { Search, Loader2, X, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SemanticSearchProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  showExamples?: boolean;
}

const EXAMPLE_QUERIES = [
  "Mulheres em cargos de liderança",
  "CEOs com experiência em fintech",
  "Executivos do mercado financeiro",
  "Líderes focados em diversidade",
  "Profissionais em conselhos",
  "Diretores de tecnologia em São Paulo",
];

export function SemanticSearch({
  onSearch,
  isLoading = false,
  placeholder = "Busque participantes: 'CEOs em fintech', 'mulheres em conselhos'...",
  showExamples = true,
}: SemanticSearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    onSearch(example);
  };

  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className="w-full space-y-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="pl-10 pr-10"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Buscar
            </>
          )}
        </Button>
      </div>

      {/* Example Queries */}
      {showExamples && !isLoading && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            Exemplos de buscas:
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                onClick={() => handleExampleClick(example)}
              >
                {example}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
