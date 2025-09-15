import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, MessageSquare, TrendingUp, Clock } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
}

function KPICard({ title, value, description, icon, trend }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className="mt-2">
            <Badge variant={trend === "up" ? "default" : trend === "down" ? "destructive" : "secondary"}>
              {trend === "up" ? "↗" : trend === "down" ? "↘" : "→"} {trend}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  // TODO: Replace with real data from queries
  const kpiData = {
    totalParticipants: 1250,
    active24h: 89,
    responseRate: 87.5,
    p95Latency: 1200
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do sistema de entrevistas com IA
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total de Participantes"
          value={kpiData.totalParticipants}
          description="Usuários cadastrados no sistema"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
          trend="up"
        />
        
        <KPICard
          title="Ativos 24h"
          value={kpiData.active24h}
          description="Conversas ativas nas últimas 24h"
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
          trend="up"
        />
        
        <KPICard
          title="Taxa de Resposta"
          value={`${kpiData.responseRate}%`}
          description="Participantes que respondem mensagens"
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          trend="neutral"
        />
        
        <KPICard
          title="Latência P95"
          value={`${kpiData.p95Latency}ms`}
          description="Tempo de resposta 95º percentil"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          trend={kpiData.p95Latency <= 1500 ? "up" : "down"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimos Eventos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* TODO: Replace with real events */}
              <div className="flex items-center space-x-2">
                <Badge>INFO</Badge>
                <span className="text-sm">Novo participante cadastrado</span>
                <span className="text-xs text-muted-foreground ml-auto">há 2 min</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary">RAG</Badge>
                <span className="text-sm">Documento processado com sucesso</span>
                <span className="text-xs text-muted-foreground ml-auto">há 5 min</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="destructive">ERROR</Badge>
                <span className="text-sm">Falha no envio de HSM template</span>
                <span className="text-xs text-muted-foreground ml-auto">há 12 min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estatísticas por Etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* TODO: Replace with real stage data */}
              {["intro", "ASA", "listas", "pre_evento", "diaD"].map((stage) => (
                <div key={stage} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{stage}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                      {Math.floor(Math.random() * 200)}
                    </span>
                    <div className="w-16 h-2 bg-secondary rounded-full">
                      <div 
                        className="h-2 bg-primary rounded-full" 
                        style={{ width: `${Math.random() * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}