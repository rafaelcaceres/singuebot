import React, { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import {
  Users,
  MessageSquare,
  Brain,
  FileText,
  Activity,
  AlertCircle,
  Loader2,
  Target,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { stageLabel } from "@/admin/lib/stages";
import { StatCluster } from "../components/StatCluster";

type TimeRange = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<TimeRange, number> = { "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABELS: Record<TimeRange, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

const HEALTH_LABELS: Record<string, string> = {
  healthy: "Operando",
  idle: "Sem atividade",
  processing: "Processando",
  degraded: "Degradado",
};

const HEALTH_TONES: Record<string, StatusTone> = {
  healthy: "success",
  idle: "neutral",
  processing: "info",
  degraded: "warning",
};

const SUBSYSTEM_LABELS: Record<string, string> = {
  messageProcessing: "Mensagens",
  aiProcessing: "Respostas da IA",
  knowledgeProcessing: "Base de conhecimento",
};

// Recharts writes these straight into SVG fill/stroke, so they must be complete
// colors — `var(--primary)` alone is the bare OKLCH triplet `L C H`, which SVG
// can't parse and silently renders black. That was the grey-blob bug.
const CHART = {
  primary: "oklch(var(--primary))",
  success: "oklch(var(--success))",
  grid: "oklch(var(--border))",
  axis: "oklch(var(--muted-foreground))",
};

const CHART_TOOLTIP = {
  background: "oklch(var(--popover))",
  border: "1px solid oklch(var(--border))",
  borderRadius: "var(--radius)",
  color: "oklch(var(--popover-foreground))",
  fontSize: "12px",
} as const;

function ChartEmpty({ label }: { label: string }) {
  return (
    <div className="h-48 flex items-center justify-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function RecentActivity({ items }: { items: any[] | undefined }) {
  if (!items || items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          Mensagens e novos participantes aparecem aqui conforme chegam.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border -mt-1">
      {items.slice(0, 8).map((activity, index) => (
        <li key={index} className="flex items-start gap-3 py-2">
          <span className="shrink-0 mt-0.5 text-muted-foreground">
            {activity.type === "message" && <MessageSquare className="h-4 w-4" />}
            {activity.type === "ai_interaction" && <Brain className="h-4 w-4" />}
            {activity.type === "new_participant" && <Users className="h-4 w-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm">{activity.description}</p>
            <p className="text-xs text-muted-foreground truncate">
              {activity.type === "new_participant"
                ? `${activity.details?.name ?? "Sem nome"} (${activity.details?.phone ?? "—"})`
                : activity.details?.preview}
            </p>
          </div>
          <time
            dateTime={new Date(activity.timestamp).toISOString()}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {new Date(activity.timestamp).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </li>
      ))}
    </ul>
  );
}

/**
 * The console's one panel: a flat bordered surface with an optional titled
 * header. The dashboard used to mix these with shadcn `<Card>` (which adds a
 * shadow) on the same page — two container languages the redesign had removed
 * everywhere else.
 */
function Panel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-card ${className ?? ""}`}>
      {title && (
        <div className="flex items-center gap-2 px-5 pt-4 pb-2 text-sm font-medium text-foreground">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          {title}
        </div>
      )}
      <div className="px-5 pb-5 pt-1">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const featureFlags = useQuery(api.functions.botConfig.getFeatureFlags);
  const interviewEnabled = featureFlags?.enableInterview ?? false;
  const participantRAGEnabled = featureFlags?.enableParticipantRAG ?? false;

  const days = RANGE_DAYS[timeRange];

  // What needs a human right now — the reason this page exists.
  const operatorMetrics = useQuery(api.operatorDashboard.getOperatorMetrics);
  const attentionConversations = useQuery(
    api.operatorDashboard.getOperatorConversations,
    { filter: "needs_attention", limit: 5 }
  );

  const realTimeMetrics = useQuery(api.analytics.getRealTimeMetrics);
  const messageVolumeChart = useQuery(api.analytics.getMessageVolumeChart, { days });
  const participantGrowthChart = useQuery(
    api.analytics.getParticipantGrowthChart,
    interviewEnabled ? { days } : "skip"
  );
  const interviewAnalytics = useQuery(
    api.analytics.getInterviewAnalytics,
    interviewEnabled ? {} : "skip"
  );
  const systemHealth = useQuery(api.analytics.getSystemHealth);
  const recentActivity = useQuery(api.analytics.getRecentActivity, { limit: 10 });
  const ragStats = useQuery(
    api.functions.participantRAG.getRAGStats,
    participantRAGEnabled ? undefined : "skip"
  );

  const isLoading =
    realTimeMetrics === undefined ||
    messageVolumeChart === undefined ||
    systemHealth === undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando painel...</span>
        </div>
      </div>
    );
  }

  if (realTimeMetrics === null || messageVolumeChart === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Não foi possível carregar o painel</h2>
          <p className="text-sm text-muted-foreground">
            As consultas de métricas falharam. Recarregue a página; se persistir, verifique
            os logs do backend.
          </p>
        </div>
      </div>
    );
  }

  const metrics = realTimeMetrics;
  const needsAttention = operatorMetrics?.needsAttention ?? 0;
  const unread = operatorMetrics?.unread ?? 0;
  const attentionList = attentionConversations ?? [];
  const hasVolume = (messageVolumeChart ?? []).some(
    (d: any) => (d.inbound ?? 0) > 0 || (d.outbound ?? 0) > 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            O que o assistente está fazendo e o que precisa de você.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {(Object.keys(RANGE_LABELS) as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeRange(range)}
              aria-pressed={timeRange === range}
              className="h-7 px-3 text-xs"
            >
              {RANGE_LABELS[range]}
            </Button>
          ))}
        </div>
      </div>

      {/* 1. Precisa de atenção agora. The hero, and the only thing here that is
             ever urgent. */}
      <section aria-labelledby="attention-heading">
        <div
          className={
            needsAttention > 0
              ? "rounded-lg border border-border bg-warning-muted p-5"
              : "rounded-lg border border-border bg-card p-5"
          }
        >
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h2
                id="attention-heading"
                className={
                  needsAttention > 0
                    ? "text-sm font-medium text-warning-muted-foreground"
                    : "text-sm font-medium text-muted-foreground"
                }
              >
                Precisa de atenção agora
              </h2>
              <div className="flex items-baseline gap-3 mt-1">
                <span
                  className={
                    needsAttention > 0
                      ? "text-4xl font-semibold tabular-nums text-warning-muted-foreground"
                      : "text-4xl font-semibold tabular-nums text-foreground"
                  }
                >
                  {needsAttention}
                </span>
                <span
                  className={
                    needsAttention > 0
                      ? "text-sm text-warning-muted-foreground/90"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {needsAttention === 1
                    ? "conversa aguardando um humano"
                    : "conversas aguardando um humano"}
                  {unread > 0 && ` · ${unread} mensagem${unread > 1 ? "s" : ""} não lida${unread > 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
            <Button asChild variant={needsAttention > 0 ? "default" : "outline"}>
              <Link to="/atendimento?filter=needs_attention" className="gap-2">
                Abrir Central de Atendimento
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {attentionList.length > 0 && (
            <ul className="mt-4 pt-4 border-t border-border/60 divide-y divide-border/60">
              {attentionList.map((conversation: any) => (
                <li key={conversation.participantId}>
                  <Link
                    to={`/atendimento?participant=${conversation.participantId}`}
                    className="flex items-center justify-between gap-4 py-2 text-sm rounded hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring px-2 -mx-2"
                  >
                    <span className="font-medium truncate">
                      {conversation.participantName || conversation.participantPhone}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {conversation.lastMessageAt
                        ? new Date(conversation.lastMessageAt).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 2. Estado do sistema. Every status below is derived from real activity;
             nothing here is asserted. */}
      <section aria-labelledby="health-heading" className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 id="health-heading" className="text-sm font-medium text-muted-foreground">
            Estado do sistema
          </h2>
          {systemHealth && (
            <StatusBadge tone={HEALTH_TONES[systemHealth.overall] ?? "neutral"} dot>
              {HEALTH_LABELS[systemHealth.overall] ?? systemHealth.overall}
            </StatusBadge>
          )}
        </div>

        <div className="rounded-lg border border-border divide-y divide-border">
          {systemHealth &&
            Object.entries(systemHealth.subsystems).map(([key, subsystem]) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm">{SUBSYSTEM_LABELS[key] ?? key}</span>
                <StatusBadge tone={HEALTH_TONES[subsystem.status] ?? "neutral"} dot>
                  {HEALTH_LABELS[subsystem.status] ?? subsystem.status}
                </StatusBadge>
              </div>
            ))}
        </div>

        <StatCluster
          stats={[
            {
              label: "Participantes cadastrados",
              value: metrics.participants.total.toLocaleString("pt-BR"),
              icon: Users,
            },
            {
              label: "Mensagens nas últimas 24h",
              value: metrics.messages.last24h.toLocaleString("pt-BR"),
              icon: MessageSquare,
            },
            {
              label: "Respostas da IA hoje",
              value: metrics.ai.interactions24h.toLocaleString("pt-BR"),
              icon: Brain,
            },
            ...(participantRAGEnabled
              ? [
                  {
                    label: "Participantes indexados",
                    value: (ragStats?.totalParticipants ?? 0).toLocaleString("pt-BR"),
                    icon: Sparkles,
                  } as const,
                ]
              : []),
          ]}
        />
      </section>

      {/* 3. Atividade ao longo do tempo. */}
      <section aria-labelledby="activity-heading" className="space-y-3">
        <h2 id="activity-heading" className="text-sm font-medium text-muted-foreground">
          Atividade nos últimos {RANGE_LABELS[timeRange]}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel title="Volume de mensagens">
            {hasVolume ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={messageVolumeChart} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="date" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Area
                      type="monotone"
                      dataKey="inbound"
                      name="Recebidas"
                      stackId="1"
                      stroke={CHART.primary}
                      fill={CHART.primary}
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="outbound"
                      name="Enviadas"
                      stackId="1"
                      stroke={CHART.success}
                      fill={CHART.success}
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ChartEmpty label="Sem mensagens neste período." />
            )}
          </Panel>

          {interviewEnabled && participantGrowthChart ? (
            <Panel title="Crescimento de participantes">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={participantGrowthChart} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="date" stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={CHART.axis} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                    <Line
                      type="monotone"
                      dataKey="participants"
                      name="Participantes"
                      stroke={CHART.primary}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          ) : (
            <Panel title="Atividade recente" icon={Activity}>
              <RecentActivity items={recentActivity} />
            </Panel>
          )}
        </div>
      </section>

      {/* 4. Blocos condicionais — só aparecem quando há o que mostrar. */}
      {(interviewEnabled && interviewAnalytics) || (interviewEnabled && participantGrowthChart) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {interviewEnabled && interviewAnalytics && (
            <Panel title="Funil da entrevista" icon={Target}>
              <div className="space-y-3">
                {interviewAnalytics.funnel.map((stage: any) => (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span>{stageLabel(stage.stage)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {stage.count} · {stage.percentage}%
                      </span>
                    </div>
                    <div
                      className="w-full bg-muted rounded-full h-1.5"
                      role="progressbar"
                      aria-valuenow={stage.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${stageLabel(stage.stage)}: ${stage.percentage}%`}
                    >
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* When the growth chart took the right slot above, activity moves here. */}
          {interviewEnabled && participantGrowthChart && (
            <Panel title="Atividade recente" icon={Activity}>
              <RecentActivity items={recentActivity} />
            </Panel>
          )}
        </div>
      ) : null}

      {/* 5. Base de conhecimento. */}
      <section aria-labelledby="knowledge-heading" className="space-y-3">
        <h2
          id="knowledge-heading"
          className="text-sm font-medium text-muted-foreground flex items-center gap-2"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Base de conhecimento
        </h2>
        <StatCluster
          className="md:grid-cols-3"
          stats={[
            { label: "Documentos", value: metrics.knowledge.totalDocs, icon: FileText },
            {
              label: "Processados",
              value: metrics.knowledge.ingestedDocs,
              icon: Sparkles,
              tone: "success",
            },
            {
              label: "Taxa de processamento",
              value: `${metrics.knowledge.processingRate}%`,
            },
          ]}
        />
      </section>
    </div>
  );
}
