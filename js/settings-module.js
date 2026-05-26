const SettingsModule = {
  init() {
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('btn-add-dentist')?.addEventListener('click', () => this.showDentistForm());
    document.getElementById('btn-add-service')?.addEventListener('click', () => this.showServiceForm());
  },

  render() {
    if (!Auth.can('settings')) return;
    this.renderSettingsForm();
    if (Auth.can('dentists')) this.renderDentists();
    if (Auth.can('services')) this.renderServices();
  },

  renderSettingsForm() {
    const data = loadData();
    const s = data.settings;
    const form = document.getElementById('clinic-settings-form');
    if (!form) return;
    form.querySelector('[name=clinicName]').value = s.clinicName || '';
    form.querySelector('[name=phone]').value = s.phone || '';
    form.querySelector('[name=email]').value = s.email || '';
    form.querySelector('[name=address]').value = s.address || '';
    form.querySelector('[name=hours]').value = s.hours || '';
    form.querySelector('[name=tin]').value = s.tin || '';
    form.querySelector('[name=slotMinutes]').value = s.slotMinutes || 30;
  },

  saveSettings() {
    const form = document.getElementById('clinic-settings-form');
    if (!form.reportValidity()) return;
    const fd = new FormData(form);
    const fresh = loadData();
    fresh.settings = {
      ...fresh.settings,
      clinicName: fd.get('clinicName')?.toString().trim(),
      phone: fd.get('phone')?.toString().trim(),
      email: fd.get('email')?.toString().trim(),
      address: fd.get('address')?.toString().trim(),
      hours: fd.get('hours')?.toString().trim(),
      tin: fd.get('tin')?.toString().trim(),
      slotMinutes: parseInt(fd.get('slotMinutes')?.toString(), 10) || 30,
    };
    saveData(fresh);
    ClinicUI.showToast('Clinic settings updated. Refresh public site to see changes.');
  },

  renderDentists() {
    const data = loadData();
    const tbody = document.getElementById('dentists-admin-tbody');
    if (!tbody) return;

    tbody.innerHTML = data.dentists
      .map((d) => {
        const days = d.available?.join(', ') || '—';
        return `
        <tr>
          <td>${ClinicUI.escapeHtml(d.name)}</td>
          <td>${ClinicUI.escapeHtml(d.specialty)}</td>
          <td>${ClinicUI.escapeHtml(d.licenseNo)}</td>
          <td>${ClinicUI.escapeHtml(days)}</td>
          <td>${ClinicUI.escapeHtml(d.phone || '—')}</td>
          <td class="actions">
            <button class="btn btn-sm btn-primary" data-edit-dentist="${d.id}">Edit / Schedule</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-edit-dentist]').forEach((btn) =>
      btn.addEventListener('click', () => this.showDentistForm(btn.dataset.editDentist))
    );
  },

  showDentistForm(dentistId = null) {
    const data = loadData();
    const d = dentistId ? data.dentists.find((x) => x.id === dentistId) : normalizeDentist({ id: generateId('den'), available: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] });

    const scheduleRows = WEEKDAYS.map((day) => {
      const slot = d.schedule?.[day] || { enabled: false, start: '08:00', end: '18:00' };
      return `
        <tr>
          <td><label><input type="checkbox" name="day_${day}" ${slot.enabled ? 'checked' : ''} /> ${day}</label></td>
          <td><input type="time" name="start_${day}" value="${slot.start || '08:00'}" /></td>
          <td><input type="time" name="end_${day}" value="${slot.end || '18:00'}" /></td>
        </tr>`;
    }).join('');

    const html = `
      <form id="dentist-form">
        <div class="form-row">
          <div class="form-group"><label>Name *</label><input name="name" required value="${ClinicUI.escapeHtml(d.name)}" /></div>
          <div class="form-group"><label>Specialty *</label><input name="specialty" required value="${ClinicUI.escapeHtml(d.specialty)}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>License no.</label><input name="licenseNo" value="${ClinicUI.escapeHtml(d.licenseNo)}" /></div>
          <div class="form-group"><label>Phone</label><input name="phone" value="${ClinicUI.escapeHtml(d.phone)}" /></div>
        </div>
        <div class="form-group"><label>Email</label><input type="email" name="email" value="${ClinicUI.escapeHtml(d.email)}" /></div>
        <div class="form-group"><label>Bio (shown on website)</label><textarea name="bio" rows="2">${ClinicUI.escapeHtml(d.bio)}</textarea></div>
        <h4 class="section-subtitle">Weekly schedule</h4>
        <table class="compact-table">
          <thead><tr><th>Day</th><th>Start</th><th>End</th></tr></thead>
          <tbody>${scheduleRows}</tbody>
        </table>
      </form>`;

    const modal = ClinicUI.openModal(
      dentistId ? 'Edit dentist & schedule' : 'Add dentist',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="button" class="btn btn-primary" id="dentist-save-btn">Save</button>`
    );

    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());
    modal.querySelector('#dentist-save-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#dentist-form');
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const fresh = loadData();
      let dentist = dentistId ? fresh.dentists.find((x) => x.id === dentistId) : { id: d.id };

      dentist.name = fd.get('name')?.toString().trim();
      dentist.specialty = fd.get('specialty')?.toString().trim();
      dentist.licenseNo = fd.get('licenseNo')?.toString().trim();
      dentist.phone = fd.get('phone')?.toString().trim();
      dentist.email = fd.get('email')?.toString().trim();
      dentist.bio = fd.get('bio')?.toString().trim();

      const schedule = {};
      const available = [];
      WEEKDAYS.forEach((day) => {
        const enabled = !!fd.get(`day_${day}`);
        schedule[day] = {
          enabled,
          start: fd.get(`start_${day}`)?.toString() || '08:00',
          end: fd.get(`end_${day}`)?.toString() || '18:00',
        };
        if (enabled) available.push(day);
      });
      dentist.schedule = schedule;
      dentist.available = available;

      if (!dentistId) fresh.dentists.push(normalizeDentist(dentist));
      else Object.assign(fresh.dentists.find((x) => x.id === dentistId), dentist);

      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast('Dentist saved.');
      this.renderDentists();
    });
  },

  renderServices() {
    const data = loadData();
    const tbody = document.getElementById('services-edit-tbody');
    if (!tbody) return;

    tbody.innerHTML = data.services
      .map(
        (s) => `
      <tr>
        <td>${ClinicUI.escapeHtml(s.name)}</td>
        <td>${s.duration} min</td>
        <td>${formatCurrency(s.price)}</td>
        <td class="actions">
          <button class="btn btn-sm btn-outline" data-edit-service="${s.id}">Edit</button>
        </td>
      </tr>`
      )
      .join('');

    tbody.querySelectorAll('[data-edit-service]').forEach((btn) =>
      btn.addEventListener('click', () => this.showServiceForm(btn.dataset.editService))
    );
  },

  showServiceForm(serviceId = null) {
    const data = loadData();
    const s = serviceId ? data.services.find((x) => x.id === serviceId) : { id: generateId('svc'), icon: 'fa-tooth', duration: 45, price: 0 };

    const html = `
      <form id="service-form">
        <div class="form-group"><label>Service name *</label><input name="name" required value="${ClinicUI.escapeHtml(s.name || '')}" /></div>
        <div class="form-group"><label>Description</label><textarea name="description" rows="2">${ClinicUI.escapeHtml(s.description || '')}</textarea></div>
        <div class="form-row">
          <div class="form-group"><label>Duration (min)</label><input type="number" name="duration" min="15" value="${s.duration || 45}" /></div>
          <div class="form-group"><label>Price (₱)</label><input type="number" name="price" min="0" step="0.01" value="${s.price || 0}" /></div>
        </div>
        <div class="form-group"><label>Icon (Font Awesome class)</label><input name="icon" value="${ClinicUI.escapeHtml(s.icon || 'fa-tooth')}" placeholder="fa-tooth" /></div>
      </form>`;

    const modal = ClinicUI.openModal(
      serviceId ? 'Edit service' : 'Add service',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="button" class="btn btn-primary" id="service-save-btn">Save</button>`
    );

    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());
    modal.querySelector('#service-save-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#service-form');
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const fresh = loadData();
      let svc = serviceId ? fresh.services.find((x) => x.id === serviceId) : { id: generateId('svc') };
      svc.name = fd.get('name')?.toString().trim();
      svc.description = fd.get('description')?.toString().trim();
      svc.duration = parseInt(fd.get('duration')?.toString(), 10) || 45;
      svc.price = parseFloat(fd.get('price')?.toString()) || 0;
      svc.icon = fd.get('icon')?.toString().trim() || 'fa-tooth';
      if (!serviceId) fresh.services.push(svc);
      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast('Service saved.');
      this.renderServices();
      window.AdminApp?.renderServicesTable?.(loadData());
    });
  },
};
