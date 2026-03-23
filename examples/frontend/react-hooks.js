// React Hook para consumir la API de AutoServices
import { useState, useEffect, useCallback } from 'react';
import { AutoServicesAPI } from './frontend-api-client.js';

export function useAutoServicesAPI(baseURL) {
  const [api] = useState(() => new AutoServicesAPI(baseURL));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const executeRequest = useCallback(async (requestFn, ...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await requestFn.apply(api, args);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  return {
    loading,
    error,
    clearError: () => setError(null),

    // Auth
    register: (userData) => executeRequest(api.register, userData),
    login: (credentials) => executeRequest(api.login, credentials),
    logout: () => api.logout(),

    // Users
    getUsers: (params) => executeRequest(api.getUsers, params),
    getUser: (id) => executeRequest(api.getUser, id),
    createUser: (userData) => executeRequest(api.createUser, userData),
    updateUser: (id, userData) => executeRequest(api.updateUser, id, userData),
    deleteUser: (id) => executeRequest(api.deleteUser, id),

    // Companies
    getCompanies: (params) => executeRequest(api.getCompanies, params),
    getCompany: (phone) => executeRequest(api.getCompany, phone),
    createCompany: (companyData) => executeRequest(api.createCompany, companyData),
    updateCompany: (phone, companyData) => executeRequest(api.updateCompany, phone, companyData),
    deleteCompany: (phone) => executeRequest(api.deleteCompany, phone),

    // Technicians
    getTechnicians: (params) => executeRequest(api.getTechnicians, params),
    getTechnician: (phone) => executeRequest(api.getTechnician, phone),
    createTechnician: (technicianData) => executeRequest(api.createTechnician, technicianData),
    updateTechnician: (phone, technicianData) => executeRequest(api.updateTechnician, phone, technicianData),
    deleteTechnician: (phone) => executeRequest(api.deleteTechnician, phone),

    // Services
    getServices: (params) => executeRequest(api.getServices, params),
    getService: (id) => executeRequest(api.getService, id),
    createService: (serviceData) => executeRequest(api.createService, serviceData),
    updateService: (id, serviceData) => executeRequest(api.updateService, id, serviceData),
    deleteService: (id) => executeRequest(api.deleteService, id),

    // Appointments
    getAppointments: (params) => executeRequest(api.getAppointments, params),
    getAppointment: (id) => executeRequest(api.getAppointment, id),
    createAppointment: (appointmentData) => executeRequest(api.createAppointment, appointmentData),
    updateAppointment: (id, appointmentData) => executeRequest(api.updateAppointment, id, appointmentData),
    deleteAppointment: (id) => executeRequest(api.deleteAppointment, id),

    // Customers
    getCustomers: (params) => executeRequest(api.getCustomers, params),
    getCustomer: (phone) => executeRequest(api.getCustomer, phone),
    createCustomer: (customerData) => executeRequest(api.createCustomer, customerData),
    updateCustomer: (phone, customerData) => executeRequest(api.updateCustomer, phone, customerData),
    deleteCustomer: (phone) => executeRequest(api.deleteCustomer, phone),

    // Coverage Zones
    getCoverageZones: (params) => executeRequest(api.getCoverageZones, params),
    getCoverageZone: (id) => executeRequest(api.getCoverageZone, id),
    createCoverageZone: (zoneData) => executeRequest(api.createCoverageZone, zoneData),
    updateCoverageZone: (id, zoneData) => executeRequest(api.updateCoverageZone, id, zoneData),
    deleteCoverageZone: (id) => executeRequest(api.deleteCoverageZone, id),

    // Health check
    healthCheck: () => executeRequest(api.healthCheck),
  };
}

// Hook específico para autenticación
export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const api = useAutoServicesAPI();

  useEffect(() => {
    // Verificar si hay token guardado
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
      // Aquí podrías hacer una llamada para obtener datos del usuario
    }
  }, []);

  const login = async (credentials) => {
    try {
      const response = await api.login(credentials);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.register(userData);
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return {
    user,
    isAuthenticated,
    login,
    register,
    logout,
    loading: api.loading,
    error: api.error,
  };
}

// Hook para datos con caché
export function useData(endpoint, params = {}, dependencies = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const api = useAutoServicesAPI();

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await endpoint(params);
        if (isMounted) {
          setData(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    endpoint(params)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [endpoint, params]);

  return { data, loading, error, refetch };
}