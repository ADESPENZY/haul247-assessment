'use client';

import { useEffect, useState } from 'react';

export function useUserRole(): 'admin' | 'operator' | null {
  const [role, setRole] = useState<'admin' | 'operator' | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('userRole') as 'admin' | 'operator' | null;
    setRole(stored);
  }, []);

  return role;
}
