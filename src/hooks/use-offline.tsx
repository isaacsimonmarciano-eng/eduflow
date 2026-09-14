import * as React from "react";
import { isDemoMode } from "@/demo/mode";

export function useOfflineFlag() {
  const [offline, setOffline] = React.useState(() => typeof navigator !== "undefined" ? !navigator.onLine : false);
  React.useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return offline;
}

export function useDemoFlag() {
  const [demo, setDemo] = React.useState(() => isDemoMode());
  // allow toggling when navigator comes back? Keep stable.
  React.useEffect(() => { setDemo(isDemoMode()); }, []);
  return demo;
}
