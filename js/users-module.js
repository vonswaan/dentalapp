const UsersModule = {
  init() {
    document.getElementById('btn-add-user')?.addEventListener('click', () => this.showForm());
  },

  render() {
    if (!Auth.can('users')) return;
    const data = loadData();
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    const session = Auth.getSession();
    tbody.innerHTML = data.users
      .sort((a, b) => a.username.localeCompare(b.username))
      .map((u) => {
        const roleLabel = ROLES[u.role]?.label || u.role;
        const isSelf = session?.userId === u.id;
        return `
        <tr>
          <td><strong>${ClinicUI.escapeHtml(u.username)}</strong></td>
          <td>${ClinicUI.escapeHtml(u.fullName)}</td>
          <td>${ClinicUI.escapeHtml(u.email || '—')}</td>
          <td><span class="badge badge-confirmed">${ClinicUI.escapeHtml(roleLabel)}</span></td>
          <td>${u.active ? '<span class="badge badge-confirmed">Active</span>' : '<span class="badge badge-cancelled">Disabled</span>'}</td>
          <td class="actions">
            <button class="btn btn-sm btn-outline" data-edit-user="${u.id}">Edit</button>
            ${!isSelf ? `<button class="btn btn-sm btn-danger" data-del-user="${u.id}">Delete</button>` : ''}
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-edit-user]').forEach((btn) =>
      btn.addEventListener('click', () => this.showForm(btn.dataset.editUser))
    );
    tbody.querySelectorAll('[data-del-user]').forEach((btn) =>
      btn.addEventListener('click', () => this.deleteUser(btn.dataset.delUser))
    );
  },

  showForm(userId = null) {
    const data = loadData();
    const u = userId ? data.users.find((x) => x.id === userId) : null;
    const roleOptions = Object.keys(ROLES)
      .map(
        (r) =>
          `<option value="${r}" ${u?.role === r ? 'selected' : ''}>${ClinicUI.escapeHtml(ROLES[r].label)}</option>`
      )
      .join('');

    const html = `
      <form id="user-form">
        <div class="form-row">
          <div class="form-group">
            <label>Username *</label>
            <input name="username" required value="${ClinicUI.escapeHtml(u?.username || '')}" ${u ? 'readonly' : ''} />
          </div>
          <div class="form-group">
            <label>Full name *</label>
            <input name="fullName" required value="${ClinicUI.escapeHtml(u?.fullName || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" value="${ClinicUI.escapeHtml(u?.email || '')}" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Role *</label>
            <select name="role" required>${roleOptions}</select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select name="active">
              <option value="1" ${u?.active !== false ? 'selected' : ''}>Active</option>
              <option value="0" ${u?.active === false ? 'selected' : ''}>Disabled</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>${u ? 'New password (leave blank to keep)' : 'Password *'}</label>
          <input type="password" name="password" ${u ? '' : 'required'} minlength="6" autocomplete="new-password" />
        </div>
      </form>`;

    const modal = ClinicUI.openModal(
      userId ? 'Edit user' : 'Add user',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="button" class="btn btn-primary" id="user-save-btn">Save</button>`
    );

    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());
    modal.querySelector('#user-save-btn')?.addEventListener('click', () => {
      const form = modal.querySelector('#user-form');
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const fresh = loadData();
      const username = fd.get('username')?.toString().trim().toLowerCase();
      const dup = fresh.users.find(
        (x) => x.username.toLowerCase() === username && x.id !== userId
      );
      if (dup) {
        ClinicUI.showToast('Username already exists.', true);
        return;
      }

      let user = userId ? fresh.users.find((x) => x.id === userId) : { id: generateId('usr'), createdAt: new Date().toISOString() };
      user.username = username;
      user.fullName = fd.get('fullName')?.toString().trim();
      user.email = fd.get('email')?.toString().trim();
      user.role = fd.get('role')?.toString();
      user.active = fd.get('active')?.toString() === '1';
      const pw = fd.get('password')?.toString();
      if (pw) user.passwordHash = Auth.hashPassword(pw);
      else if (!userId) user.passwordHash = Auth.hashPassword('changeme');

      if (!userId) fresh.users.push(user);
      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast('User saved.');
      this.render();
    });
  },

  deleteUser(id) {
    const session = Auth.getSession();
    if (session?.userId === id) {
      ClinicUI.showToast('You cannot delete your own account.', true);
      return;
    }
    if (!confirm('Delete this user account?')) return;
    const fresh = loadData();
    fresh.users = fresh.users.filter((u) => u.id !== id);
    saveData(fresh);
    ClinicUI.showToast('User removed.');
    this.render();
  },
};
