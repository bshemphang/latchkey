import { useCallback, useEffect, useState } from 'react';
import { engine, type EngineStatus } from '../ai/engine';

/** Live engine status, polled so the header pills stay current. */
export function useEngineStatus(): {
  status: EngineStatus;
  refresh: () => void;
} {
  const [status, setStatus] = useState<EngineStatus>(() => engine.status);
  const refresh = useCallback(() => setStatus({ ...engine.status }), []);
  useEffect(() => {
    const id = window.setInterval(refresh, 2000);
    return () => window.clearInterval(id);
  }, [refresh]);
  return { status, refresh };
}
