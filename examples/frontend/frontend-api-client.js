/**
 * AutoServices API Client
 *
 * Handles:
 *  - Correct /api/v1/ prefix on all endpoints
 *  - Bearer token injection
 *  - Automatic token refresh on 401 (access token expired)
 *  - Server-side logout (revokes the token on the backend)
 *  - Persistent storage of both access and refresh tokens
 */
class AutoServicesAPI {
  constructor(baseURL = 'http://localhost:3000') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('authToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this._refreshing = null; // prevents concurrent refresh races
  }

  // ─── Core request ──────────────────────────────────────────────────────────

  async request(endpoint, options = {}, retry = true) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    };

    if (this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, config);

    // Auto-refresh on 401 (expired access token)
    if (response.status === 401 && retry && this.refreshToken) {
      const refreshed = await this._tryRefresh();
      if (refreshed) {
        return this.request(endpoint, options, false);
      }
      // Refresh failed — clear session
      this._clearSession();
      throw new Error('Session expired. Please log in again.');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    // 204 No Content
    if (response.status === 204) return null;

    return response.json();
  }

  async _tryRefresh() {
    // If a refresh is already in flight, wait for it instead of firing another one
    if (this._refreshing) return this._refreshing;

    this._refreshing = (async () => {
      try {
        const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
        if (!response.ok) return false;
        const data = await response.json();
        this._setTokens(data.token, this.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        this._refreshing = null;
      }
    })();

    return this._refreshing;
  }

  _setTokens(token, refreshToken) {
    this.token = token;
    localStorage.setItem('authToken', token);
    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  _clearSession() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async registerCompany(data) {
    return this.request('/api/v1/auth/register/company', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(credentials) {
    const response = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this._setTokens(response.token, response.refreshToken);
    return response;
  }

  async logout() {
    if (!this.token) {
      this._clearSession();
      return;
    }
    try {
      await this.request('/api/v1/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      }, false);
    } finally {
      this._clearSession();
    }
  }

  async refresh() {
    const ok = await this._tryRefresh();
    if (!ok) throw new Error('Could not refresh token');
    return { token: this.token };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats() {
    return this.request('/api/v1/stats');
  }

  async getPublicStats() {
    return this.request('/api/v1/public/stats');
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async getAdminMetrics() {
    return this.request('/api/v1/admin/metrics');
  }

  async getAdminGrowth() {
    return this.request('/api/v1/admin/growth');
  }

  async getAdminActivity() {
    return this.request('/api/v1/admin/activity');
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  async getUsers() {
    return this.request('/api/v1/users');
  }

  async getUser(id) {
    return this.request(`/api/v1/users/${id}`);
  }

  async createUser(data) {
    return this.request('/api/v1/users', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateUser(id, data) {
    return this.request(`/api/v1/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteUser(id) {
    return this.request(`/api/v1/users/${id}`, { method: 'DELETE' });
  }

  // ─── Companies ─────────────────────────────────────────────────────────────

  async getCompanies(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/companies${q ? `?${q}` : ''}`);
  }

  async getCompany(phone) {
    return this.request(`/api/v1/companies/${encodeURIComponent(phone)}`);
  }

  async createCompany(data) {
    return this.request('/api/v1/companies', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateCompany(phone, data) {
    return this.request(`/api/v1/companies/${encodeURIComponent(phone)}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteCompany(phone) {
    return this.request(`/api/v1/companies/${encodeURIComponent(phone)}`, { method: 'DELETE' });
  }

  // ─── Technicians ───────────────────────────────────────────────────────────

  async getTechnicians(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/technicians${q ? `?${q}` : ''}`);
  }

  async getTechnician(phone) {
    return this.request(`/api/v1/technicians/${encodeURIComponent(phone)}`);
  }

  async createTechnician(data) {
    return this.request('/api/v1/technicians', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateTechnician(phone, data) {
    return this.request(`/api/v1/technicians/${encodeURIComponent(phone)}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteTechnician(phone) {
    return this.request(`/api/v1/technicians/${encodeURIComponent(phone)}`, { method: 'DELETE' });
  }

  async getTechnicianAvailability(phone, date) {
    const q = date ? `?date=${date}` : '';
    return this.request(`/api/v1/technicians/${encodeURIComponent(phone)}/availability${q}`);
  }

  // ─── Customers ─────────────────────────────────────────────────────────────

  async getCustomers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/customers${q ? `?${q}` : ''}`);
  }

  async getCustomer(phone) {
    return this.request(`/api/v1/customers/${encodeURIComponent(phone)}`);
  }

  async createCustomer(data) {
    return this.request('/api/v1/customers', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateCustomer(phone, data) {
    return this.request(`/api/v1/customers/${encodeURIComponent(phone)}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteCustomer(phone) {
    return this.request(`/api/v1/customers/${encodeURIComponent(phone)}`, { method: 'DELETE' });
  }

  // ─── Services ──────────────────────────────────────────────────────────────

  async getServices(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/services${q ? `?${q}` : ''}`);
  }

  async getService(id) {
    return this.request(`/api/v1/services/${id}`);
  }

  async createService(data) {
    return this.request('/api/v1/services', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateService(id, data) {
    return this.request(`/api/v1/services/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteService(id) {
    return this.request(`/api/v1/services/${id}`, { method: 'DELETE' });
  }

  // ─── Appointments ──────────────────────────────────────────────────────────

  async getAppointments(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/appointments${q ? `?${q}` : ''}`);
  }

  async getAppointment(id) {
    return this.request(`/api/v1/appointments/${id}`);
  }

  async createAppointment(data) {
    return this.request('/api/v1/appointments', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateAppointment(id, data) {
    return this.request(`/api/v1/appointments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteAppointment(id) {
    return this.request(`/api/v1/appointments/${id}`, { method: 'DELETE' });
  }

  async setTechnicianStatus(appointmentId, estatusTecnico) {
    return this.request(`/api/v1/appointments/${appointmentId}/status/tecnico`, {
      method: 'PATCH',
      body: JSON.stringify({ estatusTecnico }),
    });
  }

  async setAdminStatus(appointmentId, estatusAdministrador) {
    return this.request(`/api/v1/appointments/${appointmentId}/status/administrador`, {
      method: 'PATCH',
      body: JSON.stringify({ estatusAdministrador }),
    });
  }

  getAppointmentPdfUrl(appointmentId) {
    return `${this.baseURL}/api/v1/appointments/${appointmentId}/pdf`;
  }

  // ─── Specialties ───────────────────────────────────────────────────────────

  async getSpecialties(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/specialties${q ? `?${q}` : ''}`);
  }

  async getSpecialty(id) {
    return this.request(`/api/v1/specialties/${id}`);
  }

  async createSpecialty(data) {
    return this.request('/api/v1/specialties', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateSpecialty(id, data) {
    return this.request(`/api/v1/specialties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteSpecialty(id) {
    return this.request(`/api/v1/specialties/${id}`, { method: 'DELETE' });
  }

  // ─── Coverage Zones ────────────────────────────────────────────────────────

  async getCoverageZones(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/coverage-zones${q ? `?${q}` : ''}`);
  }

  async getCoverageZone(id) {
    return this.request(`/api/v1/coverage-zones/${id}`);
  }

  async createCoverageZone(data) {
    return this.request('/api/v1/coverage-zones', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateCoverageZone(id, data) {
    return this.request(`/api/v1/coverage-zones/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteCoverageZone(id) {
    return this.request(`/api/v1/coverage-zones/${id}`, { method: 'DELETE' });
  }

  // ─── Service Specialties ───────────────────────────────────────────────────

  async getServiceSpecialties(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/service-specialties${q ? `?${q}` : ''}`);
  }

  async getSpecialtiesForService(serviceId) {
    return this.request(`/api/v1/service-specialties/service/${serviceId}`);
  }

  async getServicesForSpecialty(specialtyId) {
    return this.request(`/api/v1/service-specialties/specialty/${specialtyId}`);
  }

  async linkServiceSpecialty(serviceId, specialtyId) {
    return this.request('/api/v1/service-specialties', {
      method: 'POST',
      body: JSON.stringify({ serviceId, specialtyId }),
    });
  }

  async unlinkServiceSpecialty(serviceId, specialtyId) {
    return this.request(`/api/v1/service-specialties/${serviceId}/${specialtyId}`, { method: 'DELETE' });
  }

  // ─── Technician Specialties ────────────────────────────────────────────────

  async getTechnicianSpecialties(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/technician-specialties${q ? `?${q}` : ''}`);
  }

  async getSpecialtiesForTechnician(phone) {
    return this.request(`/api/v1/technician-specialties/technician/${encodeURIComponent(phone)}`);
  }

  async getTechniciansForSpecialty(specialtyId) {
    return this.request(`/api/v1/technician-specialties/specialty/${specialtyId}`);
  }

  async linkTechnicianSpecialty(technicianPhone, specialtyId) {
    return this.request('/api/v1/technician-specialties', {
      method: 'POST',
      body: JSON.stringify({ technicianPhone, specialtyId }),
    });
  }

  async unlinkTechnicianSpecialty(phone, specialtyId) {
    return this.request(`/api/v1/technician-specialties/${encodeURIComponent(phone)}/${specialtyId}`, { method: 'DELETE' });
  }

  // ─── Technician Coverage Zones ─────────────────────────────────────────────

  async getTechnicianCoverageZones(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/technician-coverage-zones${q ? `?${q}` : ''}`);
  }

  async getCoverageZonesForTechnician(phone, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/technician-coverage-zones/technician/${encodeURIComponent(phone)}${q ? `?${q}` : ''}`);
  }

  async getTechniciansForZone(zoneId, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/v1/technician-coverage-zones/zone/${zoneId}${q ? `?${q}` : ''}`);
  }

  async assignTechnicianToZone(technicianPhone, coverageZoneId) {
    return this.request('/api/v1/technician-coverage-zones', {
      method: 'POST',
      body: JSON.stringify({ technicianPhone, coverageZoneId }),
    });
  }

  async removeTechnicianFromZone(phone, zoneId) {
    return this.request(`/api/v1/technician-coverage-zones/${encodeURIComponent(phone)}/${zoneId}`, { method: 'DELETE' });
  }

  // ─── System ────────────────────────────────────────────────────────────────

  async healthCheck() {
    return this.request('/health');
  }
}

export default new AutoServicesAPI();
export { AutoServicesAPI };
