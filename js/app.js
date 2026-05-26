(function () {
  const data = loadData();
  const settings = data.settings;

  document.title = `${settings.clinicName} | Dental Care`;
  document.querySelectorAll('[data-clinic-name]').forEach((el) => (el.textContent = settings.clinicName));
  document.querySelectorAll('[data-phone]').forEach((el) => (el.textContent = settings.phone));
  document.querySelectorAll('[data-email]').forEach((el) => (el.textContent = settings.email));
  document.querySelectorAll('[data-address]').forEach((el) => (el.textContent = settings.address));
  document.querySelectorAll('[data-hours]').forEach((el) => (el.textContent = settings.hours));

  const header = document.querySelector('.header');
  const nav = document.querySelector('.nav');
  const navToggle = document.querySelector('.nav-toggle');
  window.addEventListener('scroll', () => header?.classList.toggle('scrolled', window.scrollY > 20));
  navToggle?.addEventListener('click', () => nav?.classList.toggle('open'));

  const serviceOptions =
    '<option value="">Select a service</option>' +
    data.services.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} — ${formatCurrency(s.price)}</option>`).join('');

  const dentistOptions =
    '<option value="">Any available dentist</option>' +
    data.dentists.map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${escapeHtml(d.specialty)})</option>`).join('');

  const serviceSelect = document.getElementById('service');
  const dentistSelect = document.getElementById('dentist');
  const dateSelect = document.getElementById('appointment-date');
  const timeSelect = document.getElementById('appointment-time');
  const slotHint = document.getElementById('slot-hint');

  if (serviceSelect) serviceSelect.innerHTML = serviceOptions;
  if (dentistSelect) dentistSelect.innerHTML = dentistOptions;

  const servicesGrid = document.getElementById('services-grid');
  if (servicesGrid) {
    servicesGrid.innerHTML = data.services
      .map(
        (s) => `
      <article class="service-card-v2">
        <div class="icon"><i class="fa-solid ${s.icon}"></i></div>
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(s.description)}</p>
        <span class="price">${formatCurrency(s.price)}</span>
        <span class="form-hint"> · ${s.duration} min</span>
      </article>`
      )
      .join('');
  }

  const teamGrid = document.getElementById('team-grid');
  if (teamGrid) {
    teamGrid.innerHTML = data.dentists
      .map((d) => {
        const sched = d.available?.join(' · ') || '—';
        return `
      <article class="team-row-card">
        <div class="avatar"><i class="fa-solid fa-user-doctor"></i></div>
        <div>
          <h3>${escapeHtml(d.name)}</h3>
          <p class="role">${escapeHtml(d.specialty)}</p>
          <p class="days">${sched}</p>
        </div>
      </article>`;
      })
      .join('');
  }

  function getBookingParams() {
    return {
      serviceId: serviceSelect?.value || '',
      dentistId: dentistSelect?.value || '',
    };
  }

  function setSlotHint(message, isError = false) {
    if (!slotHint) return;
    slotHint.textContent = message || '';
    slotHint.classList.toggle('slot-hint-error', isError);
    slotHint.style.display = message ? 'block' : 'none';
  }

  function refreshDateOptions() {
    if (!dateSelect) return;
    const { serviceId, dentistId } = getBookingParams();
    const prev = dateSelect.value;
    dateSelect.innerHTML = BookingSlots.buildDateOptions(dentistId, serviceId);
    if (prev && [...dateSelect.options].some((o) => o.value === prev && !o.disabled)) {
      dateSelect.value = prev;
    } else {
      dateSelect.value = '';
    }
    refreshTimeOptions();
  }

  function refreshTimeOptions() {
    if (!timeSelect) return;
    const { serviceId, dentistId } = getBookingParams();
    const dateStr = dateSelect?.value || '';

    timeSelect.innerHTML = BookingSlots.buildTimeOptions(dateStr, dentistId, serviceId);
    timeSelect.disabled = !dateStr || !serviceId;

    if (!serviceId) {
      setSlotHint('Select a service to see available dates and times.');
    } else if (!dateStr) {
      setSlotHint('Fully booked dates are disabled. Pick an open date, then choose a time.');
    } else {
      const slots = BookingSlots.getSlotsForDate(dateStr, dentistId, serviceId);
      const open = slots.filter((s) => s.available).length;
      const booked = slots.filter((s) => s.booked).length;
      if (open === 0) {
        setSlotHint('This date is fully booked. Please choose another date.', true);
      } else {
        setSlotHint(`${open} slot(s) available · ${booked} already booked (shown disabled)`);
      }
    }
  }

  serviceSelect?.addEventListener('change', refreshDateOptions);
  dentistSelect?.addEventListener('change', () => {
    refreshDateOptions();
  });
  dateSelect?.addEventListener('change', () => {
    const opt = dateSelect.selectedOptions[0];
    if (opt?.disabled) {
      dateSelect.value = '';
      setSlotHint('That date is fully booked. Please choose another date.', true);
      refreshTimeOptions();
      return;
    }
    refreshTimeOptions();
  });

  timeSelect?.addEventListener('change', () => {
    const opt = timeSelect.selectedOptions[0];
    if (opt?.disabled || !opt?.value) {
      timeSelect.value = '';
      if (opt?.disabled) {
        setSlotHint('That time is already booked. Please pick another slot.', true);
      }
      return;
    }
    const { serviceId, dentistId } = getBookingParams();
    const dateStr = dateSelect?.value;
    if (dateStr && !BookingSlots.isSlotAvailable(dateStr, opt.value, dentistId, serviceId)) {
      timeSelect.value = '';
      setSlotHint('That time was just booked. Please choose another.', true);
    }
  });

  refreshDateOptions();

  document.getElementById('booking-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const patientName = fd.get('name')?.toString().trim();
    const email = fd.get('email')?.toString().trim();
    const phone = fd.get('phone')?.toString().trim();
    const serviceId = fd.get('service')?.toString();
    const dentistId = fd.get('dentist')?.toString() || '';
    const date = fd.get('date')?.toString();
    const time = fd.get('time')?.toString();
    const notes = fd.get('notes')?.toString().trim() || '';

    if (!patientName || !email || !phone || !serviceId || !date || !time) {
      showToast('Please fill in all required fields.', true);
      return;
    }

    if (!BookingSlots.isSlotAvailable(date, time, dentistId, serviceId)) {
      showToast('This date and time is no longer available. Please choose another slot.', true);
      refreshDateOptions();
      return;
    }

    const fresh = loadData();
    const day = getDayName(date);
    let assignedDentist = dentistId;

    if (!assignedDentist) {
      const dentists = BookingSlots.getActiveDentists(fresh, day, '');
      assignedDentist = dentists.find((dentist) => {
        const booked = BookingSlots.getBookedOnDate(fresh, date, dentist.id);
        const blockStart = BookingSlots.timeToMinutes(time);
        const svc = fresh.services.find((s) => s.id === serviceId);
        const duration = svc?.duration || fresh.settings.slotMinutes || 30;
        const blockEnd = blockStart + duration;
        const conflict = booked.some((a) => {
          const { start, end } = BookingSlots.appointmentBlocks(a, fresh, fresh.settings.slotMinutes || 30);
          return blockStart < end && blockEnd > start;
        });
        return !conflict;
      })?.id;
      if (!assignedDentist) {
        showToast('No dentist available for this slot.', true);
        refreshDateOptions();
        return;
      }
    } else {
      const dentist = fresh.dentists.find((d) => d.id === assignedDentist);
      if (!BookingSlots.getDentistHours(dentist, day)) {
        showToast('Selected dentist is not available on this day.', true);
        return;
      }
    }

    const patient = findOrCreatePatient(fresh, { name: patientName, email, phone });
    fresh.appointments.push({
      id: generateId('apt'),
      patientId: patient.id,
      patientName,
      email,
      phone,
      serviceId,
      dentistId: assignedDentist,
      date,
      time,
      notes,
      bookingMode: 'slot',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    saveData(fresh);

    const service = fresh.services.find((s) => s.id === serviceId);
    const dentist = fresh.dentists.find((d) => d.id === assignedDentist);
    showToast(`Booked! ${formatDate(date)} at ${BookingSlots.formatTime12(time)} — ${service?.name} with ${dentist?.name}.`);
    e.target.reset();
    refreshDateOptions();
  });

  function showToast(message, isError = false) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4500);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
