import { useState, useEffect } from 'react';
import { onAuthStateChange, getSession } from '../lib/auth';
import type { User } from '../lib/auth';

export interface AuthHook {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession().then((s) => {
      setUser(s?.user ?? null);
      setLoading(false);
    });
    const unsub = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, loading };
}
