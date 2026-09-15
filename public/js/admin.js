const API = '/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || 'null');

// Protection de la page : réservée aux administrateurs connectés
if (!token || !user || user.role !== 'admin') {
  window.location.href = '/login.html';
}

const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

document.getElementById('logoutLink').addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
});

function handleAuthError() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toLocaleString('fr-FR') + ' F';
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ===================== STATS =====================

async function loadStats() {
  const res = await fetch(`${API}/admin/stats`, { headers: authHeaders });
  if (res.status === 401 || res.status === 403) return handleAuthError();
  const stats = await res.json();
  document.getElementById('statUsers').textContent = stats.totalUsers;
  document.getElementById('statVerified').textContent = stats.verifiedUsers;
  document.getElementById('statMatches').textContent = stats.totalMatches;
  document.getElementById('statPredictions').textContent = stats.totalPredictions;
}

// ===================== PAIEMENTS MOBILE MONEY =====================

const OP_CLASS = { orange: 'op-orange', mtn: 'op-mtn', moov: 'op-moov', wave: 'op-wave' };
const OP_LABEL = { orange: 'Orange Money', mtn: 'MTN Money', moov: 'Moov Money', wave: 'Wave' };
const STATUS_CLASS = { pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected' };
const STATUS_LABEL = { pending: 'En attente', approved: 'Validé', rejected: 'Rejeté' };

async function loadPayments() {
  const tbody = document.querySelector('#paymentsTable tbody');
  const msg = document.getElementById('paymentsMessage');
  try {
    const res = await fetch(`${API}/payments/admin/list?status=pending`, { headers: authHeaders });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const data = await res.json();
    const paiements = data.paiements || [];
    document.getElementById('paymentsCount').textContent = paiements.length + ' en attente';
    tbody.innerHTML = '';
    if (paiements.length === 0) {
      msg.textContent = 'Aucun paiement en attente pour le moment.';
      msg.className = 'message';
      return;
    }
    msg.textContent = '';
    paiements.forEach((p) => tbody.appendChild(renderPaymentRow(p)));
  } catch (err) {
    msg.textContent = 'Impossible de charger les paiements.';
    msg.className = 'message error';
  }
}

function renderPaymentRow(p) {
  const tr = document.createElement('tr');
  const opKey = String(p.operator || '').toLowerCase();
  const opClass = OP_CLASS[opKey] || 'op-orange';
  const opLabel = OP_LABEL[opKey] || escapeHtml(p.operator);
  const statusClass = STATUS_CLASS[p.status] || 'status-pending';
  const statusLabel = STATUS_LABEL[p.status] || escapeHtml(p.status);

  tr.innerHTML = `
    <td>
      <strong>${escapeHtml(p.name || '—')}</strong><br>
      <span style="color:var(--text-dim);font-size:11px;">${escapeHtml(p.phone || p.email || '')}</span>
    </td>
    <td><span class="op-tag ${opClass}">${opLabel}</span></td>
    <td>${formatMoney(p.amount)}</td>
    <td class="code-cell">${escapeHtml(p.transaction_code)}</td>
    <td>${formatDate(p.created_at)}</td>
    <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
    <td class="actions"></td>
  `;

  const actionsCell = tr.querySelector('.actions');

  const okBtn = document.createElement('button');
  okBtn.textContent = 'Valider';
  okBtn.className = 'ok small';
  okBtn.addEventListener('click', () => approvePayment(p.id, okBtn, koBtn));

  const koBtn = document.createElement('button');
  koBtn.textContent = 'Rejeter';
  koBtn.className = 'danger small';
  koBtn.addEventListener('click', () => rejectPayment(p.id, okBtn, koBtn));

  actionsCell.append(okBtn, koBtn);
  return tr;
}

async function approvePayment(id, okBtn, koBtn) {
  const msg = document.getElementById('paymentsMessage');
  okBtn.disabled = true;
  koBtn.disabled = true;
  try {
    const res = await fetch(`${API}/payments/admin/${id}/approve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors de la validation.');
    msg.textContent = 'Paiement validé — abonnement activé.';
    msg.className = 'message success';
    loadPayments();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
    okBtn.disabled = false;
    koBtn.disabled = false;
  }
}

async function rejectPayment(id, okBtn, koBtn) {
  const msg = document.getElementById('paymentsMessage');
  const note = prompt('Raison du rejet (optionnel) :') || '';
  okBtn.disabled = true;
  koBtn.disabled = true;
  try {
    const res = await fetch(`${API}/payments/admin/${id}/reject`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur lors du rejet.');
    msg.textContent = 'Paiement rejeté.';
    msg.className = 'message success';
    loadPayments();
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
    okBtn.disabled = false;
    koBtn.disabled = false;
  }
}

// ===================== CONNEXIONS RÉCENTES =====================

async function loadLogins() {
  const table = document.getElementById('loginsTable');
  const thead = table.querySelector('thead tr');
  const tbody = table.querySelector('tbody');
  const msg = document.getElementById('loginsMessage');
  try {
    const res = await fetch(`${API}/admin/logins`, { headers: authHeaders });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const rows = await res.json();
    thead.innerHTML = '';
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) {
      msg.textContent = 'Aucune connexion récente.';
      msg.className = 'message';
      return;
    }
    msg.textContent = '';
    const columns = Object.keys(rows[0]);
    columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.replace(/_/g, ' ');
      thead.appendChild(th);
    });
    rows.slice(0, 50).forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach((col) => {
        const td = document.createElement('td');
        const val = row[col];
        const isDateCol = /_at$|date/i.test(col);
        td.textContent = isDateCol ? formatDate(val) : (val === null || val === undefined ? '—' : String(val));
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  } catch (err) {
    msg.textContent = 'Impossible de charger les connexions récentes.';
    msg.className = 'message error';
  }
}

// ===================== CLIENTS =====================

async function loadUsers() {
  const tbody = document.querySelector('#usersTable tbody');
  const msg = document.getElementById('usersMessage');
  try {
    const res = await fetch(`${API}/admin/users`, { headers: authHeaders });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const users = await res.json();
    tbody.innerHTML = '';
    users.forEach((u) => tbody.appendChild(renderUserRow(u)));
  } catch (err) {
    msg.textContent = 'Impossible de charger les clients.';
    msg.className = 'message error';
  }
}

function renderUserRow(u) {
  const tr = document.createElement('tr');
  const verified = u.email_verified && u.phone_verified ? '✅' : '⏳';
  tr.innerHTML = `
    <td>${escapeHtml(u.name)}</td>
    <td>${escapeHtml(u.email)}</td>
    <td>${escapeHtml(u.phone)}</td>
    <td>${u.role}</td>
    <td>${verified}</td>
    <td>${u.status}</td>
    <td class="actions"></td>
  `;

  const actionsCell = tr.querySelector('.actions');

  const roleBtn = document.createElement('button');
  roleBtn.textContent = u.role === 'admin' ? 'Rétrograder' : 'Promouvoir admin';
  roleBtn.className = 'secondary small';
  roleBtn.addEventListener('click', () => updateUser(u.id, 'role', u.role === 'admin' ? 'user' : 'admin'));

  const statusBtn = document.createElement('button');
  statusBtn.textContent = u.status === 'active' ? 'Suspendre' : 'Réactiver';
  statusBtn.className = 'secondary small';
  statusBtn.addEventListener('click', () => updateUser(u.id, 'status', u.status === 'active' ? 'suspended' : 'active'));

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = 'Supprimer';
  deleteBtn.className = 'danger small';
  deleteBtn.addEventListener('click', () => deleteUser(u.id));

  actionsCell.append(roleBtn, statusBtn, deleteBtn);
  return tr;
}

async function updateUser(id, field, value) {
  await fetch(`${API}/admin/users/${id}/${field}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ [field]: value })
  });
  loadUsers();
}

async function deleteUser(id) {
  if (!confirm('Supprimer définitivement ce client ?')) return;
  await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders });
  loadUsers();
  loadStats();
}

// ===================== ACTIONS RAPIDES (sync / combiné) =====================

document.getElementById('regenerateComboBtn').addEventListener('click', async () => {
  const msg = document.getElementById('comboMessage');
  msg.textContent = 'Génération en cours...';
  msg.className = 'message';
  try {
    const res = await fetch(`${API}/admin/combos/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur.');
    msg.textContent = 'Combiné régénéré avec succès !';
    msg.className = 'message success';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
  }
});

document.getElementById('syncLeagueBtn').addEventListener('click', async () => {
  const leagueId = document.getElementById('leagueIdInput').value.trim();
  const msg = document.getElementById('syncMessage');
  if (!leagueId) {
    msg.textContent = 'Entre un ID de ligue.';
    msg.className = 'message error';
    return;
  }
  msg.textContent = 'Synchronisation en cours...';
  msg.className = 'message';
  try {
    const res = await fetch(`${API}/matches/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ leagueId: leagueId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur.');
    msg.textContent = data.message;
    msg.className = 'message success';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
  }
});

// ===================== INITIALISATION =====================

loadStats();
loadPayments();
loadUsers();
loadLogins();

// ===================== NAVIGATION BARRE LATERALE =====================

document.querySelectorAll('.sidebar .navlink').forEach((link) => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.sidebar .navlink').forEach((l) => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
    link.classList.add('active');
    const target = document.getElementById('page-' + link.dataset.page);
    if (target) target.classList.add('active');
  });
});

// ===================== ABONNEMENTS =====================

const SUB_LABEL = { admin: 'Administrateur', active: 'Actif', trial: 'Essai gratuit', expired: 'Expiré' };
const SUB_CLASS = { admin: 'status-approved', active: 'status-approved', trial: 'status-pending', expired: 'status-rejected' };

async function loadSubscriptions() {
  const tbody = document.querySelector('#subsTable tbody');
  const msg = document.getElementById('subsMessage');
  try {
    const res = await fetch(`${API}/admin/subscriptions`, { headers: authHeaders });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const rows = await res.json();
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) {
      msg.textContent = 'Aucun client pour le moment.';
      msg.className = 'message';
      return;
    }
    msg.textContent = '';
    rows.forEach((u) => {
      const tr = document.createElement('tr');
      const statusClass = SUB_CLASS[u.statut] || 'status-pending';
      const statusLabel = SUB_LABEL[u.statut] || u.statut;
      tr.innerHTML = `
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email || u.phone || '')}</td>
        <td><span class="status-tag ${statusClass}">${statusLabel}</span></td>
        <td>${formatDate(u.expire_le)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    msg.textContent = 'Impossible de charger les abonnements.';
    msg.className = 'message error';
  }
}

loadSubscriptions();

// ===================== COMBINES =====================

const RESULT_LABEL = { won: 'Gagné', lost: 'Perdu', pending: 'En attente' };
const RESULT_CLASS = { won: 'status-approved', lost: 'status-rejected', pending: 'status-pending' };

async function loadCombo() {
  const tier = document.getElementById('comboTierSelect').value;
  const summary = document.getElementById('comboSummary');
  const tbody = document.querySelector('#comboTable tbody');
  const msg = document.getElementById('comboTableMessage');
  summary.textContent = '';
  tbody.innerHTML = '';
  msg.textContent = 'Chargement...';
  msg.className = 'message';
  try {
    const res = await fetch(`${API}/combos/today?tier=${tier}`, { headers: authHeaders });
    if (res.status === 401 || res.status === 403) return handleAuthError();
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur.');

    const picks = data.picks || [];
    summary.textContent = `Combiné du ${formatDate(data.combo && data.combo.combo_date)} — ${picks.length} sélection(s)`;

    if (picks.length === 0) {
      msg.textContent = 'Aucune sélection pour cette formule aujourd\'hui.';
      return;
    }
    msg.textContent = '';
    picks.forEach((p) => {
      const tr = document.createElement('tr');
      const resultClass = RESULT_CLASS[p.result] || 'status-pending';
      const resultLabel = RESULT_LABEL[p.result] || p.result;
      tr.innerHTML = `
        <td>${escapeHtml(p.home_team_name)} - ${escapeHtml(p.away_team_name)}</td>
        <td>${escapeHtml(p.pick_label)}</td>
        <td>${p.confidence ? Math.round(10000 / p.confidence) / 100 : '—'}</td>
        <td>${p.confidence}%</td>
        <td><span class="status-tag ${resultClass}">${resultLabel}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    msg.textContent = err.message || 'Impossible de charger le combiné.';
    msg.className = 'message error';
  }
}

document.getElementById('loadComboBtn').addEventListener('click', loadCombo);
