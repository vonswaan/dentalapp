const BookingSlots = {
  timeToMinutes(t) {
    const [h, m] = (t || '00:00').split(':').map(Number);
    return h * 60 + m;
  },

  formatTime12(t) {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  },

  getDentistHours(dentist, dayName) {
    const slot = dentist.schedule?.[dayName];
    if (slot?.enabled) return { start: slot.start || '08:00', end: slot.end || '18:00' };
    if (dentist.available?.includes(dayName)) return { start: '08:00', end: '18:00' };
    return null;
  },

  getActiveDentists(data, dayName, dentistId) {
    let dentists = dentistId
      ? data.dentists.filter((d) => d.id === dentistId)
      : data.dentists.filter((d) => d.available?.includes(dayName) || d.schedule?.[dayName]?.enabled);
    return dentists.filter((d) => this.getDentistHours(d, dayName));
  },

  getBookedOnDate(data, dateStr, dentistId) {
    return data.appointments.filter(
      (a) =>
        a.date === dateStr &&
        a.status !== 'cancelled' &&
        (!dentistId || a.dentistId === dentistId)
    );
  },

  appointmentBlocks(appt, data, slotStep) {
    const start = this.timeToMinutes(appt.time);
    const svc = data.services.find((s) => s.id === appt.serviceId);
    const duration = svc?.duration || slotStep;
    return { start, end: start + duration, dentistId: appt.dentistId };
  },

  /** All time slots for a date with booked/available flags */
  getSlotsForDate(dateStr, dentistId, serviceId, excludeAppointmentId = null) {
    const data = loadData();
    const settings = data.settings || {};
    const slotStep = settings.slotMinutes || 30;
    const day = getDayName(dateStr);
    const dentists = this.getActiveDentists(data, day, dentistId);

    if (!dentists.length) return [];

    const service = serviceId ? data.services.find((s) => s.id === serviceId) : null;
    const duration = service?.duration || slotStep;

    let booked = this.getBookedOnDate(data, dateStr, dentistId);
    if (excludeAppointmentId) {
      booked = booked.filter((a) => a.id !== excludeAppointmentId);
    }

    const allTimes = new Set();
    dentists.forEach((dentist) => {
      const hours = this.getDentistHours(dentist, day);
      const [sh, sm] = hours.start.split(':').map(Number);
      const [eh, em] = hours.end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      for (let m = startMin; m + duration <= endMin; m += slotStep) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        allTimes.add(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
      }
    });

    return [...allTimes].sort().map((time) => {
      const blockStart = this.timeToMinutes(time);
      const blockEnd = blockStart + duration;

      let available = false;
      if (dentistId) {
        const dentist = dentists[0];
        const conflict = booked.some((a) => {
          if (a.dentistId !== dentist.id) return false;
          const { start, end } = this.appointmentBlocks(a, data, slotStep);
          return blockStart < end && blockEnd > start;
        });
        available = !conflict;
      } else {
        available = dentists.some((dentist) => {
          const conflict = booked.some((a) => {
            if (a.dentistId !== dentist.id) return false;
            const { start, end } = this.appointmentBlocks(a, data, slotStep);
            return blockStart < end && blockEnd > start;
          });
          return !conflict;
        });
      }

      return { time, available, booked: !available };
    });
  },

  getAvailableSlots(dateStr, dentistId, serviceId, excludeAppointmentId) {
    return this.getSlotsForDate(dateStr, dentistId, serviceId, excludeAppointmentId)
      .filter((s) => s.available)
      .map((s) => s.time);
  },

  dateHasOpenSlots(dateStr, dentistId, serviceId) {
    if (!serviceId) return false;
    return this.getSlotsForDate(dateStr, dentistId, serviceId).some((s) => s.available);
  },

  isSlotAvailable(dateStr, time, dentistId, serviceId, excludeAppointmentId) {
    const slot = this.getSlotsForDate(dateStr, dentistId, serviceId, excludeAppointmentId).find(
      (s) => s.time === time
    );
    return slot?.available === true;
  },

  /** Dates from today through maxDays ahead */
  buildDateOptions(dentistId, serviceId, maxDays = 90) {
    if (!serviceId) {
      return '<option value="">Select a service first</option>';
    }

    const today = new Date();
    const options = ['<option value="">Select a date</option>'];

    for (let i = 0; i < maxDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const hasOpen = this.dateHasOpenSlots(dateStr, dentistId, serviceId);
      if (hasOpen) {
        options.push(`<option value="${dateStr}">${label}</option>`);
      } else {
        options.push(`<option value="${dateStr}" disabled>${label} — Fully booked</option>`);
      }
    }

    return options.join('');
  },

  buildTimeOptions(dateStr, dentistId, serviceId, excludeAppointmentId) {
    if (!dateStr) {
      return '<option value="">Select a date first</option>';
    }
    if (!serviceId) {
      return '<option value="">Select a service first</option>';
    }

    const slots = this.getSlotsForDate(dateStr, dentistId, serviceId, excludeAppointmentId);
    if (!slots.length) {
      return '<option value="">No schedule on this day</option>';
    }

    const hasAny = slots.some((s) => s.available);
    let html = hasAny
      ? '<option value="">Select time</option>'
      : '<option value="">All times booked on this date</option>';

    slots.forEach(({ time, available, booked }) => {
      const label = this.formatTime12(time);
      if (available) {
        html += `<option value="${time}">${label}</option>`;
      } else if (booked) {
        html += `<option value="${time}" disabled>${label} — Booked</option>`;
      }
    });

    return html;
  },
};
