import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import App from "./App";
import { AdminLayout } from "./admin/layout/AdminLayout";
import Dashboard from "./admin/pages/Dashboard";
import { SignInForm } from "./SignInForm";
import { Conversations } from "./admin/pages/Conversations";
import { KnowledgePage } from "./admin/pages/KnowledgePage";
import { Participants } from "./admin/pages/Participants";
import { UserManagement } from "./admin/pages/UserManagement";
import { TemplatesPage } from "./admin/pages/TemplatesPage";
import DashboardParticipants from "./admin/pages/DashboardParticipants";

function ImportPage() {
  return <div className="p-8">Importar CSV - Em desenvolvimento</div>;
}

function JobsPage() {
  return <div className="p-8">Jobs & Logs - Em desenvolvimento</div>;
}

function SettingsPage() {
  return <div className="p-8">Configurações - Em desenvolvimento</div>;
}

// Component to handle authentication redirects
function AuthRedirectHandler() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated && location.pathname === "/login") {
        // If user is authenticated and on login page, redirect to dashboard
        void navigate("/", { replace: true });
      } else if (!isAuthenticated && location.pathname !== "/login") {
        // If user is not authenticated and not on login page, redirect to login
        void navigate("/login", { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, location.pathname, navigate]);

  return null;
}

export function AppRouter() {  
  return (
    <BrowserRouter>
      <AuthRedirectHandler />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={
          <Unauthenticated>
            <div className="min-h-screen flex items-center justify-center bg-background">
              <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold">WhatsApp AI Assistant</h2>
                  <p className="mt-2 text-muted-foreground">
                    Entre para acessar o painel administrativo
                  </p>
                </div>
                <SignInForm />
              </div>
            </div>
          </Unauthenticated>
        } />

        {/* Main authenticated routes */}
        <Route path="/" element={
          <Authenticated>
            <AdminLayout />
          </Authenticated>
        }>
          {/* Dashboard as home page */}
          <Route index element={<Dashboard />} />
          
          {/* WhatsApp interface moved to /whatsapp */}
          <Route path="whatsapp" element={<App />} />
          
          {/* Admin pages */}
          <Route path="participants" element={<Participants />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="dashboard-participants" element={<DashboardParticipants />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all route for unauthenticated users */}
        <Route path="*" element={
          <Unauthenticated>
            <Navigate to="/login" replace />
          </Unauthenticated>
        } />
      </Routes>
    </BrowserRouter>
  );
}