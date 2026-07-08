/**
 * Authentication Module
 * Cryptographically secures the static web application
 * Uses PBKDF2 for Key Derivation and HMAC-SHA256 Request Signing
 */

const Auth = {
  // Session validation
  init() {
    const session = sessionStorage.getItem('monitoring_session');
    const encryptedUrl = localStorage.getItem('monitoring_api_url_encrypted');

    if (!encryptedUrl) {
      // First time run setup
      const legacyUrl = localStorage.getItem('monitoring_api_url') || '';
      document.getElementById('login-title').textContent = 'Konfigurasi Awal';
      document.getElementById('login-subtitle').textContent = 'Masukkan Google Apps Script Web App URL dan buat password pengaman.';
      document.getElementById('login-setup-fields').classList.remove('hidden');
      if (legacyUrl) {
        document.getElementById('login-setup-url').value = legacyUrl;
      }
      document.getElementById('login-submit-btn').innerHTML = '<span class="material-symbols-outlined text-[20px]">save</span> Simpan & Kunci';
      this.showLogin();
      return;
    }

    if (session === 'active') {
      const hmacKey = sessionStorage.getItem('monitoring_hmac_key');
      const decrypted = this.decryptUrl(sessionStorage.getItem('monitoring_key'));
      if (decrypted && hmacKey) {
        API._baseUrl = decrypted;
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

  // Derive AES Key & HMAC Key from password using PBKDF2 with dynamic salt
  deriveKeys(password, salt) {
    const derivedBytes = CryptoJS.PBKDF2(password, salt, {
      keySize: 512 / 32, // 16 words = 64 bytes
      iterations: 100000,
      hasher: CryptoJS.algo.SHA256
    });

    const derivedHex = derivedBytes.toString(CryptoJS.enc.Hex);
    const aesKeyHex = derivedHex.substring(0, 64);   // First 32 bytes (256 bits)
    const hmacKeyHex = derivedHex.substring(64, 128); // Next 32 bytes (256 bits)
    return { aesKeyHex, hmacKeyHex };
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
      const { aesKeyHex } = this.deriveKeys(password, salt);
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

      // Derive a deterministic salt from the unique Apps Script URL (unique per deployment, not hardcoded)
      const salt = CryptoJS.SHA256(url);
      const saltHex = salt.toString(CryptoJS.enc.Hex);
      localStorage.setItem('monitoring_api_salt', saltHex);

      const { aesKeyHex, hmacKeyHex } = this.deriveKeys(password, salt);
      const encrypted = this.encryptUrl(url, aesKeyHex);
      if (encrypted) {
        // Save encrypted URL
        localStorage.setItem('monitoring_api_url_encrypted', encrypted);
        localStorage.removeItem('monitoring_api_url');
        
        // Temporarily hold setup parameters in Auth state
        this._tempSetup = { password, url, hmacKeyHex };

        // Transition to instructions screen
        document.getElementById('login-title').textContent = 'Hubungkan Backend';
        document.getElementById('login-subtitle').textContent = 'Amankan backend Google Apps Script dengan kunci ini.';
        document.getElementById('login-fields-container').classList.add('hidden');
        
        document.getElementById('login-setup-key').value = hmacKeyHex;
        document.getElementById('login-setup-success').classList.remove('hidden');
      } else {
        this.showError('Gagal mengenkripsi URL');
      }
    } else {
      // Login Mode
      const decrypted = this.decryptUrl(password);
      if (decrypted) {
        const saltHex = localStorage.getItem('monitoring_api_salt');
        const salt = CryptoJS.enc.Hex.parse(saltHex);
        const { hmacKeyHex } = this.deriveKeys(password, salt);
        sessionStorage.setItem('monitoring_session', 'active');
        sessionStorage.setItem('monitoring_key', password);
        sessionStorage.setItem('monitoring_hmac_key', hmacKeyHex);
        
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
      const { password, url, hmacKeyHex } = this._tempSetup;
      sessionStorage.setItem('monitoring_session', 'active');
      sessionStorage.setItem('monitoring_key', password);
      sessionStorage.setItem('monitoring_hmac_key', hmacKeyHex);
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
      localStorage.removeItem('monitoring_api_salt');
      sessionStorage.clear();
      window.location.reload();
    }
  }
};
