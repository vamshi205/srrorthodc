import { useState, useEffect, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { Procedure } from '@/types/procedure';
import { procedureService } from '@/services/procedureService';

export function useProcedures() {
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procedureTypes, setProcedureTypes] = useState<string[]>(['All']);

  const procedureFuse = useRef<Fuse<Procedure> | null>(null);
  const itemFuse = useRef<Fuse<string> | null>(null);
  const instrumentFuse = useRef<Fuse<string> | null>(null);
  const instrumentMapRef = useRef<Map<string, string>>(new Map());

  const processProcedures = useCallback((data: Procedure[]) => {
    setProcedures(data);

    // Extract unique types - add "All" first, then other types (exclude "None")
    const types = ['All', ...new Set(data.map((p) => p.type).filter((t) => Boolean(t) && t !== 'None'))];
    setProcedureTypes(types);

    // Setup Fuse instances
    procedureFuse.current = new Fuse(data, {
      keys: ['name'],
      threshold: 0.4,
    });

    const allItems = data.flatMap((p) => {
      const selectable = p.items.flatMap((raw) => {
        const base = raw.match(/^(.+?)\s*\{/)?.[1]?.trim() || raw.trim();
        return base && base !== raw.trim() ? [raw.trim(), base] : [raw.trim()];
      });
      const fixed = p.fixedItems.map((fi) => fi.name).filter(Boolean);
      return [...selectable, ...fixed];
    });
    itemFuse.current = new Fuse([...new Set(allItems.filter(Boolean))], { threshold: 0.4 });

    // Create instrument mapping with procedure names
    const instrumentMap = new Map<string, string>();
    data.forEach((p) => {
      p.instruments.forEach((inst) => {
        // If instrument appears in multiple procedures, keep the first one found
        if (!instrumentMap.has(inst)) {
          instrumentMap.set(inst, p.name);
        }
      });
    });

    // Store instrument map in ref for search results
    instrumentMapRef.current = instrumentMap;

    const allInstruments = Array.from(instrumentMap.keys());
    instrumentFuse.current = new Fuse(allInstruments, { threshold: 0.4 });

    setLoading(false);
  }, []);

  const fetchProcedures = useCallback(async (_force?: boolean) => {
    setLoading(true);
    setError(null);

    try {
      // Always fetch directly from Firestore DB — no local caching
      localStorage.removeItem('srrortho:procedures_cache');
      console.log('Fetching fresh procedures directly from Firestore');
      const data = await procedureService.getAll();
      processProcedures(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to fetch procedures from Firestore');
      setLoading(false);
    }
  }, [processProcedures]);

  const refetchSingleProcedure = useCallback(
    async (procedureName: string): Promise<Procedure | null> => {
      try {
        localStorage.removeItem('srrortho:procedures_cache');
        const data = await procedureService.getAll();
        processProcedures(data);
        return data.find(p => p.name === procedureName) || null;
      } catch {
        return null;
      }
    },
    [processProcedures]
  );

  const searchProcedures = useCallback(
    (query: string, type?: string): Procedure[] => {
      // If "None" is selected and no search query, return empty array
      // But if there's a search query, allow searching
      if (type === 'None' && !query) {
        return [];
      }

      let results = procedures;

      if (query && procedureFuse.current) {
        results = procedureFuse.current.search(query).map((r) => r.item);
      }

      // If "None" is selected but there's a search query, show search results
      // Otherwise, filter by type if specified
      if (type && type !== 'All' && type !== 'None') {
        results = results.filter((p) => p.type === type);
      }

      return results;
    },
    [procedures]
  );

  const searchItems = useCallback((query: string): string[] => {
    if (!query || !itemFuse.current) return [];
    return itemFuse.current.search(query).map((r) => r.item);
  }, []);

  const searchInstruments = useCallback((query: string): Array<{ instrument: string; procedureName: string }> => {
    if (!query || !instrumentFuse.current) return [];
    return instrumentFuse.current.search(query).map((r) => ({
      instrument: r.item,
      procedureName: instrumentMapRef.current.get(r.item) || 'Unknown'
    }));
  }, []);

  useEffect(() => {
    fetchProcedures();
  }, [fetchProcedures]);

  return {
    procedures,
    loading,
    error,
    procedureTypes,
    fetchProcedures,
    refetchSingleProcedure,
    searchProcedures,
    searchItems,
    searchInstruments,
  };
}
