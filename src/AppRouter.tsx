import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Authenticated, Unauthenticated } from "convex/react";
import App from "./App";
import { AdminLayout } from "./admin/layout/AdminLayout";
import Dashboard from "./admin/pages/Dashboard";
import { SignInForm } from "./SignInForm";
import { Conversations } from "./admin/pages/Conversations";
import { KnowledgePage } from "./admin/pages/KnowledgePage";
import { Participants } from "./admin/pages/Participants";
import { UserManagement } from "./admin/pages/UserManagement";

// Placeholder components for admin pages - will be implemented later

function ConversationsPage() {
  return <div className="p-8">Conversas - Em desenvolvimento</div>;
}

function ContentPage() {
  return <div className="p-8">Conteúdo - Em desenvolvimento</div>;
}

function TemplatesPage() {
  return <div className="p-8">Templates HSM - Em desenvolvimento</div>;
}

function ImportPage() {
  return <div className="p-8">Importar CSV - Em desenvolvimento</div>;
}

function JobsPage() {
  return <div className="p-8">Jobs & Logs - Em desenvolvimento</div>;
}

function SettingsPage() {
  return <div className="p-8">Configurações - Em desenvolvimento</div>;
}

export function AppRouter() {
  return (
    <BrowserRouter>
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

        {/* Main WhatsApp interface (existing) */}
        <Route path="/" element={<App />} />

        {/* Admin routes */}
        <Route path="/admin" element={
          <Authenticated>
            <AdminLayout />
          </Authenticated>
        }>
          <Route index element={<Dashboard />} />
          <Route path="participants" element={<Participants />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="conversations/:id" element={<ConversationsPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Redirect unauthenticated admin access to login */}
        <Route path="/admin/*" element={
          <Unauthenticated>
            <Navigate to="/login" replace />
          </Unauthenticated>
        } />
      </Routes>
    </BrowserRouter>
  );
}