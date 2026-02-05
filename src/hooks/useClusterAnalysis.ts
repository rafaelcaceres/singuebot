import { useState, useCallback, useEffect } from 'react';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export interface ClusterPoint {
  participantId: Id<"participants">;
  x: number;
  y: number;
  cluster: number;
  metadata: {
    name?: string;
    cargo?: string;
    empresa?: string;
    setor?: string;
    programaMarca?: string;
  };
}

export interface ClusterStat {
  clusterId: number;
  count: number;
  label: string;
}

export interface ClusterInsight {
  clusterId: number;
  name: string;
  description: string;
  commonalities: string[];
  count: number;
}

export interface ClusterAnalysisResult {
  points: ClusterPoint[];
  clusterStats: ClusterStat[];
  totalParticipants: number;
  parameters?: {
    minClusterSize: number;
    minSamples: number;
  };
}

export function useClusterAnalysis() {
  const [isGeneratingCache, setIsGeneratingCache] = useState(false);
  const [isClustering, setIsClustering] = useState(false);
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClusterAnalysisResult | null>(null);
  const [insights, setInsights] = useState<ClusterInsight[] | null>(null);
  const [cacheInfo, setCacheInfo] = useState<{ version: string; count: number } | null>(null);
  const [clusteringParams, setClusteringParams] = useState<{ minClusterSize?: number; minSamples?: number } | undefined>(undefined);

  // Query to get cached clustering results
  const cachedClusterResults = useQuery(
    api.functions.participantRAG.getCachedClusterResults,
    clusteringParams || {}
  );

  const generateUMAPCacheAction = useAction(api.functions.participantRAG.generateUMAPCache);
  const runClusteringAction = useAction(api.functions.participantRAG.runClusteringOnCache);
  const generateInsightsAction = useAction(api.functions.participantRAG.generateClusterInsights);

  // Load cached results when available
  useEffect(() => {
    if (cachedClusterResults && !result) {
      console.log('📦 Loading cached clustering results');
      setResult({
        points: cachedClusterResults.points,
        clusterStats: cachedClusterResults.clusterStats,
        totalParticipants: cachedClusterResults.totalParticipants,
        parameters: cachedClusterResults.parameters,
      });
    }
  }, [cachedClusterResults, result]);

  const generateCache = useCallback(async (forceRefresh = false) => {
    setIsGeneratingCache(true);
    setError(null);

    try {
      const result = await generateUMAPCacheAction({ forceRefresh });
      setCacheInfo({ version: result.version, count: result.cached + result.skipped });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate UMAP cache';
      setError(errorMessage);
      console.error('UMAP cache generation error:', err);
      throw err;
    } finally {
      setIsGeneratingCache(false);
    }
  }, [generateUMAPCacheAction]);

  const runClustering = useCallback(async (params?: { minClusterSize?: number; minSamples?: number }) => {
    // Update clustering params to trigger cache query
    setClusteringParams(params);

    // Check if we have cached results for these parameters
    // The useEffect will load them automatically if available
    // If not, proceed with computation

    setIsClustering(true);
    setError(null);

    try {
      const data = await runClusteringAction(params || {});
      setResult(data);

      // Auto-generate insights after clustering
      setIsGeneratingInsights(true);
      try {
        const clusterInsights = await generateInsightsAction({ clusterPoints: data.points });
        setInsights(clusterInsights);
      } catch (insightErr) {
        console.error('Failed to generate insights:', insightErr);
        // Don't fail the whole operation if insights fail
      } finally {
        setIsGeneratingInsights(false);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run clustering';
      setError(errorMessage);
      console.error('Clustering error:', err);
      throw err;
    } finally {
      setIsClustering(false);
    }
  }, [runClusteringAction, generateInsightsAction]);

  const generateClustersWithCache = useCallback(async (params?: {
    minClusterSize?: number;
    minSamples?: number;
    forceRefresh?: boolean;
  }) => {
    try {
      // Only regenerate cache if explicitly requested
      if (params?.forceRefresh) {
        await generateCache(true);
      }

      // Then run clustering (will use cached data)
      await runClustering({
        minClusterSize: params?.minClusterSize,
        minSamples: params?.minSamples,
      });
    } catch (err) {
      // Error already handled in individual functions
    }
  }, [generateCache, runClustering]);

  const clearResults = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    generateCache,
    runClustering,
    generateClustersWithCache,
    clearResults,
    isGeneratingCache,
    isClustering,
    isGeneratingInsights,
    isAnalyzing: isGeneratingCache || isClustering || isGeneratingInsights,
    error,
    result,
    insights,
    cacheInfo,
    hasResults: result !== null && result.points.length > 0,
    // Cache metadata
    isCached: cachedClusterResults !== null && cachedClusterResults !== undefined,
    cacheCreatedAt: cachedClusterResults?.createdAt,
    umapCacheVersion: cachedClusterResults?.umapCacheVersion,
  };
}
