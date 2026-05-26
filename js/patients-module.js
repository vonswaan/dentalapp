const PatientsModule = {
  init() {
    document.getElementById('btn-add-patient')?.addEventListener('click', () => this.showForm());
    document.getElementById('patient-search')?.addEventListener('input', () => this.render());
  },

  render() {
    const data = loadData();
    const q = document.getElementById('patient-search')?.value?.toLowerCase() || '';
    const tbody = document.getElementById('patients-tbody');
    if (!tbody) return;

    let list = data.patients.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.patientNo && p.patientNo.toLowerCase().includes(q))
    );
    list = list.sort((a, b) => a.name.localeCompare(b.name));

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No patients found</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((p) => {
        const visits = (p.visits || []).length;
        const apts = data.appointments.filter((a) => a.patientId === p.id).length;
        return `
        <tr>
          <td><code>${ClinicUI.escapeHtml(p.patientNo || '—')}</code></td>
          <td>${ClinicUI.escapeHtml(p.name)}</td>
          <td>${ClinicUI.escapeHtml(p.phone)}</td>
          <td>${ClinicUI.escapeHtml(p.email)}</td>
          <td>${visits}</td>
          <td>${apts}</td>
          <td class="actions">
            <button class="btn btn-sm btn-primary" data-view-patient="${p.id}">Records</button>
            <button class="btn btn-sm btn-outline" data-edit-patient="${p.id}">Edit</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-view-patient]').forEach((btn) =>
      btn.addEventListener('click', () => this.showRecord(btn.dataset.viewPatient))
    );
    tbody.querySelectorAll('[data-edit-patient]').forEach((btn) =>
      btn.addEventListener('click', () => this.showForm(btn.dataset.editPatient))
    );
  },

  showForm(patientId = null) {
    const data = loadData();
    const p = patientId ? getPatient(data, patientId) : createEmptyPatient({});

    const html = `
      <form id="patient-form" class="form-grid-2">
        <div class="form-group"><label>Full name *</label><input name="name" required value="${ClinicUI.escapeHtml(p.name)}" /></div>
        <div class="form-group"><label>Phone *</label><input name="phone" required value="${ClinicUI.escapeHtml(p.phone)}" /></div>
        <div class="form-group"><label>Email</label><input type="email" name="email" value="${ClinicUI.escapeHtml(p.email)}" /></div>
        <div class="form-group"><label>Date of birth</label><input type="date" name="dob" value="${ClinicUI.escapeHtml(p.dob)}" /></div>
        <div class="form-group"><label>Gender</label>
          <select name="gender">
            <option value="">—</option>
            <option value="Male" ${p.gender === 'Male' ? 'selected' : ''}>Male</option>
            <option value="Female" ${p.gender === 'Female' ? 'selected' : ''}>Female</option>
            <option value="Other" ${p.gender === 'Other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
        <div class="form-group"><label>Blood type</label>
          <select name="bloodType">
            <option value="">—</option>
            ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
              .map((b) => `<option value="${b}" ${p.bloodType === b ? 'selected' : ''}>${b}</option>`)
              .join('')}
          </select>
        </div>
        <div class="form-group form-full"><label>Address</label><input name="address" value="${ClinicUI.escapeHtml(p.address)}" /></div>
        <div class="form-group form-full"><label>Allergies</label><textarea name="allergies" rows="2">${ClinicUI.escapeHtml(p.allergies)}</textarea></div>
        <div class="form-group form-full"><label>Medical history</label><textarea name="medicalHistory" rows="3">${ClinicUI.escapeHtml(p.medicalHistory)}</textarea></div>
        <div class="form-group"><label>Emergency contact</label><input name="ecName" value="${ClinicUI.escapeHtml(p.emergencyContact?.name)}" placeholder="Name" /></div>
        <div class="form-group"><label>EC phone</label><input name="ecPhone" value="${ClinicUI.escapeHtml(p.emergencyContact?.phone)}" /></div>
        <div class="form-group"><label>Relationship</label><input name="ecRelation" value="${ClinicUI.escapeHtml(p.emergencyContact?.relation)}" /></div>
      </form>`;

    const modal = ClinicUI.openModal(
      patientId ? 'Edit patient' : 'Register patient',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="submit" form="patient-form" class="btn btn-primary">Save</button>`
    );

    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());
    modal.querySelector('#patient-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fresh = loadData();
      let patient = patientId ? getPatient(fresh, patientId) : createEmptyPatient({});
      if (!patient) return;

      patient.name = fd.get('name')?.toString().trim() || '';
      patient.phone = fd.get('phone')?.toString().trim() || '';
      patient.email = fd.get('email')?.toString().trim() || '';
      patient.dob = fd.get('dob')?.toString() || '';
      patient.gender = fd.get('gender')?.toString() || '';
      patient.bloodType = fd.get('bloodType')?.toString() || '';
      patient.address = fd.get('address')?.toString().trim() || '';
      patient.allergies = fd.get('allergies')?.toString().trim() || '';
      patient.medicalHistory = fd.get('medicalHistory')?.toString().trim() || '';
      patient.emergencyContact = {
        name: fd.get('ecName')?.toString().trim() || '',
        phone: fd.get('ecPhone')?.toString().trim() || '',
        relation: fd.get('ecRelation')?.toString().trim() || '',
      };
      patient.updatedAt = new Date().toISOString();

      if (!patientId) {
        if (!patient.patientNo) patient.patientNo = assignPatientNo(fresh);
        fresh.patients.push(patient);
      }

      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast('Patient record saved.');
      this.render();
      window.AdminApp?.renderDashboard?.();
    });
  },

  showRecord(patientId) {
    const data = loadData();
    const p = getPatient(data, patientId);
    if (!p) return;

    const visits = (p.visits || [])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(
        (v) => `
      <tr>
        <td>${formatDate(v.date)}</td>
        <td>${ClinicUI.escapeHtml(data.dentists.find((d) => d.id === v.dentistId)?.name || '—')}</td>
        <td>${ClinicUI.escapeHtml(v.diagnosis || '—')}</td>
        <td>${ClinicUI.escapeHtml(v.treatment || '—')}</td>
        <td>${ClinicUI.escapeHtml(v.notes || '')}</td>
      </tr>`
      )
      .join('');

    const html = `
      <div class="record-summary">
        <div><strong>${ClinicUI.escapeHtml(p.name)}</strong> <span class="badge badge-confirmed">${ClinicUI.escapeHtml(p.patientNo)}</span></div>
        <p class="form-hint">${ClinicUI.escapeHtml(p.phone)} · ${ClinicUI.escapeHtml(p.email)} · ${p.gender || '—'} · Age ${calcAge(p.dob) || '—'} · ${p.bloodType || '—'}</p>
        <p class="form-hint"><strong>Allergies:</strong> ${ClinicUI.escapeHtml(p.allergies || 'None recorded')}</p>
        <p class="form-hint"><strong>History:</strong> ${ClinicUI.escapeHtml(p.medicalHistory || 'None recorded')}</p>
      </div>
      <h4 class="section-subtitle">Clinical visits</h4>
      <button type="button" class="btn btn-sm btn-primary" id="btn-add-visit" style="margin-bottom:12px"><i class="fa-solid fa-plus"></i> Add visit</button>
      <table class="compact-table">
        <thead><tr><th>Date</th><th>Dentist</th><th>Diagnosis</th><th>Treatment</th><th>Notes</th></tr></thead>
        <tbody>${visits || '<tr><td colspan="5" class="empty-state">No visits yet</td></tr>'}</tbody>
      </table>`;

    const modal = ClinicUI.openModal('Patient record', html, '');
    modal.querySelector('#btn-add-visit')?.addEventListener('click', () => this.showVisitForm(patientId));
  },

  showVisitForm(patientId) {
    const data = loadData();
    const html = `
      <form id="visit-form">
        <div class="form-group"><label>Date *</label><input type="date" name="date" required value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="form-group"><label>Dentist</label><select name="dentistId"><option value="">—</option>${ClinicUI.dentistOptions(data)}</select></div>
        <div class="form-group"><label>Diagnosis</label><input name="diagnosis" /></div>
        <div class="form-group"><label>Treatment</label><input name="treatment" /></div>
        <div class="form-group"><label>Notes</label><textarea name="notes" rows="3"></textarea></div>
      </form>`;

    ClinicUI.closeModal();
    const modal = ClinicUI.openModal(
      'Add clinical visit',
      html,
      `<button type="button" class="btn btn-ghost" id="visit-cancel">Cancel</button>
       <button type="submit" form="visit-form" class="btn btn-primary">Save visit</button>`
    );

    modal.querySelector('#visit-cancel')?.addEventListener('click', () => this.showRecord(patientId));
    modal.querySelector('#visit-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fresh = loadData();
      const p = getPatient(fresh, patientId);
      if (!p) return;
      p.visits = p.visits || [];
      p.visits.push({
        id: generateId('vis'),
        date: fd.get('date')?.toString(),
        dentistId: fd.get('dentistId')?.toString() || '',
        diagnosis: fd.get('diagnosis')?.toString().trim() || '',
        treatment: fd.get('treatment')?.toString().trim() || '',
        notes: fd.get('notes')?.toString().trim() || '',
      });
      p.updatedAt = new Date().toISOString();
      saveData(fresh);
      ClinicUI.showToast('Visit recorded.');
      this.showRecord(patientId);
    });
  },
};
