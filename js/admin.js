const AdminApp = {
  init() {
    this.showLogin();

    if (Auth.validateSession()) {
      try {
        this.showDashboard();
      } catch (err) {
        console.error(err);
        Auth.clearSession();
        this.showLogin();
        ClinicUI.showToast('Session expired. Please sign in again.', true);
      }
    } else {
      Auth.clearSession();
    }

    this.bindLoginForm();

    document.getElementById('logout-btn')?.addEventListener('click', () => {
      Auth.logout();
      location.reload();
    });

    try {
      PatientsModule.init();
      AppointmentsModule.init();
      DocumentsModule.init();
      InventoryModule.init();
      UsersModule.init();
      SettingsModule.init();
      BillingModule.init();
      this.setupNav();
    } catch (err) {
      console.error('Module init error:', err);
    }
  },

  bindLoginForm() {
    const form = document.getElementById('login-form');
    if (!form || form.dataset.bound === '1') return;
    form.dataset.bound = '1';

    const doLogin = () => {
      const username = document.getElementById('username')?.value;
      const password = document.getElementById('password')?.value;
      if (typeof Auth === 'undefined' || typeof loadData === 'undefined') {
        alert('System failed to load. Please hard-refresh the page (Ctrl+F5).');
        return;
      }
      const result = Auth.login(username, password);
      if (result.ok) {
        this.showDashboard();
        if (typeof ClinicUI !== 'undefined') {
          ClinicUI.showToast(`Welcome, ${result.user.fullName || result.user.username}.`);
        }
      } else {
        this.showLogin();
        if (typeof ClinicUI !== 'undefined') {
          ClinicUI.showToast(result.message, true);
        } else {
          alert(result.message);
        }
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      doLogin();
    });
  },

  showLogin() {
    document.getElementById('login-view')?.classList.remove('hidden');
    document.getElementById('dashboard-view')?.classList.add('hidden');
  },

  showDashboard() {
    if (!Auth.validateSession()) {
      Auth.clearSession();
      this.showLogin();
      ClinicUI.showToast('Please sign in to continue.', true);
      return;
    }
    document.getElementById('login-view')?.classList.add('hidden');
    document.getElementById('dashboard-view')?.classList.remove('hidden');
    Auth.applyNavPermissions();
    Auth.updateUserBadge();
    this.renderDashboard();
  },

  setupNav() {
    document.querySelectorAll('.admin-nav a[data-panel]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const panel = link.dataset.panel;
        const perm = link.dataset.permission;
        if (perm && !Auth.can(perm)) return;

        document.querySelectorAll('.admin-nav a[data-panel]').forEach((l) => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.admin-panel').forEach((p) => p.classList.add('hidden'));
        document.getElementById(`panel-${panel}`)?.classList.remove('hidden');
        document.getElementById('admin-title').textContent = link.textContent.trim();
        this.onPanelShow(panel);
      });
    });
  },

  onPanelShow(panel) {
    if (panel === 'patients') PatientsModule.render();
    if (panel === 'receipts') DocumentsModule.renderReceipts();
    if (panel === 'medcerts') DocumentsModule.renderMedCerts();
    if (panel === 'inventory') InventoryModule.render();
    if (panel === 'users') UsersModule.render();
    if (panel === 'settings') SettingsModule.render();
    if (panel === 'finance') FinanceModule.render();
  },

  renderDashboard() {
    const data = loadData();
    const today = new Date().toISOString().slice(0, 10);

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-pending', data.appointments.filter((a) => a.status === 'pending').length);
    set('stat-today', data.appointments.filter((a) => a.date === today && a.status !== 'cancelled').length);
    set('stat-patients', data.patients.length);
    set('stat-low-stock', data.inventory.filter((i) => i.quantity <= i.reorderLevel).length);
    set('stat-revenue', formatCurrency(data.receipts.reduce((s, r) => s + (r.total || 0), 0)));
    const todayIncomeEl = document.getElementById('stat-today-income');
    if (todayIncomeEl) todayIncomeEl.textContent = formatCurrency(getTodayIncome(data));

    this.renderAppointmentsTable(data, { overview: true });
    this.renderAppointmentsTable(data, { full: true });
    if (Auth.can('patients')) PatientsModule.render();
    if (Auth.can('receipts')) DocumentsModule.renderReceipts();
    if (Auth.can('medcerts')) DocumentsModule.renderMedCerts();
    if (Auth.can('inventory')) InventoryModule.render();
    if (Auth.can('users')) UsersModule.render();
    if (Auth.can('settings')) SettingsModule.render();
    this.setupFilters();
  },

  renderAppointmentsTable(data, opts = {}) {
    if (!Auth.can('appointments')) return;
    const overviewTbody = opts.overview ? document.getElementById('appointments-overview-tbody') : null;
    const fullTbody = opts.full ? document.getElementById('appointments-tbody') : null;
    if (!overviewTbody && !fullTbody) return;

    let list = this.getFilteredAppointments(data);
    list = list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

    if (overviewTbody) {
      const recent = list.slice(0, 8);
      overviewTbody.innerHTML =
        recent.length === 0
          ? '<tr><td colspan="5" class="empty-state">No appointments yet</td></tr>'
          : recent
              .map((a) => {
                const service = data.services.find((s) => s.id === a.serviceId);
                return `
        <tr>
          <td>${ClinicUI.escapeHtml(a.patientName)}</td>
          <td>${ClinicUI.escapeHtml(service?.name || '—')}</td>
          <td>${formatDate(a.date)}</td>
          <td>${ClinicUI.formatTime(a.time)}</td>
          <td><span class="badge badge-${a.status}">${a.status}</span></td>
        </tr>`;
              })
              .join('');
    }

    if (fullTbody) {
      if (list.length === 0) {
        fullTbody.innerHTML = '<tr><td colspan="8" class="empty-state">No appointments found</td></tr>';
        return;
      }

      fullTbody.innerHTML = list
        .map((a) => {
          const service = data.services.find((s) => s.id === a.serviceId);
          const dentist = data.dentists.find((d) => d.id === a.dentistId);
          return `
        <tr>
          <td>${ClinicUI.escapeHtml(a.patientName)}</td>
          <td>${ClinicUI.escapeHtml(a.phone)}</td>
          <td>${ClinicUI.escapeHtml(service?.name || '—')}</td>
          <td>${ClinicUI.escapeHtml(dentist?.name || '—')}</td>
          <td>${formatDate(a.date)}</td>
          <td>${ClinicUI.formatTime(a.time)}</td>
          <td><span class="badge badge-${a.status}">${a.status}</span></td>
          <td class="actions">
            ${a.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-action="confirm" data-id="${a.id}">Confirm</button>` : ''}
            ${a.status === 'confirmed' ? `<button class="btn btn-sm btn-primary" data-action="complete" data-id="${a.id}"><i class="fa-solid fa-cash-register"></i> Complete &amp; pay</button>` : ''}
            ${a.status === 'completed' && a.receiptId ? `<button class="btn btn-sm btn-outline" data-action="view-receipt" data-id="${a.receiptId}">Receipt</button>` : ''}
            ${a.status !== 'cancelled' && a.status !== 'completed' ? `<button class="btn btn-sm btn-danger" data-action="cancel" data-id="${a.id}">Cancel</button>` : ''}
          </td>
        </tr>`;
        })
        .join('');

      fullTbody.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => this.updateAppointmentStatus(btn.dataset.id, btn.dataset.action));
      });
    }
  },

  setupFilters() {
    const statusFilter = document.getElementById('filter-status');
    const dateFilter = document.getElementById('filter-date');
    const refresh = () => {
      const d = loadData();
      this.renderAppointmentsTable(d, { overview: true });
      this.renderAppointmentsTable(d, { full: true });
    };
    statusFilter?.addEventListener('change', refresh);
    dateFilter?.addEventListener('change', refresh);
  },

  getFilteredAppointments(data) {
    const status = document.getElementById('filter-status')?.value;
    const date = document.getElementById('filter-date')?.value;
    return data.appointments.filter((a) => {
      if (status && a.status !== status) return false;
      if (date && a.date !== date) return false;
      return true;
    });
  },

  updateAppointmentStatus(id, action) {
    if (action === 'complete') {
      BillingModule.showCompletePayment(id);
      return;
    }
    if (action === 'view-receipt') {
      DocumentsModule.printReceipt(id);
      return;
    }
    const data = loadData();
    const apt = data.appointments.find((a) => a.id === id);
    if (!apt) return;
    const map = { confirm: 'confirmed', cancel: 'cancelled' };
    apt.status = map[action] || apt.status;
    apt.updatedAt = new Date().toISOString();
    saveData(data);
    this.renderDashboard();
  },
};

document.addEventListener('DOMContentLoaded', () => {
  try {
    AdminApp.init();
  } catch (err) {
    console.error(err);
    alert('Failed to start clinic system. Hard-refresh the page (Ctrl+F5).');
  }
});
