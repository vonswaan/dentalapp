const InventoryModule = {
  init() {
    document.getElementById('btn-add-inventory')?.addEventListener('click', () => this.showItemForm());
    document.getElementById('inventory-search')?.addEventListener('input', () => this.render());
    document.getElementById('inventory-filter')?.addEventListener('change', () => this.render());
  },

  render() {
    const data = loadData();
    const q = document.getElementById('inventory-search')?.value?.toLowerCase() || '';
    const filter = document.getElementById('inventory-filter')?.value || '';
    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;

    let list = data.inventory.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)) &&
        (!filter || i.category === filter)
    );

    if (filter === 'low') list = list.filter((i) => i.quantity <= i.reorderLevel);

    list = list.sort((a, b) => a.name.localeCompare(b.name));

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No inventory items</td></tr>';
      return;
    }

    tbody.innerHTML = list
      .map((i) => {
        const low = i.quantity <= i.reorderLevel;
        return `
        <tr class="${low ? 'row-low-stock' : ''}">
          <td><code>${ClinicUI.escapeHtml(i.sku)}</code></td>
          <td>${ClinicUI.escapeHtml(i.name)}</td>
          <td>${ClinicUI.escapeHtml(i.category)}</td>
          <td><strong>${i.quantity}</strong> ${ClinicUI.escapeHtml(i.unit)}</td>
          <td>${i.reorderLevel}</td>
          <td>${formatCurrency(i.cost)}</td>
          <td>${low ? '<span class="badge badge-pending">Low stock</span>' : '<span class="badge badge-confirmed">OK</span>'}</td>
          <td class="actions">
            <button class="btn btn-sm btn-primary" data-stock-in="${i.id}">Stock in</button>
            <button class="btn btn-sm btn-outline" data-stock-out="${i.id}">Stock out</button>
            <button class="btn btn-sm btn-ghost" data-edit-inv="${i.id}">Edit</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('[data-stock-in]').forEach((btn) =>
      btn.addEventListener('click', () => this.showStockModal(btn.dataset.stockIn, 'in'))
    );
    tbody.querySelectorAll('[data-stock-out]').forEach((btn) =>
      btn.addEventListener('click', () => this.showStockModal(btn.dataset.stockOut, 'out'))
    );
    tbody.querySelectorAll('[data-edit-inv]').forEach((btn) =>
      btn.addEventListener('click', () => this.showItemForm(btn.dataset.editInv))
    );

    this.renderLogs(data);
    const lowCount = data.inventory.filter((i) => i.quantity <= i.reorderLevel).length;
    const el = document.getElementById('stat-low-stock');
    if (el) el.textContent = lowCount;
  },

  renderLogs(data) {
    const tbody = document.getElementById('inventory-logs-tbody');
    if (!tbody) return;

    const logs = [...(data.inventoryLogs || [])]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);

    if (!logs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No stock movements yet</td></tr>';
      return;
    }

    tbody.innerHTML = logs
      .map((log) => {
        const item = data.inventory.find((i) => i.id === log.itemId);
        return `
        <tr>
          <td>${formatDateLong(log.createdAt.slice(0, 10))}</td>
          <td>${ClinicUI.escapeHtml(item?.name || '—')}</td>
          <td><span class="badge badge-${log.type === 'in' ? 'confirmed' : 'pending'}">${log.type === 'in' ? 'IN' : 'OUT'}</span></td>
          <td>${log.qty}</td>
          <td>${ClinicUI.escapeHtml(log.reason)}</td>
        </tr>`;
      })
      .join('');
  },

  showItemForm(itemId = null) {
    const data = loadData();
    const i = itemId ? data.inventory.find((x) => x.id === itemId) : null;
    const categories = [...new Set([...data.inventory.map((x) => x.category), 'Consumables', 'Medication', 'Materials', 'Equipment'])];

    const html = `
      <form id="inventory-form" class="form-grid-2">
        <div class="form-group"><label>SKU *</label><input name="sku" required value="${ClinicUI.escapeHtml(i?.sku || '')}" /></div>
        <div class="form-group"><label>Name *</label><input name="name" required value="${ClinicUI.escapeHtml(i?.name || '')}" /></div>
        <div class="form-group"><label>Category</label>
          <input name="category" list="cat-list" value="${ClinicUI.escapeHtml(i?.category || 'Consumables')}" />
          <datalist id="cat-list">${categories.map((c) => `<option value="${ClinicUI.escapeHtml(c)}">`).join('')}</datalist>
        </div>
        <div class="form-group"><label>Unit</label><input name="unit" value="${ClinicUI.escapeHtml(i?.unit || 'pcs')}" /></div>
        <div class="form-group"><label>Quantity</label><input type="number" name="quantity" min="0" value="${i?.quantity ?? 0}" /></div>
        <div class="form-group"><label>Reorder level</label><input type="number" name="reorderLevel" min="0" value="${i?.reorderLevel ?? 5}" /></div>
        <div class="form-group"><label>Unit cost (₱)</label><input type="number" name="cost" min="0" step="0.01" value="${i?.cost ?? 0}" /></div>
        <div class="form-group"><label>Supplier</label><input name="supplier" value="${ClinicUI.escapeHtml(i?.supplier || '')}" /></div>
      </form>`;

    const modal = ClinicUI.openModal(
      itemId ? 'Edit inventory item' : 'Add inventory item',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="submit" form="inventory-form" class="btn btn-primary">Save</button>`
    );

    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());
    modal.querySelector('#inventory-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const fresh = loadData();

      const item = itemId
        ? fresh.inventory.find((x) => x.id === itemId)
        : { id: generateId('inv') };

      item.sku = fd.get('sku')?.toString().trim();
      item.name = fd.get('name')?.toString().trim();
      item.category = fd.get('category')?.toString().trim() || 'Consumables';
      item.unit = fd.get('unit')?.toString().trim() || 'pcs';
      item.quantity = parseInt(fd.get('quantity')?.toString(), 10) || 0;
      item.reorderLevel = parseInt(fd.get('reorderLevel')?.toString(), 10) || 0;
      item.cost = parseFloat(fd.get('cost')?.toString()) || 0;
      item.supplier = fd.get('supplier')?.toString().trim() || '';

      if (!itemId) fresh.inventory.push(item);
      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast('Inventory item saved.');
      this.render();
      window.AdminApp?.renderDashboard?.();
    });
  },

  showStockModal(itemId, type) {
    const data = loadData();
    const item = data.inventory.find((i) => i.id === itemId);
    if (!item) return;

    const html = `
      <form id="stock-form">
        <p><strong>${ClinicUI.escapeHtml(item.name)}</strong> — Current: ${item.quantity} ${ClinicUI.escapeHtml(item.unit)}</p>
        <div class="form-group"><label>Quantity *</label><input type="number" name="qty" min="1" required value="1" /></div>
        <div class="form-group"><label>Reason *</label><input name="reason" required placeholder="${type === 'in' ? 'Delivery from supplier' : 'Used for procedure'}" /></div>
      </form>`;

    const modal = ClinicUI.openModal(
      type === 'in' ? 'Stock in' : 'Stock out',
      html,
      `<button type="button" class="btn btn-ghost modal-cancel">Cancel</button>
       <button type="submit" form="stock-form" class="btn btn-primary">Confirm</button>`
    );

    modal.querySelector('.modal-cancel')?.addEventListener('click', () => ClinicUI.closeModal());
    modal.querySelector('#stock-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const qty = parseInt(fd.get('qty')?.toString(), 10) || 0;
      const reason = fd.get('reason')?.toString().trim();
      if (qty < 1 || !reason) return;

      const fresh = loadData();
      const inv = fresh.inventory.find((i) => i.id === itemId);
      if (!inv) return;

      if (type === 'out' && inv.quantity < qty) {
        ClinicUI.showToast('Insufficient stock.', true);
        return;
      }

      inv.quantity = type === 'in' ? inv.quantity + qty : inv.quantity - qty;
      fresh.inventoryLogs = fresh.inventoryLogs || [];
      fresh.inventoryLogs.push({
        id: generateId('log'),
        itemId,
        type,
        qty,
        reason,
        createdAt: new Date().toISOString(),
      });

      saveData(fresh);
      ClinicUI.closeModal();
      ClinicUI.showToast(`Stock ${type === 'in' ? 'added' : 'removed'}.`);
      this.render();
    });
  },
};
