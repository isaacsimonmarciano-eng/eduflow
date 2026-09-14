import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { DemoRequireAuth } from "@/components/DemoRequireAuth";
import CourseImporter from "@/components/CourseImporter";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";
import { isDemoMode, demoModeReason } from "@/demo/mode";
import { DemoProvider } from "@/demo/store";

// Lazy pages
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const AuthDemo = lazy(() => import("./pages/AuthDemo.tsx"));
const Dashboard = lazy(() => import("./pages/DashboardV2.tsx"));
const DashboardDemo = lazy(() => import("./pages/DashboardDemo.tsx"));
const QuestionsPage = lazy(() => import("./pages/QuestionsPage.tsx"));
const QuestionsDemoPage = lazy(() => import("./pages/QuestionsDemoPage.tsx"));
const OfflineDemo = lazy(() => import("./pages/OfflineDemo.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Chargement…</div>
    </div>
  );
}

class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Erreur d&apos;affichage</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">{this.state.message}</p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage({ type: "iframe-route-change", path: location.pathname }, "*");
  }, [location.pathname]);
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  return null;
}

const DEMO = isDemoMode();
const demoReason = demoModeReason();

if (DEMO) {
  // eslint-disable-next-line no-console
  console.info(`[Cartable Vivant] Mode DÉMO activé — ${demoReason ?? "offline"} — Convex ignoré, données en localStorage.`);
}

const rootEl = document.getElementById("root")!;

if (DEMO) {
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <ToolbarErrorBoundary>
          <VlyToolbar />
        </ToolbarErrorBoundary>
        <DemoProvider>
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/demo" element={<OfflineDemo />} />
                <Route path="/auth" element={<AuthDemo redirectAfterAuth="/dashboard" />} />
                <Route
                  path="/dashboard"
                  element={
                    <DemoRequireAuth>
                      <DashboardDemo />
                    </DemoRequireAuth>
                  }
                />
                <Route
                  path="/questions"
                  element={
                    <DemoRequireAuth>
                      <QuestionsDemoPage />
                    </DemoRequireAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </DemoProvider>
      </RootErrorBoundary>
    </StrictMode>,
  );
} else {
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string;
  const convex = new ConvexReactClient(convexUrl);
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <ToolbarErrorBoundary>
          <VlyToolbar />
        </ToolbarErrorBoundary>
        <ConvexAuthProvider client={convex}>
          <BrowserRouter>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/demo" element={<OfflineDemo />} />
                <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <>
                        <Dashboard />
                        <CourseImporter />
                      </>
                    </RequireAuth>
                  }
                />
                <Route
                  path="/questions"
                  element={
                    <RequireAuth>
                      <QuestionsPage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
        </ConvexAuthProvider>
      </RootErrorBoundary>
    </StrictMode>,
  );
}
