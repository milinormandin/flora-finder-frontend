"use client";

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

// Keep these references explicit so Next.js includes them in the browser bundle.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === "undefined") return null;

  // Firebase is optional for local plant browsing and browser-saved lists.
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    return null;
  }

  // Reuse the default app during Fast Refresh and client-side navigation.
  return getApps().find((app) => app.name === "[DEFAULT]") ?? initializeApp(firebaseConfig);
}
