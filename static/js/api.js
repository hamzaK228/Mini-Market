/* ============================================================
 * Mini-Markets CRM — API Client
 * Production-grade HTTP client with JWT auto-refresh
 * ============================================================ */
const API = {
  getToken() {
    return localStorage.getItem('crm_token');
  },

  async _refreshToken() {
    const rt = localStorage.getItem('crm_refresh_token');
    if (!rt) return false;
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem('crm_token', data.access_token);
      localStorage.setItem('crm_refresh_token', data.refresh_token);
      localStorage.setItem('crm_owner', JSON.stringify(data.owner));
      return true;
    } catch (_) {
      return false;
    }
  },

  async request(path, options = {}) {
    // Prefix path with /api/v1/ if not already
    if (!path.startsWith('/api/v1/') && path.startsWith('/api/')) {
      path = path.replace('/api/', '/api/v1/');
    }

    const token = this.getToken();
    if (!token && !path.includes('/auth/')) {
      window.location.href = '/';
      return null;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(path, { ...options, headers });
      if (res.status === 401) {
        // Automatic token refresh
        const refreshed = await this._refreshToken();
        if (refreshed) {
          const t = this.getToken();
          headers['Authorization'] = `Bearer ${t}`;
          const retryRes = await fetch(path, { ...options, headers });
          if (retryRes.ok) return retryRes.json();
        }
        // Refresh failed — force re-login
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_refresh_token');
        localStorage.removeItem('crm_owner');
        window.location.href = '/';
        return null;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Ошибка запроса');
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${path}:`, err);
      if (window.showToast) {
        window.showToast(err.message || 'Ошибка подключения к серверу', 'error');
      } else {
        alert(err.message || 'Ошибка подключения к серверу');
      }
      throw err;
    }
  },

  async get(path) {
    return this.request(path, { method: 'GET' });
  },
  async post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },
  async put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  },
  async delete(path) {
    return this.request(path, { method: 'DELETE' });
  },
};