(function hcExpensesPage() {
  const CATEGORY_META = {
    groceries: { label: 'Groceries', color: 'var(--good)' },
    household: { label: 'Household', color: 'var(--teal)' },
    medicine: { label: 'Medicine', color: '#8862D6' },
    utilities: { label: 'Utilities', color: '#3B8FC4' },
    fuel: { label: 'Fuel & gas', color: '#D97A4A' },
    other: { label: 'Other', color: 'var(--text-faint)' }
  };
  const HC_EXPENSE_HEADER = ['id', 'date', 'amount', 'category', 'note'];
  function toExpenseRow(e) { return [e.id, e.date, e.amount, e.category, e.note || '']; }
  function parseExpenseRow(r) {
    if (!r[1] || !r[2]) return null;
    return { id: r[0] || ('x' + Date.now() + Math.random().toString(36).slice(2, 7)), date: r[1], amount: Number(r[2]) || 0, category: r[3] || 'other', note: r[4] || '' };
  }
  function fmtAmount(n) { return '$' + n.toFixed(2); }

  let currentFilter = 'all';
  let editingId = null;

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
      const remote = await hcSheetsFetchTab('Expenses', 'A1:E2000', parseExpenseRow);
      if (remote.length === 0) {
        await hcSheetsPushTab('Expenses', 'A1:E2000', HC_EXPENSE_HEADER, hcLoadExpenses().map(toExpenseRow));
      } else {
        hcSaveExpenses(remote);
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

  function persistExpenses(list) {
    hcSaveExpenses(list);
    if (hcSheetsConnected()) {
      setSheetStatus('busy', 'Syncing…');
      hcSheetsPushTab('Expenses', 'A1:E2000', HC_EXPENSE_HEADER, list.map(toExpenseRow))
        .then(() => setSheetStatus('ok', 'Synced ' + new Date().toLocaleTimeString()))
        .catch(e => setSheetStatus('error', e.message));
    }
  }

  /* ---------------------------- rendering ---------------------------- */

  function monthKey(dateStr) { const d = new Date(dateStr); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function monthLabel(dateStr) { return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
  function shortDate(dateStr) { return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  function renderBreakdown() {
    const now = new Date();
    const thisMonth = hcExpensesInMonth(hcLoadExpenses(), now.getFullYear(), now.getMonth());
    const totals = {};
    thisMonth.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
    const max = Math.max(1, ...Object.values(totals));
    const rows = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    const mount = document.getElementById('category-breakdown-mount');
    if (!rows.length) {
      mount.innerHTML = `<p class="muted" style="font-size:13px;">No expenses logged this month yet.</p>`;
      return;
    }
    mount.innerHTML = rows.map(([key, amount]) => {
      const meta = CATEGORY_META[key] || CATEGORY_META.other;
      const pct = (amount / max) * 100;
      return `
        <div class="category-bar-row">
          <span class="cat-label"><span class="dot" style="background:${meta.color}"></span>${meta.label}</span>
          <span class="level-bar"><span class="level-bar-fill" style="width:${pct}%; background:${meta.color};"></span></span>
          <span class="cat-amount">${fmtAmount(amount)}</span>
        </div>`;
    }).join('');
  }

  function rowMarkup(e) {
    const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
    return `
      <div class="expense-row" data-id="${e.id}">
        <span class="expense-date">${shortDate(e.date)}</span>
        <span class="expense-cat"><span class="dot" style="background:${meta.color}"></span>${meta.label}</span>
        <span class="expense-note">${e.note || ''}</span>
        <span class="expense-amount">${fmtAmount(e.amount)}</span>
        <span class="row-actions">
          <button data-action="edit" aria-label="Edit"><svg><use href="#i-edit"/></svg></button>
          <button data-action="delete" aria-label="Delete"><svg><use href="#i-close"/></svg></button>
        </span>
      </div>`;
  }

  function render() {
    renderBreakdown();

    const all = hcLoadExpenses()
      .filter(e => currentFilter === 'all' || e.category === currentFilter)
      .sort((a, b) => b.date.localeCompare(a.date));

    const groups = [];
    all.forEach(e => {
      const key = monthKey(e.date);
      let group = groups.find(g => g.key === key);
      if (!group) { group = { key, label: monthLabel(e.date), items: [], total: 0 }; groups.push(group); }
      group.items.push(e);
      group.total += e.amount;
    });

    document.getElementById('expense-list-mount').innerHTML = groups.map(g => `
      <div class="expense-month-title">${g.label} <span class="total">${fmtAmount(g.total)}</span></div>
      ${g.items.map(rowMarkup).join('')}
    `).join('') || `<p class="muted" style="font-size:13px;">No expenses logged yet — add one above.</p>`;

    const summary = hcExpenseSummary();
    const delta = summary.lastTotal > 0 ? Math.round(((summary.total - summary.lastTotal) / summary.lastTotal) * 100) : null;
    document.getElementById('exp-sub').textContent =
      `${fmtAmount(summary.total)} this month across ${summary.count} entries` +
      (delta !== null ? ` · ${delta > 0 ? '+' : ''}${delta}% vs last month` : '');
  }

  /* ---------------------------- add / edit form ---------------------------- */

  const form = document.getElementById('expense-form-panel');
  const fields = {
    date: document.getElementById('ef-date'),
    amount: document.getElementById('ef-amount'),
    category: document.getElementById('ef-category'),
    note: document.getElementById('ef-note')
  };

  function openForm(item) {
    editingId = item ? item.id : null;
    document.getElementById('ef-title').textContent = item ? 'Edit expense' : 'Add expense';
    document.getElementById('ef-delete').classList.toggle('hidden', !item);
    fields.date.value = item ? item.date : new Date().toISOString().slice(0, 10);
    fields.amount.value = item ? item.amount : '';
    fields.category.value = item ? item.category : 'groceries';
    fields.note.value = item ? item.note : '';
    form.classList.remove('hidden');
    fields.amount.focus();
  }

  function closeForm() {
    form.classList.add('hidden');
    editingId = null;
  }

  document.getElementById('exp-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('ef-cancel').addEventListener('click', closeForm);

  document.getElementById('ef-save').addEventListener('click', () => {
    const amount = Number(fields.amount.value);
    if (!fields.date.value || !amount || amount <= 0) { fields.amount.focus(); return; }
    const list = hcLoadExpenses();
    const patch = { date: fields.date.value, amount, category: fields.category.value, note: fields.note.value.trim() };
    if (editingId) {
      const item = list.find(i => i.id === editingId);
      Object.assign(item, patch);
      hcLogActivity(`Updated a ${CATEGORY_META[patch.category].label} expense`);
    } else {
      list.push({ id: 'x' + Date.now(), ...patch });
      hcLogActivity(`Logged ${fmtAmount(amount)} — ${CATEGORY_META[patch.category].label}`);
    }
    persistExpenses(list);
    closeForm();
    render();
  });

  document.getElementById('ef-delete').addEventListener('click', () => {
    if (!editingId) return;
    if (!window.confirm('Remove this expense?')) return;
    persistExpenses(hcLoadExpenses().filter(i => i.id !== editingId));
    hcLogActivity('Removed an expense entry');
    closeForm();
    render();
  });

  document.getElementById('expense-list-mount').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const row = btn.closest('.expense-row');
    const id = row.dataset.id;
    const item = hcLoadExpenses().find(i => i.id === id);
    if (!item) return;
    if (btn.dataset.action === 'edit') {
      openForm(item);
    } else if (btn.dataset.action === 'delete') {
      if (!window.confirm('Remove this expense?')) return;
      persistExpenses(hcLoadExpenses().filter(i => i.id !== id));
      hcLogActivity('Removed an expense entry');
      render();
    }
  });

  document.getElementById('exp-filter').addEventListener('change', (e) => {
    currentFilter = e.target.value;
    render();
  });

  render();
})();
