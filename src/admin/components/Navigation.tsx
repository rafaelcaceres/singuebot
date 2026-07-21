import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BookOpen,
  MessageCircle,
  Settings,
  UserCog,
  Headphones,
  Sparkles,
  Network,
  Megaphone,
} from "lucide-react";

type FeatureFlagKey =
  | "enableInterview"
  | "enableClustering"
  | "enableTemplates"
  | "enableBroadcasts"
  | "enableParticipantRAG"
  | "enableCSVImport";

interface MenuItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  featureFlag?: FeatureFlagKey;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

/**
 * Grouped so the sidebar reads as four decisions instead of one flat list of
 * fifteen. Order matches how a coordinator moves through the day: watch, then
 * people, then outbound, then setup.
 */
const menuSections: MenuSection[] = [
  {
    label: "Operação",
    items: [
      {
        title: "Visão geral",
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
    ],
  },
  {
    label: "Participantes",
    items: [
      {
        // No feature flag: the roster is the base record every other flow reads
        // from, including broadcasts.
        title: "Participantes",
        href: "/participants",
        icon: Users,
        roles: ["owner", "editor", "viewer"],
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
    ],
  },
  {
    label: "Mensagens",
    items: [
      {
        title: "Conversas",
        href: "/conversations",
        icon: MessageSquare,
        roles: ["owner", "editor", "viewer"],
      },
      {
        title: "Templates HSM",
        href: "/templates",
        icon: MessageCircle,
        roles: ["owner", "editor"],
        featureFlag: "enableTemplates",
      },
      {
        title: "Disparos",
        href: "/broadcasts",
        icon: Megaphone,
        roles: ["owner", "editor"],
        featureFlag: "enableBroadcasts",
      },
      {
        title: "Conhecimento",
        href: "/knowledge",
        icon: BookOpen,
        roles: ["owner", "editor"],
      },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        title: "Usuários",
        href: "/users",
        icon: UserCog,
        roles: ["owner"],
      },
      {
        title: "Configurações",
        href: "/settings",
        icon: Settings,
        roles: ["owner"],
      },
    ],
  },
];

/** Prefix match so /participants/:id and /broadcasts/:id keep their parent active. */
function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation() {
  const location = useLocation();
  const featureFlags = useQuery(api.functions.botConfig.getFeatureFlags);
  const { user, isLoading } = useAuth();

  const userRole = user?.role ?? "viewer";

  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles.includes(userRole)) return false;
        if (item.featureFlag && featureFlags && !featureFlags[item.featureFlag]) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="w-64 shrink-0 bg-card border-r border-border h-full overflow-y-auto">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Singuê</h2>
      </div>

      {/* Holding the list until the role resolves avoids items flashing in and
          out as the organizer query lands. */}
      {isLoading ? (
        <div className="px-4 py-6 space-y-2" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <nav className="px-3 py-4 space-y-6">
          {visibleSections.map((section) => (
            <div key={section.label}>
              <h3 className="px-3 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h3>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(location.pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
