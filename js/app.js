/**
 * App Module — Main Application Logic v3
 * Supports: merged SK, Tim Penyusun Enter-separator, complete bulk columns
 */

const App = {
  data: [],
  filteredData: [],
  sortColumn: 'UPDATED_AT',
  sortAsc: false,
  currentPage: 1,
  itemsPerPage: 10,
  katalogCurrentPage: 1,
  katalogItemsPerPage: 9,
  timPenulisCurrentPage: 1,
  timPenulisItemsPerPage: 8,
  editingId: null,
  addMode: 'single',
  bulkRowCounter: 0,
  bulkSaving: false,

  options: {
    jenisBahanAjar: ['Buku Ajar', 'Modul Praktikum', 'Buku Referensi', 'Modul Ajar'],
    progressPenulisan: ['Selesai', 'Drop', 'Proses Pengerjaan', 'Usulan Baru'],
    ndKeKeu: ['Kirim', 'Dalam Proses', 'Belum', 'Tanpa Honor'],
    prodi: ['ASP', 'MAP', 'MKN', 'Akuntansi', 'Pajak', 'Bea dan Cukai', 'Penilai/PBB', 'Manajemen Aset', 'Kebendaharaan Negara'],
    skTahun: ['2024', '2025', '2026', '2027'],
  },

  async init() {
    this.bindEvents();
    this.checkConfig();
    this.initResizers();
    this.initAutoSync();
  },

  checkConfig() {
    const banner = document.getElementById('config-banner');
    if (!banner) return;
    banner.style.display = API.isConfigured() ? 'none' : 'flex';
  },

  bindEvents() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.addEventListener('input', Utils.debounce(() => this.applyFilters(), 300));

    ['filter-jenis', 'filter-progress', 'filter-nd', 'filter-prodi'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.applyFilters());
    });

    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.addEventListener('click', () => UI.closeModal());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.closeModal();
    });

    // Auto-calculate percentage
    ['add', 'edit'].forEach(prefix => {
      const progress = document.getElementById(`${prefix}-progress`);
      const nd = document.getElementById(`${prefix}-nd`);
      if (progress) progress.addEventListener('change', () => UI.updateFormPercentage(prefix));
      if (nd) nd.addEventListener('change', () => UI.updateFormPercentage(prefix));
    });

    // Auto-calculate similarity
    const addJudul = document.getElementById('add-judul');
    if (addJudul) {
      addJudul.addEventListener('input', Utils.debounce(() => {
        const t = addJudul.value.trim();
        if (t.length >= 3) {
          const r = Utils.findMaxSimilarity(t, this.data);
          UI.updateSimilarityDisplay('add', r.maxSimilarity, r.mostSimilarTitle);
        } else {
          UI.updateSimilarityDisplay('add', 0, '');
        }
      }, 400));
    }

    const editJudul = document.getElementById('edit-judul');
    if (editJudul) {
      editJudul.addEventListener('input', Utils.debounce(() => {
        const t = editJudul.value.trim();
        if (t.length >= 3) {
          const r = Utils.findMaxSimilarity(t, this.data, this.editingId);
          UI.updateSimilarityDisplay('edit', r.maxSimilarity, r.mostSimilarTitle);
        } else {
          UI.updateSimilarityDisplay('edit', 0, '');
        }
      }, 400));
    }

    // Checkbox items
    document.querySelectorAll('.checkbox-item').forEach(item => {
      item.addEventListener('click', () => {
        const cb = item.querySelector('input[type="checkbox"]');
        cb.checked = !cb.checked;
        item.classList.toggle('checked', cb.checked);
      });
    });

    // Form submissions
    const addForm = document.getElementById('add-form');
    if (addForm) addForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleAdd(); });
    const editForm = document.getElementById('edit-form');
    if (editForm) editForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleEdit(); });

    // Close bulk prodi dropdowns on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.bulk-prodi-wrap')) {
        document.querySelectorAll('.bulk-prodi-dropdown.active').forEach(d => d.classList.remove('active'));
      }
    });
  },

  async loadData() {
    UI.setLoading('table-container', true);
    try {
      this.data = await API.fetchAll();
      this.applyFilters();
      UI.updateStats(this.data);
      UI.updateSyncTime();
      
      // Update other views if they are currently active
      const activeNav = document.querySelector('.nav-link.bg-secondary-container');
      if (activeNav) {
        const tabId = activeNav.id.replace('nav-', '');
        if (tabId === 'bahan-ajar') this.renderKatalog();
        else if (tabId === 'laporan') this.renderLaporan();
        else if (tabId === 'tim-penulis') this.renderTimPenulis();
        else if (tabId === 'pengaturan') this.renderSettings();
      }
    } catch (error) {
      UI.showToast('Gagal memuat data: ' + error.message, 'error');
      this.renderTable([]);
    } finally {
      UI.setLoading('table-container', false);
    }
  },

  applyFilters() {
    const search = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const fJenis = document.getElementById('filter-jenis')?.value || '';
    const fProgress = document.getElementById('filter-progress')?.value || '';
    const fNd = document.getElementById('filter-nd')?.value || '';
    const fProdi = document.getElementById('filter-prodi')?.value || '';

    this.filteredData = this.data.filter(item => {
      if (search) {
        const fields = [item.JUDUL, item.JENIS_BAHAN_AJAR, item.PROGRESS_PENULISAN, item.ND_KE_KEU, item.SUDAH_TERBIT, item.TIM_EKSTERNAL_BPPK, item.PRODI, item.CATATAN, item.TIM_PENYUSUN].map(f => (f || '').toLowerCase());
        if (!fields.some(f => f.includes(search))) return false;
      }
      if (fJenis && item.JENIS_BAHAN_AJAR !== fJenis) return false;
      if (fProgress && item.PROGRESS_PENULISAN !== fProgress) return false;
      if (fNd && item.ND_KE_KEU !== fNd) return false;
      if (fProdi) {
        const prodis = (item.PRODI || '').split(',').map(p => p.trim());
        if (!prodis.includes(fProdi)) return false;
      }
      return true;
    });

    if (this.sortColumn) {
      this.filteredData.sort((a, b) => {
        let vA = a[this.sortColumn] || '';
        let vB = b[this.sortColumn] || '';
        if (['SIMILARITY', 'PERSENTASE_PENYELESAIAN', 'TOTAL_HONOR'].includes(this.sortColumn)) {
          vA = parseFloat(vA) || 0;
          vB = parseFloat(vB) || 0;
        } else {
          vA = vA.toString().toLowerCase();
          vB = vB.toString().toLowerCase();
        }
        if (vA < vB) return this.sortAsc ? -1 : 1;
        if (vA > vB) return this.sortAsc ? 1 : -1;
        return 0;
      });
    }

    this.currentPage = 1; // Reset to page 1 on filter
    this.renderTable();
  },

  initResizers() {
    const table = document.getElementById('data-table');
    if (!table) return;
    const ths = table.querySelectorAll('thead th');
    ths.forEach((th, i) => {
      if (th.style.width === '36px' || th.style.width === '100px') return; // Skip # and Aksi
      
      const resizer = document.createElement('div');
      resizer.style.width = '5px';
      resizer.style.height = '100%';
      resizer.style.position = 'absolute';
      resizer.style.right = '0';
      resizer.style.top = '0';
      resizer.style.cursor = 'col-resize';
      resizer.style.userSelect = 'none';
      resizer.style.zIndex = '1';
      
      th.style.position = 'relative';
      th.appendChild(resizer);
      
      const savedWidth = localStorage.getItem(`th-width-${i}`);
      if (savedWidth) {
        th.style.width = savedWidth + 'px';
      }

      let x, w;
      resizer.addEventListener('mousedown', (e) => {
        x = e.clientX;
        w = th.offsetWidth;
        e.stopPropagation();
        
        const mouseMoveHandler = (e) => {
          const dx = e.clientX - x;
          const newW = w + dx;
          th.style.width = newW + 'px';
          localStorage.setItem(`th-width-${i}`, newW);
        };
        
        const mouseUpHandler = () => {
          document.removeEventListener('mousemove', mouseMoveHandler);
          document.removeEventListener('mouseup', mouseUpHandler);
        };
        
        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
      });
      
      resizer.addEventListener('click', (e) => e.stopPropagation());
    });
  },

  sortBy(column) {
    if (this.sortColumn === column) this.sortAsc = !this.sortAsc;
    else { this.sortColumn = column; this.sortAsc = true; }
    this.applyFilters();

    document.querySelectorAll('.data-table thead th').forEach(th => {
      th.classList.remove('sorted');
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = '↕';
    });
    const activeTh = document.querySelector(`[data-sort="${column}"]`);
    if (activeTh) {
      activeTh.classList.add('sorted');
      const icon = activeTh.querySelector('.sort-icon');
      if (icon) icon.textContent = this.sortAsc ? '↑' : '↓';
    }
  },

  changePage(page) {
    this.currentPage = page;
    this.renderTable();
  },

  changeItemsPerPage(limit) {
    this.itemsPerPage = limit === 'all' ? 'all' : parseInt(limit);
    this.currentPage = 1;
    this.renderTable();
  },

  renderTable() {
    const data = this.filteredData;
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    if (!data || data.length === 0) {
      const isFiltered = !!(document.getElementById('search-input')?.value || document.getElementById('filter-jenis')?.value || document.getElementById('filter-progress')?.value || document.getElementById('filter-nd')?.value || document.getElementById('filter-prodi')?.value);
      tbody.innerHTML = UI.renderEmptyState('Belum ada data bahan ajar', isFiltered);
      UI.updateTableCount(0, this.data.length);
      UI.renderPagination(0, 1, this.itemsPerPage);
      return;
    }

    let paginatedData = data;
    let startIndex = 0;
    if (this.itemsPerPage !== 'all') {
      startIndex = (this.currentPage - 1) * this.itemsPerPage;
      paginatedData = data.slice(startIndex, startIndex + this.itemsPerPage);
    }

    tbody.innerHTML = paginatedData.map((item, i) => {
      const actualIndex = startIndex + i;
      const progressBadge = Utils.getProgressBadge(item.PROGRESS_PENULISAN);
      const ndBadge = Utils.getNdBadge(item.ND_KE_KEU);
      const pct = parseInt(item.PERSENTASE_PENYELESAIAN) || 0;

      // SK links
      let skLinks = [];
      try {
        if (typeof item.DAFTAR_SK === 'string' && item.DAFTAR_SK.trim().startsWith('[')) {
          skLinks = JSON.parse(item.DAFTAR_SK);
        } else if (item.DAFTAR_SK) {
          skLinks = [{ year: 'SK', url: item.DAFTAR_SK }];
        }
      } catch(e) {}
      if (!Array.isArray(skLinks)) skLinks = [];

      // Only show the latest SK on the main table
      let latestSkLink = [];
      if (skLinks.length > 0) {
        const sortedLinks = [...skLinks].sort((a, b) => {
          const yearA = parseInt(a.year) || 0;
          const yearB = parseInt(b.year) || 0;
          return yearB - yearA; // descending
        });
        latestSkLink = [sortedLinks[0]];
      }

      // Tim Penyusun: display with line breaks handled strictly
      const timPenyusunDisplay = Utils.truncate((item.TIM_PENYUSUN || '').replace(/[\r\n]+/g, ', '), 35);

      return `
        <tr data-id="${Utils.escapeHtml(item.ID)}" class="hover:bg-surface-bright transition-colors group">
          <td class="px-6 py-4 text-on-surface-variant font-medium text-xs w-12">${actualIndex + 1}</td>
          
          <td class="px-6 py-4 max-w-[320px]">
            <div class="flex flex-col gap-1.5">
              <span class="font-semibold text-on-surface hover:text-primary cursor-pointer transition-colors block text-sm leading-snug break-words" onclick="App.openDetailModal('${Utils.escapeHtml(item.ID)}')" title="${Utils.escapeHtml(item.JUDUL)}">
                ${Utils.escapeHtml(Utils.truncate(item.JUDUL, 80))}
              </span>
              <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-primary-fixed text-on-primary-fixed border border-primary-fixed-dim">
                  ${Utils.escapeHtml(item.JENIS_BAHAN_AJAR || '-')}
                </span>
                ${item.PRODI ? item.PRODI.split(',').map(p => `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary-container text-on-secondary-container border border-outline-variant">${Utils.escapeHtml(p.trim())}</span>`).join('') : ''}
              </div>
              ${item.TIM_PENYUSUN ? `<span class="text-[11px] text-on-surface-variant truncate block" title="${Utils.escapeHtml(item.TIM_PENYUSUN.replace(/[\r\n]+/g, ', '))}">Penyusun: <span class="font-medium text-on-surface">${Utils.escapeHtml(Utils.truncate(item.TIM_PENYUSUN.replace(/[\r\n]+/g, ', '), 60))}</span></span>` : ''}
            </div>
          </td>
          
          <td class="px-6 py-4 text-center w-24">${UI.renderSimilarity(item.SIMILARITY)}</td>
          
          <td class="px-6 py-4 min-w-[180px]">
            <div class="flex flex-col gap-1.5">
              ${UI.renderProgress(pct)}
              <div class="flex flex-wrap gap-1 mt-0.5">
                ${UI.renderBadge(progressBadge)}
                ${UI.renderBadge(ndBadge)}
              </div>
            </div>
          </td>
          
          <td class="px-6 py-4 min-w-[160px]">
            <div class="flex flex-col gap-1">
              <span class="font-semibold text-on-surface text-sm">${Utils.formatCurrency(item.TOTAL_HONOR)}</span>
              ${item.TIM_EKSTERNAL_BPPK ? `<span class="text-[11px] text-on-surface-variant leading-none">Eksternal: <span class="font-medium text-on-surface">${Utils.escapeHtml(Utils.truncate(item.TIM_EKSTERNAL_BPPK, 25))}</span></span>` : ''}
            </div>
          </td>
          
          <td class="px-6 py-4 min-w-[160px]">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-1.5 text-xs text-on-surface">
                <span class="material-symbols-outlined text-[16px] text-on-surface-variant">publish</span>
                <span class="${item.SUDAH_TERBIT ? 'font-medium' : 'text-on-surface-variant'}">${Utils.escapeHtml(item.SUDAH_TERBIT || 'Belum Terbit')}</span>
              </div>
              <div class="flex flex-wrap gap-1">${UI.renderSKLinks(latestSkLink)}</div>
            </div>
          </td>
          
          <td class="px-6 py-4 text-xs text-on-surface-variant max-w-[150px] truncate" title="${Utils.escapeHtml(item.CATATAN || '-')}">
            ${Utils.escapeHtml(item.CATATAN || '-')}
          </td>
          
          <td class="px-6 py-4 text-center w-28">
            <div class="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button class="w-8 h-8 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary inline-flex items-center justify-center transition-colors" onclick="App.openDetailModal('${Utils.escapeHtml(item.ID)}')" title="Detail"><span class="material-symbols-outlined text-[18px]">visibility</span></button>
              <button class="w-8 h-8 rounded hover:bg-surface-container text-on-surface-variant hover:text-primary inline-flex items-center justify-center transition-colors" onclick="App.openEditModal('${Utils.escapeHtml(item.ID)}')" title="Edit"><span class="material-symbols-outlined text-[18px]">edit</span></button>
              <button class="w-8 h-8 rounded hover:bg-error-container text-on-surface-variant hover:text-error inline-flex items-center justify-center transition-colors" onclick="App.openDeleteModal('${Utils.escapeHtml(item.ID)}')" title="Hapus"><span class="material-symbols-outlined text-[18px]">delete</span></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    UI.updateTableCount(data.length, this.data.length);
    UI.renderPagination(data.length, this.currentPage, this.itemsPerPage);
  },

  // ==================
  // MODAL HANDLERS
  // ==================

  addSKRow(containerId, data = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const d = data || { year: new Date().getFullYear().toString(), url: '' };
    
    const row = document.createElement('div');
    row.className = 'sk-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginBottom = '8px';
    row.style.alignItems = 'center';
    
    const years = ['2023','2024','2025','2026','2027'];
    const options = years.map(y => `<option value="${y}" ${d.year === y ? 'selected' : ''}>${y}</option>`).join('');
    
    row.innerHTML = `
      <div class="flex-shrink-0 w-[100px]">
        <select class="form-select sk-year-select w-full rounded-lg border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest font-body-md text-body-md text-on-surface px-4 py-3 shadow-sm cursor-pointer">${options}</select>
      </div>
      <div class="flex-grow">
        <input type="url" class="form-input sk-url-input w-full rounded-lg border-surface-variant focus:border-primary focus:ring-1 focus:ring-primary/20 bg-surface-container-lowest font-body-md text-body-md text-on-surface px-4 py-3 shadow-sm" value="${Utils.escapeHtml(d.url)}" placeholder="https://drive.google.com/...">
      </div>
      <button type="button" class="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" onclick="this.parentElement.remove()"><span class="material-symbols-outlined">delete</span></button>
    `;
    
    container.appendChild(row);
  },

  openAddModal() {
    UI.resetForm('add-form');
    this.resetBulkTable();
    this.switchAddMode('single');
    UI.openModal('modal-add');
  },

  switchAddMode(mode) {
    this.addMode = mode;
    const modal = document.getElementById('modal-add');
    const tabSingle = document.getElementById('tab-single');
    const tabBulk = document.getElementById('tab-bulk');
    const singleBtn = document.getElementById('add-submit-btn');
    const bulkBtn = document.getElementById('bulk-submit-btn');

    document.querySelectorAll('#add-tab-toggle .tab-toggle-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === mode);
    });

    if (mode === 'single') {
      tabSingle.classList.add('active');
      tabBulk.classList.remove('active');
      tabSingle.style.display = 'block';
      tabBulk.style.display = 'none';
      singleBtn.style.display = 'flex';
      bulkBtn.style.display = 'none';
      modal.classList.remove('modal-bulk-active');
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.classList.remove('max-w-[95vw]');
        content.classList.add('max-w-[1200px]');
      }
    } else {
      tabSingle.classList.remove('active');
      tabBulk.classList.add('active');
      tabSingle.style.display = 'none';
      tabBulk.style.display = 'flex';
      singleBtn.style.display = 'none';
      bulkBtn.style.display = 'flex';
      modal.classList.add('modal-bulk-active');
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.classList.add('max-w-[95vw]');
        content.classList.remove('max-w-[1200px]');
      }
      const bulkBody = document.getElementById('bulk-table-body');
      if (!bulkBody.children.length) this.addBulkRows(5);
    }
  },

  // ==================
  // BULK INPUT
  // ==================

  addBulkRows(count = 1) {
    const tbody = document.getElementById('bulk-table-body');
    if (!tbody) return;

    for (let i = 0; i < count; i++) {
      this.bulkRowCounter++;
      const rk = this.bulkRowCounter;
      const tr = document.createElement('tr');
      tr.dataset.rowKey = rk;
      tr.className = "focus-within:bg-surface-bright transition-colors group";
      tr.innerHTML = `
        <td class="table-cell-border text-center text-on-surface-variant font-medium text-xs"></td>
        <td class="table-cell-border"><input type="text" class="table-input" data-field="JUDUL" placeholder="Judul..." oninput="App.updateBulkCounter(); App.updateBulkSimilarity(this)"></td>
        <td class="table-cell-border text-center"><div class="font-medium text-on-surface-variant text-xs" data-field="SIMILARITY">-</div></td>
        <td class="table-cell-border p-0">
          <select class="table-input cursor-pointer" data-field="JENIS_BAHAN_AJAR">
            <option value="">—</option>
            ${this.options.jenisBahanAjar.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
        </td>
        <td class="table-cell-border p-0">
          <select class="table-input cursor-pointer" data-field="PROGRESS_PENULISAN">
            <option value="">—</option>
            ${this.options.progressPenulisan.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
        </td>
        <td class="table-cell-border p-0">
          <select class="table-input cursor-pointer" data-field="ND_KE_KEU">
            <option value="">—</option>
            ${this.options.ndKeKeu.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
        </td>
        <td class="table-cell-border"><input type="text" class="table-input" data-field="SUDAH_TERBIT" placeholder="..."></td>
        <td class="table-cell-border"><input type="text" class="table-input" data-field="TIM_PENYUSUN" placeholder="Nama..." style="font-size:12px"></td>
        <td class="table-cell-border p-0 relative">
          <div class="h-full w-full bulk-prodi-wrap">
            <button type="button" class="bulk-prodi-btn w-full h-full flex items-center justify-between px-2 text-on-surface-variant text-sm hover:bg-surface transition-colors" onclick="App.toggleBulkProdi(this, ${rk})" data-row="${rk}">
              <span class="bulk-prodi-label truncate pr-2">Pilih</span>
              <span class="material-symbols-outlined text-[16px] flex-shrink-0">arrow_drop_down</span>
            </button>
            <div class="bulk-prodi-dropdown w-48" id="bulk-prodi-dd-${rk}">
              ${this.options.prodi.map(p => `
                <div class="bulk-prodi-option px-3 py-2 hover:bg-surface cursor-pointer text-sm flex items-center gap-2 checkbox-item" data-value="${p}" onclick="App.selectBulkProdi(this, ${rk})">
                  <div class="w-4 h-4 border border-outline-variant rounded flex items-center justify-center text-primary bg-surface-container-lowest"><span class="material-symbols-outlined text-[14px] font-bold prodi-check">check</span></div>
                  ${p}
                </div>
              `).join('')}
            </div>
          </div>
        </td>
        <td class="table-cell-border"><input type="number" class="table-input" data-field="TOTAL_HONOR" placeholder="0" min="0"></td>
        <td class="table-cell-border"><input type="text" class="table-input" data-field="TIM_EKSTERNAL_BPPK" placeholder="..."></td>
        <td class="table-cell-border p-0">
          <select class="table-input cursor-pointer" data-field="SK_TAHUN">
            <option value="">—</option>
            ${this.options.skTahun.map(y => `<option value="${y}">${y}</option>`).join('')}
          </select>
        </td>
        <td class="table-cell-border"><input type="url" class="table-input" data-field="SK_URL" placeholder="URL SK..."></td>
        <td class="table-cell-border"><input type="text" class="table-input" data-field="CATATAN" placeholder="..."></td>
        <td class="table-cell-border text-center"><button type="button" class="w-8 h-8 rounded hover:bg-error-container text-on-surface-variant hover:text-error inline-flex items-center justify-center transition-colors" onclick="App.removeBulkRow(this)" title="Hapus Baris"><span class="material-symbols-outlined text-[18px]">delete</span></button></td>
      `;
      tbody.appendChild(tr);
    }
    this.updateBulkCounter();
    this.renumberBulkRows();
  },

  toggleBulkProdi(btn, rowKey) {
    const dd = document.getElementById(`bulk-prodi-dd-${rowKey}`);
    if (!dd) return;
    document.querySelectorAll('.bulk-prodi-dropdown.active').forEach(d => { if (d !== dd) d.classList.remove('active'); });
    dd.classList.toggle('active');
  },

  selectBulkProdi(optionEl, rowKey) {
    optionEl.classList.toggle('selected');
    optionEl.classList.toggle('checked');
    const dd = document.getElementById(`bulk-prodi-dd-${rowKey}`);
    const label = dd.parentElement.querySelector('.bulk-prodi-label');
    const selected = dd.querySelectorAll('.bulk-prodi-option.selected');
    if (selected.length === 0) {
      label.innerHTML = 'Pilih';
    } else {
      label.innerHTML = Array.from(selected).map(s => `<span class="prodi-chip">${s.dataset.value}</span>`).join('');
    }
  },

  removeBulkRow(btn) {
    const tr = btn.closest('tr');
    if (tr) {
      tr.style.opacity = '0';
      tr.style.transition = 'opacity 0.15s ease';
      setTimeout(() => { tr.remove(); this.updateBulkCounter(); this.renumberBulkRows(); }, 150);
    }
  },

  renumberBulkRows() {
    document.querySelectorAll('#bulk-table-body tr').forEach((tr, i) => {
      tr.querySelector('td:first-child').textContent = i + 1;
    });
  },

  clearEmptyBulkRows() {
    let removed = 0;
    document.querySelectorAll('#bulk-table-body tr').forEach(tr => {
      const judul = tr.querySelector('[data-field="JUDUL"]')?.value?.trim() || '';
      if (!judul) { tr.remove(); removed++; }
    });
    this.renumberBulkRows();
    this.updateBulkCounter();
    UI.showToast(removed > 0 ? `${removed} baris kosong dihapus` : 'Tidak ada baris kosong', 'info');
  },

  updateBulkCounter() {
    const rows = document.querySelectorAll('#bulk-table-body tr');
    let filled = 0;
    rows.forEach(tr => { if (tr.querySelector('[data-field="JUDUL"]')?.value?.trim()) filled++; });
    const c = document.getElementById('bulk-counter');
    if (c) c.innerHTML = `<strong>${filled}</strong> baris terisi dari ${rows.length}`;
    const s = document.getElementById('bulk-save-count');
    if (s) s.textContent = filled;
  },

  updateBulkSimilarity: Utils.debounce((inputEl) => {
    const tr = inputEl.closest('tr');
    if (!tr) return;
    const simCell = tr.querySelector('[data-field="SIMILARITY"]');
    if (!simCell) return;
    
    const text = inputEl.value.trim();
    if (text.length >= 3) {
      const r = Utils.findMaxSimilarity(text, App.data);
      simCell.innerHTML = UI.renderSimilarity(r.maxSimilarity);
    } else {
      simCell.innerHTML = '<span style="color:var(--text-tertiary);">-</span>';
    }
  }, 400),

  collectBulkData() {
    const rows = document.querySelectorAll('#bulk-table-body tr');
    const records = [];

    rows.forEach((tr, index) => {
      const judul = tr.querySelector('[data-field="JUDUL"]')?.value?.trim() || '';
      if (!judul) return;

      const rowKey = tr.dataset.rowKey;
      const prodiDd = document.getElementById(`bulk-prodi-dd-${rowKey}`);
      const prodiValues = [];
      if (prodiDd) prodiDd.querySelectorAll('.bulk-prodi-option.selected').forEach(opt => prodiValues.push(opt.dataset.value));

      // SK: map year to correct field
      const skTahun = tr.querySelector('[data-field="SK_TAHUN"]')?.value || '';
      const skUrl = tr.querySelector('[data-field="SK_URL"]')?.value?.trim() || '';

      const record = {
        _rowIndex: index,
        _tr: tr,
        JUDUL: judul,
        SIMILARITY: parseInt(tr.querySelector('[data-field="SIMILARITY"]')?.textContent) || 0,
        JENIS_BAHAN_AJAR: tr.querySelector('[data-field="JENIS_BAHAN_AJAR"]')?.value || '',
        PROGRESS_PENULISAN: tr.querySelector('[data-field="PROGRESS_PENULISAN"]')?.value || '',
        ND_KE_KEU: tr.querySelector('[data-field="ND_KE_KEU"]')?.value || '',
        SUDAH_TERBIT: tr.querySelector('[data-field="SUDAH_TERBIT"]')?.value?.trim() || '',
        TIM_EKSTERNAL_BPPK: tr.querySelector('[data-field="TIM_EKSTERNAL_BPPK"]')?.value?.trim() || '',
        TOTAL_HONOR: Utils.parseCurrency(tr.querySelector('[data-field="TOTAL_HONOR"]')?.value || '0'),
        PRODI: prodiValues.join(', '),
        DAFTAR_SK: (() => {
          const year = tr.querySelector('[data-field="SK_TAHUN"]')?.value || '';
          const url = tr.querySelector('[data-field="SK_URL"]')?.value?.trim() || '';
          return url ? [{year, url}] : [];
        })(),
        CATATAN: tr.querySelector('[data-field="CATATAN"]')?.value?.trim() || '',
        TIM_PENYUSUN: tr.querySelector('[data-field="TIM_PENYUSUN"]')?.value?.trim() || '',
      };

      records.push(record);
    });

    return records;
  },

  async handleBulkAdd() {
    if (this.bulkSaving) return;
    const records = this.collectBulkData();

    if (records.length === 0) {
      UI.showToast('Tidak ada data untuk disimpan. Isi minimal 1 judul.', 'warning');
      return;
    }

    let hasErrors = false;
    records.forEach(r => {
      r._tr.classList.remove('bulk-row-error');
      if (!r.JUDUL || !r.JENIS_BAHAN_AJAR) { r._tr.classList.add('bulk-row-error'); hasErrors = true; }
    });
    if (hasErrors) {
      UI.showToast('Beberapa baris belum lengkap (Judul & Jenis wajib). Baris error ditandai merah.', 'warning');
      return;
    }

    this.bulkSaving = true;
    const bulkBtn = document.getElementById('bulk-submit-btn');
    if (bulkBtn) { bulkBtn.disabled = true; bulkBtn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Menyimpan...'; }

    const progressEl = document.getElementById('bulk-progress');
    const progressFill = document.getElementById('bulk-progress-fill');
    const progressText = document.getElementById('bulk-progress-text');
    if (progressEl) progressEl.classList.add('active');

    let saved = 0, failed = 0;
    const total = records.length;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const simResult = Utils.findMaxSimilarity(record.JUDUL, this.data);
      record.SIMILARITY = simResult.maxSimilarity;

      const cleanRecord = { ...record };
      delete cleanRecord._rowIndex;
      delete cleanRecord._tr;

      try {
        await API.create(cleanRecord);
        saved++;
        record._tr.style.opacity = '0.3';
        record._tr.style.background = 'var(--success-50)';
      } catch (error) {
        failed++;
        record._tr.classList.add('bulk-row-error');
      }

      const pct = Math.round(((i + 1) / total) * 100);
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.textContent = `Menyimpan ${i + 1}/${total}... (${saved} berhasil${failed ? `, ${failed} gagal` : ''})`;

      if (i < records.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    this.bulkSaving = false;
    if (bulkBtn) { bulkBtn.disabled = false; bulkBtn.innerHTML = `<span class="material-symbols-outlined text-[18px]">save</span> Simpan Semua (<span id="bulk-save-count">0</span> data)`; }
    if (progressText) progressText.textContent = `Selesai! ${saved} berhasil${failed ? `, ${failed} gagal` : ''}`;

    if (failed === 0) {
      UI.showToast(`${saved} data berhasil disimpan!`, 'success');
      setTimeout(() => { UI.closeModal('modal-add'); this.resetBulkTable(); }, 1200);
    } else {
      UI.showToast(`${saved} berhasil, ${failed} gagal. Periksa baris merah.`, 'warning');
    }

    await this.loadData();
  },

  resetBulkTable() {
    const tbody = document.getElementById('bulk-table-body');
    if (tbody) tbody.innerHTML = '';
    this.bulkRowCounter = 0;
    const p = document.getElementById('bulk-progress');
    if (p) p.classList.remove('active');
    const f = document.getElementById('bulk-progress-fill');
    if (f) f.style.width = '0%';
    this.updateBulkCounter();
    this.renumberBulkRows();
  },

  // ==================
  // EDIT / DETAIL / DELETE
  // ==================

  openEditModal(id) {
    const record = this.data.find(d => d.ID === id);
    if (!record) { UI.showToast('Data tidak ditemukan', 'error'); return; }

    this.editingId = id;
    UI.resetForm('edit-form');
    UI.populateForm('edit-form', record);

    const simResult = Utils.findMaxSimilarity(record.JUDUL, this.data, id);
    UI.updateSimilarityDisplay('edit', simResult.maxSimilarity, simResult.mostSimilarTitle);

    UI.openModal('modal-edit');
  },

  openDetailModal(id) {
    const record = this.data.find(d => d.ID === id);
    if (!record) { UI.showToast('Data tidak ditemukan', 'error'); return; }

    const detailBody = document.getElementById('detail-body');
    if (!detailBody) return;

    const pct = parseInt(record.PERSENTASE_PENYELESAIAN) || 0;
    const progressBadge = Utils.getProgressBadge(record.PROGRESS_PENULISAN);
    const ndBadge = Utils.getNdBadge(record.ND_KE_KEU);

    // SK links
    let skLinks = [];
    try {
      if (typeof record.DAFTAR_SK === 'string' && record.DAFTAR_SK.trim().startsWith('[')) {
        skLinks = JSON.parse(record.DAFTAR_SK);
      } else if (record.DAFTAR_SK) {
        skLinks = [{ year: 'SK', url: record.DAFTAR_SK }];
      }
    } catch(e) {}
    if (!Array.isArray(skLinks)) skLinks = [];

    // History
    let historyEntries = [];
    try {
      historyEntries = typeof record.HISTORY === 'string' ? JSON.parse(record.HISTORY) : (record.HISTORY || []);
    } catch(e) {}
    if (!Array.isArray(historyEntries)) historyEntries = [];
    
    let historyHtml = historyEntries.length ? historyEntries.map(h => `
      <div class="border-l-2 border-primary pl-3 ml-1.5">
        <div class="font-body-sm text-body-sm text-on-surface-variant">${Utils.formatDate(h.date)}</div>
        <div class="font-label-md text-label-md text-on-surface">${Utils.escapeHtml(h.action)}</div>
        <div class="font-body-sm text-body-sm text-on-surface-variant">${Utils.escapeHtml(h.details)}</div>
      </div>
    `).join('') : '<div class="font-body-sm text-body-sm text-on-surface-variant">Belum ada riwayat</div>';

    // Tim Penyusun: show line by line
    const timPenyusunHtml = (record.TIM_PENYUSUN || '-').split('\n').map(n => Utils.escapeHtml(n.trim())).filter(Boolean).join('<br>');

    detailBody.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-gutter gap-y-stack-lg mb-6">
        <div class="flex flex-col gap-1 md:col-span-2">
          <div class="font-label-md text-label-md text-on-surface-variant">Judul Bahan Ajar</div>
          <div class="font-headline-sm text-headline-sm text-on-surface font-bold">${Utils.escapeHtml(record.JUDUL || '-')}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">Jenis</div>
          <div class="font-body-md text-body-md"><span class="inline-flex items-center px-2 py-1 rounded-md bg-secondary-fixed text-on-secondary-fixed text-xs font-medium border border-secondary-fixed-dim">${Utils.escapeHtml(record.JENIS_BAHAN_AJAR || '-')}</span></div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">Similarity</div>
          <div class="font-body-md text-body-md">${UI.renderSimilarity(record.SIMILARITY)}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">Progress</div>
          <div class="font-body-md text-body-md">${UI.renderBadge(progressBadge)}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">ND ke KEU</div>
          <div class="font-body-md text-body-md">${UI.renderBadge(ndBadge)}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">Penyelesaian</div>
          <div class="font-body-md text-body-md">${UI.renderProgress(pct)}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">Terbit</div>
          <div class="font-body-md text-body-md">${Utils.escapeHtml(record.SUDAH_TERBIT || '-')}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">Tim Eksternal</div>
          <div class="font-body-md text-body-md">${Utils.escapeHtml(record.TIM_EKSTERNAL_BPPK || '-')}</div>
        </div>
        <div class="flex flex-col gap-1">
          <div class="font-label-md text-label-md text-on-surface-variant">Honor</div>
          <div class="font-body-md text-body-md">${Utils.formatCurrency(record.TOTAL_HONOR)}</div>
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <div class="font-label-md text-label-md text-on-surface-variant">Program Studi</div>
          <div class="font-body-md text-body-md">${UI.renderProdiTags(record.PRODI)}</div>
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <div class="font-label-md text-label-md text-on-surface-variant">File SK</div>
          <div class="font-body-md text-body-md flex gap-2 flex-wrap">${UI.renderSKLinks(skLinks)}</div>
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <div class="font-label-md text-label-md text-on-surface-variant">Tim Penyusun</div>
          <div class="font-body-md text-body-md">${timPenyusunHtml || '-'}</div>
        </div>
        <div class="flex flex-col gap-1 md:col-span-2">
          <div class="font-label-md text-label-md text-on-surface-variant">Catatan</div>
          <div class="font-body-md text-body-md">${Utils.escapeHtml(record.CATATAN || '-')}</div>
        </div>
      </div>
      <div class="pt-4 border-t border-surface-variant">
        <h3 class="font-headline-sm text-headline-sm text-on-surface mb-4 flex items-center gap-2"><span class="material-symbols-outlined text-[20px]">history</span> Riwayat (History)</h3>
        <div class="flex flex-col gap-4">
          ${historyHtml}
        </div>
      </div>
    `;

    const editBtn = document.getElementById('detail-edit-btn');
    if (editBtn) editBtn.onclick = () => { UI.closeModal('modal-detail'); setTimeout(() => this.openEditModal(id), 300); };

    UI.openModal('modal-detail');
  },

  openDeleteModal(id) {
    const record = this.data.find(d => d.ID === id);
    if (!record) return;
    this.editingId = id;
    const titleEl = document.getElementById('delete-title');
    if (titleEl) titleEl.textContent = record.JUDUL || 'data ini';
    UI.openModal('modal-delete');
  },

  // ==================
  // CRUD
  // ==================

  collectFormData(prefix) {
    const v = (id) => document.getElementById(id)?.value?.trim() || '';

    const prodiValues = [];
    document.querySelectorAll(`#${prefix}-form input[name="${prefix}-prodi"]:checked`).forEach(item => {
      prodiValues.push(item.value);
    });

    const daftarSK = Array.from(document.querySelectorAll(`#${prefix}-sk-container .sk-row`)).map(row => ({
      year: row.querySelector('.sk-year-select').value,
      url: row.querySelector('.sk-url-input').value.trim()
    })).filter(sk => sk.url !== '');

    return {
      JUDUL: v(`${prefix}-judul`),
      SIMILARITY: parseInt(v(`${prefix}-similarity`)) || 0,
      JENIS_BAHAN_AJAR: v(`${prefix}-jenis`),
      PROGRESS_PENULISAN: v(`${prefix}-progress`),
      ND_KE_KEU: v(`${prefix}-nd`),
      SUDAH_TERBIT: v(`${prefix}-terbit`),
      TIM_EKSTERNAL_BPPK: v(`${prefix}-tim-eksternal`),
      TOTAL_HONOR: Utils.parseCurrency(v(`${prefix}-honor`)),
      PRODI: prodiValues.join(', '),
      DAFTAR_SK: daftarSK,
      CATATAN: v(`${prefix}-catatan`),
      TIM_PENYUSUN: v(`${prefix}-tim-penyusun`),
    };
  },

  validateForm(data, prefix) {
    let valid = true;
    const judulGroup = document.getElementById(`${prefix}-judul`)?.closest('.form-group');
    if (!data.JUDUL) { judulGroup?.classList.add('has-error'); valid = false; } else { judulGroup?.classList.remove('has-error'); }
    const jenisGroup = document.getElementById(`${prefix}-jenis`)?.closest('.form-group');
    if (!data.JENIS_BAHAN_AJAR) { jenisGroup?.classList.add('has-error'); valid = false; } else { jenisGroup?.classList.remove('has-error'); }
    return valid;
  },

  async handleAdd() {
    const data = this.collectFormData('add');
    if (!this.validateForm(data, 'add')) { UI.showToast('Lengkapi field wajib', 'warning'); return; }

    const btn = document.getElementById('add-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Menyimpan...'; }

    try {
      await API.create(data);
      UI.showToast('Data berhasil ditambahkan!', 'success');
      UI.closeModal('modal-add');
      await this.loadData();
    } catch (e) {
      UI.showToast('Gagal: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">save</span> Simpan Data'; }
    }
  },

  async handleEdit() {
    if (!this.editingId) return;
    const data = this.collectFormData('edit');
    if (!this.validateForm(data, 'edit')) { UI.showToast('Lengkapi field wajib', 'warning'); return; }

    const btn = document.getElementById('edit-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Menyimpan...'; }

    try {
      await API.update(this.editingId, data);
      UI.showToast('Data berhasil diperbarui!', 'success');
      UI.closeModal('modal-edit');
      this.editingId = null;
      await this.loadData();
    } catch (e) {
      UI.showToast('Gagal: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">save</span> Simpan Perubahan'; }
    }
  },

  async handleDelete() {
    if (!this.editingId) return;
    const btn = document.getElementById('delete-submit-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;border-width:2px;"></div> Menghapus...'; }

    try {
      await API.delete(this.editingId);
      UI.showToast('Data berhasil dihapus', 'success');
      UI.closeModal('modal-delete');
      this.editingId = null;
      await this.loadData();
    } catch (e) {
      UI.showToast('Gagal: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">delete</span> Hapus'; }
    }
  },

  // ==================
  // SETUP
  // ==================

  openSetupModal() {
    const input = document.getElementById('setup-url-input');
    if (input) input.value = API.getUrl() || '';
    UI.openModal('modal-setup');
  },

  async saveSetup() {
    const url = document.getElementById('setup-url-input')?.value?.trim();
    if (!url) { UI.showToast('Masukkan URL Google Apps Script', 'warning'); return; }
    if (!url.startsWith('https://script.google.com/')) { UI.showToast('URL harus dari script.google.com', 'warning'); return; }
    API.setUrl(url);
    UI.closeModal('modal-setup');
    this.checkConfig();
    UI.showToast('URL disimpan! Memuat data...', 'success');
    await this.loadData();
  },

  async refreshData() {
    if (!API.isConfigured()) { this.openSetupModal(); return; }
    await this.loadData();
    UI.showToast('Data berhasil di-refresh', 'info');
  },

  exportCSV() {
    const d = this.filteredData.length > 0 ? this.filteredData : this.data;
    if (d.length === 0) { UI.showToast('Tidak ada data', 'warning'); return; }
    Utils.exportToCSV(d);
    UI.showToast('CSV berhasil diunduh', 'success');
  },

  clearFilters() {
    ['search-input'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    ['filter-jenis', 'filter-progress', 'filter-nd', 'filter-prodi'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
    this.sortColumn = null;
    this.sortAsc = true;
    document.querySelectorAll('.data-table thead th').forEach(th => { th.classList.remove('sorted'); const icon = th.querySelector('.sort-icon'); if (icon) icon.textContent = '↕'; });
    this.applyFilters();
  },

  // ===================================================
  // TAB SWITCHING & OTHER PAGES RENDERERS
  // ===================================================

  switchTab(tabId) {
    // Hide all tab views
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.add('hidden');
    });
    
    // Show target tab view
    const target = document.getElementById(`view-${tabId}`);
    if (target) {
      target.classList.remove('hidden');
    }
    
    // Update navigation active styles
    document.querySelectorAll('.nav-link').forEach(link => {
      link.className = 'nav-link text-on-surface-variant hover:bg-surface-container-high mx-2 rounded-lg flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer';
    });
    
    const activeLink = document.getElementById(`nav-${tabId}`);
    if (activeLink) {
      activeLink.className = 'nav-link bg-secondary-container text-on-secondary-container rounded-lg mx-2 flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer';
    }
    
    // Close sidebar on mobile
    UI.closeSidebarOnMobile();
    
    // Render specific tab contents
    if (tabId === 'bahan-ajar') {
      this.renderKatalog();
    } else if (tabId === 'laporan') {
      this.renderLaporan();
    } else if (tabId === 'tim-penulis') {
      this.renderTimPenulis();
    } else if (tabId === 'pengaturan') {
      this.renderSettings();
    }
  },

  openEditModalFromKatalog(id) {
    this.switchTab('dashboard');
    this.openEditModal(id);
  },

  renderKatalog(resetPage = false) {
    if (resetPage) {
      this.katalogCurrentPage = 1;
    }
    const search = (document.getElementById('katalog-search')?.value || '').toLowerCase().trim();
    const fProdi = document.getElementById('katalog-filter-prodi')?.value || '';
    const grid = document.getElementById('katalog-grid');
    if (!grid) return;

    // Populate prodi dropdown in catalog if empty
    const prodiSelect = document.getElementById('katalog-filter-prodi');
    if (prodiSelect && prodiSelect.options.length <= 1) {
      this.options.prodi.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        prodiSelect.appendChild(opt);
      });
    }

    const filtered = this.data.filter(item => {
      if (search) {
        const fields = [item.JUDUL, item.TIM_PENYUSUN, item.JENIS_BAHAN_AJAR].map(f => (f || '').toLowerCase());
        if (!fields.some(f => f.includes(search))) return false;
      }
      if (fProdi) {
        const prodis = (item.PRODI || '').split(',').map(p => p.trim());
        if (!prodis.includes(fProdi)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 bg-surface-container-lowest border border-surface-variant rounded-xl text-on-surface-variant font-body-md"><span class="material-symbols-outlined text-[48px] block mb-2 opacity-50">menu_book</span>Belum ada data bahan ajar yang cocok</div>`;
      this.renderKatalogPagination(0, 1, this.katalogItemsPerPage);
      return;
    }

    // Paginate cards
    let paginatedData = filtered;
    let startIndex = 0;
    if (this.katalogItemsPerPage !== 'all') {
      startIndex = (this.katalogCurrentPage - 1) * this.katalogItemsPerPage;
      paginatedData = filtered.slice(startIndex, startIndex + this.katalogItemsPerPage);
    }

    grid.innerHTML = paginatedData.map(item => {
      const pct = parseInt(item.PERSENTASE_PENYELESAIAN) || 0;
      const progressBadge = Utils.getProgressBadge(item.PROGRESS_PENULISAN);
      
      let typeIcon = 'book';
      let iconColor = 'bg-primary/10 text-primary';
      if (item.JENIS_BAHAN_AJAR === 'Modul Praktikum' || item.JENIS_BAHAN_AJAR === 'Modul Ajar') {
        typeIcon = 'labs';
        iconColor = 'bg-orange-100 text-orange-700';
      } else if (item.JENIS_BAHAN_AJAR === 'Buku Referensi') {
        typeIcon = 'bookmark';
        iconColor = 'bg-purple-100 text-purple-700';
      }

      const shortTitle = Utils.truncate(item.JUDUL || 'Tanpa Judul', 80);
      const authors = Utils.truncate((item.TIM_PENYUSUN || 'Tidak ada tim penyusun').replace(/[\r\n]+/g, ', '), 70);
      const prodis = (item.PRODI || '').split(',').map(p => p.trim()).filter(Boolean);

      return `
        <div class="bg-surface-container-lowest rounded-xl p-5 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05),0px_2px_4px_-2px_rgba(0,0,0,0.05)] border border-surface-variant flex flex-col justify-between hover:shadow-md transition-all hover:-translate-y-0.5">
          <div class="flex flex-col gap-3">
            <div class="flex justify-between items-start">
              <div class="w-10 h-10 rounded-lg ${iconColor} flex items-center justify-center">
                <span class="material-symbols-outlined">${typeIcon}</span>
              </div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${progressBadge.bg} ${progressBadge.text} border ${progressBadge.border}">${item.PROGRESS_PENULISAN || 'Usulan Baru'}</span>
            </div>
            
            <div>
              <h4 class="font-headline-sm text-headline-sm text-on-surface line-clamp-2 min-h-[48px] hover:text-primary transition-colors cursor-pointer" onclick="App.openEditModalFromKatalog('${item.ID}')" title="${Utils.escapeHtml(item.JUDUL)}">${Utils.escapeHtml(shortTitle)}</h4>
              <p class="font-body-sm text-body-sm text-on-surface-variant mt-2 flex items-center gap-1.5"><span class="material-symbols-outlined text-[16px]">person</span> ${Utils.escapeHtml(authors)}</p>
            </div>
            
            <div class="flex flex-wrap gap-1 mt-1">
              ${prodis.map(p => `<span class="inline-block bg-secondary-fixed text-on-secondary-fixed text-[11px] font-semibold px-2 py-0.5 rounded border border-secondary-fixed-dim">${p}</span>`).join('')}
            </div>
          </div>
          
          <div class="border-t border-surface-variant mt-4 pt-4 flex items-center justify-between">
            <div class="flex flex-col gap-1 w-full">
              <div class="flex justify-between text-xs font-medium text-on-surface-variant">
                <span>Progress Penulisan</span>
                <span class="font-semibold text-primary">${pct}%</span>
              </div>
              <div class="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full" style="width: ${pct}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.renderKatalogPagination(filtered.length, this.katalogCurrentPage, this.katalogItemsPerPage);
  },

  changeKatalogPage(page) {
    this.katalogCurrentPage = page;
    this.renderKatalog();
  },

  changeKatalogItemsPerPage(limit) {
    this.katalogItemsPerPage = limit === 'all' ? 'all' : parseInt(limit);
    this.katalogCurrentPage = 1;
    this.renderKatalog();
  },

  renderKatalogPagination(totalItems, currentPage, itemsPerPage) {
    const container = document.getElementById('katalog-pagination-container');
    const buttonsContainer = document.getElementById('katalog-pagination-buttons');
    const startEl = document.getElementById('katalog-page-start');
    const endEl = document.getElementById('katalog-page-end');
    const totalEl = document.getElementById('katalog-page-total');
    
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
    buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''} onclick="App.changeKatalogPage(${currentPage - 1})"><span class="material-symbols-outlined text-[20px]">chevron_left</span></button>`;

    // Page Numbers (max 5 visible)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container font-label-md text-label-md text-xs transition-colors" onclick="App.changeKatalogPage(1)">1</button>`;
      if (startPage > 2) buttonsContainer.innerHTML += `<span class="px-1 text-on-surface-variant font-label-md text-label-md">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === currentPage;
      const btnClass = isActive 
        ? "w-8 h-8 flex items-center justify-center rounded border border-primary bg-primary text-on-primary font-label-md text-label-md text-xs transition-colors shadow-sm"
        : "w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant font-label-md text-label-md text-xs hover:bg-surface-container transition-colors";
      buttonsContainer.innerHTML += `<button class="${btnClass}" onclick="App.changeKatalogPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) buttonsContainer.innerHTML += `<span class="px-1 text-on-surface-variant font-label-md text-label-md">...</span>`;
      buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container font-label-md text-label-md text-xs transition-colors" onclick="App.changeKatalogPage(${totalPages})">${totalPages}</button>`;
    }

    // Next Button
    buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.changeKatalogPage(${currentPage + 1})"><span class="material-symbols-outlined text-[20px]">chevron_right</span></button>`;
  },

  renderLaporan() {
    const data = this.data;
    if (!data || data.length === 0) return;

    // 1. Distribusi Jenis
    const jenisCounts = {};
    this.options.jenisBahanAjar.forEach(j => jenisCounts[j] = 0);
    data.forEach(item => {
      if (item.JENIS_BAHAN_AJAR) {
        const itemVal = item.JENIS_BAHAN_AJAR.trim().toLowerCase();
        const matchKey = this.options.jenisBahanAjar.find(j => j.toLowerCase() === itemVal);
        if (matchKey) {
          jenisCounts[matchKey] = (jenisCounts[matchKey] || 0) + 1;
        }
      }
    });

    const jenisChart = document.getElementById('laporan-jenis-chart');
    if (jenisChart) {
      jenisChart.innerHTML = Object.entries(jenisCounts).map(([jenis, count]) => {
        const pct = data.length > 0 ? Math.round((count / data.length) * 100) : 0;
        return `
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs font-semibold text-on-surface">
              <span>${jenis}</span>
              <span>${count} (${pct}%)</span>
            </div>
            <div class="w-full h-3 bg-surface-container rounded-full overflow-hidden border border-outline-variant">
              <div class="h-full bg-primary rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 2. Distribusi Progress
    const progressCounts = {};
    this.options.progressPenulisan.forEach(p => progressCounts[p] = 0);
    data.forEach(item => {
      if (item.PROGRESS_PENULISAN) {
        const itemVal = item.PROGRESS_PENULISAN.trim().toLowerCase();
        const matchKey = this.options.progressPenulisan.find(p => p.toLowerCase() === itemVal);
        if (matchKey) {
          progressCounts[matchKey] = (progressCounts[matchKey] || 0) + 1;
        }
      }
    });

    const progressChart = document.getElementById('laporan-progress-chart');
    if (progressChart) {
      progressChart.innerHTML = Object.entries(progressCounts).map(([prog, count]) => {
        const pct = data.length > 0 ? Math.round((count / data.length) * 100) : 0;
        const progLower = prog.toLowerCase();
        let colorClass = 'bg-orange-500';
        if (progLower === 'selesai') colorClass = 'bg-emerald-500';
        if (progLower === 'drop') colorClass = 'bg-error';
        if (progLower === 'usulan baru') colorClass = 'bg-secondary';
        
        return `
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs font-semibold text-on-surface">
              <span>${prog}</span>
              <span>${count} (${pct}%)</span>
            </div>
            <div class="w-full h-3 bg-surface-container rounded-full overflow-hidden border border-outline-variant">
              <div class="h-full ${colorClass} rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 3. Distribusi ND
    const ndCounts = {};
    this.options.ndKeKeu.forEach(n => ndCounts[n] = 0);
    data.forEach(item => {
      if (item.ND_KE_KEU) {
        const itemVal = item.ND_KE_KEU.trim().toLowerCase();
        const matchKey = this.options.ndKeKeu.find(n => n.toLowerCase() === itemVal);
        if (matchKey) {
          ndCounts[matchKey] = (ndCounts[matchKey] || 0) + 1;
        }
      }
    });

    const ndChart = document.getElementById('laporan-nd-chart');
    if (ndChart) {
      ndChart.innerHTML = Object.entries(ndCounts).map(([nd, count]) => {
        const pct = data.length > 0 ? Math.round((count / data.length) * 100) : 0;
        const ndLower = nd.toLowerCase();
        let colorClass = 'bg-primary';
        if (ndLower === 'belum') colorClass = 'bg-orange-500';
        if (ndLower === 'tanpa honor') colorClass = 'bg-outline';

        return `
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-xs font-semibold text-on-surface">
              <span>${nd}</span>
              <span>${count} (${pct}%)</span>
            </div>
            <div class="w-full h-3 bg-surface-container rounded-full overflow-hidden border border-outline-variant">
              <div class="h-full ${colorClass} rounded-full" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // 4. Summary Table per Prodi
    const prodiTable = document.getElementById('laporan-prodi-table');
    if (prodiTable) {
      prodiTable.innerHTML = this.options.prodi.map(p => {
        const prodiItems = data.filter(item => {
          const prodis = (item.PRODI || '').split(',').map(pr => pr.trim());
          return prodis.includes(p);
        });

        const total = prodiItems.length;
        if (total === 0) {
          return `
            <tr class="hover:bg-surface-container-low transition-colors">
              <td class="px-6 py-4 font-semibold text-on-surface">${p}</td>
              <td class="px-6 py-4 text-on-surface-variant">0</td>
              <td class="px-6 py-4 text-on-surface-variant">0</td>
              <td class="px-6 py-4 text-on-surface-variant">0</td>
              <td class="px-6 py-4 text-on-surface-variant">0%</td>
              <td class="px-6 py-4 text-on-surface-variant">Rp 0</td>
            </tr>
          `;
        }

        const complete = prodiItems.filter(item => parseInt(item.PERSENTASE_PENYELESAIAN) === 100).length;
        const progress = prodiItems.filter(item => parseInt(item.PERSENTASE_PENYELESAIAN) < 100 && item.PROGRESS_PENULISAN !== 'Drop').length;
        
        let avgProgress = 0;
        let totalHonor = 0;
        prodiItems.forEach(item => {
          avgProgress += parseInt(item.PERSENTASE_PENYELESAIAN) || 0;
          totalHonor += parseFloat(item.TOTAL_HONOR) || 0;
        });
        avgProgress = Math.round(avgProgress / total);

        return `
          <tr class="hover:bg-surface-container-low transition-colors">
            <td class="px-6 py-4 font-semibold text-on-surface">${p}</td>
            <td class="px-6 py-4 font-medium text-on-surface text-center">${total}</td>
            <td class="px-6 py-4 text-emerald-600 font-semibold text-center">${complete}</td>
            <td class="px-6 py-4 text-orange-600 font-semibold text-center">${progress}</td>
            <td class="px-6 py-4 font-semibold">
              <div class="flex items-center gap-1.5">
                <div class="w-12 h-1.5 bg-surface-container border border-outline-variant rounded-full overflow-hidden">
                  <div class="h-full bg-primary" style="width: ${avgProgress}%"></div>
                </div>
                <span>${avgProgress}%</span>
              </div>
            </td>
            <td class="px-6 py-4 font-medium text-on-surface">${Utils.formatCurrency(totalHonor)}</td>
          </tr>
        `;
      }).join('');
    }
  },

  renderTimPenulis(resetPage = false) {
    if (resetPage) {
      this.timPenulisCurrentPage = 1;
    }
    const search = (document.getElementById('penulis-search')?.value || '').toLowerCase().trim();
    const grid = document.getElementById('penulis-grid');
    if (!grid) return;

    const writersMap = {};
    this.data.forEach(item => {
      const writersRaw = item.TIM_PENYUSUN || '';
      const writers = writersRaw.split(/,|\n/).map(w => w.trim()).filter(w => w.length > 2);
      
      writers.forEach(writer => {
        const normalized = writer.replace(/\s+/g, ' ');
        const key = normalized.toLowerCase();
        
        if (!writersMap[key]) {
          writersMap[key] = {
            name: normalized,
            booksCount: 0,
            totalProgress: 0,
            booksList: [],
            prodis: new Set()
          };
        }
        
        writersMap[key].booksCount += 1;
        writersMap[key].totalProgress += parseInt(item.PERSENTASE_PENYELESAIAN) || 0;
        writersMap[key].booksList.push(item.JUDUL);
        if (item.PRODI) {
          item.PRODI.split(',').forEach(p => writersMap[key].prodis.add(p.trim()));
        }
      });
    });

    let aggregated = Object.values(writersMap);

    if (search) {
      aggregated = aggregated.filter(w => w.name.toLowerCase().includes(search));
    }

    const sortVal = document.getElementById('penulis-sort')?.value || 'karya-desc';
    aggregated.sort((a, b) => {
      const avgA = Math.round(a.totalProgress / a.booksCount);
      const avgB = Math.round(b.totalProgress / b.booksCount);
      
      if (sortVal === 'karya-desc') {
        return b.booksCount - a.booksCount || b.name.localeCompare(a.name);
      } else if (sortVal === 'karya-asc') {
        return a.booksCount - b.booksCount || a.name.localeCompare(b.name);
      } else if (sortVal === 'prog-desc') {
        return avgB - avgA || b.booksCount - a.booksCount;
      } else if (sortVal === 'prog-asc') {
        return avgA - avgB || a.booksCount - b.booksCount;
      } else if (sortVal === 'name-asc') {
        return a.name.localeCompare(b.name);
      } else if (sortVal === 'name-desc') {
        return b.name.localeCompare(a.name);
      }
      return 0;
    });

    if (aggregated.length === 0) {
      grid.innerHTML = `<div class="col-span-full text-center py-12 bg-surface-container-lowest border border-surface-variant rounded-xl text-on-surface-variant font-body-md"><span class="material-symbols-outlined text-[48px] block mb-2 opacity-50">groups</span>Belum ada data tim penulis yang cocok</div>`;
      this.renderTimPenulisPagination(0, 1, this.timPenulisItemsPerPage);
      return;
    }

    // Paginate authors
    let paginatedData = aggregated;
    let startIndex = 0;
    if (this.timPenulisItemsPerPage !== 'all') {
      startIndex = (this.timPenulisCurrentPage - 1) * this.timPenulisItemsPerPage;
      paginatedData = aggregated.slice(startIndex, startIndex + this.timPenulisItemsPerPage);
    }

    grid.innerHTML = paginatedData.map((writer, idx) => {
      const globalIdx = startIndex + idx;
      const avgProgress = Math.round(writer.totalProgress / writer.booksCount);
      const prodiArray = Array.from(writer.prodis);
      const bookTitlesEscaped = writer.booksList.map(b => `• ${Utils.escapeHtml(b)}`).join('\n');
      
      const colors = [
        'bg-primary text-on-primary',
        'bg-secondary-container text-on-secondary-container border-secondary-fixed-dim',
        'bg-emerald-100 text-emerald-800 border-emerald-300',
        'bg-purple-100 text-purple-800 border-purple-300',
        'bg-orange-100 text-orange-800 border-orange-300'
      ];
      const colorCls = colors[globalIdx % colors.length];

      return `
        <div class="bg-surface-container-lowest rounded-xl p-5 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.05),0px_2px_4px_-2px_rgba(0,0,0,0.05)] border border-surface-variant flex flex-col justify-between hover:shadow-md transition-all">
          <div>
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${colorCls}">
                ${writer.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div>
                <h4 class="font-headline-sm text-headline-sm text-on-surface line-clamp-1" title="${Utils.escapeHtml(writer.name)}">${Utils.escapeHtml(writer.name)}</h4>
                <p class="font-body-sm text-body-sm text-on-surface-variant">${prodiArray.slice(0, 2).join(', ') || '-'}</p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 bg-surface p-3 rounded-lg border border-surface-variant mb-4">
              <div class="text-center">
                <span class="block text-xs text-on-surface-variant font-medium">Bahan Ajar</span>
                <span class="text-headline-md font-bold text-primary">${writer.booksCount}</span>
              </div>
              <div class="text-center">
                <span class="block text-xs text-on-surface-variant font-medium">Avg Progress</span>
                <span class="text-headline-md font-bold text-emerald-600">${avgProgress}%</span>
              </div>
            </div>
            
            <div class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-on-surface-variant">Daftar Karya:</span>
              <div class="text-xs text-on-surface-variant line-clamp-3 leading-relaxed whitespace-pre-line" title="${Utils.escapeHtml(bookTitlesEscaped)}">${Utils.escapeHtml(bookTitlesEscaped)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.renderTimPenulisPagination(aggregated.length, this.timPenulisCurrentPage, this.timPenulisItemsPerPage);
  },

  changeTimPenulisPage(page) {
    this.timPenulisCurrentPage = page;
    this.renderTimPenulis();
  },

  changeTimPenulisItemsPerPage(limit) {
    this.timPenulisItemsPerPage = limit === 'all' ? 'all' : parseInt(limit);
    this.timPenulisCurrentPage = 1;
    this.renderTimPenulis();
  },

  renderTimPenulisPagination(totalItems, currentPage, itemsPerPage) {
    const container = document.getElementById('penulis-pagination-container');
    const buttonsContainer = document.getElementById('penulis-pagination-buttons');
    const startEl = document.getElementById('penulis-page-start');
    const endEl = document.getElementById('penulis-page-end');
    const totalEl = document.getElementById('penulis-page-total');
    
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
    buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''} onclick="App.changeTimPenulisPage(${currentPage - 1})"><span class="material-symbols-outlined text-[20px]">chevron_left</span></button>`;

    // Page Numbers (max 5 visible)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    if (startPage > 1) {
      buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container font-label-md text-label-md text-xs transition-colors" onclick="App.changeTimPenulisPage(1)">1</button>`;
      if (startPage > 2) buttonsContainer.innerHTML += `<span class="px-1 text-on-surface-variant font-label-md text-label-md">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
      const isActive = i === currentPage;
      const btnClass = isActive 
        ? "w-8 h-8 flex items-center justify-center rounded border border-primary bg-primary text-on-primary font-label-md text-label-md text-xs transition-colors shadow-sm"
        : "w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant font-label-md text-label-md text-xs hover:bg-surface-container transition-colors";
      buttonsContainer.innerHTML += `<button class="${btnClass}" onclick="App.changeTimPenulisPage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) buttonsContainer.innerHTML += `<span class="px-1 text-on-surface-variant font-label-md text-label-md">...</span>`;
      buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container font-label-md text-label-md text-xs transition-colors" onclick="App.changeTimPenulisPage(${totalPages})">${totalPages}</button>`;
    }

    // Next Button
    buttonsContainer.innerHTML += `<button class="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''} onclick="App.changeTimPenulisPage(${currentPage + 1})"><span class="material-symbols-outlined text-[20px]">chevron_right</span></button>`;
  },

  renderSettings() {
    const settingsUrl = document.getElementById('settings-api-url');
    if (settingsUrl) {
      settingsUrl.value = API.getUrl() || '';
    }
    
    const settingsCache = document.getElementById('settings-cache-count');
    if (settingsCache) {
      settingsCache.textContent = this.data.length + ' Baris Data';
    }

    const settingsStatus = document.getElementById('settings-status');
    if (settingsStatus) {
      if (API.isConfigured()) {
        settingsStatus.className = 'font-medium text-emerald-600';
        settingsStatus.textContent = 'Terhubung';
      } else {
        settingsStatus.className = 'font-medium text-error';
        settingsStatus.textContent = 'Belum Terhubung';
      }
    }

    const activeInterval = parseInt(localStorage.getItem('sync-interval')) || 0;
    if (activeInterval === 0) document.getElementById('sync-manual').checked = true;
    else if (activeInterval === 5) document.getElementById('sync-5m').checked = true;
    else if (activeInterval === 15) document.getElementById('sync-15m').checked = true;
  },

  saveSettingsConnection() {
    const url = document.getElementById('settings-api-url')?.value.trim();
    if (!url) {
      UI.showToast('URL API tidak boleh kosong', 'warning');
      return;
    }
    
    const key = sessionStorage.getItem('monitoring_key');
    if (key && typeof Auth !== 'undefined') {
      const salt = CryptoJS.SHA256(url);
      const saltHex = salt.toString(CryptoJS.enc.Hex);
      localStorage.setItem('monitoring_api_salt', saltHex);

      const aesKeyHex = Auth.deriveKey(key, salt);
      const encrypted = Auth.encryptUrl(url, aesKeyHex);
      if (encrypted) {
        localStorage.setItem('monitoring_api_url_encrypted', encrypted);
        localStorage.removeItem('monitoring_api_url');
      }
    } else {
      API.setUrl(url); // Fallback if not logged in
    }
    
    API._baseUrl = url;
    UI.showToast('URL API berhasil disimpan dan diamankan', 'success');
    this.checkConfig();
    this.loadData();
    this.renderSettings();
  },

  setSyncInterval(minutes) {
    localStorage.setItem('sync-interval', minutes);
    UI.showToast(`Interval sinkronisasi diatur ke: ${minutes === 0 ? 'Manual' : minutes + ' Menit'}`, 'info');
    this.initAutoSync();
  },

  initAutoSync() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    
    const minutes = parseInt(localStorage.getItem('sync-interval')) || 0;
    if (minutes > 0) {
      this.syncTimer = setInterval(() => {
        this.loadData();
      }, minutes * 60 * 1000);
    }
  },

  resetLocalCache() {
    if (confirm('Apakah Anda yakin ingin meriset seluruh cache data lokal? Data akan diunduh ulang dari server.')) {
      this.loadData();
    }
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
