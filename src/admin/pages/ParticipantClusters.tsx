import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Users,
  TrendingUp,
  Filter,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { useClusterAnalysis, ClusterPoint } from '@/hooks/useClusterAnalysis';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const CLUSTER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // orange
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange-dark
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#6366f1', // indigo
  '#a855f7', // violet
];

const NOISE_COLOR = '#9ca3af'; // gray for noise points

function getClusterColor(clusterId: number): string {
  if (clusterId === -1) return NOISE_COLOR;
  return CLUSTER_COLORS[clusterId % CLUSTER_COLORS.length];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ClusterPoint;
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const clusterLabel = data.cluster === -1 ? 'Ruído' : `Cluster ${data.cluster + 1}`;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs">
      <div className="space-y-2">
        <div>
          <p className="font-semibold text-sm">{data.metadata.name || 'Sem nome'}</p>
          <Badge
            style={{
              backgroundColor: getClusterColor(data.cluster),
              color: 'white',
            }}
            className="text-xs mt-1"
          >
            {clusterLabel}
          </Badge>
        </div>
        {data.metadata.cargo && (
          <p className="text-xs text-gray-600">
            <span className="font-medium">Cargo:</span> {data.metadata.cargo}
          </p>
        )}
        {data.metadata.empresa && (
          <p className="text-xs text-gray-600">
            <span className="font-medium">Empresa:</span> {data.metadata.empresa}
          </p>
        )}
        {data.metadata.setor && (
          <p className="text-xs text-gray-600">
            <span className="font-medium">Setor:</span> {data.metadata.setor}
          </p>
        )}
        {data.metadata.programaMarca && (
          <p className="text-xs text-gray-600">
            <span className="font-medium">Programa:</span> {data.metadata.programaMarca}
          </p>
        )}
      </div>
    </div>
  );
}

export function ParticipantClusters() {
  const navigate = useNavigate();
  const {
    generateClustersWithCache,
    runClustering,
    generateCache,
    isAnalyzing,
    isGeneratingCache,
    isClustering,
    isGeneratingInsights,
    error,
    result,
    insights,
    hasResults,
    cacheInfo,
    isCached,
    cacheCreatedAt,
    umapCacheVersion,
  } = useClusterAnalysis();

  // Get participant count for calculating dynamic defaults
  const totalParticipants = useQuery(api.functions.participantRAG.getParticipantCount) ?? 0;

  // Calculate dynamic defaults using same logic as backend
  const getRecommendedMinClusterSize = () => Math.max(3, Math.floor(totalParticipants * 0.01));
  const getRecommendedMinSamples = (minClusterSize: number) => Math.max(1, Math.floor(minClusterSize / 5));

  const [selectedClusters, setSelectedClusters] = useState<Set<number>>(new Set());
  const [chartSize, setChartSize] = useState<'normal' | 'fullscreen'>('normal');
  const [minClusterSize, setMinClusterSize] = useState<number>(10);
  const [minSamples, setMinSamples] = useState<number>(3);
  const [useRecommended, setUseRecommended] = useState<boolean>(true);

  // Update defaults when totalParticipants changes and we're using recommended
  useEffect(() => {
    if (useRecommended && totalParticipants > 0) {
      const recommendedMinClusterSize = getRecommendedMinClusterSize();
      const recommendedMinSamples = getRecommendedMinSamples(recommendedMinClusterSize);
      setMinClusterSize(recommendedMinClusterSize);
      setMinSamples(recommendedMinSamples);
    }
  }, [totalParticipants, useRecommended]);

  useEffect(() => {
    // Auto-generate clusters on mount with recommended parameters
    if (totalParticipants > 0 && minClusterSize > 0) {
      void generateClustersWithCache({
        minClusterSize,
        minSamples,
      });
    }
  }, []); // Only run on mount

  useEffect(() => {
    // Select all clusters by default when results arrive
    if (result && result.clusterStats.length > 0) {
      setSelectedClusters(new Set(result.clusterStats.map((s) => s.clusterId)));
    }
  }, [result]);

  const handleRefreshCache = () => {
    void generateCache(true);
  };

  const handleReCluster = () => {
    void runClustering({ minClusterSize, minSamples });
  };

  const handleUseRecommended = () => {
    setUseRecommended(true);
    const recommendedMinClusterSize = getRecommendedMinClusterSize();
    const recommendedMinSamples = getRecommendedMinSamples(recommendedMinClusterSize);
    setMinClusterSize(recommendedMinClusterSize);
    setMinSamples(recommendedMinSamples);
  };

  const handleMinClusterSizeChange = (value: number) => {
    setMinClusterSize(value);
    setUseRecommended(false);
  };

  const handleMinSamplesChange = (value: number) => {
    setMinSamples(value);
    setUseRecommended(false);
  };

  const toggleCluster = (clusterId: number) => {
    setSelectedClusters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clusterId)) {
        newSet.delete(clusterId);
      } else {
        newSet.add(clusterId);
      }
      return newSet;
    });
  };

  const selectAllClusters = () => {
    if (result) {
      setSelectedClusters(new Set(result.clusterStats.map((s) => s.clusterId)));
    }
  };

  const deselectAllClusters = () => {
    setSelectedClusters(new Set());
  };

  const handlePointClick = (point: ClusterPoint) => {
    void navigate(`/participants/${point.participantId}`);
  };

  // Filter points based on selected clusters
  const filteredPoints = result?.points.filter((p) => selectedClusters.has(p.cluster)) || [];

  if (isAnalyzing) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-lg font-semibold">Analisando participantes...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Gerando embeddings, aplicando UMAP e HDBSCAN
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Erro ao gerar clusters</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={handleRefreshCache} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasResults || !result) {
    return (
      <div className="p-6">
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <h3 className="font-semibold text-lg mb-2">Nenhum cluster encontrado</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Não há participantes suficientes para análise de clusters
              </p>
              <Button onClick={handleRefreshCache}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Clusters de Participantes
            </h1>
            <p className="text-muted-foreground mt-1">
              Visualização de similaridade usando UMAP + HDBSCAN
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefreshCache} variant="outline" disabled={isGeneratingCache}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingCache ? 'animate-spin' : ''}`} />
              Regenerar Cache
            </Button>
          </div>
        </div>

        {/* Cache Info */}
        {isCached && cacheCreatedAt && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    Resultados em cache
                  </p>
                  <p className="text-xs text-green-700">
                    Gerado em {new Date(cacheCreatedAt).toLocaleString('pt-BR')}
                    {umapCacheVersion && ` • Versão: ${umapCacheVersion.slice(0, 20)}...`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clustering Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Parâmetros de Clustering (HDBSCAN)</CardTitle>
            <CardDescription>
              Ajuste os parâmetros e clique em "Reclusterizar" para ver os resultados instantaneamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Tamanho Mínimo do Cluster
                    <span className="text-muted-foreground ml-2">({minClusterSize})</span>
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="50"
                    value={minClusterSize}
                    onChange={(e) => handleMinClusterSizeChange(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Menor = mais clusters pequenos
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Amostras Mínimas
                    <span className="text-muted-foreground ml-2">({minSamples})</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={minSamples}
                    onChange={(e) => handleMinSamplesChange(Number(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Menor = clusters menos densos
                  </p>
                </div>
                <Button
                  onClick={handleReCluster}
                  disabled={isClustering}
                  className="w-full"
                >
                  {isClustering && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reclusterizar
                </Button>
              </div>

              {!useRecommended && totalParticipants > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-900">
                      Você está usando parâmetros personalizados.
                      <span className="ml-1 text-amber-700">
                        Recomendado: minClusterSize={getRecommendedMinClusterSize()}, minSamples={getRecommendedMinSamples(getRecommendedMinClusterSize())}
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={handleUseRecommended}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0 border-amber-300 hover:bg-amber-100"
                  >
                    Usar Recomendados
                  </Button>
                </div>
              )}
            </div>
            {result?.parameters && (
              <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
                <strong>Parâmetros atuais:</strong> minClusterSize={result.parameters.minClusterSize}, minSamples={result.parameters.minSamples}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Participantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{result.totalParticipants}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Clusters Encontrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {result.clusterStats.filter((s) => s.clusterId !== -1).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pontos Selecionados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredPoints.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1  gap-6">
        {/* Cluster List Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtrar Clusters
            </CardTitle>
            <CardDescription>
              Clique para mostrar/ocultar clusters
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button onClick={selectAllClusters} variant="outline" size="sm" className="flex-1 text-xs">
                Todos
              </Button>
              <Button onClick={deselectAllClusters} variant="outline" size="sm" className="flex-1 text-xs">
                Nenhum
              </Button>
            </div>
            <Separator />
            <div className="space-y-2 max-h-[600px] overflow-y-auto grid grid-cols-3 gap-2">
              {result.clusterStats.map((stat) => {
                const insight = insights?.find(i => i.clusterId === stat.clusterId);
                return (
                  <button
                    key={stat.clusterId}
                    onClick={() => toggleCluster(stat.clusterId)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedClusters.has(stat.clusterId)
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getClusterColor(stat.clusterId) }}
                        />
                        <div className="text-left">
                          <p className="text-sm font-medium">
                            {insight ? insight.name : stat.label}
                          </p>
                          <p className="text-xs text-muted-foreground">{stat.count} participantes</p>
                        </div>
                      </div>
                      {selectedClusters.has(stat.clusterId) && (
                        <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    {insight && (
                      <div className="mt-2 text-left">
                        <p className="text-xs text-gray-600">{insight.description}</p>
                        {insight.commonalities.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {insight.commonalities.slice(0, 2).map((trait, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {trait}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
              {isGeneratingInsights && (
                <div className="text-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-xs text-muted-foreground mt-1">Gerando insights com AI...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scatter Plot */}
        <Card className={`lg:col-span-3 ${chartSize === 'fullscreen' ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Mapa de Similaridade</CardTitle>
                <CardDescription>
                  Cada ponto representa um participante. Pontos próximos são similares.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChartSize(chartSize === 'normal' ? 'fullscreen' : 'normal')}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: chartSize === 'fullscreen' ? 'calc(100vh - 200px)' : '600px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="x" name="UMAP-1" />
                  <YAxis type="number" dataKey="y" name="UMAP-2" />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter
                    name="Participantes"
                    data={filteredPoints}
                    onClick={(data: ClusterPoint) => handlePointClick(data)}
                    cursor="pointer"
                  >
                    {filteredPoints.map((point, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getClusterColor(point.cluster)}
                        opacity={0.8}
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estatísticas dos Clusters</CardTitle>
          <CardDescription>
            Distribuição de participantes por cluster
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {result.clusterStats.map((stat) => {
              const percentage = (stat.count / result.totalParticipants) * 100;
              return (
                <div key={stat.clusterId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getClusterColor(stat.clusterId) }}
                      />
                      <span className="font-medium">{stat.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stat.count} participantes ({percentage.toFixed(1)}%)
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: getClusterColor(stat.clusterId),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
