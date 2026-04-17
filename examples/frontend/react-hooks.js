// React hooks for AutoServices API
import { useState, useEffect, useCallback, useRef } from 'react';
import { AutoServicesAPI } from './frontend-api-client.js';

// Shared API instance — swap baseURL via env variable in real projects
const DEFAULT_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
    ? import.meta.env.VITE_API_URL
    : 'http://localhost:3000';

// ─── Core hook ────────────────────────────────────────────────────────────────

export function useAutoServicesAPI(baseURL = DEFAULT_BASE_URL) {
  const [api] = useState(() => new AutoServicesAPI(baseURL));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      return await fn(api);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return { api, loading, error, execute, clearError: () => setError(null) };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function useAuth(baseURL = DEFAULT_BASE_URL) {
  const [api] = useState(() => new AutoServicesAPI(baseURL));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAuthenticated = !!api.token;

  // Restore user from localStorage on mount (token may still be valid)
  useEffect(() => {
    const stored = localStorage.getItem('authUser');
    if (stored && api.token) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.login(credentials);
      setUser(response.user);
      localStorage.setItem('authUser', JSON.stringify(response.user));
      return response;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const registerCompany = async (data) => {
    setLoading(true);
    setError(null);
    try {
      return await api.registerCompany(data);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await api.logout();
    } finally {
      setUser(null);
      localStorage.removeItem('authUser');
      setLoading(false);
    }
  };

  return { user, isAuthenticated, loading, error, login, registerCompany, logout };
}

// ─── Generic paginated list hook ──────────────────────────────────────────────

export function usePaginatedList(fetchFn, params = {}, deps = []) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async (overrideParams) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn({ ...params, ...overrideParams });
      setData(result.data ?? result);
      if (result.pagination) setPagination(result.pagination);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, ...deps]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, pagination, loading, error, refetch: fetch };
}

// ─── Specialised hooks ────────────────────────────────────────────────────────

export function useStats(baseURL = DEFAULT_BASE_URL) {
  const { api, loading, error, execute } = useAutoServicesAPI(baseURL);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    execute((a) => a.getStats()).then(setStats).catch(() => {});
  }, []);

  return { stats, loading, error };
}

export function usePublicStats(baseURL = DEFAULT_BASE_URL) {
  const { api, loading, error, execute } = useAutoServicesAPI(baseURL);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    execute((a) => a.getPublicStats()).then(setStats).catch(() => {});
  }, []);

  return { stats, loading, error };
}

export function useAdminDashboard(baseURL = DEFAULT_BASE_URL) {
  const { api, loading, error, execute } = useAutoServicesAPI(baseURL);
  const [metrics, setMetrics] = useState(null);
  const [growth, setGrowth] = useState(null);
  const [activity, setActivity] = useState(null);

  const load = useCallback(() => {
    Promise.all([
      execute((a) => a.getAdminMetrics()).then(setMetrics),
      execute((a) => a.getAdminGrowth()).then(setGrowth),
      execute((a) => a.getAdminActivity()).then(setActivity),
    ]).catch(() => {});
  }, [execute]);

  useEffect(() => { load(); }, []);

  return { metrics, growth, activity, loading, error, refetch: load };
}

export function useCompanies(params = {}, baseURL = DEFAULT_BASE_URL) {
  const { api } = useAutoServicesAPI(baseURL);
  return usePaginatedList((p) => api.getCompanies(p), params, [baseURL]);
}

export function useTechnicians(params = {}, baseURL = DEFAULT_BASE_URL) {
  const { api } = useAutoServicesAPI(baseURL);
  return usePaginatedList((p) => api.getTechnicians(p), params, [baseURL]);
}

export function useCustomers(params = {}, baseURL = DEFAULT_BASE_URL) {
  const { api } = useAutoServicesAPI(baseURL);
  return usePaginatedList((p) => api.getCustomers(p), params, [baseURL]);
}

export function useServices(params = {}, baseURL = DEFAULT_BASE_URL) {
  const { api } = useAutoServicesAPI(baseURL);
  return usePaginatedList((p) => api.getServices(p), params, [baseURL]);
}

export function useAppointments(params = {}, baseURL = DEFAULT_BASE_URL) {
  const { api } = useAutoServicesAPI(baseURL);
  return usePaginatedList((p) => api.getAppointments(p), params, [baseURL]);
}

export function useSpecialties(params = {}, baseURL = DEFAULT_BASE_URL) {
  const { api } = useAutoServicesAPI(baseURL);
  return usePaginatedList((p) => api.getSpecialties(p), params, [baseURL]);
}

export function useCoverageZones(params = {}, baseURL = DEFAULT_BASE_URL) {
  const { api } = useAutoServicesAPI(baseURL);
  return usePaginatedList((p) => api.getCoverageZones(p), params, [baseURL]);
}

export function useTechnicianAvailability(phone, date, baseURL = DEFAULT_BASE_URL) {
  const { api, loading, error, execute } = useAutoServicesAPI(baseURL);
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    if (!phone) return;
    execute((a) => a.getTechnicianAvailability(phone, date))
      .then(setAvailability)
      .catch(() => {});
  }, [phone, date]);

  return { availability, loading, error };
}
