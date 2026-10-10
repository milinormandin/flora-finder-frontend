"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPlantsPage } from "@/lib/plant-data";
import type { Plant } from "@/types/Plant";
import PlantCard from "./components/PlantCard";
import PageState from "./components/PageState";
import PlantGridSkeleton from "./components/PlantGridSkeleton";

export default function HomePage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requestPending = useRef(true);
  const loadMoreTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    getPlantsPage(offset, controller.signal)
      .then((data) => {
        if (cancelled) return;
        setPlants((current) => offset === 0 ? data.plants : [...current, ...data.plants]);
        setTotal(data.total);
        setNextOffset(data.nextOffset);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) {
          requestPending.current = false;
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [offset, attempt]);

  const loadMore = useCallback(() => {
    if (requestPending.current || error || nextOffset === null) return;
    requestPending.current = true;
    setLoading(true);
    setOffset(nextOffset);
  }, [error, nextOffset]);

  useEffect(() => {
    const target = loadMoreTarget.current;
    if (!target || loading || error || nextOffset === null || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    }, { rootMargin: "400px 0px" });
    observer.observe(target);

    return () => observer.disconnect();
  }, [loading, error, nextOffset, loadMore]);

  const retry = () => {
    if (requestPending.current) return;
    requestPending.current = true;
    setError(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  };

  return (
    <main id="main-content" tabIndex={-1} className="page-container pb-12 pt-10 sm:pb-16 sm:pt-14">
      <header className="mb-9 max-w-2xl sm:mb-11">
        <h1 className="text-4xl leading-[1.12] font-semibold tracking-tight text-foreground sm:text-5xl">
          Explore native plants
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          Get to know Hawaiʻi’s plants, their habitats, and their practical uses.
        </p>
      </header>

      {loading && plants.length === 0 ? (
        <PlantGridSkeleton />
      ) : error && plants.length === 0 ? (
        <PageState
          kind="error"
          title="The collection couldn’t load"
          description="Please try again to explore the plants."
          onRetry={retry}
        />
      ) : plants.length === 0 ? (
        <PageState
          kind="empty"
          title="No plants to show yet"
          description="The collection is empty. Check back for plants to explore."
        />
      ) : (
        <>
          <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
            {plants.map((plant) => (
              <li key={plant.PLANT_ID} className="min-w-0">
                <PlantCard plant={plant} />
              </li>
            ))}
          </ul>
          <div ref={loadMoreTarget} className="mt-8 flex flex-col items-center gap-4 text-center">
            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
              {loading ? "Loading more plants…" : `Showing ${plants.length} of ${total} plants.`}
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                More plants couldn’t load. Please try again.
              </p>
            )}
            {nextOffset !== null && (
              <Button variant="outline" onClick={error ? retry : loadMore} disabled={loading}>
                {loading ? "Loading more plants…" : error ? "Try again" : "Load more plants"}
              </Button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
