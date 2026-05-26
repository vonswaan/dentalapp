const ClinicUI = {
  escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  formatTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  },

  showToast(message, isError = false) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  },

  openModal(title, bodyHtml, footerHtml = '') {
    let overlay = document.getElementById('clinic-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'clinic-modal-overlay';
      overlay.className = 'modal-overlay hidden';
      overlay.innerHTML = '<div class="modal modal-lg" id="clinic-modal"></div>';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) ClinicUI.closeModal();
      });
    }
    const modal = document.getElementById('clinic-modal');
    modal.innerHTML = `
      <div class="modal-header-row">
        <h3>${title}</h3>
        <button type="button" class="btn btn-ghost btn-sm modal-close-btn" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-actions">${footerHtml}</div>` : ''}`;
    overlay.classList.remove('hidden');
    modal.querySelector('.modal-close-btn')?.addEventListener('click', () => ClinicUI.closeModal());
    return modal;
  },

  closeModal() {
    document.getElementById('clinic-modal-overlay')?.classList.add('hidden');
    document.getElementById('clinic-modal')?.classList.remove('modal-wide');
  },

  printHtml(html, title = 'Document') {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Please allow pop-ups to print this document.');
      return;
    }
    win.document.write(`
      <!DOCTYPE html><html><head><title>${ClinicUI.escapeHtml(title)}</title>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; padding: 40px; color: #111; max-width: 700px; margin: 0 auto; }
        .doc-header { text-align: center; border-bottom: 2px solid #0d9488; padding-bottom: 16px; margin-bottom: 24px; }
        .doc-header h1 { font-size: 1.4rem; margin: 0 0 4px; color: #0f766e; }
        .doc-header p { margin: 2px 0; font-size: 0.85rem; color: #555; }
        .doc-title { text-align: center; font-size: 1.2rem; font-weight: bold; margin: 24px 0; text-decoration: underline; }
        .doc-meta { margin-bottom: 20px; font-size: 0.95rem; }
        .doc-meta p { margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; font-size: 0.9rem; }
        th { background: #f0fdfa; }
        .text-right { text-align: right; }
        .totals { margin-top: 12px; text-align: right; }
        .totals p { margin: 4px 0; }
        .signature { margin-top: 48px; }
        .signature .line { border-top: 1px solid #333; width: 240px; margin-top: 48px; padding-top: 8px; font-size: 0.9rem; }
        .body-text { line-height: 1.8; text-align: justify; margin: 20px 0; }
        @media print { body { padding: 20px; } }
      </style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  },

  patientOptions(data, selectedId = '') {
    return (
      '<option value="">Select patient</option>' +
      data.patients
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(
          (p) =>
            `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${ClinicUI.escapeHtml(p.patientNo || '')} — ${ClinicUI.escapeHtml(p.name)}</option>`
        )
        .join('')
    );
  },

  dentistOptions(data, selectedId = '', includeBlank = false) {
    const blank = includeBlank ? '<option value="">Select dentist</option>' : '';
    return (
      blank +
      data.dentists
        .map(
          (d) =>
            `<option value="${d.id}" ${d.id === selectedId ? 'selected' : ''}>${ClinicUI.escapeHtml(d.name)}</option>`
        )
        .join('')
    );
  },

  patientPickerHtml(data, prefix = 'pt') {
    return `
      <div class="patient-picker" data-prefix="${prefix}">
        <div class="patient-mode-tabs">
          <label class="mode-tab active">
            <input type="radio" name="${prefix}PatientMode" value="existing" checked />
            Select patient
          </label>
          <label class="mode-tab">
            <input type="radio" name="${prefix}PatientMode" value="manual" />
            Enter manually
          </label>
        </div>
        <div class="patient-panel patient-panel-existing">
          <div class="form-group">
            <label>Patient *</label>
            <select name="${prefix}PatientId" id="${prefix}-patient-select">${ClinicUI.patientOptions(data)}</select>
          </div>
        </div>
        <div class="patient-panel patient-panel-manual hidden">
          <div class="form-row">
            <div class="form-group">
              <label>Full name *</label>
              <input type="text" name="${prefix}ManualName" placeholder="Patient name" />
            </div>
            <div class="form-group">
              <label>Phone *</label>
              <input type="tel" name="${prefix}ManualPhone" placeholder="+63 9XX XXX XXXX" />
            </div>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="${prefix}ManualEmail" placeholder="Optional" />
          </div>
        </div>
      </div>`;
  },

  initPatientPicker(container, prefix = 'pt') {
    const root = container.querySelector(`.patient-picker[data-prefix="${prefix}"]`) || container;
    const existingPanel = root.querySelector('.patient-panel-existing');
    const manualPanel = root.querySelector('.patient-panel-manual');
    const selectEl = root.querySelector(`#${prefix}-patient-select`) || root.querySelector(`select[name="${prefix}PatientId"]`);

    const update = () => {
      const mode = root.querySelector(`input[name="${prefix}PatientMode"]:checked`)?.value || 'existing';
      const isManual = mode === 'manual';
      existingPanel?.classList.toggle('hidden', isManual);
      manualPanel?.classList.toggle('hidden', !isManual);
      if (selectEl) selectEl.required = !isManual;
      manualPanel?.querySelectorAll('input').forEach((inp) => {
        if (inp.name === `${prefix}ManualName` || inp.name === `${prefix}ManualPhone`) {
          inp.required = isManual;
        }
      });
      root.querySelectorAll('.mode-tab').forEach((tab) => {
        const radio = tab.querySelector('input[type="radio"]');
        tab.classList.toggle('active', radio?.checked);
      });
    };

    root.querySelectorAll(`input[name="${prefix}PatientMode"]`).forEach((r) => r.addEventListener('change', update));
    update();
  },

  resolvePatientFromForm(fresh, formData, prefix = 'pt') {
    const mode = formData.get(`${prefix}PatientMode`)?.toString() || 'existing';
    if (mode === 'manual') {
      const name = formData.get(`${prefix}ManualName`)?.toString().trim();
      const phone = formData.get(`${prefix}ManualPhone`)?.toString().trim();
      const email = formData.get(`${prefix}ManualEmail`)?.toString().trim();
      if (!name || !phone) return null;
      return findOrCreatePatient(fresh, {
        name,
        phone,
        email: email || `${phone.replace(/\D/g, '')}@walkin.local`,
      });
    }
    const id = formData.get(`${prefix}PatientId`)?.toString();
    if (!id) return null;
    return getPatient(fresh, id);
  },
};
