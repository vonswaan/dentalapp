const STORAGE_KEY = 'dentalcare_data';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function hashPasswordStorage(password) {
  try {
    return btoa(unescape(encodeURIComponent(`dc_${password}`)));
  } catch {
    return password;
  }
}

function defaultDentistSchedule(availableDays = []) {
  const schedule = {};
  WEEKDAYS.forEach((day) => {
    schedule[day] = { enabled: availableDays.includes(day), start: '08:00', end: '18:00' };
  });
  return schedule;
}

function normalizeDentist(d) {
  const available = d.available || [];
  return {
    id: d.id,
    name: d.name || '',
    specialty: d.specialty || '',
    licenseNo: d.licenseNo || '',
    email: d.email || '',
    phone: d.phone || '',
    bio: d.bio || '',
    available,
    schedule: d.schedule || defaultDentistSchedule(available),
  };
}

const defaultInventory = [
  { id: 'inv1', sku: 'GLV-001', name: 'Nitrile Gloves (box)', category: 'Consumables', unit: 'box', quantity: 45, reorderLevel: 10, cost: 350, supplier: 'MedSupply PH' },
  { id: 'inv2', sku: 'MSK-001', name: 'Surgical Masks', category: 'Consumables', unit: 'box', quantity: 8, reorderLevel: 15, cost: 280, supplier: 'MedSupply PH' },
  { id: 'inv3', sku: 'ANE-001', name: 'Local Anesthetic (Lidocaine)', category: 'Medication', unit: 'vial', quantity: 24, reorderLevel: 8, cost: 120, supplier: 'PharmaCare' },
  { id: 'inv4', sku: 'CMP-001', name: 'Dental Composite Resin', category: 'Materials', unit: 'syringe', quantity: 18, reorderLevel: 5, cost: 890, supplier: 'DentalPro' },
  { id: 'inv5', sku: 'BUR-001', name: 'Diamond Burs Set', category: 'Equipment', unit: 'set', quantity: 6, reorderLevel: 3, cost: 2400, supplier: 'DentalPro' },
];

const defaultUsers = [
  {
    id: 'usr_super',
    username: 'superadmin',
    passwordHash: '', // set in migrate
    role: 'superadmin',
    fullName: 'Super Administrator',
    email: 'admin@von.dental',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_admin',
    username: 'admin',
    passwordHash: '',
    role: 'admin',
    fullName: 'Clinic Admin',
    email: 'hello@von.dental',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_staff',
    username: 'staff',
    passwordHash: '',
    role: 'staff',
    fullName: 'Front Desk Staff',
    email: '',
    active: true,
    createdAt: new Date().toISOString(),
  },
];

const defaultPasswords = { superadmin: 'superadmin123', admin: 'dental2026', staff: 'staff2026' };

const defaultData = {
  users: defaultUsers.map((u) => ({
    ...u,
    passwordHash: hashPasswordStorage(defaultPasswords[u.username] || 'changeme'),
  })),
  services: [
    { id: 'svc1', name: 'General Checkup', description: 'Comprehensive oral exam, cleaning, and health assessment.', duration: 45, price: 75, icon: 'fa-tooth' },
    { id: 'svc2', name: 'Teeth Whitening', description: 'Professional whitening for a brighter, confident smile.', duration: 60, price: 199, icon: 'fa-sparkles' },
    { id: 'svc3', name: 'Dental Implants', description: 'Permanent tooth replacement with natural-looking results.', duration: 90, price: 2500, icon: 'fa-screwdriver-wrench' },
    { id: 'svc4', name: 'Root Canal', description: 'Pain relief and preservation of infected teeth.', duration: 75, price: 850, icon: 'fa-heart-pulse' },
    { id: 'svc5', name: 'Orthodontics', description: 'Braces and aligners for straighter teeth.', duration: 60, price: 3500, icon: 'fa-grip-lines' },
    { id: 'svc6', name: 'Pediatric Care', description: 'Gentle dental care tailored for children.', duration: 40, price: 65, icon: 'fa-child' },
  ],
  dentists: [
    { id: 'den1', name: 'Dr. Maria Santos', specialty: 'General Dentistry', licenseNo: 'D-12345', email: 'maria@von.dental', phone: '+63 912 111 0001', available: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
    { id: 'den2', name: 'Dr. James Chen', specialty: 'Orthodontics', licenseNo: 'D-23456', email: 'james@von.dental', phone: '+63 912 111 0002', available: ['Tue', 'Wed', 'Thu', 'Sat'] },
    { id: 'den3', name: 'Dr. Ana Reyes', specialty: 'Pediatric Dentistry', licenseNo: 'D-34567', email: 'ana@von.dental', phone: '+63 912 111 0003', available: ['Mon', 'Wed', 'Fri', 'Sat'] },
  ],
  appointments: [],
  patients: [],
  receipts: [],
  medicalCerts: [],
  inventory: defaultInventory,
  inventoryLogs: [],
  counters: { receipt: 1000, medCert: 100, patientNo: 1000 },
  settings: {
    clinicName: 'Von Dental Clinic',
    phone: '+63 2 8123 4567',
    email: 'hello@von.dental',
    address: '123 Health Avenue, Makati City, Metro Manila',
    hours: 'Mon–Sat 8:00 AM – 6:00 PM',
    slotMinutes: 30,
    tin: '123-456-789-000',
  },
};

function createEmptyPatient({ name, email, phone, ...rest }) {
  return {
    id: generateId('pat'),
    patientNo: null,
    name: name || '',
    email: email || '',
    phone: phone || '',
    dob: rest.dob || '',
    gender: rest.gender || '',
    address: rest.address || '',
    bloodType: rest.bloodType || '',
    allergies: rest.allergies || '',
    medicalHistory: rest.medicalHistory || '',
    emergencyContact: rest.emergencyContact || { name: '', phone: '', relation: '' },
    visits: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function normalizePatient(p) {
  const base = createEmptyPatient({ name: p.name, email: p.email, phone: p.phone });
  return {
    ...base,
    ...p,
    id: p.id || base.id,
    emergencyContact: { ...base.emergencyContact, ...(p.emergencyContact || {}) },
    visits: Array.isArray(p.visits) ? p.visits : [],
    updatedAt: p.updatedAt || p.createdAt || base.createdAt,
  };
}

function migrateData(parsed) {
  const data = { ...structuredClone(defaultData), ...parsed };
  let migrated = false;
  data.settings = { ...defaultData.settings, ...parsed.settings };
  if (data.settings.clinicName?.includes('BrightSmile')) {
    data.settings.clinicName = data.settings.clinicName.replace(/BrightSmile/gi, 'Von');
    migrated = true;
  }
  if (data.settings.email?.includes('brightsmile')) {
    data.settings.email = data.settings.email.replace(/brightsmile\.dental/gi, 'von.dental');
    migrated = true;
  }
  data.inventory = parsed.inventory?.length ? parsed.inventory : defaultInventory;
  data.receipts = parsed.receipts || [];
  data.medicalCerts = parsed.medicalCerts || parsed.medCerts || [];
  if (!Array.isArray(data.medicalCerts)) data.medicalCerts = [];
  data.inventoryLogs = parsed.inventoryLogs || [];
  data.counters = { ...defaultData.counters, ...parsed.counters };
  data.patients = (parsed.patients || []).map(normalizePatient);

  if (!(parsed.users || []).length) {
    data.users = structuredClone(defaultData.users);
    migrated = true;
  } else {
    data.users = parsed.users.map((u) => ({
      ...u,
      active: u.active !== false,
      passwordHash: u.passwordHash || '',
    }));
  }
  if (ensureDefaultUsers(data)) migrated = true;

  data.dentists = (parsed.dentists || defaultData.dentists).map(normalizeDentist);
  data.patients.forEach((p) => {
    if (!p.patientNo) {
      p.patientNo = assignPatientNo(data);
      migrated = true;
    }
  });
  if (migrated || !parsed.inventory?.length) {
    try {
      saveData(data);
    } catch (_) {}
  }
  return data;
}

function ensureDefaultUsers(data) {
  let changed = false;
  if (!Array.isArray(data.users)) {
    data.users = structuredClone(defaultData.users);
    return true;
  }

  Object.entries(defaultPasswords).forEach(([username, password]) => {
    const expectedHash = hashPasswordStorage(password);
    let user = data.users.find((u) => u.username.toLowerCase() === username);
    const template = defaultUsers.find((u) => u.username === username);

    if (!user && template) {
      data.users.push({
        ...template,
        id: generateId('usr'),
        username,
        passwordHash: expectedHash,
        active: true,
      });
      changed = true;
      return;
    }

    if (!user) return;

    const needsReset =
      !user.passwordHash || user.passwordHash === hashPasswordStorage('changeme');

    if (needsReset) {
      user.passwordHash = expectedHash;
      changed = true;
    }
  });

  if (!data.users.some((u) => u.role === 'superadmin')) {
    data.users.push({
      ...defaultUsers[0],
      id: generateId('usr'),
      passwordHash: hashPasswordStorage(defaultPasswords.superadmin),
      active: true,
    });
    changed = true;
  }

  return changed;
}

function assignPatientNo(data) {
  data.counters.patientNo = (data.counters.patientNo || 1000) + 1;
  return `P-${String(data.counters.patientNo).padStart(5, '0')}`;
}

function nextDocNumber(data, type) {
  data.counters[type] = (data.counters[type] || 1000) + 1;
  const prefix = type === 'receipt' ? 'OR' : 'MC';
  return `${prefix}-${String(data.counters[type]).padStart(6, '0')}`;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveData(defaultData);
      return structuredClone(defaultData);
    }
    return migrateData(JSON.parse(raw));
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getPatient(data, id) {
  return data.patients.find((p) => p.id === id);
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getDayName(dateStr) {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dateStr + 'T12:00:00').getDay()];
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-PH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);
}

function calcAge(dob) {
  if (!dob) return '';
  const birth = new Date(dob + 'T12:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? String(age) : '';
}

function findOrCreatePatient(data, { name, email, phone }) {
  let patient = data.patients.find((p) => p.email && email && p.email.toLowerCase() === email.toLowerCase());
  if (!patient) {
    patient = createEmptyPatient({ name, email, phone });
    patient.patientNo = assignPatientNo(data);
    data.patients.push(patient);
  } else {
    patient.name = name;
    patient.phone = phone;
    patient.updatedAt = new Date().toISOString();
    if (!patient.patientNo) patient.patientNo = assignPatientNo(data);
  }
  return patient;
}
