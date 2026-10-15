"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflineRetry() {
  return <Button variant="ghost" onClick={() => window.location.reload()}><RefreshCw aria-hidden="true" />Try this page again</Button>;
}
