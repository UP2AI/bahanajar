/**
 * UI Module — DOM Manipulation, Modals, Toasts
 * Web Monitoring Penyusunan Bahan Ajar
 * v2: Supports bulk mode
 */

const UI = {
  /**
   * Show a modal by ID
   */
  openModal(modalId) {
    const backdrop = document.getElementById('modal-backdrop');
    const modal = document.getElementById(modalId);
    if (!backdrop || !modal) return;

    backdrop.classList.add('active');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus first input
    setTimeout(() => {
      const firstInput = modal.querySelector('input:not([type="hidden"]):not([type="checkbox"]), select, textarea');
      if (firstInput) firstInput.focus();
    }, 300);
  },

  /**
   * Close a specific modal or all modals
   */
  closeModal(modalId) {
    const backdrop = document.getElementById('modal-backdrop');
    
    if (modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('active');
        modal.classList.remove('modal-bulk-active');
      }
    } else {
      // Close all modals
      document.querySelectorAll('.modal.active').forEach(m => {
        m.classList.remove('active');
        m.classList.remove('modal-bulk-active');
      });
    }
    
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';

    // Close any open bulk prodi dropdowns
    document.querySelectorAll('.bulk-prodi-dropdown.active').forEach(d => d.classList.remove('active'));
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
      warning: '⚠',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${Utils.escapeHtml(message)}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Show/hide loading overlay on an element
   */
  setLoading(elementId, isLoading) {
    const el = document.getElementById(elementId);
    if (!el) return;

    let overlay = el.querySelector('.loading-overlay');
    
    if (isLoading) {
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div>';
        el.style.position = 'relative';
        el.appendChild(overlay);
      }
      // Force reflow before adding active
      overlay.offsetHeight;
      overlay.classList.add('active');
    } else {
      if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 200);
      }
    }
  },

  /**
   * Render a badge
   */
  renderBadge(info) {
    if (info.dot) {
      return `<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${info.bg} ${info.text} text-xs font-medium border ${info.border}"><div class="w-1.5 h-1.5 rounded-full ${info.dot}"></div> ${Utils.escapeHtml(info.label)}</span>`;
    }
    return `<span class="inline-flex items-center px-2 py-1 rounded-md bg-secondary-fixed text-on-secondary-fixed text-xs font-medium border border-secondary-fixed-dim">${Utils.escapeHtml(info.label)}</span>`;
  },

  /**
   * Render progress bar + text
   */
  renderProgress(percentage) {
    const pct = parseInt(percentage) || 0;
    let color = 'bg-emerald-500';
    let textColor = 'text-emerald-600';
    if (pct < 50) { color = 'bg-error'; textColor = 'text-error'; }
    else if (pct < 100) { color = 'bg-orange-500'; textColor = 'text-orange-600'; }

    return `
      <div class="flex items-center gap-2">
        <div class="w-16 h-1.5 bg-surface-variant rounded-full overflow-hidden">
          <div class="h-full ${color} rounded-full" style="width: ${pct}%"></div>
        </div>
        <span class="text-xs font-medium ${textColor}">${pct}%</span>
      </div>
    `;
  },

  /**
   * Render prodi tags
   */
  renderProdiTags(prodiStr) {
    if (!prodiStr) return '-';
    const prodis = prodiStr.split(',').map(p => p.trim()).filter(Boolean);
    if (prodis.length === 0) return '-';
    return `<div class="flex flex-wrap gap-1">${prodis.map(p => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-variant text-on-surface-variant">${Utils.escapeHtml(p)}</span>`).join('')}</div>`;
  },

  /**
   * Render file link
   */
  renderFileLink(url, label) {
    if (!url) return '-';
    return `<a href="${Utils.escapeHtml(url)}" target="_blank" rel="noopener" class="text-primary hover:underline flex items-center gap-1" title="${Utils.escapeHtml(url)}"><span class="material-symbols-outlined text-[14px]">description</span> ${label}</a>`;
  },

  /**
   * Render SK links
   */
  renderSKLinks(links) {
    if (!Array.isArray(links) || links.length === 0) return '-';
    return links.map(sk => {
      let url = String(sk.url || sk.link || sk.tautan || '').trim();
      let year = String(sk.year || sk.tahun || 'SK');
      
      const isUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.includes('drive.google.com');
      let href = url;
      if (url && !isUrl && url.includes('.')) {
        href = 'https://' + url;
      }
      
      if (url && (isUrl || url.includes('.'))) {
        return `<a href="${Utils.escapeHtml(href)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-2 py-1 bg-surface-bright border border-outline-variant rounded text-primary hover:bg-surface-container transition-colors text-xs font-medium" title="${Utils.escapeHtml(url)}"><span class="material-symbols-outlined text-[14px]">description</span> SK ${Utils.escapeHtml(year)}</a>`;
      } else if (url) {
        return `<span class="inline-flex items-center gap-1 px-2 py-1 bg-surface-bright border border-error/20 rounded text-error text-xs font-medium cursor-help" title="Tautan tidak valid: ${Utils.escapeHtml(url)}"><span class="material-symbols-outlined text-[14px]">warning</span> SK ${Utils.escapeHtml(year)} (${Utils.escapeHtml(url)})</span>`;
      } else {
        return `<span class="inline-flex items-center gap-1 px-2 py-1 bg-surface-bright border border-outline-variant rounded text-on-surface-variant text-xs font-medium"><span class="material-symbols-outlined text-[14px]">description</span> SK ${Utils.escapeHtml(year)}</span>`;
      }
    }).join(' ');
  },

  /**
   * Render similarity display
   */
  renderSimilarity(similarity) {
    const sim = parseInt(similarity) || 0;
    const cls = Utils.getSimilarityClass(sim);
    return `<span class="font-medium ${cls}">${sim}%</span>`;
  },

  /**
   * Update stats cards
   */
  updateStats(data) {
    const total = data.length;
    const complete = data.filter(d => parseInt(d.PERSENTASE_PENYELESAIAN) === 100).length;
    const inProcess = data.filter(d => {
      const pct = parseInt(d.PERSENTASE_PENYELESAIAN);
      return pct > 0 && pct < 100;
    }).length;
    const avgPct = total > 0 
      ? Math.round(data.reduce((sum, d) => sum + (parseInt(d.PERSENTASE_PENYELESAIAN) || 0), 0) / total)
      : 0;

    const el = (id, val) => {
      const e = document.getElementById(id);
      if (e) e.textContent = val;
    };

    el('stat-total', total);
    el('stat-total-sub', `${total} bahan ajar terdaftar`);
    el('stat-complete', complete);
    el('stat-complete-sub', `dari ${total} total`);
    el('stat-process', inProcess);
    el('stat-process-sub', `sedang berjalan`);
    el('stat-average', avgPct + '%');
    el('stat-average-sub', `rata-rata penyelesaian`);
  },

  /**
   * Update last sync time display
   */
  updateSyncTime() {
    const el = document.getElementById('last-sync');
    if (el) {
      const now = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      el.textContent = `Sync: ${now}`;
    }
  },

  /**
   * Render empty state in table
   */
  renderEmptyState(message = 'Belum ada data bahan ajar', isFiltered = false) {
    return `
      <tr>
        <td colspan="100%">
          <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
            <span class="material-symbols-outlined text-[48px] text-outline-variant mb-4">${isFiltered ? 'search_off' : 'menu_book'}</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface mb-2">${isFiltered ? 'Tidak ada hasil' : message}</h3>
            <p class="font-body-md text-body-md text-on-surface-variant mb-6">${isFiltered ? 'Coba ubah filter atau kata kunci pencarian' : 'Klik tombol "Tambah Data" untuk menambahkan bahan ajar baru'}</p>
            ${!isFiltered ? '<button class="bg-primary text-on-primary px-4 py-2 rounded-lg font-label-md hover:bg-primary-container transition-colors flex items-center gap-2" onclick="App.openAddModal()"><span class="material-symbols-outlined">add</span> Tambah Data</button>' : ''}
          </div>
        </td>
      </tr>
    `;
  },

  /**
   * Reset form by ID
   */
  resetForm(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.reset();
    
    // Clear checkboxes visual
    form.querySelectorAll('.checkbox-item').forEach(item => {
      item.classList.remove('checked');
    });

    // Clear error states
    form.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));

    // Reset percentage display
    const pctValue = form.querySelector('.pct-value');
    if (pctValue) {
      pctValue.textContent = '0%';
      pctValue.style.color = 'var(--neutral-500)';
    }

    // Reset similarity display
    const prefix = formId.replace('-form', '');
    const simDisplay = document.getElementById(`${prefix}-similarity-display`);
    if (simDisplay) {
      simDisplay.innerHTML = '<span class="font-stat-value text-stat-value text-primary">0%</span><span class="font-body-sm text-body-sm text-on-surface-variant">Similarity</span>';
    }
    const simWarning = document.getElementById(`${prefix}-similarity-warning`);
    if (simWarning) simWarning.style.display = 'none';

    // Reset SK container
    const skContainer = document.getElementById(`${prefix}-sk-container`);
    if (skContainer) {
      skContainer.innerHTML = '';
      if (typeof App !== 'undefined' && App.addSKRow) {
        App.addSKRow(`${prefix}-sk-container`);
      }
    }
  },

  /**
   * Populate form with existing data for editing
   */
  populateForm(formId, record) {
    const form = document.getElementById(formId);
    if (!form || !record) return;

    // Set simple text/select inputs
    const fieldMap = {
      'JUDUL': 'edit-judul',
      'SIMILARITY': 'edit-similarity',
      'JENIS_BAHAN_AJAR': 'edit-jenis',
      'PROGRESS_PENULISAN': 'edit-progress',
      'ND_KE_KEU': 'edit-nd',
      'SUDAH_TERBIT': 'edit-terbit',
      'TIM_EKSTERNAL_BPPK': 'edit-tim-eksternal',
      'TOTAL_HONOR': 'edit-honor',
      'CATATAN': 'edit-catatan',
      'TIM_PENYUSUN': 'edit-tim-penyusun',
    };

    Object.entries(fieldMap).forEach(([key, inputId]) => {
      const el = document.getElementById(inputId);
      if (el) el.value = record[key] || '';
    });

    // Set PRODI checkboxes
    const prodiValues = (record.PRODI || '').split(',').map(p => p.trim());
    const prefix = formId.replace('-form', '');
    form.querySelectorAll(`input[name="${prefix}-prodi"]`).forEach(item => {
      if (prodiValues.includes(item.value)) {
        item.checked = true;
      } else {
        item.checked = false;
      }
    });

    // Set SK rows
    const skContainer = document.getElementById('edit-sk-container');
    if (skContainer && typeof App !== 'undefined' && App.addSKRow) {
      skContainer.innerHTML = '';
      let skLinks = [];
      try {
        if (typeof record.DAFTAR_SK === 'string' && record.DAFTAR_SK.trim().startsWith('[')) {
          skLinks = JSON.parse(record.DAFTAR_SK);
        } else if (record.DAFTAR_SK) {
          skLinks = [{ year: '2026', url: record.DAFTAR_SK }];
        }
      } catch(e) {}
      if (!Array.isArray(skLinks)) skLinks = [];
      
      if (skLinks.length === 0) {
        App.addSKRow('edit-sk-container');
      } else {
        skLinks.forEach(sk => App.addSKRow('edit-sk-container', sk));
      }
    }

    // Update percentage display
    this.updateFormPercentage('edit');
  },

  /**
   * Update the auto-calculated percentage in the form
   */
  updateFormPercentage(prefix) {
    const progressEl = document.getElementById(`${prefix}-progress`);
    const ndEl = document.getElementById(`${prefix}-nd`);
    const pctEl = document.getElementById(`${prefix}-percentage-value`);
    
    if (!progressEl || !ndEl || !pctEl) return;

    const pct = Utils.calculatePercentage(progressEl.value, ndEl.value);
    pctEl.textContent = pct + '%';

    if (pct === 100) pctEl.style.color = 'var(--success-600)';
    else if (pct === 50) pctEl.style.color = 'var(--warning-600)';
    else pctEl.style.color = 'var(--neutral-500)';
  },

  /**
   * Update similarity display in the add form
   */
  updateSimilarityDisplay(prefix, similarity, mostSimilarTitle) {
    const displayEl = document.getElementById(`${prefix}-similarity-display`);
    const warningEl = document.getElementById(`${prefix}-similarity-warning`);
    const inputEl = document.getElementById(`${prefix}-similarity`);
    
    if (inputEl) inputEl.value = similarity;
    
    if (displayEl) {
      const cls = Utils.getSimilarityClass(similarity);
      displayEl.innerHTML = `<span class="font-stat-value text-stat-value ${cls}">${similarity}%</span><span class="font-body-sm text-body-sm text-on-surface-variant">Similarity</span>`;
    }
    
    if (warningEl) {
      if (similarity >= 60 && mostSimilarTitle) {
        warningEl.style.display = 'block';
        warningEl.innerHTML = `⚠️ <strong>Mirip dengan:</strong> "${Utils.escapeHtml(Utils.truncate(mostSimilarTitle, 80))}"`;
      } else {
        warningEl.style.display = 'none';
      }
    }
  },

  updateTableCount(filtered, total) {
    const el = document.getElementById('table-count');
    if (el) {
      if (filtered === total) {
        el.textContent = `${total} Total Data`;
      } else {
        el.textContent = `${filtered} Ditemukan (dari ${total})`;
      }
    }
  },

  /**
   * Render Pagination Buttons
   */
  renderPagination(totalItems, currentPage, itemsPerPage) {
    const container = document.getElementById('pagination-container');
    const buttonsContainer = document.getElementById('pagination-buttons');
    const startEl = document.getElementById('page-start');
    const endEl = document.getElementById('page-end');
    const totalEl = document.getElementById('page-total');
    
    if (!container || !buttonsContainer) return;

    if (totalItems === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    
    // Setup Info
    const start = itemsPerPage === 'all' ? 1 : (currentPage - 1) * itemsPerPage + 1;
    const end = itemsPerPage === 'all' ? totalItems : Math.min(currentPage * itemsPerPage, totalItems);
    
    if (startEl) startEl.textContent = start;
    if (endEl) endEl.textContent = end;
    if (totalEl) totalEl.textContent = totalItems;

    // Setup Buttons
    buttonsContainer.innerHTML = '';
    
    if (itemsPerPage === 'all') return; // No buttons needed

    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return; // Only 1 page, no buttons needed

    // Prev Button
    buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''} onclick="App.changePage(${currentPage - 1})"><span class="material-symbols-outlined text-[20px]">chevron_left</span></button>`;

    // Page Numbers (max 5 visible)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container font-label-md text-label-md text-xs transition-colors" onclick="App.changePage(1)">1</button>`;
      if (startPage > 2) buttonsContainer.innerHTML += `<span class="px-1 text-on-surface-variant font-label-md text-label-md">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === currentPage;
      const btnClass = isActive 
        ? "w-8 h-8 flex items-center justify-center rounded border border-primary bg-primary text-on-primary font-label-md text-label-md text-xs transition-colors shadow-sm"
        : "w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant font-label-md text-label-md text-xs hover:bg-surface-container transition-colors";
      buttonsContainer.innerHTML += `<button class="${btnClass}" onclick="App.changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) buttonsContainer.innerHTML += `<span class="px-1 text-on-surface-variant font-label-md text-label-md">...</span>`;
      buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container font-label-md text-label-md text-xs transition-colors" onclick="App.changePage(${totalPages})">${totalPages}</button>`;
    }

    // Next Button
    buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.changePage(${currentPage + 1})"><span class="material-symbols-outlined text-[20px]">chevron_right</span></button>`;
  },
  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    
    sidebar.classList.toggle('-translate-x-full');
    const isHidden = sidebar.classList.contains('-translate-x-full');
    
    let backdrop = document.getElementById('sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      backdrop.className = 'fixed inset-0 bg-black/40 backdrop-blur-[1px] z-10';
      backdrop.onclick = () => this.toggleSidebar();
      document.body.appendChild(backdrop);
    }
    
    if (isHidden) {
      backdrop.style.display = 'none';
    } else {
      backdrop.style.display = 'block';
    }
  },
  closeSidebarOnMobile() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
      this.toggleSidebar();
    }
  },
};
