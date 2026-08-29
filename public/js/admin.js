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

async function loadStats() {
  const res = await fetch(`${API}/admin/stats`, { headers: authHeaders });
  if (res.status === 401 || res.status === 403) return handleAuthError();
  const stats = await res.json();
  document.getElementById('statUsers').textContent = stats.totalUsers;
  document.getElementById('statVerified').textContent = stats.verifiedUsers;
  document.getElementById('statMatches').textContent = stats.totalMatches;
  document.getElementById('statPredictions').textContent = stats.totalPredictions;
}

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

function handleAuthError() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

document.getElementById('regenerateComboBtn').addEventListener('click', async () => {
  const msg = document.getElementById('comboMessage');
  msg.textContent = 'Generation en cours...';
  msg.className = 'message';
  try {
    const res = await fetch(`${API}/admin/combos/generate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur.');
    msg.textContent = 'Combine regenere avec succes !';
    msg.className = 'message success';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
  }
});

loadStats();
loadUsers();
loadLogins();
