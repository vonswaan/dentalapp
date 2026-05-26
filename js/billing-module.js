const BillingModule = {
  lineItems: [],

  init() {
    document.getElementById('finance-date')?.addEventListener('change', () => this.renderFinance());
  },

  render() {
    this.renderFinance();
  },

  showCompletePayment(appointmentId) {
    const data = loadData();
    const apt = data.appointments.find((a) => a.id === appointmentId);
    if (!apt) return;

    if (apt.status === 'completed' && apt.receiptId) {
      ClinicUI.showToast('Already completed and billed. View receipt in Receipts.', true);
      return;
    }

    const patient = getPatient(data, apt.patientId);
    const service = data.services.find((s) => s.id === apt.serviceId);
    const dentist = data.dentists.find((d) => d.id === apt.dentistId);

    this.lineItems = [];
    if (service) {
      this.lineItems.push({
        description: `${service.name} (scheduled)`,
        qty: 1,
        unitPrice: service.price,
        amount: service.price,
        type: 'service',
        serviceId: service.id,
      });
    }

    const invOptions = data.inventory
      .filter((i) => i.quantity > 0)
      .map(
        (i) =>
          `<option value="${i.id}" data-price="${i.cost}">${ClinicUI.escapeHtml(i.name)} — ${formatCurrency(i.cost)} (${i.quantity} ${ClinicUI.escapeHtml(i.unit)})</option>`
      )
      .join('');

    const serviceOptions = data.services
      .map(
        (s) =>
          `<option value="${s.id}" data-price="${s.price}">${ClinicUI.escapeHtml(s.name)} — ${formatCurrency(s.price)}</option>`
      )
      .join('');

    const html = `
      <form id="complete-billing-form">
        <div class="billing-patient-banner">
          <strong>${ClinicUI.escapeHtml(apt.patientName)}</strong>
          <span class="form-hint">${formatDate(apt.date)} · ${ClinicUI.formatTime(apt.time)} · ${ClinicUI.escapeHtml(dentist?.name || '—')}</span>
        </div>
        <div class="form-group">
          <label>Treatment / activities performed *</label>
          <textarea name="treatmentNotes" rows="2" required placeholder="e.g. Cleaning, filling tooth #14, fluoride application">${ClinicUI.escapeHtml(service?.name ? `Completed: ${service.name}` : '')}</textarea>
        </div>
        <div class="form-group">
          <label>Bill items</label>
          <div class="line-item-add billing-add-row">
            <select id="bill-add-service">${serviceOptions}</select>
            <button type="button" class="btn btn-sm btn-outline" id="bill-add-svc-btn">+ Service</button>
          </div>
          <div class="line-item-add billing-add-row">
            <input type="text" id="bill-activity-desc" placeholder="Additional activity description" style="flex:1" />
            <input type="number" id="bill-activity-price" placeholder="Price" min="0" step="0.01" style="width:100px" />
            <button type="button" class="btn btn-sm btn-outline" id="bill-add-activity-btn">+ Activity</button>
          </div>
          <div class="line-item-add billing-add-row">
            <select id="bill-add-medicine"><option value="">Medicine from inventory</option>${invOptions}</select>
            <input type="number" id="bill-med-qty" value="1" min="1" style="width:70px" />
            <button type="button" class="btn btn-sm btn-outline" id="bill-add-med-btn">+ Medicine</button>
          </div>
          <div class="line-item-add billing-add-row">
            <input type="text" id="bill-other-desc" placeholder="Other charge" style="flex:1" />
            <input type="number" id="bill-other-price" placeholder="Amount" min="0" step="0.01" style="width:100px" />
            <button type="button" class="btn btn-sm btn-outline" id="bill-add-other-btn">+ Other</button>
          </div>
        </div>
        <table class="compact-table" id="bill-lines-table">
          <thead><tr><th>Item</th><th>Type</th><th>Qty</th><th>Price</th><th>Amount</th><th></th></tr></thead>
          <tbody id="bill-lines"></tbody>
        </table>
        <p class="receipt-total-preview" id="bill-total-preview">Total: ₱0.00</p>
        <div class="form-row">
          <div class="form-group">
            <label>Discount (₱)</label>
            <input type="number" name="discount" id="bill-discount" value="0" min="0" step="0.01" />
          </div>
          <div class="form-group">
            <label>Payment method *</label>
            <select name="paymentMethod" required>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="GCash">GCash</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Amount paid *</label>
          <input type="number" name="amountPaid" id="bill-paid" min="0" step="0.01" required />
        </div>
      </form>`;

    const modal = ClinicUI.openModal(
      'Complete visit & collect payment',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="button" class="btn btn-primary" id="bill-complete-btn"><i class="fa-solid fa-check"></i> Complete &amp; issue receipt</button>`
    );
    document.getElementById('clinic-modal')?.classList.add('modal-wide');

    const self = this;
    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());

    modal.querySelector('#bill-add-svc-btn')?.addEventListener('click', () => {
      const sel = modal.querySelector('#bill-add-service');
      const opt = sel?.selectedOptions[0];
      if (!opt?.value) return;
      const price = parseFloat(opt.dataset.price) || 0;
      self.lineItems.push({
        description: opt.textContent.split(' — ')[0],
        qty: 1,
        unitPrice: price,
        amount: price,
        type: 'service',
        serviceId: opt.value,
      });
      self.renderBillLines(modal);
    });

    modal.querySelector('#bill-add-activity-btn')?.addEventListener('click', () => {
      const desc = modal.querySelector('#bill-activity-desc')?.value?.trim();
      const price = parseFloat(modal.querySelector('#bill-activity-price')?.value) || 0;
      if (!desc) {
        ClinicUI.showToast('Enter activity description.', true);
        return;
      }
      self.lineItems.push({ description: desc, qty: 1, unitPrice: price, amount: price, type: 'activity' });
      modal.querySelector('#bill-activity-desc').value = '';
      modal.querySelector('#bill-activity-price').value = '';
      self.renderBillLines(modal);
    });

    modal.querySelector('#bill-add-med-btn')?.addEventListener('click', () => {
      const sel = modal.querySelector('#bill-add-medicine');
      const opt = sel?.selectedOptions[0];
      if (!opt?.value) return;
      const qty = parseInt(modal.querySelector('#bill-med-qty')?.value, 10) || 1;
      const price = parseFloat(opt.dataset.price) || 0;
      const inv = loadData().inventory.find((i) => i.id === opt.value);
      if (inv && inv.quantity < qty) {
        ClinicUI.showToast(`Only ${inv.quantity} in stock.`, true);
        return;
      }
      self.lineItems.push({
        description: inv?.name || opt.textContent,
        qty,
        unitPrice: price,
        amount: qty * price,
        type: 'medicine',
        inventoryId: opt.value,
      });
      self.renderBillLines(modal);
    });

    modal.querySelector('#bill-add-other-btn')?.addEventListener('click', () => {
      const desc = modal.querySelector('#bill-other-desc')?.value?.trim();
      const price = parseFloat(modal.querySelector('#bill-other-price')?.value) || 0;
      if (!desc) {
        ClinicUI.showToast('Enter charge description.', true);
        return;
      }
      self.lineItems.push({ description: desc, qty: 1, unitPrice: price, amount: price, type: 'additional' });
      modal.querySelector('#bill-other-desc').value = '';
      modal.querySelector('#bill-other-price').value = '';
      self.renderBillLines(modal);
    });

    modal.querySelector('#bill-discount')?.addEventListener('input', () => self.renderBillLines(modal));
    modal.querySelector('#bill-complete-btn')?.addEventListener('click', () => self.submitComplete(appointmentId, modal));

    this.renderBillLines(modal);
  },

  renderBillLines(modal) {
    const tbody = modal.querySelector('#bill-lines');
    const discount = parseFloat(modal.querySelector('#bill-discount')?.value) || 0;
    const subtotal = this.lineItems.reduce((s, l) => s + l.amount, 0);
    const total = Math.max(0, subtotal - discount);
    const paid = modal.querySelector('#bill-paid');
    if (paid && !paid.dataset.touched) paid.value = total.toFixed(2);

    modal.querySelector('#bill-total-preview').textContent =
      `Subtotal: ${formatCurrency(subtotal)} · Total: ${formatCurrency(total)}`;

    if (!tbody) return;
    if (this.lineItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Add bill items above</td></tr>';
      return;
    }

    const typeLabels = { service: 'Service', activity: 'Activity', medicine: 'Medicine', additional: 'Other' };
    tbody.innerHTML = this.lineItems
      .map(
        (l, i) => `
      <tr>
        <td>${ClinicUI.escapeHtml(l.description)}</td>
        <td><span class="badge badge-confirmed">${typeLabels[l.type] || l.type}</span></td>
        <td>${l.qty}</td>
        <td>${formatCurrency(l.unitPrice)}</td>
        <td>${formatCurrency(l.amount)}</td>
        <td><button type="button" class="btn btn-sm btn-danger" data-rm-line="${i}">×</button></td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-rm-line]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.lineItems.splice(Number(btn.dataset.rmLine), 1);
        this.renderBillLines(modal);
      });
    });

    paid?.addEventListener('input', () => {
      paid.dataset.touched = '1';
    }, { once: true });
  },

  submitComplete(appointmentId, modal) {
    const form = modal.querySelector('#complete-billing-form');
    if (!form.reportValidity()) return;
    if (this.lineItems.length === 0) {
      ClinicUI.showToast('Add at least one bill item.', true);
      return;
    }

    const fd = new FormData(form);
    const fresh = loadData();
    const apt = fresh.appointments.find((a) => a.id === appointmentId);
    if (!apt) return;

    const subtotal = this.lineItems.reduce((s, l) => s + l.amount, 0);
    const discount = parseFloat(fd.get('discount')?.toString()) || 0;
    const total = Math.max(0, subtotal - discount);
    const amountPaid = parseFloat(fd.get('amountPaid')?.toString()) || total;
    const session = Auth.getSession();

    for (const l of this.lineItems.filter((x) => x.type === 'medicine' && x.inventoryId)) {
      const inv = fresh.inventory.find((i) => i.id === l.inventoryId);
      const qty = l.qty || 1;
      if (!inv || inv.quantity < qty) {
        ClinicUI.showToast(`Insufficient stock: ${inv?.name || 'item'}`, true);
        return;
      }
    }

    const receipt = {
      id: generateId('rcp'),
      receiptNo: nextDocNumber(fresh, 'receipt'),
      appointmentId: apt.id,
      patientId: apt.patientId,
      patientName: apt.patientName,
      items: this.lineItems.map((l) => ({ ...l })),
      treatmentNotes: fd.get('treatmentNotes')?.toString().trim() || '',
      subtotal,
      discount,
      total,
      paymentMethod: fd.get('paymentMethod')?.toString() || 'Cash',
      amountPaid,
      change: Math.max(0, amountPaid - total),
      notes: apt.notes || '',
      issuedBy: session?.fullName || session?.username || 'Staff',
      createdAt: new Date().toISOString(),
      incomeDate: new Date().toISOString().slice(0, 10),
    };

    this.lineItems
      .filter((l) => l.type === 'medicine' && l.inventoryId)
      .forEach((l) => {
        const inv = fresh.inventory.find((i) => i.id === l.inventoryId);
        if (!inv) return;
        const qty = l.qty || 1;
        inv.quantity -= qty;
        fresh.inventoryLogs = fresh.inventoryLogs || [];
        fresh.inventoryLogs.push({
          id: generateId('log'),
          itemId: inv.id,
          type: 'out',
          qty,
          reason: `Used for visit — ${apt.patientName} (OR ${receipt.receiptNo})`,
          createdAt: new Date().toISOString(),
        });
      });

    fresh.receipts.push(receipt);
    apt.status = 'completed';
    apt.receiptId = receipt.id;
    apt.treatmentNotes = receipt.treatmentNotes;
    apt.completedAt = receipt.createdAt;
    apt.updatedAt = receipt.createdAt;

    const patient = getPatient(fresh, apt.patientId);
    if (patient) {
      patient.visits = patient.visits || [];
      patient.visits.push({
        id: generateId('vis'),
        date: apt.date,
        dentistId: apt.dentistId,
        diagnosis: receipt.treatmentNotes,
        treatment: this.lineItems.map((l) => l.description).join('; '),
        notes: `Receipt ${receipt.receiptNo} · ${formatCurrency(total)}`,
      });
      patient.updatedAt = new Date().toISOString();
    }

    saveData(fresh);
    ClinicUI.closeModal();
    ClinicUI.showToast(`Visit completed. Receipt ${receipt.receiptNo} — ${formatCurrency(total)}`);
    window.AdminApp?.renderDashboard?.();
    if (Auth.can('finance')) FinanceModule.render();
  },

  renderFinance() {
    if (!Auth.can('finance')) return;
    const dateInput = document.getElementById('finance-date');
    const dateStr = dateInput?.value || new Date().toISOString().slice(0, 10);
    if (dateInput && !dateInput.value) dateInput.value = dateStr;

    const data = loadData();
    const dayReceipts = getReceiptsForDate(data, dateStr);
    const total = dayReceipts.reduce((s, r) => s + (r.total || 0), 0);
    const count = dayReceipts.length;

    const byMethod = {};
    dayReceipts.forEach((r) => {
      const m = r.paymentMethod || 'Cash';
      byMethod[m] = (byMethod[m] || 0) + (r.total || 0);
    });

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('finance-day-total', formatCurrency(total));
    set('finance-day-count', String(count));
    set('finance-day-avg', count ? formatCurrency(total / count) : '—');

    const methodEl = document.getElementById('finance-by-method');
    if (methodEl) {
      methodEl.innerHTML =
        Object.keys(byMethod).length === 0
          ? '<p class="empty-state">No payments this day</p>'
          : Object.entries(byMethod)
              .map(
                ([m, amt]) =>
                  `<div class="finance-method-row"><span>${ClinicUI.escapeHtml(m)}</span><strong>${formatCurrency(amt)}</strong></div>`
              )
              .join('');
    }

    const tbody = document.getElementById('finance-daily-tbody');
    if (!tbody) return;
    if (dayReceipts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No income recorded for this date</td></tr>';
      return;
    }

    tbody.innerHTML = dayReceipts
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => {
        const types = [...new Set((r.items || []).map((i) => i.type))].join(', ');
        return `
        <tr>
          <td><code>${ClinicUI.escapeHtml(r.receiptNo)}</code></td>
          <td>${ClinicUI.escapeHtml(r.patientName)}</td>
          <td class="form-hint" style="max-width:200px">${ClinicUI.escapeHtml((r.treatmentNotes || '').slice(0, 60))}${(r.treatmentNotes || '').length > 60 ? '…' : ''}</td>
          <td>${formatCurrency(r.total)}</td>
          <td>${ClinicUI.escapeHtml(r.paymentMethod)}</td>
          <td><span class="badge badge-${types.includes('medicine') ? 'pending' : 'confirmed'}">${ClinicUI.escapeHtml(types || '—')}</span></td>
        </tr>`;
      })
      .join('');

    this.renderWeekSummary(data);
  },

  renderWeekSummary(data) {
    const el = document.getElementById('finance-week-chart');
    if (!el) return;
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const receipts = getReceiptsForDate(data, ds);
      const sum = receipts.reduce((s, r) => s + (r.total || 0), 0);
      days.push({
        label: d.toLocaleDateString('en-PH', { weekday: 'short' }),
        sum,
        count: receipts.length,
      });
    }
    const max = Math.max(...days.map((d) => d.sum), 1);
    el.innerHTML = days
      .map(
        (d) => `
      <div class="finance-bar-wrap">
        <div class="finance-bar" style="height:${Math.max(4, (d.sum / max) * 80)}px" title="${formatCurrency(d.sum)}"></div>
        <span class="finance-bar-label">${d.label}</span>
        <span class="finance-bar-amt">${formatCurrency(d.sum)}</span>
      </div>`
      )
      .join('');
  },
};

const FinanceModule = BillingModule;

function getReceiptsForDate(data, dateStr) {
  return (data.receipts || []).filter((r) => {
    const d = r.incomeDate || (r.createdAt || '').slice(0, 10);
    return d === dateStr;
  });
}

function getTodayIncome(data) {
  const today = new Date().toISOString().slice(0, 10);
  return getReceiptsForDate(data, today).reduce((s, r) => s + (r.total || 0), 0);
}
