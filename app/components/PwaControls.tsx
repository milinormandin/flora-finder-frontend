"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function subscribeDisplayMode(callback: () => void) {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

const subscribeNever = () => () => {};

function cacheCurrentPage() {
  try {
    navigator.serviceWorker.controller?.postMessage({ type: "CACHE_PAGE", url: window.location.href });
  } catch {
    // The old controller may become redundant while an update takes over.
  }
}

export default function PwaControls() {
  const pathname = usePathname();
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const standalone = useSyncExternalStore(subscribeDisplayMode, isStandalone, () => false);
  const iosSafari = useSyncExternalStore(subscribeNever, isIosSafari, () => false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [setupFailed, setSetupFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIosHelp(false);
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !window.isSecureContext || !("serviceWorker" in navigator)) return;

    let disposed = false;
    let hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;
    let registration: ServiceWorkerRegistration | undefined;
    const cleanupWorkers: (() => void)[] = [];

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onStateChange = () => {
        if (disposed) return;
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(registration?.waiting ?? worker);
        } else if (worker.state === "redundant" && !registration?.active) {
          setSetupFailed(true);
        }
      };
      worker.addEventListener("statechange", onStateChange);
      cleanupWorkers.push(() => worker.removeEventListener("statechange", onStateChange));
    };
    const onUpdateFound = () => watchWorker(registration?.installing ?? null);
    const onControllerChange = () => {
      if (hadController) {
        // Every open tab reloads when an accepted update activates, keeping its assets in sync.
        if (!reloading) {
          reloading = true;
          window.location.reload();
        }
      } else {
        hadController = true;
        cacheCurrentPage();
      }
    };
    const checkForUpdate = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void registration?.update().catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((value) => {
        if (disposed) return;
        registration = value;
        if (value.waiting) setWaitingWorker(value.waiting);
        watchWorker(value.installing);
        value.addEventListener("updatefound", onUpdateFound);
        if (navigator.serviceWorker.controller) cacheCurrentPage();
      })
      .catch(() => {
        if (!disposed) setSetupFailed(true);
      });

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      registration?.removeEventListener("updatefound", onUpdateFound);
      cleanupWorkers.forEach((cleanup) => cleanup());
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) cacheCurrentPage();
  }, [pathname]);

  const install = async () => {
    setActionError(null);
    if (!installPrompt) {
      setShowIosHelp((value) => !value);
      return;
    }
    const prompt = installPrompt;
    setInstallPrompt(null);
    setInstalling(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setActionError("Installation couldn’t start. Try your browser’s install option.");
    } finally {
      setInstalling(false);
    }
  };

  const update = () => {
    if (!waitingWorker || updating || !online) return;
    setUpdating(true);
    setActionError(null);
    try {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } catch {
      setUpdating(false);
      setActionError("The update couldn’t start. Reload the page to try again.");
    }
  };

  const canInstall = !standalone && !installed && (Boolean(installPrompt) || iosSafari);
  if (online && !canInstall && !installing && !waitingWorker && !setupFailed && !actionError) return null;

  return (
    <aside aria-label="App options" className="border-b border-border bg-secondary/40">
      <div className="page-container flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3">
        <div className="min-w-0 flex-1 text-sm leading-6" role="status" aria-live="polite">
          {!online ? (
            <p className="flex items-start gap-2"><WifiOff className="mt-1 size-4 shrink-0" aria-hidden="true" /><span>You’re offline. Browse the catalog, your saved list, and previously opened plant pages. Photos and maps need an internet connection.</span></p>
          ) : waitingWorker ? (
            <p>A new version of Flora Finder is ready.</p>
          ) : setupFailed ? (
            <p>Offline access couldn’t be prepared. Reload when connected to try again.</p>
          ) : (
            <p>Keep Flora Finder on your home screen for your next outing.</p>
          )}
          {actionError && <p>{actionError}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {waitingWorker && <Button size="sm" onClick={update} disabled={updating || !online}><RefreshCw aria-hidden="true" />{updating ? "Updating…" : "Update app"}</Button>}
          {(canInstall || installing) && <Button variant="outline" size="sm" onClick={install} disabled={installing} aria-expanded={iosSafari ? showIosHelp : undefined} aria-controls={iosSafari ? "pwa-install-instructions" : undefined}><Download aria-hidden="true" />{installing ? "Installing…" : "Install app"}</Button>}
        </div>
        {showIosHelp && canInstall && <p id="pwa-install-instructions" className="w-full text-sm leading-6" role="note">In Safari, tap Share, then Add to Home Screen to install Flora Finder.</p>}
      </div>
    </aside>
  );
}
