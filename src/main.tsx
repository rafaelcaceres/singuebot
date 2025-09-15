import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import { AppRouter } from "./AppRouter";
import { Toaster } from "sonner";
import { ThemeProvider } from "./components/theme-provider";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <ConvexAuthProvider client={convex}>
    <ThemeProvider defaultTheme="light" storageKey="whatsapp-ai-theme">
      <AppRouter />
      <Toaster />
    </ThemeProvider>
  </ConvexAuthProvider>,
);
