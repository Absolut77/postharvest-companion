import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { UserBadge } from "@/components/user-badge";
import { Toaster } from "@/components/ui/sonner";
import { actions } from "@/lib/store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">Page introuvable.</p>
        <a href="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Accueil</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Erreur de chargement</h1>
      <button
        onClick={() => { router.invalidate(); reset(); }}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        Réessayer
      </button>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PostHarvest Central — Gestion post-récolte" },
      { name: "description", content: "Outil interne de suivi post-récolte : journal des mouvements, inventaire bulk, curing, packaging et rapports." },
      { property: "og:title", content: "PostHarvest Central" },
      { property: "og:description", content: "Outil interne de suivi post-récolte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { actions.seedDemo(); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center gap-3 border-b bg-card px-3 shrink-0">
              <SidebarTrigger />
              <div className="font-semibold text-sm">PostHarvest Central</div>
              <div className="text-xs text-muted-foreground hidden sm:block">Suivi post-récolte</div>
              <div className="ml-auto"><UserBadge /></div>
            </header>
            <main className="flex-1 min-w-0"><Outlet /></main>
          </div>
        </div>
        <Toaster position="top-right" richColors />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
