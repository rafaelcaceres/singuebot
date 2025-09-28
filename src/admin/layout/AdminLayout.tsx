import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Navigation } from "../components/Navigation";
import { SignOutButton } from "../../SignOutButton";

export function AdminLayout() {
  const location = useLocation();
  const loggedInUser = useQuery(api.auth.loggedInUser);

  console.log("AdminLayout rendering...", { 
    location: location.pathname, 
    loggedInUser,
    userStatus: loggedInUser === undefined ? 'loading' : loggedInUser === null ? 'not-logged' : 'logged-in'
  });

  if (loggedInUser === undefined) {
    console.log("AdminLayout: User loading...");
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (loggedInUser === null) {
    console.log("AdminLayout: User not logged in, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  console.log("AdminLayout: User logged in, rendering layout");

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Navigation />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-6">
            <h2 className="text-xl font-semibold text-primary">WhatsApp AI Assistant</h2>
            <SignOutButton />
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-6 py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}