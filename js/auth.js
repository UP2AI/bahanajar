/**
 * Authentication Module
 * Cryptographically secures the static web application
 * Uses the security password directly as the SIGNATURE_KEY for maximum simplicity and security
 */

const Auth = {
  // Session validation
  init() {
    const session = sessionStorage.getItem('monitoring_session');
    const password = sessionStorage.getItem('monitoring_key');
    const encryptedUrl = localStorage.getItem('monitoring_api_url_encrypted');
    
    if (session === 'active' && password && encryptedUrl) {
      const decrypted = this.decryptUrl(password);
      if (decrypted) {
        API._baseUrl = decrypted;
        this.hideLogin();
        return;
      }
    }
    
    // Clear invalid session if any
    sessionStorage.clear();
    this.showLogin();
  },

  showLogin() {
    const encryptedUrl = localStorage.getItem('monitoring_api_url_encrypted');
    const isSetup = !encryptedUrl;
    
    // Toggle setup fields visibility
    const setupFields = document.getElementById('login-setup-fields');
    const loginTitle = document.getElementById('login-title');
    const loginSubtitle = document.getElementById('login-subtitle');
    const submitBtn = document.getElementById('login-submit-btn');
    
    if (isSetup) {
      if (setupFields) setupFields.classList.remove('hidden');
      if (loginTitle) loginTitle.textContent = 'Konfigurasi Awal';
      if (loginSubtitle) loginSubtitle.textContent = 'Hubungkan sistem monitoring bahan ajar dengan database Anda.';
      if (submitBtn) {
        submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">save</span> Simpan & Hubungkan';
      }
    } else {
      if (setupFields) setupFields.classList.add('hidden');
      if (loginTitle) loginTitle.textContent = 'Akses Terkunci';
      if (loginSubtitle) loginSubtitle.textContent = 'Masukkan password Anda untuk memuat data dan mengaktifkan aplikasi.';
      if (submitBtn) {
        submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px]">login</span> Masuk Ke Sistem';
      }
    }
    
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

  // Derive AES-256 Key from password using PBKDF2 with dynamic salt
  deriveKey(password, salt) {
    const derivedBytes = CryptoJS.PBKDF2(password, salt, {
      keySize: 256 / 32, // 8 words = 32 bytes = 256 bits
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });
    return derivedBytes.toString(CryptoJS.enc.Hex);
  },

  encryptUrl(url, aesKeyHex) {
    try {
      return CryptoJS.AES.encrypt(url.trim(), aesKeyHex).toString();
    } catch (e) {
      return null;
    }
  },

  decryptUrl(password) {
    const encrypted = localStorage.getItem('monitoring_api_url_encrypted');
    const saltHex = localStorage.getItem('monitoring_api_salt');
    if (!encrypted || !saltHex) return null;
    try {
      const salt = CryptoJS.enc.Hex.parse(saltHex);
      const aesKeyHex = this.deriveKey(password, salt);
      const bytes = CryptoJS.AES.decrypt(encrypted, aesKeyHex);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (decrypted && decrypted.startsWith('https://script.google.com/')) {
        return decrypted;
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

    const encryptedUrl = localStorage.getItem('monitoring_api_url_encrypted');

    if (!encryptedUrl) {
      // Setup Mode
      const url = document.getElementById('login-setup-url').value.trim();

      if (!url || !url.startsWith('https://script.google.com/')) {
        this.showError('Masukkan URL Google Apps Script yang valid');
        return;
      }
      if (password.length < 6) {
        this.showError('Password harus minimal 6 karakter');
        return;
      }

      // Generate dynamic salt from the Apps Script URL
      const salt = CryptoJS.SHA256(url);
      const saltHex = salt.toString(CryptoJS.enc.Hex);
      localStorage.setItem('monitoring_api_salt', saltHex);

      const aesKeyHex = this.deriveKey(password, salt);
      const encrypted = this.encryptUrl(url, aesKeyHex);

      if (encrypted) {
        // Save encrypted URL in localStorage
        localStorage.setItem('monitoring_api_url_encrypted', encrypted);
        
        // Remove legacy fields if present
        localStorage.removeItem('monitoring_api_url');
        localStorage.removeItem('monitoring_api_config_encrypted');
        
        // Hold values temporarily in memory to complete setup wizard
        this._tempSetup = { password, url };

        // Show configuration instructions overlay
        document.getElementById('login-title').textContent = 'Hubungkan Backend';
        document.getElementById('login-subtitle').textContent = 'Pasang Signature Key ini di Google Apps Script Anda.';
        document.getElementById('login-fields-container').classList.add('hidden');
        
        document.getElementById('login-setup-key').value = password;
        document.getElementById('login-setup-success').classList.remove('hidden');
      } else {
        this.showError('Gagal mengenkripsi URL database');
      }
    } else {
      // Login Mode
      const decrypted = this.decryptUrl(password);
      if (decrypted) {
        sessionStorage.setItem('monitoring_session', 'active');
        sessionStorage.setItem('monitoring_key', password);
        sessionStorage.setItem('monitoring_hmac_key', password); // Password IS the signature key
        
        API._baseUrl = decrypted;
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
      const { password, url } = this._tempSetup;
      sessionStorage.setItem('monitoring_session', 'active');
      sessionStorage.setItem('monitoring_key', password);
      sessionStorage.setItem('monitoring_hmac_key', password);
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
      localStorage.removeItem('monitoring_api_url_encrypted');
      localStorage.removeItem('monitoring_api_config_encrypted');
      localStorage.removeItem('monitoring_api_salt');
      sessionStorage.clear();
      window.location.reload();
    }
  }
};
