'use strict';

function createResponse(user, question, context = {}) {
  const name = user?.name || 'Utilisateur';
  const text = String(question || '').toLowerCase();

  if (text.includes('bonjour') || text.includes('salut') || text.includes('hello')) {
    return `Bonjour ${name} 👋 Je suis Galika. Je suis là pour t'aider à comprendre Sport Analytics.`;
  }

  if (text.includes('statistique') || text.includes('stats')) {
    return `Je peux t'expliquer les statistiques affichées, par exemple les buts, la possession, les tirs, la forme récente et les indicateurs offensifs ou défensifs.`;
  }

  if (text.includes('aide') || text.includes('comprends pas') || text.includes('explique')) {
    return `Bien sûr ${name} 😊 Dis-moi simplement ce que tu ne comprends pas et je vais te l'expliquer étape par étape.`;
  }

  if (text.includes('qui es-tu') || text.includes('tu es qui')) {
    return `Je suis Galika, l'assistante de Sport Analytics. Je peux aider les visiteurs à comprendre le fonctionnement du site et ses analyses.`;
  }

  if (user?.role === 'admin') {
    return `Je suis Galika, ${name}. Je reconnais ton compte comme celui du créateur de la plateforme. Je peux t'aider à comprendre et développer Sport Analytics.`;
  }

  return `Je t'écoute, ${name} 👋 Pose-moi ta question et je vais essayer de t'aider clairement.`;
}

module.exports = {
  createResponse
};
