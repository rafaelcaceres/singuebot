import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock,
  Brain,
  FileText,
  Activity,
  CheckCircle,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Calendar,
  Zap,
  Target,
  Globe,
  Settings,
  Download,
  Filter
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';

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

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("7d");
  const [refreshing, setRefreshing] = useState(false);

  console.log("Dashboard component rendering...");

  // Enhanced data fetching with new analytics
  const realTimeMetrics = useQuery(api.analytics.getRealTimeMetrics);
  const messageVolumeChart = useQuery(api.analytics.getMessageVolumeChart, { days: timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90 });
  const participantGrowthChart = useQuery(api.analytics.getParticipantGrowthChart, { days: timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90 });
  const interviewAnalytics = useQuery(api.analytics.getInterviewAnalytics);
  const systemHealth = useQuery(api.analytics.getSystemHealth);
  const topParticipants = useQuery(api.analytics.getTopParticipants, { limit: 5 });
  const recentActivity = useQuery(api.analytics.getRecentActivity, { limit: 10 });

  console.log("Query results:", {
    realTimeMetrics,
    messageVolumeChart,
    participantGrowthChart,
    interviewAnalytics,
    systemHealth,
    topParticipants,
    recentActivity
  });

  // Legacy data for backward compatibility
  const kpis = useQuery(api.admin.getDashboardKPIs);
  const aiInteractions = useQuery(api.aiAgent.getAIInteractions, { limit: 5 });
  const knowledgeDocs = useQuery(api.admin.getKnowledgeDocuments);
  const processingJobs = useQuery(api.admin.getProcessingJobs);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => setRefreshing(false), 1000);
  };

  const isLoading = realTimeMetrics === undefined || messageVolumeChart === undefined || participantGrowthChart === undefined || interviewAnalytics === undefined || systemHealth === undefined;

  console.log("isLoading:", isLoading);

  // Show loading state
  if (isLoading) {
    console.log("Showing loading state...");
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span>Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  console.log("Dashboard data loaded, rendering content...");

  // Fallback data when no real data exists
  const fallbackMetrics = {
    participants: {
      total: 0,
      active24h: 0,
      withConsent: 0,
      consentRate: 0,
    },
    messages: {
      total: 0,
      last24h: 0,
      lastWeek: 0,
      lastMonth: 0,
      responseRate: 0,
    },
    ai: {
      totalInteractions: 0,
      interactions24h: 0,
      avgResponseTime: 0,
    },
    interviews: {
      totalSessions: 0,
      activeSessions: 0,
      completionRate: 0,
    },
    knowledge: {
      totalDocs: 0,
      ingestedDocs: 0,
      processingRate: 0,
    },
  };

  const fallbackChartData = [
    { date: new Date().toISOString().split('T')[0], inbound: 0, outbound: 0, participants: 0 }
  ];

  const fallbackSystemHealth = {
    overall: "healthy" as const,
    uptime: "99.9%",
    subsystems: {
      database: { status: "healthy" as const },
      whatsapp: { status: "healthy" as const },
      ai: { status: "healthy" as const },
      processing: { status: "healthy" as const }
    }
  };

  const fallbackInterviewAnalytics = {
    funnel: [
      { stage: "started", count: 0, percentage: 0 },
      { stage: "consent", count: 0, percentage: 0 },
      { stage: "questions", count: 0, percentage: 0 },
      { stage: "completed", count: 0, percentage: 0 }
    ]
  };

  const fallbackRecentActivity: any[] = [];

  // Use fallback data if queries return null/undefined
  const metrics = realTimeMetrics || fallbackMetrics;
  const volumeData = messageVolumeChart || fallbackChartData;
  const growthData = participantGrowthChart || fallbackChartData;
  const healthData = systemHealth || fallbackSystemHealth;
  const interviewData = interviewAnalytics || fallbackInterviewAnalytics;
  const activityData = recentActivity || fallbackRecentActivity;

  const chartColors = {
    primary: "#3b82f6",
    secondary: "#10b981",
    accent: "#f59e0b",
    danger: "#ef4444",
    muted: "#6b7280"
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time insights and analytics for your WhatsApp AI Assistant
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as "7d" | "30d" | "90d")}
            className="px-3 py-2 border rounded-md"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button
             onClick={() => void handleRefresh()}
             disabled={refreshing}
             className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
           >
             <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
             <span>Refresh</span>
           </button>
        </div>
      </div>

      {/* System Health Alert */}
      {healthData.overall !== "healthy" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="text-red-800 font-medium">System Alert</span>
          </div>
          <p className="text-red-700 mt-1">
            Some system components are experiencing issues. Please check the system health section below.
          </p>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Participants"
          value={metrics.participants.total.toLocaleString()}
          description="Registered users"
          icon={<Users className="h-6 w-6" />}
          trend="up"
        />
        <KPICard
          title="24h Message Volume"
          value={metrics.messages.last24h.toLocaleString()}
          description="Messages in last 24 hours"
          icon={<MessageSquare className="h-6 w-6" />}
          trend="up"
        />
        <KPICard
          title="AI Interactions"
          value={metrics.ai.interactions24h.toLocaleString()}
          description="AI responses today"
          icon={<Brain className="h-6 w-6" />}
          trend="up"
        />
        <KPICard
          title="Consent Rate"
          value={`${metrics.participants.consentRate.toFixed(1)}%`}
          description="Users with consent"
          icon={<CheckCircle className="h-6 w-6" />}
          trend="up"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Message Volume Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Message Volume</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="inbound" 
                    stackId="1"
                    stroke={chartColors.primary} 
                    fill={chartColors.primary}
                    fillOpacity={0.6}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="outbound" 
                    stackId="1"
                    stroke={chartColors.secondary} 
                    fill={chartColors.secondary}
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Participant Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Participant Growth</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="participants" 
                    stroke={chartColors.primary}
                    strokeWidth={2}
                    dot={{ fill: chartColors.primary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interview Analytics & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interview Funnel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Interview Completion Funnel</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {interviewData.funnel.map((stage, index) => (
                <div key={stage.stage} className="flex items-center space-x-4">
                  <div className="w-20 text-sm font-medium capitalize">
                    {stage.stage.replace('_', ' ')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">
                        {stage.count} participants
                      </span>
                      <span className="text-sm font-medium">
                        {stage.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${stage.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>System Health</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Overall Status</span>
              <Badge variant={healthData.overall === "healthy" ? "default" : "destructive"}>
                {healthData.overall}
              </Badge>
            </div>
            
            {Object.entries(healthData.subsystems).map(([key, subsystem]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </span>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={subsystem.status === "healthy" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {subsystem.status}
                  </Badge>
                  {subsystem.status === "healthy" && (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            ))}
            
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span>Uptime</span>
                <span className="font-medium">{healthData.uptime}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Activity & Top Participants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activityData.length > 0 ? (
                activityData.slice(0, 8).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      {activity.type === "message" && (
                        <MessageSquare className="h-4 w-4 text-blue-500 mt-1" />
                      )}
                      {activity.type === "ai_interaction" && (
                        <Brain className="h-4 w-4 text-purple-500 mt-1" />
                      )}
                      {activity.type === "new_participant" && (
                        <Users className="h-4 w-4 text-green-500 mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.type === "message" && activity.details?.preview}
                        {activity.type === "ai_interaction" && activity.details?.preview}
                        {activity.type === "new_participant" && `${activity.details?.name} (${activity.details?.phone})`}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Most Active Participants</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topParticipants?.map((item, index) => (
                <div key={item.participant.id} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {index + 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.participant.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.participant.cluster} • {item.metrics.messageCount} messages
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {item.participant.consent && (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Base Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Knowledge Base</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {metrics.knowledge.totalDocs}
              </div>
              <div className="text-sm text-muted-foreground">Total Documents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {metrics.knowledge.ingestedDocs}
              </div>
              <div className="text-sm text-muted-foreground">Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {metrics.knowledge.processingRate}%
              </div>
              <div className="text-sm text-muted-foreground">Processing Rate</div>
            </div>
          </div>
          
          {processingJobs && processingJobs.length > 0 && (
            <div className="mt-6 pt-6 border-t">
              <h4 className="font-medium mb-3">Processing Jobs</h4>
              <div className="space-y-2">
                {processingJobs.slice(0, 3).map((job) => (
                  <div key={job._id} className="flex items-center justify-between">
                    <span className="text-sm truncate">{job.title}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {job.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}