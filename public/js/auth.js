const API = '/api';

// ---------- Inscription ----------
const registerForm = document.getElementById('registerForm');
if (registerForm) {
  const registerMessage = document.getElementById('registerMessage');
  const otpSection = document.getElementById('otpSection');
  const otpForm = document.getElementById('otpForm');
  const otpMessage = document.getElementById('otpMessage');
  const resendOtp = document.getElementById('resendOtp');
  let registeredEmail = '';

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;

    setMsg(registerMessage, 'Création du compte...', '');
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription.');

      setMsg(registerMessage, 'Compte cree ! Connexion automatique...', 'success');
      registeredEmail = email;

      const loginRes = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        localStorage.setItem('token', loginData.token);
        localStorage.setItem('user', JSON.stringify(loginData.user));
        setTimeout(function() { window.location.href = '/'; }, 800);
      } else {
        otpSection.classList.remove('hidden');
        otpSection.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      setMsg(registerMessage, err.message, 'error');
    }
  });

  otpForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('otpCode').value.trim();
    setMsg(otpMessage, 'Vérification...', '');
    try {
      const res = await fetch(`${API}/auth/verify-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail, code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code incorrect.');
      setMsg(otpMessage, `${data.message} N'oublie pas de confirmer aussi ton email avant de te connecter.`, 'success');
    } catch (err) {
      setMsg(otpMessage, err.message, 'error');
    }
  });

  resendOtp?.addEventListener('click', async () => {
    setMsg(otpMessage, 'Envoi en cours...', '');
    try {
      const res = await fetch(`${API}/auth/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registeredEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur.');
      setMsg(otpMessage, data.message, 'success');
    } catch (err) {
      setMsg(otpMessage, err.message, 'error');
    }
  });
}

// ---------- Connexion ----------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  const loginMessage = document.getElementById('loginMessage');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    setMsg(loginMessage, 'Connexion...', '');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Connexion impossible.');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      setMsg(loginMessage, 'Connexion réussie, redirection...', 'success');
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? '/admin.html' : '/';
      }, 800);
    } catch (err) {
      setMsg(loginMessage, err.message, 'error');
    }
  });
}

function setMsg(el, text, type) {
  el.textContent = text;
  el.className = `message ${type}`;
}
