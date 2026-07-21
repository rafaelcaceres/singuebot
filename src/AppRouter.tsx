import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { AdminLayout } from "./admin/layout/AdminLayout";
import Dashboard from "./admin/pages/Dashboard";
import { SignInForm } from "./SignInForm";
import { Conversations } from "./admin/pages/Conversations";
import { KnowledgePage } from "./admin/pages/KnowledgePage";
import { Participants } from "./admin/pages/Participants";
import { UserManagement } from "./admin/pages/UserManagement";
import { TemplatesPage } from "./admin/pages/TemplatesPage";
import { ParticipantExplorer } from "./admin/pages/ParticipantExplorer";
import { ParticipantProfile } from "./admin/pages/ParticipantProfile";
import { ParticipantClusters } from "./admin/pages/ParticipantClusters";
import { SettingsPage } from "./admin/pages/SettingsPage";
import { OperatorDashboard } from "./admin/pages/OperatorDashboard";
import { Broadcasts } from "./admin/pages/Broadcasts";
import { BroadcastDetail } from "./admin/pages/BroadcastDetail";
import { RequireFlag } from "./admin/components/RequireFlag";
import { RequireRole } from "./admin/components/RequireRole";

/**
 * Only handles the case AdminLayout can't: bouncing an already-authenticated
 * user off /login. The unauthenticated guard lives in AdminLayout itself.
 */
function AuthRedirectHandler() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated && location.pathname === "/login") {
      void navigate("/", { replace: true });
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
            <div className="min-h-screen flex items-center justify-center bg-background px-6">
              <div className="max-w-md w-full">
                {/* A brand mark, not a second heading — SignInForm owns the
                    page's h1, and the two used to say the same thing twice. */}
                <p className="text-center text-sm font-semibold tracking-tight text-muted-foreground mb-8">
                  Singuê
                </p>
                <SignInForm />
              </div>
            </div>
          </Unauthenticated>
        } />

        {/* Main authenticated routes.
            The Unauthenticated branch is required, not belt-and-braces: the
            AdminLayout guard lives *inside* <Authenticated>, which renders
            nothing when logged out — so without this, a logged-out visitor to
            any admin URL got a blank page instead of the login screen. */}
        <Route path="/" element={
          <>
            <Authenticated>
              <AdminLayout />
            </Authenticated>
            <Unauthenticated>
              <Navigate to="/login" replace />
            </Unauthenticated>
          </>
        }>
          {/* Dashboard as home page */}
          <Route index element={<Dashboard />} />

          {/* Central de Atendimento (substituiu /whatsapp) */}
          <Route path="atendimento" element={<OperatorDashboard />} />

          {/* Every gate below mirrors what Navigation already declares per item.
              The sidebar hid these; the URLs stayed open. */}
          {/* Deliberately NOT gated by enableInterview: the participant roster is
              the base record, and the broadcast flow starts by selecting from it.
              Gating it behind the interview flag made "Novo disparo" bounce to
              the home page whenever interviews were off. */}
          <Route path="participants" element={<Participants />} />
          <Route path="participants/:id" element={<ParticipantProfile />} />
          <Route
            path="relations"
            element={
              <RequireFlag flag="enableParticipantRAG">
                <ParticipantExplorer />
              </RequireFlag>
            }
          />
          <Route
            path="clusters"
            element={
              <RequireFlag flag="enableClustering">
                <ParticipantClusters />
              </RequireFlag>
            }
          />
          <Route path="conversations" element={<Conversations />} />
          <Route
            path="knowledge"
            element={
              <RequireRole roles={["owner", "editor"]}>
                <KnowledgePage />
              </RequireRole>
            }
          />
          <Route
            path="users"
            element={
              <RequireRole roles={["owner"]}>
                <UserManagement />
              </RequireRole>
            }
          />
          <Route
            path="templates"
            element={
              <RequireFlag flag="enableTemplates">
                <RequireRole roles={["owner", "editor"]}>
                  <TemplatesPage />
                </RequireRole>
              </RequireFlag>
            }
          />
          <Route
            path="broadcasts"
            element={
              <RequireFlag flag="enableBroadcasts">
                <Broadcasts />
              </RequireFlag>
            }
          />
          <Route
            path="broadcasts/:id"
            element={
              <RequireFlag flag="enableBroadcasts">
                <BroadcastDetail />
              </RequireFlag>
            }
          />
          <Route
            path="settings"
            element={
              <RequireRole roles={["owner"]}>
                <SettingsPage />
              </RequireRole>
            }
          />
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