import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Navigation } from "../components/Navigation";
import { SignOutButton } from "../../SignOutButton";
import { ThemeToggle } from "../../components/ThemeToggle";

/**
 * Routes that are full-height workspaces rather than documents: they manage
 * their own scrolling regions and must not sit inside the padded, scrolling
 * container the rest of the console uses.
 */
const FULL_BLEED_ROUTES = ["/atendimento"];

export function AdminLayout() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const location = useLocation();

  const isFullBleed = FULL_BLEED_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`)
  );

  if (loggedInUser === undefined) {
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
    return <Navigate to="/login" replace />;
  }

  // A real app shell: the viewport is the frame, and scrolling happens inside
  // <main>. Before this the root was `min-h-screen` with nothing constraining
  // height, so `overflow-auto` never engaged — a long message thread grew the
  // whole document instead of scrolling in place.
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Navigation />
      <div className="flex-1 flex flex-col min-w-0">
        {/* The sidebar already carries the product name — this bar carries the
            account and its controls, not a second logo. */}
        <header className="shrink-0 h-16 flex justify-end items-center gap-2 border-b border-border bg-background px-6">
          <span className="text-sm text-muted-foreground mr-1 truncate max-w-[16rem]">
            {loggedInUser.email ?? loggedInUser.name ?? "Sessão ativa"}
          </span>
          <ThemeToggle />
          <SignOutButton />
        </header>
        <main className={`flex-1 min-h-0 ${isFullBleed ? "overflow-hidden" : "overflow-auto"}`}>
          {isFullBleed ? (
            <Outlet />
          ) : (
            <div className="container mx-auto px-6 py-8">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
