import { AlertTriangle, WifiOff, RotateCcw } from "lucide-react";
import { isDemoMode } from "@/demo/mode";
import { useDemo } from "@/demo/store";

export function OfflineBanner() {
  const demo = isDemoMode();
  const { resetDemo } = useDemo();
  if (!demo) return null;
  return (
    <div className="sticky top-16 z-20 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-900 sm:px-6 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <span className="inline-flex items-center gap-2 font-semibold">
          <WifiOff className="size-4" /> Mode démo hors-ligne
          <span className="hidden font-normal opacity-80 sm:inline">— fonctionne sans Wi-Fi ni Convex. Tout est sauvegardé sur cet appareil.</span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-amber-800 shadow-sm dark:bg-amber-900 dark:text-amber-100">localhost prêt</span>
        </span>
        <button onClick={() => { if (confirm("Réinitialiser les données démo ?")) resetDemo(); }} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900 dark:hover:bg-amber-900/60">
          <RotateCcw className="size-3.5" /> Réinitialiser la démo
        </button>
      </div>
      <p className="mx-auto mt-1 w-full max-w-6xl text-[11px] leading-relaxed opacity-80 sm:hidden">Fonctionne sans Wi-Fi ni Convex. Données stockées sur cet appareil.</p>
    </div>
  );
}

export function InlineOfflineNote({ feature }: { feature: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
      <span className="inline-flex items-center gap-1.5 font-bold"><AlertTriangle className="size-4" /> Hors-ligne</span>
      <span className="ml-2 text-amber-800/80 dark:text-amber-200/70">{feature} nécessite Internet — en mode démo on utilise un équivalent local.</span>
    </div>
  );
}
