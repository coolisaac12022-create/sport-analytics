(function () {
  'use strict';

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!user) return;

  const name = user.name || 'Utilisateur';
  const isCreator = user.role === 'admin';

  const button = document.createElement('button');
  button.id = 'galika-button';
  button.textContent = '🤖';
  button.title = 'Ouvrir Galika';

  document.body.appendChild(button);


  const galikaChatStyle = document.createElement('style');

  galikaChatStyle.textContent = `
    #galika-panel {
      position: fixed;
      right: 20px;
      bottom: 90px;
      width: 360px;
      height: 500px;
      background: white;
      border-radius: 18px;
      box-shadow: 0 10px 40px rgba(0,0,0,.25);
      z-index: 9999;
      display: none;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e5e7eb;
    }

    #galika-header {
      padding: 15px;
      background: #111827;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #galika-close {
      border: 0;
      background: transparent;
      color: white;
      font-size: 22px;
      cursor: pointer;
    }

    #galika-messages {
      flex: 1;
      padding: 15px;
      overflow-y: auto;
      background: #f8fafc;
    }

    .galika-msg {
      margin-bottom: 10px;
      padding: 10px 12px;
      border-radius: 12px;
      line-height: 1.45;
    }

    .galika-msg.user {
      background: #111827;
      color: white;
      margin-left: 25px;
    }

    .galika-msg.bot {
      background: white;
      color: #111827;
      border: 1px solid #e5e7eb;
      margin-right: 25px;
    }

    #galika-form {
      display: flex;
      gap: 7px;
      padding: 10px;
      border-top: 1px solid #e5e7eb;
      background: white;
    }

    #galika-input {
      flex: 1;
      min-width: 0;
      padding: 10px;
      border: 1px solid #d1d5db;
      border-radius: 10px;
    }

    #galika-form button {
      border: 0;
      border-radius: 10px;
      padding: 0 12px;
      background: #111827;
      color: white;
      cursor: pointer;
    }

    @media (max-width: 500px) {
      #galika-panel {
        right: 10px;
        bottom: 80px;
        width: calc(100vw - 20px);
        height: 480px;
      }
    }
  `;

  document.head.appendChild(galikaChatStyle);

  const panel = document.createElement('div');
  panel.id = 'galika-panel';

  panel.innerHTML = `
    <div id="galika-header">
      <strong>🤖 Galika</strong>
      <button id="galika-close">×</button>
    </div>

    <div id="galika-messages"></div>

    <form id="galika-form">
      <input
        id="galika-input"
        type="text"
        placeholder="Écris ta question..."
        autocomplete="off"
      >
      <button type="submit">Envoyer</button>
    </form>
  `;

  document.body.appendChild(panel);

  const messages = document.getElementById('galika-messages');
  const input = document.getElementById('galika-input');
  const form = document.getElementById('galika-form');

  function addMessage(text, type = 'bot') {
    const item = document.createElement('div');
    item.className = 'galika-msg ' + type;
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    const question = input.value.trim();

    if (!question) return;

    addMessage(question, 'user');
    input.value = '';

    addMessage('Galika réfléchit...', 'bot');

    try {
      const token = localStorage.getItem('token');

      const response = await fetch('/api/galika/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          question,
          context: {
            page: window.location.pathname,
            title: document.title
          }
        })
      });

      const data = await response.json();

      messages.lastElementChild.remove();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur Galika.');
      }

      addMessage(data.answer, 'bot');

    } catch (error) {
      messages.lastElementChild.remove();
      addMessage('Désolé, je ne peux pas répondre pour le moment.', 'bot');
      console.error('Galika:', error);
    }
  });


  document.getElementById('galika-close')
    .addEventListener('click', function () {
      panel.style.display = 'none';
    });


  button.addEventListener('click', function () {
    const isOpen = panel.style.display === 'flex';
    panel.style.display = isOpen ? 'none' : 'flex';
    const welcomeBox = document.getElementById('galika-welcome');
    if (welcomeBox) welcomeBox.remove();
  });

  const style = document.createElement('style');
  style.textContent = `
    #galika-welcome {
      position: fixed;
      right: 20px;
      bottom: 90px;
      max-width: 320px;
      padding: 14px 16px;
      background: white;
      color: #111827;
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,.20);
      z-index: 9997;
      font-size: 14px;
      line-height: 1.5;
    }

    #galika-welcome strong {
      display: block;
      margin-bottom: 5px;
    }

    #galika-welcome-close {
      float: right;
      border: 0;
      background: none;
      cursor: pointer;
      font-size: 18px;
    }
  `;

  document.head.appendChild(style);

  const welcome = document.createElement('div');
  welcome.id = 'galika-welcome';

  welcome.innerHTML = `
    <button id="galika-welcome-close">×</button>
    <strong>🤖 Galika</strong>
    Bienvenue ${name} 👋
  `;

  document.body.appendChild(welcome);

  document.getElementById('galika-welcome-close')
    .addEventListener('click', function () {
      welcome.remove();
    });

  setTimeout(function () {
    const message = isCreator
      ? 'Bienvenue ' + name + ' 👋 Je suis Galika, ton assistante. Je reconnais ton compte comme celui du créateur de Sport Analytics.'
      : 'Bienvenue ' + name + ' 👋 Je suis Galika, ton assistante. Je peux t’aider à comprendre le site et ses statistiques.';

    console.log('Galika : ' + message);
  }, 500);


  function galikaSpeak(text) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(
        String(text).replace(/<[^>]*>/g, '')
      );

      speech.lang = 'fr-FR';
      speech.rate = 1;
      speech.pitch = 1;

      window.speechSynthesis.speak(speech);
    }

    const old = document.getElementById('galika-auto-message');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'galika-auto-message';

    box.innerHTML = `
      <strong>🤖 Galika</strong>
      <div>${text}</div>
    `;

    box.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 160px;
      max-width: 320px;
      padding: 14px 16px;
      background: white;
      color: #111827;
      border-radius: 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,.22);
      z-index: 10000;
      font-size: 14px;
      line-height: 1.5;
    `;

    document.body.appendChild(box);

    setTimeout(() => {
      box.remove();
    }, 7000);
  }

  let galikaLastReaction = '';
  let galikaLastReactionAt = 0;

  function galikaSmartReact(type, data = {}) {
    const now = Date.now();

    if (now - galikaLastReactionAt < 5000) return;

    const key = type + ':' + JSON.stringify(data);

    if (key === galikaLastReaction) return;

    galikaLastReaction = key;
    galikaLastReactionAt = now;

    galikaReact(type, data);
  }

  function galikaReact(type, data = {}) {
    if (type === 'PAGE_VIEW') {
      if (data.page === '/' || data.page === '/index.html') {
        galikaSpeak(
          `Bienvenue ${name} 👋 Je suis Galika. Je suis prête à t'accompagner sur Sport Analytics.`
        );
      }
      return;
    }

    if (type === 'USER_ACTION') {
      const text = String(data.text || '').toLowerCase();

      if (text.includes('analyse')) {
        galikaSpeak(
          `Je vois que tu ouvres une analyse, ${name}. Je peux t'aider à comprendre les indicateurs affichés.`
        );
      }
      return;
    }

    if (type === 'league_sync') {
      galikaSpeak(
        `La synchronisation de la ligue est lancée, ${name}. Je peux suivre les informations qui arrivent.`
      );
      return;
    }

    if (type === 'match_selected') {
      const home = data.homeTeam || 'Équipe 1';
      const away = data.awayTeam || 'Équipe 2';

      galikaSpeak(
        `Tu consultes maintenant ${home} contre ${away}. Je peux t'expliquer les données de cette rencontre.`
      );
      return;
    }

    if (type === 'prediction_loaded') {
      galikaSpeak(
        `L'analyse du match est disponible, ${name}. Tu peux me demander de t'expliquer les indicateurs affichés.`
      );
    }
  }

  window.GalikaReact = galikaSmartReact;

  async function galikaEvent(type, data = {}) {
    const token = localStorage.getItem('token');

    if (!token) return;

    try {
      await fetch('/api/galika/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          type,
          data
        })
      });
    } catch (error) {
      console.log('Galika contexte indisponible');
    }
  }

  galikaEvent('PAGE_VIEW', {
    page: window.location.pathname,
    title: document.title
  });


  document.addEventListener('click', function (event) {
    const element = event.target.closest('button, a');

    if (!element) return;

    const text = (element.innerText || element.textContent || '').trim();

    if (!text) return;

    galikaEvent('USER_ACTION', {
      element: element.tagName.toLowerCase(),
      text: text.slice(0, 100)
    });
  });

})();
