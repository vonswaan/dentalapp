const AppointmentsModule = {
  init() {
    document.getElementById('btn-new-appointment')?.addEventListener('click', () => this.showForm());
  },

  showForm() {
    const data = loadData();
    const today = new Date().toISOString().slice(0, 10);
    const serviceOptions =
      '<option value="">Select service</option>' +
      data.services.map((s) => `<option value="${s.id}">${ClinicUI.escapeHtml(s.name)}</option>`).join('');

    const html = `
      <form id="appointment-form">
        ${ClinicUI.patientPickerHtml(data, 'apt')}
        <div class="form-section-title" style="margin-top:16px">Appointment</div>
        <div class="form-group">
          <label>Service *</label>
          <select name="serviceId" id="apt-service" required>${serviceOptions}</select>
        </div>
        <div class="form-group">
          <label>Dentist</label>
          <select name="dentistId" id="apt-dentist">${ClinicUI.dentistOptions(data, '', true)}</select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Date *</label>
            <select name="date" id="apt-date" required>
              <option value="">Select service first</option>
            </select>
          </div>
          <div class="form-group">
            <label>Time *</label>
            <select name="time" id="apt-time" required disabled>
              <option value="">Select date first</option>
            </select>
          </div>
        </div>
        <p id="apt-slot-hint" class="slot-hint" style="display:none"></p>
        <div class="form-group">
          <label>Status</label>
          <select name="status">
            <option value="pending">Pending</option>
            <option value="confirmed" selected>Confirmed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea name="notes" rows="2" placeholder="Walk-in, phone booking, etc."></textarea>
        </div>
      </form>`;

    const modal = ClinicUI.openModal(
      'New appointment',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="button" class="btn btn-primary" id="apt-save-btn">Save appointment</button>`
    );

    ClinicUI.initPatientPicker(modal, 'apt');
    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());

    const serviceEl = modal.querySelector('#apt-service');
    const dentistEl = modal.querySelector('#apt-dentist');
    const dateEl = modal.querySelector('#apt-date');
    const timeEl = modal.querySelector('#apt-time');
    const hintEl = modal.querySelector('#apt-slot-hint');

    const setHint = (msg, err = false) => {
      if (!hintEl) return;
      hintEl.textContent = msg || '';
      hintEl.classList.toggle('slot-hint-error', err);
      hintEl.style.display = msg ? 'block' : 'none';
    };

    const refreshDates = () => {
      const serviceId = serviceEl?.value || '';
      const dentistId = dentistEl?.value || '';
      dateEl.innerHTML = BookingSlots.buildDateOptions(dentistId, serviceId);
      refreshTimes();
    };

    const refreshTimes = () => {
      const serviceId = serviceEl?.value || '';
      const dentistId = dentistEl?.value || '';
      const dateStr = dateEl?.value || '';
      timeEl.innerHTML = BookingSlots.buildTimeOptions(dateStr, dentistId, serviceId);
      timeEl.disabled = !dateStr || !serviceId;

      if (!serviceId) setHint('Select service first. Booked dates/times are disabled.');
      else if (!dateStr) setHint('Fully booked dates are disabled.');
      else {
        const slots = BookingSlots.getSlotsForDate(dateStr, dentistId, serviceId);
        const open = slots.filter((s) => s.available).length;
        const booked = slots.filter((s) => s.booked).length;
        if (!open) setHint('Date fully booked — choose another date.', true);
        else setHint(`${open} available · ${booked} booked (disabled)`);
      }
    };

    serviceEl?.addEventListener('change', refreshDates);
    dentistEl?.addEventListener('change', refreshDates);
    dateEl?.addEventListener('change', () => {
      if (dateEl.selectedOptions[0]?.disabled) {
        dateEl.value = '';
        setHint('That date is fully booked.', true);
      }
      refreshTimes();
    });
    timeEl?.addEventListener('change', () => {
      if (timeEl.selectedOptions[0]?.disabled) {
        timeEl.value = '';
        setHint('That time is already booked.', true);
      }
    });

    refreshDates();
    if (dateEl.querySelector(`option[value="${today}"]:not([disabled])`)) {
      dateEl.value = today;
      refreshTimes();
    }

    const save = () => {
      const form = modal.querySelector('#appointment-form');
      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const fresh = loadData();
      const patient = ClinicUI.resolvePatientFromForm(fresh, fd, 'apt');
      if (!patient) {
        ClinicUI.showToast('Enter patient details or select a registered patient.', true);
        return;
      }

      const serviceId = fd.get('serviceId')?.toString();
      const date = fd.get('date')?.toString();
      const time = fd.get('time')?.toString();
      let dentistId = fd.get('dentistId')?.toString() || '';

      if (!serviceId || !date || !time) {
        ClinicUI.showToast('Complete all appointment fields.', true);
        return;
      }

      if (!BookingSlots.isSlotAvailable(date, time, dentistId, serviceId)) {
        ClinicUI.showToast('This date and time is already booked. Choose another slot.', true);
        refreshDates();
        return;
      }

      const day = getDayName(date);
      if (!dentistId) {
        const dentists = BookingSlots.getActiveDentists(fresh, day, '');
        dentistId = dentists.find((dentist) => {
          const booked = BookingSlots.getBookedOnDate(fresh, date, dentist.id);
          const blockStart = BookingSlots.timeToMinutes(time);
          const svc = fresh.services.find((s) => s.id === serviceId);
          const duration = svc?.duration || fresh.settings.slotMinutes || 30;
          const blockEnd = blockStart + duration;
          return !booked.some((a) => {
            const { start, end } = BookingSlots.appointmentBlocks(a, fresh, fresh.settings.slotMinutes || 30);
            return blockStart < end && blockEnd > start;
          });
        })?.id;
        if (!dentistId) {
          ClinicUI.showToast('No dentist free at this time.', true);
          refreshDates();
          return;
        }
      }

      fresh.appointments.push({
        id: generateId('apt'),
        patientId: patient.id,
        patientName: patient.name,
        email: patient.email,
        phone: patient.phone,
        serviceId,
        dentistId,
        date,
        time,
        notes: fd.get('notes')?.toString().trim() || 'Staff entry',
        bookingMode: 'manual',
        status: fd.get('status')?.toString() || 'confirmed',
        createdAt: new Date().toISOString(),
      });

      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast(`Appointment saved for ${patient.name} on ${formatDate(date)}.`);
      window.AdminApp?.renderDashboard?.();
    };

    modal.querySelector('#apt-save-btn')?.addEventListener('click', save);
    modal.querySelector('#appointment-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      save();
    });
  },
};
