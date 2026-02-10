// auth.js - Authentication System for YURI BOT

// Fungsi untuk mengecek apakah user sudah login
function isUserLoggedIn() {
  const loggedIn = localStorage.getItem('userLoggedIn') === 'true';
  const loginTime = localStorage.getItem('loginTime');

  // Cek apakah login sudah expired (7 hari)
  if (loginTime) {
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - parseInt(loginTime) > sevenDays) {
      logoutUser();
      return false;
    }
  }

  return loggedIn;
}

// Fungsi untuk mendapatkan data user
function getUserData() {
  const userData = localStorage.getItem('userData');
  try {
    return userData ? JSON.parse(userData) : null;
  } catch (e) {
    console.error('Error parsing user data:', e);
    return null;
  }
}

// Fungsi untuk logout
function logoutUser() {
  localStorage.removeItem('userLoggedIn');
  localStorage.removeItem('userData');
  localStorage.removeItem('loginTime');

  // Hapus cookie dengan API call
  fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  }).catch(err => console.error('Logout API error:', err));

  // Redirect ke login
  window.location.href = 'login.html';
}

// Fungsi untuk update navbar berdasarkan status login
function updateNavbar() {
  const navActions = document.querySelector('.nav-actions') ||
    document.getElementById('navActions');

  if (!navActions) return;

  if (isUserLoggedIn()) {
    const userData = getUserData();
    const username = userData ? userData.username : 'User';
    const initial = username.charAt(0).toUpperCase();

    navActions.innerHTML = `
      <div class="user-info">
        <div class="user-avatar">${initial}</div>
        <span>Hi, ${username}!</span>
        <button class="btn-logout" onclick="logoutUser()">Logout</button>
      </div>
    `;
  } else {
    navActions.innerHTML = `
      <a href="login.html" class="btn-login">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.791 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
        Login
      </a>
      <a href="premium.html" class="btn-action btn-premium protected-link">Premium</a>
      <a href="support.html" class="btn-action btn-support protected-link">Support</a>
    `;
  }
}

// Fungsi untuk proteksi halaman
function requireAuth() {
  if (!isUserLoggedIn()) {
    // Simpan URL tujuan
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== '/login.html' && currentPath !== '/login') {
      sessionStorage.setItem('redirectAfterLogin', currentPath);
    }

    // Redirect ke login
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Auto-check pada halaman yang dilindungi
document.addEventListener('DOMContentLoaded', function () {
  // Daftar halaman yang memerlukan login
  const protectedPages = [
    'fitur.html',
    'command.html',
    'support.html',
    'premium.html',
    'team.html',
    'dokumentasi.html',
    'tos.html',
    'privacy.html'
  ];

  const currentPage = window.location.pathname.split('/').pop();

  // Jika halaman saat ini dilindungi, cek login
  if (protectedPages.includes(currentPage)) {
    if (!requireAuth()) {
      return;
    }
  }

  // Update navbar
  updateNavbar();

  // Tambahkan event listener untuk link yang dilindungi
  document.querySelectorAll('a.protected-link').forEach(link => {
    link.addEventListener('click', function (e) {
      if (!isUserLoggedIn()) {
        e.preventDefault();
        const href = this.getAttribute('href');
        sessionStorage.setItem('redirectAfterLogin', href);
        window.location.href = 'login.html';
      }
    });
  });
});

// Cek apakah ada redirect setelah login
if (isUserLoggedIn() && sessionStorage.getItem('redirectAfterLogin')) {
  const redirectUrl = sessionStorage.getItem('redirectAfterLogin');
  sessionStorage.removeItem('redirectAfterLogin');
  if (redirectUrl && !window.location.pathname.includes(redirectUrl)) {
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 500);
  }
}

// Export fungsi untuk penggunaan global
window.isUserLoggedIn = isUserLoggedIn;
window.getUserData = getUserData;
window.logoutUser = logoutUser;
window.updateNavbar = updateNavbar;
window.requireAuth = requireAuth;