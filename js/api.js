/**
 * API Module — Communication with Google Apps Script
 * Web Monitoring Penyusunan Bahan Ajar
 * Implements HMAC-SHA256 request signatures for static frontends
 */

const API = {
  _baseUrl: '',

  /**
   * Set the API URL
   */
  setUrl(url) {
    this._baseUrl = url.replace(/\/+$/, '');
    localStorage.setItem('monitoring_api_url', this._baseUrl);
  },

  /**
   * Get the API URL (try localStorage first)
   */
  getUrl() {
    if (!this._baseUrl) {
      this._baseUrl = localStorage.getItem('monitoring_api_url') || '';
    }
    return this._baseUrl;
  },

  /**
   * Check if API URL is configured
   */
  isConfigured() {
    return !!this.getUrl() || !!localStorage.getItem('monitoring_api_config_encrypted');
  },

  /**
   * Generate HMAC-SHA256 signature for request validation
   */
  signRequest(action, id = null, record = null) {
    const hmacKey = sessionStorage.getItem('monitoring_hmac_key');
    if (!hmacKey) {
      return { timestamp: '0', nonce: '', signature: '' };
    }

    const timestamp = new Date().getTime().toString();
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    let payload = action + "|" + timestamp + "|" + nonce;
    if (id !== null) {
      payload += "|" + id;
    }
    if (record !== null) {
      payload += "|" + JSON.stringify(record);
    }

    const signature = CryptoJS.HmacSHA256(payload, hmacKey).toString(CryptoJS.enc.Hex);

    return { timestamp, nonce, signature };
  },

  /**
   * Fetch all data from Google Sheets
   */
  async fetchAll() {
    const url = this.getUrl();
    if (!url) throw new Error('API URL belum dikonfigurasi');

    const { timestamp, nonce, signature } = this.signRequest('readAll');

    try {
      const response = await fetch(`${url}?action=readAll&timestamp=${timestamp}&nonce=${nonce}&signature=${signature}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal mengambil data');
      return result.data || [];
    } catch (error) {
      console.error('API fetchAll error:', error);
      throw error;
    }
  },

  /**
   * Fetch single record by ID
   */
  async fetchById(id) {
    const url = this.getUrl();
    if (!url) throw new Error('API URL belum dikonfigurasi');

    const { timestamp, nonce, signature } = this.signRequest('read', id);

    try {
      const response = await fetch(`${url}?action=read&id=${encodeURIComponent(id)}&timestamp=${timestamp}&nonce=${nonce}&signature=${signature}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Data tidak ditemukan');
      return result.data;
    } catch (error) {
      console.error('API fetchById error:', error);
      throw error;
    }
  },

  /**
   * Create new record
   */
  async create(record) {
    const url = this.getUrl();
    if (!url) throw new Error('API URL belum dikonfigurasi');

    const { timestamp, nonce, signature } = this.signRequest('create', null, record);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'create', record, timestamp, nonce, signature }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal menambahkan data');
      return result;
    } catch (error) {
      console.error('API create error:', error);
      throw error;
    }
  },

  /**
   * Update existing record
   */
  async update(id, record) {
    const url = this.getUrl();
    if (!url) throw new Error('API URL belum dikonfigurasi');

    const { timestamp, nonce, signature } = this.signRequest('update', id, record);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'update', id, record, timestamp, nonce, signature }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal memperbarui data');
      return result;
    } catch (error) {
      console.error('API update error:', error);
      throw error;
    }
  },

  /**
   * Delete record by ID
   */
  async delete(id) {
    const url = this.getUrl();
    if (!url) throw new Error('API URL belum dikonfigurasi');

    const { timestamp, nonce, signature } = this.signRequest('delete', id);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete', id, timestamp, nonce, signature }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal menghapus data');
      return result;
    } catch (error) {
      console.error('API delete error:', error);
      throw error;
    }
  },

  /**
   * Fetch all data from "obselete" sheet
   */
  async fetchObsolete() {
    const url = this.getUrl();
    if (!url) throw new Error('API URL belum dikonfigurasi');

    const { timestamp, nonce, signature } = this.signRequest('readObsolete');

    try {
      const response = await fetch(`${url}?action=readObsolete&timestamp=${timestamp}&nonce=${nonce}&signature=${signature}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal mengambil data obsolete');
      return result.data || [];
    } catch (error) {
      console.error('API fetchObsolete error:', error);
      throw error;
    }
  },

  /**
   * Restore record by ID from obselete to main sheet
   */
  async restore(id) {
    const url = this.getUrl();
    if (!url) throw new Error('API URL belum dikonfigurasi');

    const { timestamp, nonce, signature } = this.signRequest('restore', id);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'restore', id, timestamp, nonce, signature }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Gagal memulihkan data');
      return result;
    } catch (error) {
      console.error('API restore error:', error);
      throw error;
    }
  },
};
