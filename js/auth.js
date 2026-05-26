const AUTH_SESSION_KEY = 'dentalcare_auth';

const ROLES = {
  superadmin: {
    label: 'Super Admin',
    permissions: ['users', 'settings', 'dentists', 'services', 'appointments', 'patients', 'receipts', 'medcerts', 'inventory', 'finance'],
  },
  admin: {
    label: 'Admin',
    permissions: ['settings', 'dentists', 'services', 'appointments', 'patients', 'receipts', 'medcerts', 'inventory'],
  },
  staff: {
    label: 'Staff',
    permissions: ['appointments', 'patients', 'receipts', 'medcerts', 'inventory'],
  },
};

const Auth = {
  hashPassword(password) {
    return hashPasswordStorage(password);
  },

  verifyPassword(password, hash) {
    return this.hashPassword(password) === hash;
  },

  getSession() {
    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setSession(user) {
    const payload = JSON.stringify({
      userId: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    });
    localStorage.setItem(AUTH_SESSION_KEY, payload);
    sessionStorage.setItem(AUTH_SESSION_KEY, payload);
  },

  clearSession() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem('dentalcare_admin');
    sessionStorage.removeItem('dentalcare_user');
  },

  validateSession() {
    const session = this.getSession();
    if (!session?.userId) return false;
    const data = loadData();
    if (!Array.isArray(data.users) || data.users.length === 0) return false;
    const user = data.users.find((u) => u.id === session.userId && u.active);
    if (!user) return false;
    if (!ROLES[user.role]) return false;
    return true;
  },

  getCurrentUser() {
    const session = this.getSession();
    if (!session) return null;
    const data = loadData();
    return data.users?.find((u) => u.id === session.userId && u.active) || null;
  },

  login(username, password) {
    const userInput = (username || '').trim();
    const passInput = password || '';
    if (!userInput || !passInput) {
      return { ok: false, message: 'Enter username and password.' };
    }

    let data;
    try {
      data = loadData();
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Could not load clinic data. Try clearing site storage and refresh.' };
    }

    if (!Array.isArray(data.users) || data.users.length === 0) {
      return { ok: false, message: 'No user accounts found. Refresh the page or clear site data.' };
    }
    const user = data.users.find(
      (u) => u.username.toLowerCase() === userInput.toLowerCase() && u.active
    );
    if (!user || !user.passwordHash || !this.verifyPassword(passInput, user.passwordHash)) {
      return { ok: false, message: 'Invalid username or password.' };
    }
    user.lastLogin = new Date().toISOString();
    try {
      saveData(data);
    } catch (err) {
      console.error(err);
      return { ok: false, message: 'Could not save session. Check browser storage permissions.' };
    }
    this.setSession(user);
    return { ok: true, user };
  },

  logout() {
    this.clearSession();
  },

  can(permission) {
    const session = this.getSession();
    if (!session) return false;
    const role = ROLES[session.role];
    return role?.permissions.includes(permission) ?? false;
  },

  isSuperAdmin() {
    return this.getSession()?.role === 'superadmin';
  },

  applyNavPermissions() {
    document.querySelectorAll('[data-permission]').forEach((el) => {
      const perm = el.dataset.permission;
      const allowed = this.can(perm);
      el.style.display = allowed ? '' : 'none';
    });
  },

  updateUserBadge() {
    const session = this.getSession();
    const el = document.getElementById('current-user-badge');
    if (el && session) {
      const roleLabel = ROLES[session.role]?.label || session.role;
      el.textContent = `${session.fullName || session.username} · ${roleLabel}`;
    }
  },
};
