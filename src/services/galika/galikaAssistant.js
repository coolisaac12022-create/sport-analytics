'use strict';

const { webSearch } = require('./webSearch');

function needsWebSearch(question = '') {
  const text = String(question).toLowerCase();

  const keywords = [
    'actualité', 'actualités',
    'dernier', 'dernière',
    'récent', 'récente',
    'aujourd', 'maintenant',
    'news',
    'blessure', 'blessures',
    'transfert', 'transferts',
    'mercato',
    'composition',
    'classement',
    'résultat', 'résultats'
  ];

  return keywords.some(keyword => text.includes(keyword));
}

async function createResponse(user, question, context = {}) {
  const name = user?.name || 'Utilisateur';
  const text = String(question || '').trim();
  const lower = text.toLowerCase();
  const isCreator = user?.role === 'admin';

  const page = context?.page || '';
  const title = context?.title || '';
  const events = Array.isArray(context?.events)
    ? context.events
    : [];

  if (!text) {
    return `Je t'écoute ${name} 😊 Pose-moi une question.`;
  }

  /*
   * Recherche Web.
   * Si la clé n'est pas encore configurée, Galika
   * continue normalement avec son intelligence locale.
   */
  if (needsWebSearch(text)) {
    try {
      const search = await webSearch(text);

      if (search.answer) {
        return `Voici ce que j'ai trouvé, ${name} :\n\n${search.answer}`;
      }

      if (search.results.length) {
        return `J'ai trouvé ces informations, ${name} :\n\n` +
          search.results
            .slice(0, 3)
            .map((r, i) =>
              `${i + 1}. ${r.title}\n${r.content.slice(0, 400)}`
            )
            .join('\n\n');
      }
    } catch (error) {
      console.log('Recherche Web Galika indisponible :', error.message);
    }
  }

  if (!text) {
    return `Je t'écoute ${name} 😊`;
  }

  if (
    lower.includes('bonjour') ||
    lower.includes('salut') ||
    lower.includes('hello') ||
    lower.includes('bonsoir')
  ) {
    if (isCreator) {
      return `Bonjour ${name} 👋 Je suis Galika, ton assistante sur Sport Analytics. Je reconnais ton compte comme celui du créateur de la plateforme. Je suis prête à t'aider.`;
    }

    return `Bonjour ${name} 👋 Je suis Galika, l'assistante de Sport Analytics. Je suis là pour t'aider à comprendre le site et ses analyses.`;
  }

  if (
    lower.includes('qui es-tu') ||
    lower.includes('tu es qui') ||
    lower.includes('présente-toi')
  ) {
    return `Je suis Galika 🤖, l'assistante de Sport Analytics. Je peux expliquer les statistiques, guider les visiteurs et utiliser le contexte de la page que tu consultes.`;
  }

  if (
    lower.includes('créateur') ||
    lower.includes('createur') ||
    lower.includes('fondateur')
  ) {
    if (isCreator) {
      return `Oui ${name} 👑 Je reconnais ton compte comme celui du créateur de Sport Analytics.`;
    }

    return `Je suis Galika, l'assistante de Sport Analytics.`;
  }

  const matchEvent = [...events]
    .reverse()
    .find(event =>
      event.type === 'match_selected' ||
      event.type === 'prediction_loaded'
    );

  const currentMatch = matchEvent?.data || {};

  if (
    lower.includes('ce match') ||
    lower.includes('ce matchs') ||
    lower.includes('ce match-là') ||
    lower.includes('ce match la') ||
    lower.includes('match actuel')
  ) {
    const home = currentMatch.homeTeam || 'Équipe à domicile';
    const away = currentMatch.awayTeam || 'Équipe à l’extérieur';
    const league = currentMatch.league
      ? ` dans ${currentMatch.league}`
      : '';

    return `Le match que je vois actuellement est ${home} contre ${away}${league}. Je peux t'expliquer les données et les indicateurs affichés.`;
  }

  if (
    lower.includes('statistique') ||
    lower.includes('stats') ||
    lower.includes('possession') ||
    lower.includes('tirs') ||
    lower.includes('buts') ||
    lower.includes('forme')
  ) {
    return `Bien sûr ${name} 😊 Je peux t'expliquer les statistiques affichées sur le site : buts marqués et encaissés, possession, tirs, forme récente, attaque et défense.`;
  }

  if (
    lower.includes('où suis-je') ||
    lower.includes('quelle page') ||
    lower.includes('sur quelle page')
  ) {
    return `Tu consultes actuellement ${page || 'Sport Analytics'}, ${name}. ${title ? `Le titre de cette page est « ${title} ».` : ''}`;
  }

  if (
    lower.includes('que fais-je') ||
    lower.includes('qu est-ce que je fais')
  ) {
    const lastEvent = events.length
      ? events[events.length - 1]
      : null;

    if (lastEvent) {
      return `D'après les dernières informations que je vois, ton dernier événement est « ${lastEvent.type} ».`;
    }

    return `Je vois que tu utilises Sport Analytics, ${name}, mais je n'ai pas encore suffisamment d'événements récents pour savoir exactement ce que tu fais.`;
  }

  if (
    lower.includes('aide') ||
    lower.includes('comprends pas') ||
    lower.includes('comprend pas') ||
    lower.includes('explique') ||
    lower.includes('comment')
  ) {
    return `Pas de problème ${name} 😊 Explique-moi ce que tu ne comprends pas. Je vais te répondre étape par étape avec des mots simples.`;
  }

  if (lower.includes('site') || lower.includes('fonction')) {
    return `Je peux t'aider à comprendre Sport Analytics, les matchs, les analyses, les statistiques et les fonctionnalités disponibles sur la page que tu consultes.`;
  }

  if (page) {
    return `Je vois que tu consultes actuellement ${page}. Dis-moi ce que tu souhaites comprendre et je vais utiliser ce contexte pour t'aider.`;
  }

  return `Je t'écoute ${name} 👋 Pose-moi ta question. Je vais essayer de te donner une explication claire et simple.`;
}

module.exports = {
  createResponse,
  needsWebSearch
};
