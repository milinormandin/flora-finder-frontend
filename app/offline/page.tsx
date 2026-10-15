import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import OfflineRetry from "@/app/components/OfflineRetry";

export default function OfflinePage() {
  return (
    <main id="main-content" tabIndex={-1} className="page-container py-16 sm:py-24">
      <div className="mx-auto max-w-lg text-center">
        <WifiOff className="mx-auto mb-5 size-8 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">You’re offline</h1>
        <p className="mt-4 leading-7 text-muted-foreground">This page hasn’t been saved on this device yet. You can explore the cached catalog and your plant list, or return to this page when you’re connected.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button nativeButton={false} role="link" render={<Link href="/" />}>Explore cached plants</Button>
          <Button nativeButton={false} role="link" variant="outline" render={<Link href="/plant_list" />}>Open my plant list</Button>
        </div>
        <div className="mt-4"><OfflineRetry /></div>
      </div>
    </main>
  );
}
