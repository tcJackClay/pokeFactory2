import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDexSnapshots } from '../../../services/pokedexClient';
import { createEventDisplaySnapshots, type EventDisplayRecord } from '../utils/eventDisplaySnapshots';

export function useEventDisplaySnapshots(ids: number[]) {
  const storeRef = useRef<ReturnType<typeof createEventDisplaySnapshots> | null>(null);
  const [records, setRecords] = useState<Record<number, EventDisplayRecord>>({});
  const idsKey = [...new Set(ids)].sort((a, b) => a - b).join(',');

  useEffect(() => {
    // Each StrictMode setup owns its own store; cleanup cannot poison the following setup.
    const store = createEventDisplaySnapshots(fetchDexSnapshots);
    storeRef.current = store;
    setRecords(store.getRecords());
    const unsubscribe = store.subscribe(() => setRecords(store.getRecords()));
    return () => {
      unsubscribe();
      store.dispose();
      if (storeRef.current === store) storeRef.current = null;
    };
  }, []);

  useEffect(() => {
    void storeRef.current?.request(idsKey ? idsKey.split(',').map(Number) : []);
  }, [idsKey]);

  const ensure = useCallback(async (requested: number[], retry = false) =>
    storeRef.current?.request(requested, retry) ?? {}, []);

  return { records, ensure };
}
