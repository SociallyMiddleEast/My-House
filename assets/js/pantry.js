(function hcPantryPage() {
  const CATEGORY_LABEL = { groceries: 'Groceries', household: 'Household', medicine: 'Medicine' };
  let currentFilter = 'all';
  let editingId = null;

  const HC_PANTRY_HEADER = ['id', 'name', 'category', 'quantity', 'unit', 'lowThreshold', 'expiresAt'];
  function toPantryRow(i) { return [i.id, i.name, i.category, i.quantity, i.unit, i.lowThreshold, i.expiresAt || '']; }
  function parsePantryRow(r) {
    if (!r[1]) return null;
    return {
      id: r[0] || ('p' + Date.now() + Math.random().toString(36).slice(2, 7)),
      name: r[1],
      category: r[2] || 'groceries',
      quantity: Number(r[3]) || 0,
      unit: r[4] || '',
      lowThreshold: Number(r[5]) || 0,
      expiresAt: r[6] || null
    };
  }

  /* ---------------------------- Sheets connection status (setup lives in Settings) ---------------------------- */

  const shStatus = document.getElementById('sh-status');
  function setSheetStatus(kind, message) {
    shStatus.classList.remove('hidden');
    const dotClass = kind === 'ok' ? 'good' : kind === 'error' ? 'bad' : 'neutral';
    shStatus.innerHTML = `<span class="dot ${dotClass}"></span>${message}`;
  }

  async function afterConnected(err) {
    if (err) { setSheetStatus('idle', 'Not connected — sign in on Settings'); return; }
    setSheetStatus('busy', 'Syncing…');
    try {
      const remote = await hcSheetsFetchTab('Pantry', 'A1:G1000', parsePantryRow);
      if (remote.length === 0) {
        await hcSheetsPushTab('Pantry', 'A1:G1000', HC_PANTRY_HEADER, hcLoadPantry().map(toPantryRow)); // empty sheet — seed it from what's local
      } else {
        hcSavePantry(remote); // sheet has data — it wins
      }
      setSheetStatus('ok', 'Synced ' + new Date().toLocaleTimeString());
      render();
    } catch (e) {
      setSheetStatus('error', e.message);
    }
  }

  if (hcSheetsConfigured()) {
    setSheetStatus('idle', 'Connecting…');
    hcTrySilentConnect((err) => afterConnected(err));
  }

  function persistPantry(list) {
    hcSavePantry(list);
    if (hcSheetsConnected()) {
      setSheetStatus('busy', 'Syncing…');
      hcSheetsPushTab('Pantry', 'A1:G1000', HC_PANTRY_HEADER, list.map(toPantryRow))
        .then(() => setSheetStatus('ok', 'Synced ' + new Date().toLocaleTimeString()))
        .catch(e => setSheetStatus('error', e.message));
    }
  }

  /* ---------------------------- list rendering ---------------------------- */

  function statusRank(item) {
    const s = hcPantryStatus(item);
    return s === 'out' ? 0 : s === 'low' ? 1 : 2;
  }

  function rowMarkup(item) {
    const status = hcPantryStatus(item);
    const expiry = hcExpiryStatus(item);
    return `
      <div class="pantry-row" data-id="${item.id}">
        <span class="status-dot ${status}" title="${status}"></span>
        <span class="name">${item.name}</span>
        ${expiry ? `<span class="expiry-badge${expiry.urgent ? ' urgent' : ''}">${expiry.label}</span>` : ''}
        <span class="qty-stepper">
          <button data-action="dec" aria-label="Decrease">−</button>
          <span>${item.quantity} ${item.unit || ''}</span>
          <button data-action="inc" aria-label="Increase">+</button>
        </span>
        <span class="row-actions">
          <button data-action="edit" aria-label="Edit"><svg><use href="#i-edit"/></svg></button>
          <button data-action="delete" aria-label="Delete"><svg><use href="#i-close"/></svg></button>
        </span>
      </div>`;
  }

  function render() {
    const all = hcLoadPantry();
    const cats = currentFilter === 'all' ? ['groceries', 'household', 'medicine'] : [currentFilter];

    document.getElementById('pantry-list-mount').innerHTML = cats.map(cat => {
      const items = all.filter(i => i.category === cat).sort((a, b) => statusRank(a) - statusRank(b) || a.name.localeCompare(b.name));
      if (!items.length) return '';
      const heading = currentFilter === 'all' ? `<div class="pantry-category-title">${CATEGORY_LABEL[cat]} <span class="count">${items.length}</span></div>` : '';
      return heading + items.map(rowMarkup).join('');
    }).join('') || `<p class="muted" style="font-size:13px;">No items here yet — add one above.</p>`;

    const summary = hcPantrySummary();
    document.getElementById('pantry-sub').textContent =
      `${summary.total} items · ${summary.low} low · ${summary.out} out` + (summary.expiring ? ` · ${summary.expiring} expiring soon` : '');

    const shopping = all.filter(i => hcPantryStatus(i) !== 'ok');
    const callout = document.getElementById('shopping-callout');
    if (shopping.length) {
      callout.classList.remove('hidden');
      callout.innerHTML = `<strong>Shopping list:</strong> ${shopping.map(i => i.name).join(', ')}`;
    } else {
      callout.classList.add('hidden');
    }
  }

  /* ---------------------------- add / edit form ---------------------------- */

  const form = document.getElementById('pantry-form-panel');
  const fields = {
    name: document.getElementById('pf-name'),
    category: document.getElementById('pf-category'),
    qty: document.getElementById('pf-qty'),
    unit: document.getElementById('pf-unit'),
    threshold: document.getElementById('pf-threshold'),
    expiry: document.getElementById('pf-expiry')
  };

  function openForm(item) {
    editingId = item ? item.id : null;
    document.getElementById('pf-title').textContent = item ? 'Edit item' : 'Add item';
    document.getElementById('pf-delete').classList.toggle('hidden', !item);
    fields.name.value = item ? item.name : '';
    fields.category.value = item ? item.category : 'groceries';
    fields.qty.value = item ? item.quantity : 1;
    fields.unit.value = item ? item.unit : '';
    fields.threshold.value = item ? item.lowThreshold : 1;
    fields.expiry.value = item && item.expiresAt ? item.expiresAt : '';
    form.classList.remove('hidden');
    fields.name.focus();
  }

  function closeForm() {
    form.classList.add('hidden');
    editingId = null;
  }

  document.getElementById('pantry-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('pf-cancel').addEventListener('click', closeForm);

  document.getElementById('pf-save').addEventListener('click', () => {
    const name = fields.name.value.trim();
    if (!name) { fields.name.focus(); return; }
    const list = hcLoadPantry();
    const patch = {
      name,
      category: fields.category.value,
      quantity: Number(fields.qty.value) || 0,
      unit: fields.unit.value.trim(),
      lowThreshold: Number(fields.threshold.value) || 0,
      expiresAt: fields.expiry.value || null
    };
    if (editingId) {
      const item = list.find(i => i.id === editingId);
      Object.assign(item, patch);
      hcLogActivity(`Updated ${name} in Pantry`);
    } else {
      list.push({ id: 'p' + Date.now(), ...patch });
      hcLogActivity(`Added ${name} to Pantry`);
    }
    persistPantry(list);
    closeForm();
    render();
  });

  document.getElementById('pf-delete').addEventListener('click', () => {
    if (!editingId) return;
    const item = hcLoadPantry().find(i => i.id === editingId);
    if (!window.confirm(`Remove "${item ? item.name : 'this item'}" from Pantry?`)) return;
    persistPantry(hcLoadPantry().filter(i => i.id !== editingId));
    if (item) hcLogActivity(`Removed ${item.name} from Pantry`);
    closeForm();
    render();
  });

  /* ---------------------------- list interactions ---------------------------- */

  document.getElementById('pantry-list-mount').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('.pantry-row');
    const id = row.dataset.id;
    const list = hcLoadPantry();
    const item = list.find(i => i.id === id);
    if (!item) return;

    if (btn.dataset.action === 'inc' || btn.dataset.action === 'dec') {
      const step = item.quantity % 1 !== 0 ? 0.5 : 1;
      item.quantity = Math.max(0, +(item.quantity + (btn.dataset.action === 'inc' ? step : -step)).toFixed(1));
      persistPantry(list);
      render();
    } else if (btn.dataset.action === 'edit') {
      openForm(item);
    } else if (btn.dataset.action === 'delete') {
      if (!window.confirm(`Remove "${item.name}" from Pantry?`)) return;
      persistPantry(list.filter(i => i.id !== id));
      hcLogActivity(`Removed ${item.name} from Pantry`);
      render();
    }
  });

  document.getElementById('pantry-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    currentFilter = btn.dataset.cat;
    document.querySelectorAll('#pantry-tabs .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });

  render();
})();
