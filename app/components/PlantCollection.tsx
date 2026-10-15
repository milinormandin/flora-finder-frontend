"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getPlantsPage } from "@/lib/plant-data";
import type { PlantFilters } from "@/lib/plant-filters";
import type { Plant } from "@/types/Plant";
import PlantCard from "./PlantCard";
import PageState from "./PageState";
import PlantGridSkeleton from "./PlantGridSkeleton";

export default function PlantCollection({ filters, onClearFilters }: {
  filters: PlantFilters;
  onClearFilters: () => void;
}) {
  const { letter, island } = filters;
  const hasFilters = Boolean(letter || island);
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

    getPlantsPage(offset, controller.signal, { letter, island })
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
  }, [offset, attempt, letter, island]);

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

  if (loading && plants.length === 0) return <PlantGridSkeleton />;
  if (error && plants.length === 0) {
    return <PageState kind="error" title="The collection couldn’t load" description="Please try again to explore the plants." onRetry={retry} />;
  }
  if (plants.length === 0) {
    return (
      <PageState
        kind="empty"
        title={hasFilters ? "No plants match these filters" : "No plants to show yet"}
        description={hasFilters ? "Try another letter or island, or clear the filters to explore all plants." : "The collection is empty. Check back for plants to explore."}
        action={hasFilters ? <Button variant="outline" onClick={onClearFilters}>Clear filters</Button> : undefined}
      />
    );
  }

  return (
    <>
      <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy={loading}>
        {plants.map((plant) => (
          <li key={plant.PLANT_ID} className="min-w-0"><PlantCard plant={plant} /></li>
        ))}
      </ul>
      <div ref={loadMoreTarget} className="mt-8 flex flex-col items-center gap-4 text-center">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted-foreground">
          {loading ? "Loading more plants…" : `Showing ${plants.length} of ${total} plants.`}
        </p>
        {error && <p role="alert" className="text-sm text-destructive">More plants couldn’t load. Please try again.</p>}
        {nextOffset !== null && (
          <Button variant="outline" onClick={error ? retry : loadMore} disabled={loading}>
            {loading ? "Loading more plants…" : error ? "Try again" : "Load more plants"}
          </Button>
        )}
      </div>
    </>
  );
}
