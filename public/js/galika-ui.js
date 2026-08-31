(function () {
  'use strict';

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!user) return;

  const name = user.name || 'Utilisateur';
  const isCreator = user.role === 'admin';

  console.log('Galika active pour :', name);

  const button = document.createElement("button");
  button.id = "galika-button";
  button.textContent = "🤖";
  button.title = "Ouvrir Galika";
  document.body.appendChild(button);

  button.addEventListener("click", function () {
    alert("Bonjour " + name + " 👋 Je suis Galika.");
  });

})();
