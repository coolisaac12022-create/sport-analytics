(function () {
  if (localStorage.getItem('cookieConsent')) return;

  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML = `
    <p>Ce site utilise des cookies necessaires a son fonctionnement (connexion, preferences).
    <a href="/privacy.html">En savoir plus</a></p>
    <button id="cookie-accept">J'accepte</button>
  `;
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#0f172a;color:#f1f5f9;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;z-index:10000;border-top:1px solid #334155;font-size:0.85rem;';
  document.body.appendChild(banner);

  document.getElementById('cookie-accept').addEventListener('click', function () {
    localStorage.setItem('cookieConsent', 'accepted');
    banner.remove();
  });
})();
