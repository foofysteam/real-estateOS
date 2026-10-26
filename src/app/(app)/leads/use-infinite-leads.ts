"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { leadFiltersToSearchParams, type LeadFilters, type LeadListItemDTO, type LeadPage } from "@/lib/leads/filters";

/**
 * Pages after the server-rendered first one. Loads when `sentinelRef` scrolls near the viewport;
 * where IntersectionObserver is missing (jsdom, old browsers) callers fall back to `loadMore`.
 */
export function useInfiniteLeads(filters: LeadFilters, initial: LeadPage<LeadListItemDTO>) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    setError(false);
    try {
      const params = leadFiltersToSearchParams(filters);
      params.set("cursor", cursor);
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = (await res.json()) as LeadPage<LeadListItemDTO>;
      // A lead whose score changed mid-scroll can reappear; keep the first copy.
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError(true);
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [cursor, filters]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor || error || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    }, { rootMargin: "400px 0px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, error, loadMore]);

  return { items, loadMore, hasMore: cursor !== null, isLoading, error, sentinelRef };
}
