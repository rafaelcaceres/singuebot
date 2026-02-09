import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BookOpen,
  FileText,
  MessageCircle,
  Upload,
  Settings,
  Calendar,
  UserCog,
  Headphones,
  BarChart3,
  Sparkles,
  Network
} from "lucide-react";

type FeatureFlagKey = "enableInterview" | "enableClustering" | "enableTemplates" | "enableParticipantRAG" | "enableCSVImport";

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  featureFlag?: FeatureFlagKey;
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
    roles: ["owner", "editor", "viewer"],
  },
  {
    title: "Central de Atendimento",
    href: "/atendimento",
    icon: Headphones,
    roles: ["owner", "editor", "viewer"],
  },
  {
    title: "Participantes",
    href: "/participants",
    icon: Users,
    roles: ["owner", "editor", "viewer"],
    featureFlag: "enableInterview",
  },
  {
    title: "Explorador",
    href: "/relations",
    icon: Sparkles,
    roles: ["owner", "editor", "viewer"],
    featureFlag: "enableParticipantRAG",
  },
  {
    title: "Clusters",
    href: "/clusters",
    icon: Network,
    roles: ["owner", "editor", "viewer"],
    featureFlag: "enableClustering",
  },
  {
    title: "Dashboard Participantes",
    href: "/dashboard-participants",
    icon: BarChart3,
    roles: ["owner", "editor", "viewer"],
    featureFlag: "enableInterview",
  },
  {
    title: "Conversas",
    href: "/conversations",
    icon: MessageSquare,
    roles: ["owner", "editor", "viewer"],
  },
  {
    title: "Conhecimento",
    href: "/knowledge",
    icon: BookOpen,
    roles: ["owner", "editor"],
  },
  {
    title: "Usuários",
    href: "/users",
    icon: UserCog,
    roles: ["owner"],
  },
  {
    title: "Conteúdo",
    href: "/content",
    icon: FileText,
    roles: ["owner", "editor"],
    featureFlag: "enableInterview",
  },
  {
    title: "Templates HSM",
    href: "/templates",
    icon: MessageCircle,
    roles: ["owner", "editor"],
    featureFlag: "enableTemplates",
  },
  {
    title: "Importar CSV",
    href: "/import",
    icon: Upload,
    roles: ["owner", "editor"],
    featureFlag: "enableCSVImport",
  },
  {
    title: "Jobs & Logs",
    href: "/jobs",
    icon: Calendar,
    roles: ["owner", "editor", "viewer"],
  },
  {
    title: "Configurações",
    href: "/settings",
    icon: Settings,
    roles: ["owner"],
  },
];

export function Navigation() {
  const location = useLocation();
  const featureFlags = useQuery(api.functions.botConfig.getFeatureFlags);

  // User role check - currently all users have admin access
  const userRole = "owner"; // Placeholder

  const visibleItems = menuItems.filter(item => {
    if (!item.roles.includes(userRole)) return false;
    // Hide items whose feature flag is disabled
    if (item.featureFlag && featureFlags && !featureFlags[item.featureFlag]) return false;
    return true;
  });

  return (
    <div className="w-64 bg-card border-r border-border min-h-screen">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-foreground">Admin</h2>
      </div>
      
      <nav className="px-4 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}