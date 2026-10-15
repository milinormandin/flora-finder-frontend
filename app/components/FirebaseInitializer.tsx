"use client";

import { useEffect } from "react";
import { getFirebaseApp } from "@/lib/firebase";

export default function FirebaseInitializer() {
  useEffect(() => {
    if (!getFirebaseApp()) {
      console.warn(
        "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_APP_ID in .env.local.",
      );
    }
  }, []);

  return null;
}
