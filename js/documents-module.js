const DocumentsModule = {
  init() {
    document.getElementById('btn-new-receipt')?.addEventListener('click', () => this.showReceiptForm());
    document.getElementById('btn-new-medcert')?.addEventListener('click', () => this.showMedCertForm());
  },

  renderReceipts() {
    const data = loadData();
    const tbody = document.getElementById('receipts-tbody');
    if (!tbody) return;

    const list = [...(data.receipts || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No receipts yet</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map(
        (r) => `
      <tr>
        <td><code>${ClinicUI.escapeHtml(r.receiptNo)}</code></td>
        <td>${formatDateLong(r.createdAt.slice(0, 10))}</td>
        <td>${ClinicUI.escapeHtml(r.patientName)}</td>
        <td>${formatCurrency(r.total)}</td>
        <td>${ClinicUI.escapeHtml(r.paymentMethod)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" data-print-receipt="${r.id}"><i class="fa-solid fa-print"></i></button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-print-receipt]').forEach((btn) =>
      btn.addEventListener('click', () => this.printReceipt(btn.dataset.printReceipt))
    );
  },

  renderMedCerts() {
    const data = loadData();
    const tbody = document.getElementById('medcerts-tbody');
    if (!tbody) return;

    const list = [...(data.medicalCerts || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No medical certificates yet</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map(
        (c) => `
      <tr>
        <td><code>${ClinicUI.escapeHtml(c.certNo)}</code></td>
        <td>${formatDateLong(c.createdAt.slice(0, 10))}</td>
        <td>${ClinicUI.escapeHtml(c.patientName)}</td>
        <td>${ClinicUI.escapeHtml(c.diagnosis)}</td>
        <td>${c.restDays} day(s)</td>
        <td class="actions">
          <button type="button" class="btn btn-sm btn-outline" data-print-medcert="${c.id}"><i class="fa-solid fa-print"></i></button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-print-medcert]').forEach((btn) =>
      btn.addEventListener('click', () => this.printMedCert(btn.getAttribute('data-print-medcert')))
    );
  },

  showReceiptForm() {
    const data = loadData();
    const serviceRows = data.services
      .map((s) => `<option value="${s.id}" data-price="${s.price}">${ClinicUI.escapeHtml(s.name)} — ${formatCurrency(s.price)}</option>`)
      .join('');

    const html = `
      <form id="receipt-form">
        ${ClinicUI.patientPickerHtml(data, 'rcpt')}
        <div class="form-row">
          <div class="form-group"><label>Payment method</label>
            <select name="paymentMethod">
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="GCash">GCash</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Add line item</label>
          <div class="line-item-add">
            <select id="rcpt-service-add">${serviceRows}</select>
            <input type="number" id="rcpt-qty-add" value="1" min="1" style="width:70px" />
            <button type="button" class="btn btn-sm btn-primary" id="rcpt-add-line">Add</button>
          </div>
        </div>
        <table class="compact-table" id="rcpt-lines-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th><th></th></tr></thead>
          <tbody id="rcpt-lines"></tbody>
        </table>
        <div class="form-row" style="margin-top:16px">
          <div class="form-group"><label>Discount (₱)</label><input type="number" name="discount" value="0" min="0" step="0.01" id="rcpt-discount" /></div>
          <div class="form-group"><label>Amount paid</label><input type="number" name="amountPaid" min="0" step="0.01" id="rcpt-paid" /></div>
        </div>
        <p class="receipt-total-preview" id="rcpt-total-preview">Total: ₱0.00</p>
        <div class="form-group"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
      </form>`;

    const lines = [];
    const modal = ClinicUI.openModal(
      'New official receipt',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="button" class="btn btn-primary" id="receipt-save-btn">Save &amp; print</button>`
    );

    const updatePreview = () => {
      const sub = lines.reduce((s, l) => s + l.amount, 0);
      const disc = parseFloat(modal.querySelector('#rcpt-discount')?.value) || 0;
      const total = Math.max(0, sub - disc);
      modal.querySelector('#rcpt-total-preview').textContent = `Subtotal: ${formatCurrency(sub)} · Total: ${formatCurrency(total)}`;
      const paid = modal.querySelector('#rcpt-paid');
      if (paid && !paid.dataset.touched) paid.value = total.toFixed(2);
    };

    const renderLines = () => {
      const tbody = modal.querySelector('#rcpt-lines');
      tbody.innerHTML =
        lines.length === 0
          ? '<tr><td colspan="5" class="empty-state">Add items above</td></tr>'
          : lines
              .map(
                (l, i) => `
          <tr>
            <td>${ClinicUI.escapeHtml(l.description)}</td>
            <td>${l.qty}</td>
            <td>${formatCurrency(l.unitPrice)}</td>
            <td>${formatCurrency(l.amount)}</td>
            <td><button type="button" class="btn btn-sm btn-danger" data-rm-line="${i}">×</button></td>
          </tr>`
              )
              .join('');
      tbody.querySelectorAll('[data-rm-line]').forEach((btn) =>
        btn.addEventListener('click', () => {
          lines.splice(Number(btn.dataset.rmLine), 1);
          renderLines();
          updatePreview();
        })
      );
      updatePreview();
    };

    modal.querySelector('#rcpt-add-line')?.addEventListener('click', () => {
      const sel = modal.querySelector('#rcpt-service-add');
      const opt = sel.selectedOptions[0];
      const qty = parseInt(modal.querySelector('#rcpt-qty-add')?.value, 10) || 1;
      const unitPrice = parseFloat(opt.dataset.price) || 0;
      lines.push({ description: opt.textContent.split(' — ')[0], qty, unitPrice, amount: qty * unitPrice });
      renderLines();
    });

    modal.querySelector('#rcpt-discount')?.addEventListener('input', updatePreview);
    modal.querySelector('#rcpt-paid')?.addEventListener('input', (e) => {
      e.target.dataset.touched = '1';
    });
    ClinicUI.initPatientPicker(modal, 'rcpt');
    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());

    const saveReceipt = () => {
      const form = modal.querySelector('#receipt-form');
      if (!form.reportValidity()) return;
      if (lines.length === 0) {
        ClinicUI.showToast('Add at least one line item.', true);
        return;
      }
      const fd = new FormData(form);
      const fresh = loadData();
      const patient = ClinicUI.resolvePatientFromForm(fresh, fd, 'rcpt');
      if (!patient) {
        ClinicUI.showToast('Select or enter patient details.', true);
        return;
      }

      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const discount = parseFloat(fd.get('discount')?.toString()) || 0;
      const total = Math.max(0, subtotal - discount);
      const amountPaid = parseFloat(fd.get('amountPaid')?.toString()) || total;

      const receipt = {
        id: generateId('rcp'),
        receiptNo: nextDocNumber(fresh, 'receipt'),
        patientId: patient.id,
        patientName: patient.name,
        items: [...lines],
        subtotal,
        discount,
        total,
        paymentMethod: fd.get('paymentMethod')?.toString() || 'Cash',
        amountPaid,
        change: Math.max(0, amountPaid - total),
        notes: fd.get('notes')?.toString().trim() || '',
        issuedBy: 'Clinic Staff',
        createdAt: new Date().toISOString(),
        incomeDate: new Date().toISOString().slice(0, 10),
      };

      if (!fresh.receipts) fresh.receipts = [];
      fresh.receipts.push(receipt);
      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast('Receipt saved.');
      this.renderReceipts();
      this.printReceipt(receipt.id);
      window.AdminApp?.renderDashboard?.();
    };

    modal.querySelector('#receipt-save-btn')?.addEventListener('click', saveReceipt);
    modal.querySelector('#receipt-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveReceipt();
    });

    renderLines();
  },

  printReceipt(id) {
    const data = loadData();
    const r = data.receipts.find((x) => x.id === id);
    if (!r) return;
    const s = data.settings;

    const rows = r.items
      .map(
        (l) =>
          `<tr><td>${ClinicUI.escapeHtml(l.description)}</td><td class="text-right">${l.qty}</td><td class="text-right">${formatCurrency(l.unitPrice)}</td><td class="text-right">${formatCurrency(l.amount)}</td></tr>`
      )
      .join('');

    ClinicUI.printHtml(
      `
      <div class="doc-header">
        <h1>${ClinicUI.escapeHtml(s.clinicName)}</h1>
        <p>${ClinicUI.escapeHtml(s.address)}</p>
        <p>Tel: ${ClinicUI.escapeHtml(s.phone)} · TIN: ${ClinicUI.escapeHtml(s.tin || '—')}</p>
      </div>
      <div class="doc-title">OFFICIAL RECEIPT</div>
      <div class="doc-meta">
        <p><strong>OR No:</strong> ${ClinicUI.escapeHtml(r.receiptNo)}</p>
        <p><strong>Date:</strong> ${formatDateLong(r.createdAt.slice(0, 10))}</p>
        <p><strong>Received from:</strong> ${ClinicUI.escapeHtml(r.patientName)}</p>
      </div>
      <table>
        <thead><tr><th>Description</th><th class="text-right">Qty</th><th class="text-right">Price</th><th class="text-right">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <p>Subtotal: ${formatCurrency(r.subtotal)}</p>
        ${r.discount ? `<p>Discount: −${formatCurrency(r.discount)}</p>` : ''}
        <p><strong>Total: ${formatCurrency(r.total)}</strong></p>
        <p>Payment: ${ClinicUI.escapeHtml(r.paymentMethod)} · Paid: ${formatCurrency(r.amountPaid)}${r.change > 0 ? ` · Change: ${formatCurrency(r.change)}` : ''}</p>
      </div>
      ${r.treatmentNotes ? `<p style="margin-top:12px;font-size:0.9rem"><strong>Treatment:</strong> ${ClinicUI.escapeHtml(r.treatmentNotes)}</p>` : ''}
      ${r.notes ? `<p style="margin-top:8px;font-size:0.9rem"><em>Note: ${ClinicUI.escapeHtml(r.notes)}</em></p>` : ''}
      <div class="signature"><div class="line">Authorized signature</div></div>
    `,
      `Receipt ${r.receiptNo}`
    );
  },

  showMedCertForm() {
    const data = loadData();
    const html = `
      <form id="medcert-form">
        ${ClinicUI.patientPickerHtml(data, 'mc')}
        <div class="form-group"><label>Attending dentist *</label><select name="dentistId" required>${ClinicUI.dentistOptions(data, '', true)}</select></div>
        <div class="form-group"><label>Diagnosis / Condition *</label><input name="diagnosis" required placeholder="e.g. Post-operative dental extraction" /></div>
        <div class="form-group"><label>Recommendation *</label><textarea name="recommendation" rows="3" required placeholder="Advised complete bed rest and avoid strenuous activity..."></textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Rest days *</label><input type="number" name="restDays" min="1" value="3" required /></div>
          <div class="form-group"><label>Start date</label><input type="date" name="startDate" value="${new Date().toISOString().slice(0, 10)}" /></div>
        </div>
        <div class="form-group"><label>End date</label><input type="date" name="endDate" /></div>
      </form>`;

    const modal = ClinicUI.openModal(
      'New medical certificate',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="button" class="btn btn-primary" id="medcert-save-btn">Save &amp; print</button>`
    );

    ClinicUI.initPatientPicker(modal, 'mc');
    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());

    const saveMedCert = () => {
      const form = modal.querySelector('#medcert-form');
      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const fresh = loadData();
      const patient = ClinicUI.resolvePatientFromForm(fresh, fd, 'mc');
      const dentist = fresh.dentists.find((d) => d.id === fd.get('dentistId')?.toString());
      if (!patient) {
        ClinicUI.showToast('Select or enter patient details.', true);
        return;
      }
      if (!dentist) {
        ClinicUI.showToast('Select an attending dentist.', true);
        return;
      }

      const diagnosis = fd.get('diagnosis')?.toString().trim();
      const recommendation = fd.get('recommendation')?.toString().trim();
      if (!diagnosis || !recommendation) {
        ClinicUI.showToast('Diagnosis and recommendation are required.', true);
        return;
      }

      const startDate = fd.get('startDate')?.toString() || new Date().toISOString().slice(0, 10);
      let endDate = fd.get('endDate')?.toString();
      const restDays = parseInt(fd.get('restDays')?.toString(), 10) || 1;
      if (!endDate) {
        const end = new Date(startDate + 'T12:00:00');
        end.setDate(end.getDate() + restDays - 1);
        endDate = end.toISOString().slice(0, 10);
      }

      const cert = {
        id: generateId('mc'),
        certNo: nextDocNumber(fresh, 'medCert'),
        patientId: patient.id,
        patientName: patient.name,
        patientAge: calcAge(patient.dob),
        diagnosis,
        recommendation,
        restDays,
        startDate,
        endDate,
        dentistId: dentist.id,
        issuedBy: dentist.name,
        licenseNo: dentist.licenseNo || '',
        createdAt: new Date().toISOString(),
      };

      if (!fresh.medicalCerts) fresh.medicalCerts = [];
      fresh.medicalCerts.push(cert);
      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast('Medical certificate saved.');
      this.renderMedCerts();
      this.printMedCert(cert.id);
      window.AdminApp?.renderDashboard?.();
    };

    modal.querySelector('#medcert-save-btn')?.addEventListener('click', saveMedCert);
    modal.querySelector('#medcert-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveMedCert();
    });
  },

  printMedCert(id) {
    const data = loadData();
    const c = data.medicalCerts.find((x) => x.id === id);
    if (!c) return;
    const s = data.settings;

    ClinicUI.printHtml(
      `
      <div class="doc-header">
        <h1>${ClinicUI.escapeHtml(s.clinicName)}</h1>
        <p>${ClinicUI.escapeHtml(s.address)}</p>
        <p>Tel: ${ClinicUI.escapeHtml(s.phone)}</p>
      </div>
      <div class="doc-title">MEDICAL CERTIFICATE</div>
      <div class="doc-meta">
        <p><strong>Cert No:</strong> ${ClinicUI.escapeHtml(c.certNo)}</p>
        <p><strong>Date issued:</strong> ${formatDateLong(c.createdAt.slice(0, 10))}</p>
      </div>
      <div class="body-text">
        <p>This is to certify that <strong>${ClinicUI.escapeHtml(c.patientName)}</strong>${c.patientAge ? `, ${c.patientAge} years of age,` : ','} was examined and treated at this clinic.</p>
        <p><strong>Diagnosis:</strong> ${ClinicUI.escapeHtml(c.diagnosis)}</p>
        <p><strong>Recommendation:</strong> ${ClinicUI.escapeHtml(c.recommendation)}</p>
        <p>The patient is advised <strong>${c.restDays} day(s)</strong> of rest from <strong>${formatDateLong(c.startDate)}</strong> to <strong>${formatDateLong(c.endDate)}</strong> unless sooner recovered.</p>
        <p>This certificate is issued upon the request of the patient for whatever legal purpose it may serve.</p>
      </div>
      <div class="signature">
        <div class="line">
          ${ClinicUI.escapeHtml(c.issuedBy)}<br/>
          ${c.licenseNo ? `License No. ${ClinicUI.escapeHtml(c.licenseNo)}` : 'Licensed Dentist'}
        </div>
      </div>
    `,
      `Med Cert ${c.certNo}`
    );
  },
};
