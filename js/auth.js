/**
 * Authentication Module
 * Cryptographically secures the static web application
 * Supports multi-user setup by locally encrypting the shared signature key and URL
 */

const Auth = {
  // Session validation
  init() {
    const session = sessionStorage.getItem('monitoring_session');
    const encryptedConfig = localStorage.getItem('monitoring_api_config_encrypted');

    if (!encryptedConfig) {
      // First time run setup
      const legacyUrl = localStorage.getItem('monitoring_api_url') || '';
      document.getElementById('login-title').textContent = 'Konfigurasi Awal';
      document.getElementById('login-subtitle').textContent = 'Masukkan Google Apps Script Web App URL, Signature Key, dan buat password pengaman.';
      document.getElementById('login-setup-fields').classList.remove('hidden');
      if (legacyUrl) {
        document.getElementById('login-setup-url').value = legacyUrl;
      }
      
      // Pre-generate a secure random key
      document.getElementById('login-setup-key-input').value = this.generateRandomKey();
      
      document.getElementById('login-submit-btn').innerHTML = '<span class="material-symbols-outlined text-[20px]">save</span> Simpan & Kunci';
      this.showLogin();
      return;
    }

    if (session === 'active') {
      const decrypted = this.decryptConfig(sessionStorage.getItem('monitoring_key'));
      if (decrypted) {
        API._baseUrl = decrypted.url;
        this.hideLogin();
        return;
      }
    }

    this.showLogin();
  },

  showLogin() {
    document.getElementById('login-overlay').style.display = 'flex';
    document.getElementById('app-container').classList.add('hidden');
  },

  hideLogin() {
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').classList.remove('hidden');
    
    // Auto load data in main App
    if (typeof App !== 'undefined' && typeof App.init === 'function') {
      setTimeout(() => {
        App.loadData();
      }, 100);
    }
  },

  togglePasswordVisibility() {
    const input = document.getElementById('login-password');
    const icon = document.getElementById('password-toggle-icon');
    if (!input || !icon) return;
    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = 'visibility_off';
    } else {
      input.type = 'password';
      icon.textContent = 'visibility';
    }
  },

  // Generate a random 256-bit cryptographically secure hexadecimal key
  generateRandomKey() {
    return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
  },

  // Derive AES-256 Key from password using PBKDF2 with salt
  deriveKey(password, salt) {
    const derivedBytes = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32, // 8 words = 32 bytes = 256 bits
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });
    return derivedBytes.toString(CryptoJS.enc.Hex);
  },

  encryptConfig(configObj, aesKeyHex) {
    try {
      const plaintext = JSON.stringify(configObj);
      return CryptoJS.AES.encrypt(plaintext, aesKeyHex).toString();
    } catch (e) {
      return null;
    }
  },

  decryptConfig(password) {
    const encrypted = localStorage.getItem('monitoring_api_config_encrypted');
    const saltHex = localStorage.getItem('monitoring_api_salt');
    if (!encrypted || !saltHex) return null;
    try {
      const salt = CryptoJS.enc.Hex.parse(saltHex);
      const aesKeyHex = this.deriveKey(password, salt);
      const bytes = CryptoJS.AES.decrypt(encrypted, aesKeyHex);
      const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
      if (decryptedText) {
        const config = JSON.parse(decryptedText);
        if (config && config.url && config.signatureKey) {
          return config;
        }
      }
    } catch (e) {}
    return null;
  },

  submit() {
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error-msg');
    if (errorMsg) errorMsg.classList.add('hidden');

    if (!password) {
      this.showError('Password tidak boleh kosong');
      return;
    }

    const encryptedConfig = localStorage.getItem('monitoring_api_config_encrypted');

    if (!encryptedConfig) {
      // Setup Mode
      const url = document.getElementById('login-setup-url').value.trim();
      const signatureKey = document.getElementById('login-setup-key-input').value.trim();

      if (!url || !url.startsWith('https://script.google.com/')) {
        this.showError('Masukkan URL Google Apps Script yang valid');
        return;
      }
      if (!signatureKey || signatureKey.length < 16) {
        this.showError('Masukkan Signature Key yang valid (minimal 16 karakter)');
        return;
      }

      // Generate a random salt for this local browser installation
      const salt = CryptoJS.lib.WordArray.random(16);
      const saltHex = salt.toString(CryptoJS.enc.Hex);
      localStorage.setItem('monitoring_api_salt', saltHex);

      const aesKeyHex = this.deriveKey(password, salt);
      const configObj = { url, signatureKey };
      const encrypted = this.encryptConfig(configObj, aesKeyHex);

      if (encrypted) {
        // Save encrypted config in localStorage
        localStorage.setItem('monitoring_api_config_encrypted', encrypted);
        
        // Remove legacy plaintext fields if present
        localStorage.removeItem('monitoring_api_url');
        localStorage.removeItem('monitoring_api_url_encrypted');
        
        // Hold values temporarily in memory to complete setup wizard
        this._tempSetup = { password, url, signatureKey };

        // Show configuration instructions overlay
        document.getElementById('login-title').textContent = 'Hubungkan Backend';
        document.getElementById('login-subtitle').textContent = 'Pasang Signature Key ini di Google Apps Script Anda.';
        document.getElementById('login-fields-container').classList.add('hidden');
        
        document.getElementById('login-setup-key').value = signatureKey;
        document.getElementById('login-setup-success').classList.remove('hidden');
      } else {
        this.showError('Gagal mengenkripsi konfigurasi');
      }
    } else {
      // Login Mode
      const decrypted = this.decryptConfig(password);
      if (decrypted) {
        sessionStorage.setItem('monitoring_session', 'active');
        sessionStorage.setItem('monitoring_key', password);
        sessionStorage.setItem('monitoring_hmac_key', decrypted.signatureKey);
        
        API._baseUrl = decrypted.url;
        this.hideLogin();
        UI.showToast('Login berhasil!', 'success');
      } else {
        this.showError('Password salah, silakan coba lagi.');
      }
    }
  },

  copyKey() {
    const textarea = document.getElementById('login-setup-key');
    if (!textarea) return;
    textarea.select();
    document.execCommand('copy');
    UI.showToast('Signature Key berhasil disalin!', 'success');
  },

  completeSetup() {
    if (this._tempSetup) {
      const { password, url, signatureKey } = this._tempSetup;
      sessionStorage.setItem('monitoring_session', 'active');
      sessionStorage.setItem('monitoring_key', password);
      sessionStorage.setItem('monitoring_hmac_key', signatureKey);
      API._baseUrl = url;
      this._tempSetup = null;
      this.hideLogin();
      UI.showToast('Setup berhasil selesai!', 'success');
    }
  },

  showError(msg) {
    const errorMsg = document.getElementById('login-error-msg');
    if (errorMsg) {
      errorMsg.textContent = msg;
      errorMsg.classList.remove('hidden');
    }
  },

  logout() {
    sessionStorage.clear();
    UI.showToast('Anda telah keluar dari sistem', 'info');
    window.location.reload();
  },

  resetSecuritySettings() {
    if (confirm('Apakah Anda yakin ingin mereset seluruh setelan keamanan? Tindakan ini akan menghapus database terenkripsi dan mengharuskan Anda melakukan setup ulang.')) {
      localStorage.removeItem('monitoring_api_config_encrypted');
      localStorage.removeItem('monitoring_api_salt');
      sessionStorage.clear();
      window.location.reload();
    }
  }
};
