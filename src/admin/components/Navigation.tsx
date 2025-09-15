import React from "react";
import { Link, useLocation } from "react-router-dom";
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
  Calendar
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    roles: ["owner", "editor", "viewer"]
  },
  {
    title: "Participantes", 
    href: "/admin/participants",
    icon: Users,
    roles: ["owner", "editor", "viewer"]
  },
  {
    title: "Conversas",
    href: "/admin/conversations",
    icon: MessageSquare,
    roles: ["owner", "editor", "viewer"]
  },
  {
    title: "Conhecimento",
    href: "/admin/knowledge", 
    icon: BookOpen,
    roles: ["owner", "editor"]
  },
  {
    title: "Conteúdo",
    href: "/admin/content",
    icon: FileText,
    roles: ["owner", "editor"]
  },
  {
    title: "Templates HSM",
    href: "/admin/templates",
    icon: MessageCircle,
    roles: ["owner", "editor"]
  },
  {
    title: "Importar CSV",
    href: "/admin/import",
    icon: Upload,
    roles: ["owner", "editor"]
  },
  {
    title: "Jobs & Logs",
    href: "/admin/jobs",
    icon: Calendar,
    roles: ["owner", "editor", "viewer"]
  },
  {
    title: "Configurações",
    href: "/admin/settings",
    icon: Settings,
    roles: ["owner"]
  }
];

export function Navigation() {
  const location = useLocation();
  // TODO: Get user role from context/query
  const userRole = "owner"; // Placeholder

  const visibleItems = menuItems.filter(item => 
    item.roles.includes(userRole)
  );

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