"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface User {
  name: string;
  email: string;
  tier: string;
  token_balance: number;
}

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me/`, { credentials: "include" });
      if (res.ok) {
        const data: User = await res.json();
        setUser(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/auth/me/`, { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Not authenticated");
      })
      .then((data: User) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, isLoggedIn: !!user, loading, refreshUser };
}
