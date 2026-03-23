// API Client para AutoServices Frontend
class AutoServicesAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
  }

  // Helper para hacer requests con auth
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Agregar token si existe
    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, config);

    // Handle common errors
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Network error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // ==========================================
  // AUTENTICACIÓN (Endpoints Públicos)
  // ==========================================

  async register(userData) {
    const response = await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    // Guardar token si el registro incluye login automático
    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async login(credentials) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    // Guardar token
    this.setToken(response.token);

    return response;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  // ==========================================
  // USUARIOS (Endpoints Protegidos)
  // ==========================================

  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/users?${query}`);
  }

  async getUser(id) {
    return this.request(`/api/users/${id}`);
  }

  async createUser(userData) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id, userData) {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // COMPAÑÍAS
  // ==========================================

  async getCompanies(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/companies?${query}`);
  }

  async getCompany(phone) {
    return this.request(`/api/companies/${phone}`);
  }

  async createCompany(companyData) {
    return this.request('/api/companies', {
      method: 'POST',
      body: JSON.stringify(companyData),
    });
  }

  async updateCompany(phone, companyData) {
    return this.request(`/api/companies/${phone}`, {
      method: 'PUT',
      body: JSON.stringify(companyData),
    });
  }

  async deleteCompany(phone) {
    return this.request(`/api/companies/${phone}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // TÉCNICOS
  // ==========================================

  async getTechnicians(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/technicians?${query}`);
  }

  async getTechnician(phone) {
    return this.request(`/api/technicians/${phone}`);
  }

  async createTechnician(technicianData) {
    return this.request('/api/technicians', {
      method: 'POST',
      body: JSON.stringify(technicianData),
    });
  }

  async updateTechnician(phone, technicianData) {
    return this.request(`/api/technicians/${phone}`, {
      method: 'PUT',
      body: JSON.stringify(technicianData),
    });
  }

  async deleteTechnician(phone) {
    return this.request(`/api/technicians/${phone}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // SERVICIOS
  // ==========================================

  async getServices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/services?${query}`);
  }

  async getService(id) {
    return this.request(`/api/services/${id}`);
  }

  async createService(serviceData) {
    return this.request('/api/services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  }

  async updateService(id, serviceData) {
    return this.request(`/api/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    });
  }

  async deleteService(id) {
    return this.request(`/api/services/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // CITAS
  // ==========================================

  async getAppointments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/appointments?${query}`);
  }

  async getAppointment(id) {
    return this.request(`/api/appointments/${id}`);
  }

  async createAppointment(appointmentData) {
    return this.request('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    });
  }

  async updateAppointment(id, appointmentData) {
    return this.request(`/api/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appointmentData),
    });
  }

  async deleteAppointment(id) {
    return this.request(`/api/appointments/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // CLIENTES
  // ==========================================

  async getCustomers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/customers?${query}`);
  }

  async getCustomer(phone) {
    return this.request(`/api/customers/${phone}`);
  }

  async createCustomer(customerData) {
    return this.request('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  async updateCustomer(phone, customerData) {
    return this.request(`/api/customers/${phone}`, {
      method: 'PUT',
      body: JSON.stringify(customerData),
    });
  }

  async deleteCustomer(phone) {
    return this.request(`/api/customers/${phone}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // ZONAS DE COBERTURA
  // ==========================================

  async getCoverageZones(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/coverage-zones?${query}`);
  }

  async getCoverageZone(id) {
    return this.request(`/api/coverage-zones/${id}`);
  }

  async createCoverageZone(zoneData) {
    return this.request('/api/coverage-zones', {
      method: 'POST',
      body: JSON.stringify(zoneData),
    });
  }

  async updateCoverageZone(id, zoneData) {
    return this.request(`/api/coverage-zones/${id}`, {
      method: 'PUT',
      body: JSON.stringify(zoneData),
    });
  }

  async deleteCoverageZone(id) {
    return this.request(`/api/coverage-zones/${id}`, {
      method: 'DELETE',
    });
  }

  // ==========================================
  // UTILIDADES
  // ==========================================

  async healthCheck() {
    return this.request('/health');
  }
}

// Exportar instancia por defecto
export default new AutoServicesAPI();

// También exportar la clase para instancias personalizadas
export { AutoServicesAPI };