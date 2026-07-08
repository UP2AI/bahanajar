/**
 * Utility Functions
 * Web Monitoring Penyusunan Bahan Ajar
 */

const Utils = {
  /**
   * Calculate completion percentage based on progress and ND status
   * Progress Penulisan "Selesai" = +50%
   * ND Ke KEU "Kirim" = +50%
   */
  calculatePercentage(progressPenulisan, ndKeKeu) {
    let pct = 0;
    if (progressPenulisan && progressPenulisan.toLowerCase() === 'selesai') pct += 50;
    if (ndKeKeu && (ndKeKeu.toLowerCase() === 'kirim' || ndKeKeu.toLowerCase() === 'tanpa honor')) pct += 50;
    return pct;
  },

  /**
   * Format number as Indonesian Rupiah
   */
  formatCurrency(amount) {
    if (!amount && amount !== 0) return '-';
    const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^\d.-]/g, '')) : amount;
    if (isNaN(num)) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  },

  /**
   * Parse currency string to number
   */
  parseCurrency(str) {
    if (!str) return 0;
    return parseFloat(str.toString().replace(/[^\d.-]/g, '')) || 0;
  },

  /**
   * Generate UUID
   */
  generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  },

  /**
   * Format date to Indonesian locale
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  },

  /**
   * Debounce function
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /**
   * Truncate text with ellipsis
   */
  truncate(str, maxLen = 50) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
  },

  /**
   * Export data to CSV and trigger download
   */
  exportToCSV(data, filename = 'monitoring_bahan_ajar.csv') {
    if (!data || data.length === 0) return;

    const headers = [
      'No', 'Judul', 'Similarity (%)', 'Jenis Bahan Ajar', 'Progress Penulisan',
      'ND ke KEU', 'Sudah Terbit', 'Persentase Penyelesaian (%)',
      'Tim Eksternal BPPK', 'Total Honor', 'Prodi', 'File SK 2025',
      'File SK 2026', 'Catatan', 'Tim Penyusun'
    ];

    const rows = data.map((item, index) => [
      index + 1,
      `"${(item.JUDUL || '').replace(/"/g, '""')}"`,
      item.SIMILARITY || 0,
      `"${(item.JENIS_BAHAN_AJAR || '').replace(/"/g, '""')}"`,
      `"${(item.PROGRESS_PENULISAN || '').replace(/"/g, '""')}"`,
      `"${(item.ND_KE_KEU || '').replace(/"/g, '""')}"`,
      `"${(item.SUDAH_TERBIT || '').replace(/"/g, '""')}"`,
      item.PERSENTASE_PENYELESAIAN || 0,
      `"${(item.TIM_EKSTERNAL_BPPK || '').replace(/"/g, '""')}"`,
      item.TOTAL_HONOR || 0,
      `"${(item.PRODI || '').replace(/"/g, '""')}"`,
      `"${(item.FILE_SK_2025 || '').replace(/"/g, '""')}"`,
      `"${(item.FILE_SK_2026 || '').replace(/"/g, '""')}"`,
      `"${(item.CATATAN || '').replace(/"/g, '""')}"`,
      `"${(item.TIM_PENYUSUN || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  },

  // ============================
  // STRING SIMILARITY FUNCTIONS
  // ============================

  /**
   * Normalize string for comparison: lowercase, trim, remove extra spaces
   */
  normalizeString(str) {
    if (!str && str !== 0) return '';
    return String(str).toLowerCase().trim().replace(/\s+/g, ' ');
  },

  /**
   * Tokenize string into words
   */
  tokenize(str) {
    return this.normalizeString(str).split(/\s+/).filter(w => w.length > 0);
  },

  /**
   * Generate character n-grams from a string
   */
  ngrams(str, n = 2) {
    const normalized = this.normalizeString(str).replace(/\s/g, '');
    const grams = new Set();
    for (let i = 0; i <= normalized.length - n; i++) {
      grams.add(normalized.substring(i, i + n));
    }
    return grams;
  },

  /**
   * Jaccard similarity between two sets
   */
  jaccardSimilarity(setA, setB) {
    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  },

  /**
   * Levenshtein distance between two strings
   */
  levenshteinDistance(a, b) {
    const an = a.length;
    const bn = b.length;
    if (an === 0) return bn;
    if (bn === 0) return an;

    const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
    for (let j = 0; j <= an; j++) matrix[0][j] = j;

    for (let i = 1; i <= bn; i++) {
      for (let j = 1; j <= an; j++) {
        if (b[i - 1] === a[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,       // insertion
            matrix[i - 1][j] + 1        // deletion
          );
        }
      }
    }
    return matrix[bn][an];
  },

  /**
   * Levenshtein similarity (0-1)
   */
  levenshteinSimilarity(a, b) {
    const normA = this.normalizeString(a);
    const normB = this.normalizeString(b);
    const maxLen = Math.max(normA.length, normB.length);
    if (maxLen === 0) return 1;
    const distance = this.levenshteinDistance(normA, normB);
    return 1 - distance / maxLen;
  },

  /**
   * Word-overlap similarity (Jaccard on words)
   */
  wordSimilarity(a, b) {
    const wordsA = new Set(this.tokenize(a));
    const wordsB = new Set(this.tokenize(b));
    return this.jaccardSimilarity(wordsA, wordsB);
  },

  /**
   * Combined similarity score (0-100)
   * Uses a weighted combination of:
   * - Word Jaccard similarity (40%)
   * - Bigram Jaccard similarity (30%)
   * - Levenshtein similarity (30%)
   */
  calculateSimilarity(titleA, titleB) {
    if (!titleA || !titleB) return 0;
    
    const wordSim = this.wordSimilarity(titleA, titleB);
    const bigramSim = this.jaccardSimilarity(this.ngrams(titleA, 2), this.ngrams(titleB, 2));
    const levSim = this.levenshteinSimilarity(titleA, titleB);
    
    const combined = (wordSim * 0.4) + (bigramSim * 0.3) + (levSim * 0.3);
    return Math.round(combined * 100);
  },

  /**
   * Find the maximum similarity of a title against all existing titles
   * Returns { maxSimilarity, mostSimilarTitle }
   */
  findMaxSimilarity(newTitle, existingTitles, excludeId = null) {
    if (!newTitle || !existingTitles || existingTitles.length === 0) {
      return { maxSimilarity: 0, mostSimilarTitle: '' };
    }

    let maxSim = 0;
    let bestTitle = '';

    for (const item of existingTitles) {
      if (excludeId && item.ID === excludeId) continue;
      if (!item.JUDUL) continue;

      const sim = this.calculateSimilarity(newTitle, item.JUDUL);
      if (sim > maxSim) {
        maxSim = sim;
        bestTitle = item.JUDUL;
      }
    }

    return { maxSimilarity: maxSim, mostSimilarTitle: bestTitle };
  },

  /**
   * Get similarity badge class
   */
  getSimilarityClass(similarity) {
    if (similarity >= 70) return 'text-error';
    if (similarity >= 40) return 'text-orange-500';
    return 'text-emerald-600';
  },

  /**
   * Get progress badge info
   */
  getProgressBadge(status) {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'selesai': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Selesai' };
      case 'proses pengerjaan': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', label: 'Proses Pengerjaan' };
      case 'usulan baru': return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Usulan Baru' };
      case 'drop': return { bg: 'bg-error-container', text: 'text-on-error-container', border: 'border-error/20', dot: 'bg-error', label: 'Drop' };
      default: return { bg: 'bg-surface-variant', text: 'text-on-surface-variant', border: 'border-outline-variant', dot: 'bg-outline', label: status || '-' };
    }
  },

  /**
   * Get ND KEU badge info
   */
  getNdBadge(status) {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'kirim': return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500', label: 'Kirim' };
      case 'dalam proses': return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500', label: 'Dalam Proses' };
      case 'belum': return { bg: 'bg-error-container', text: 'text-on-error-container', border: 'border-error/20', dot: 'bg-error', label: 'Belum' };
      case 'tanpa honor': return { bg: 'bg-surface-variant', text: 'text-on-surface-variant', border: 'border-outline-variant', dot: 'bg-outline', label: 'Tanpa Honor' };
      default: return { bg: 'bg-surface-variant', text: 'text-on-surface-variant', border: 'border-outline-variant', dot: 'bg-outline', label: status || '-' };
    }
  },
};
