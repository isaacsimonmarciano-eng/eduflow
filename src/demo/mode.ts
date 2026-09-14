/**
 * Détection du mode démo / hors-ligne.
 * - `VITE_DEMO_MODE=true` → forcé (recommandé pour la présentation sans Wi-Fi)
 * - `VITE_CONVEX_URL` manquant → on bascule automatiquement en démo au lieu de crasher
 * - Sinon, si le navigateur est hors-ligne au boot, on informe mais on ne force pas
 */
export function isDemoMode(): boolean {
  const env = import.meta.env as Record<string, string | undefined>;
  if (env.VITE_DEMO_MODE === "true") return true;
  const convexUrl = env.VITE_CONVEX_URL;
  if (!convexUrl || convexUrl.trim() === "") return true;
  return false;
}

export function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.onLine === false;
}

export function demoModeReason(): string | null {
  const env = import.meta.env as Record<string, string | undefined>;
  if (env.VITE_DEMO_MODE === "true") return "VITE_DEMO_MODE=true";
  if (!env.VITE_CONVEX_URL || env.VITE_CONVEX_URL.trim() === "") return "VITE_CONVEX_URL manquant";
  return null;
}
