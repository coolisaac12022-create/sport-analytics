'use strict';

function createResponse(user, question, context = {}) {
  const name = user?.name || 'Utilisateur';
  const text = String(question || '').toLowerCase().trim();
  const isCreator = user?.role === 'admin';

  if (!text) {
    return `Je t'écoute ${name} 😊 Pose-moi une question.`;
  }

  if (
    text.includes('bonjour') ||
    text.includes('salut') ||
    text.includes('hello') ||
    text.includes('bonsoir')
  ) {
    if (isCreator) {
      return `Bonjour ${name} 👋 Je suis Galika, ton assistante sur Sport Analytics. Je reconnais ton compte comme celui du créateur de la plateforme. Je suis prête à t'aider.`;
    }

    return `Bonjour ${name} 👋 Je suis Galika, l'assistante de Sport Analytics. Je suis là pour t'aider à comprendre le site et ses analyses.`;
  }

  if (
    text.includes('qui es-tu') ||
    text.includes('tu es qui') ||
    text.includes('présente-toi')
  ) {
    return `Je suis Galika 🤖, l'assistante de Sport Analytics. Je peux expliquer les statistiques, guider les visiteurs et les aider à comprendre les fonctionnalités du site.`;
  }

  if (
    text.includes('créateur') ||
    text.includes('createur') ||
    text.includes('fondateur')
  ) {
    if (isCreator) {
      return `Oui ${name} 👑 Je reconnais ton compte comme celui du créateur de Sport Analytics.`;
    }

    return `Je suis Galika, l'assistante de Sport Analytics.`;
  }

  if (
    text.includes('statistique') ||
    text.includes('stats') ||
    text.includes('possession') ||
    text.includes('tirs') ||
    text.includes('buts') ||
    text.includes('forme')
  ) {
    return `Bien sûr ${name} 😊 Je peux t'expliquer les statistiques affichées sur le site : buts marqués et encaissés, possession, tirs, forme récente, attaque et défense. Si tu me donnes une statistique précise, je peux te l'expliquer simplement.`;
  }

  if (
    text.includes('aide') ||
    text.includes('comprends pas') ||
    text.includes('comprend pas') ||
    text.includes('explique') ||
    text.includes('comment')
  ) {
    return `Pas de problème ${name} 😊 Explique-moi ce que tu ne comprends pas. Je vais te répondre étape par étape avec des mots simples.`;
  }

  if (text.includes('site') || text.includes('fonction')) {
    return `Je peux t'aider à comprendre Sport Analytics, les matchs, les analyses, les statistiques et les différentes fonctionnalités disponibles sur la page que tu consultes.`;
  }

  if (context.page) {
    return `Je vois que tu consultes actuellement ${context.page}. Dis-moi ce que tu souhaites comprendre et je vais t'aider à partir de ce contexte.`;
  }

  return `Je t'écoute ${name} 👋 Pose-moi ta question. Je vais essayer de te donner une explication claire et simple.`;
}

module.exports = {
  createResponse
};
