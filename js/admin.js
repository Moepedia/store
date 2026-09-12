/* ============================================================
   ADMIN LOGIC
============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ---------- AUTH GUARD ---------- */
function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#adminLayout').style.display = 'none';
}
function showAdmin() {
  $('#loginScreen').classList.add('hidden');
  $('#adminLayout').style.display = 'grid';
  renderDashboard();
}

function checkAuth() {
  if (DB.isLoggedIn()) showAdmin();
  else showLogin();
}

$('#loginBtn')?.addEventListener('click', () => {
  const pw = $('#loginPassword').value;
  if (DB.login(pw)) {
    $('#loginError').classList.remove('show');
    $('#loginPassword').value = '';
    showAdmin();
  } else {
    $('#loginError').classList.add('show');
    $('#loginPassword').value = '';
    $('#loginPassword').focus();
  }
});

$('#loginPassword')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') $('#loginBtn').click();
});

$('#logoutBtn')?.addEventListener('click', () => {
  if (!confirm('Logout dari admin panel?')) return;
  DB.logout();
  showLogin();
});

/* ---------- TABS ---------- */
$$('.sidebar-nav button').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.sidebar-nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === '
