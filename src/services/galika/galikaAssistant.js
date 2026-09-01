'use strict';
const { generateAIResponse } = require('./galikaAI');

const { webSearch } = require('./webSearch');
const { generateReport } = require('./galikaEngine');


function getEngineAnalysis(context = {}) {
  const match = context?.match || context?.currentMatch;

  if (!match?.homeTeam || !match?.awayTeam) {
    return null;
  }

  if (!match.homeStats || !match.awayStats) {
    return null;
  }

  try {
    return generateReport(
      {
        name: match.homeTeam,
        recent: match.homeStats
      },
      {
        name: match.awayTeam,
        recent: match.awayStats
      }
    );
  } catch (error) {
    console.log(
      'Moteur statistique Galika indisponible :',
      error.message
    );
    return null;
  }
}

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

  const engineAnalysis = getEngineAnalysis(context);

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
    lower.includes('match actuel') ||
    lower.includes('favori') ||
    lower.includes('qui va gagner') ||
    lower.includes('pronostic')
  ) {
    const home = currentMatch.homeTeam || 'Équipe à domicile';
    const away = currentMatch.awayTeam || 'Équipe à l’extérieur';
    const league = currentMatch.league ? ` (${currentMatch.league})` : '';

    if (currentMatch.homeWinProb != null) {
      const homePct = Math.round(currentMatch.homeWinProb * 100);
      const drawPct = Math.round(currentMatch.drawProb * 100);
      const awayPct = Math.round(currentMatch.awayWinProb * 100);
      const favori = homePct >= awayPct && homePct >= drawPct ? home : (awayPct >= drawPct ? away : null);
      const favoriTxt = favori ? `${favori} est favori avec ${Math.max(homePct, awayPct)}% de chances.` : `C'est très équilibré, le nul est même l'issue la plus probable (${drawPct}%).`;

      return `Pour ${home} contre ${away}${league} : ${favoriTxt} Score le plus probable selon notre modèle : ${currentMatch.predictedScoreHome}-${currentMatch.predictedScoreAway}. Domicile ${homePct}% / Nul ${drawPct}% / Extérieur ${awayPct}%. Rappel : ce sont des tendances statistiques, pas une garantie.`;
    }

    return `Le match que je vois actuellement est ${home} contre ${away}${league}. Ouvre l'analyse du match pour que je puisse te donner les vraies probabilités.`;
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

  if (lower.includes('cote') || lower.includes('cotes')) {
    return `La cote, ${name}, c'est l'inverse de la probabilite calculee par notre modele (1 divise par la probabilite). Par exemple, une probabilite de 50% donne une cote de 2.00. Nos cotes viennent de notre propre calcul statistique (loi de Poisson), pas des bookmakers, donc elles peuvent differer de ce que tu vois sur Betclic ou 1xBet - c'est normal, c'est notre analyse independante.`;
  }

  if (lower.includes('xg') || lower.includes('buts attendus')) {
    return `Le xG (buts attendus), ${name}, est une estimation du nombre de buts qu'une equipe devrait marquer selon sa forme recente et la solidite defensive de l'adversaire. Un xG de 2.1 signifie qu'on attend environ 2 buts de cette equipe, statistiquement.`;
  }

  if (lower.includes('but/but') || lower.includes('btts') || lower.includes('les deux equipes marquent')) {
    return `But/But (BTTS), ${name}, c'est la probabilite que les DEUX equipes marquent au moins un but chacune dans le match, peu importe qui gagne. On la calcule a partir de notre modele de Poisson complet.`;
  }

  if (lower.includes('1,5') || lower.includes('2,5') || lower.includes('over') || lower.includes('under')) {
    return `Les marches +1,5/-1,5 et +2,5/-2,5, ${name}, concernent le nombre TOTAL de buts dans le match (les deux equipes cumulees). +2,5 signifie qu'on attend au moins 3 buts au total ; -2,5 signifie 2 buts ou moins.`;
  }

  if (lower.includes('combine') || lower.includes('combiné')) {
    return `Le combine du jour, ${name}, regroupe plusieurs matchs juges fiables par notre modele, choisis automatiquement pour atteindre une cote combinee d'au moins 10. Attention : combiner plusieurs matchs augmente le risque global, meme si chaque match pris seul semble sur.`;
  }

  if (lower.includes('fiable') || lower.includes('fiabilite') || lower.includes('confiance')) {
    return `Nos previsions utilisent un modele de Poisson (methode utilisee par les vrais analystes sportifs), avec un lissage statistique pour eviter les erreurs sur peu de matchs, et une moyenne de buts adaptee a chaque championnat. Mais aucun modele ne peut garantir un resultat : le football reste imprevisible par nature.`;
  }

  if (page) {
    return `Je vois que tu consultes actuellement ${page}. Dis-moi ce que tu souhaites comprendre et je vais utiliser ce contexte pour t'aider.`;
  }

  // Dernier recours : moteur IA de Galika.
  try {
    const aiResponse = await generateAIResponse({
      question: text,
      messages: context?.messages || [],
      context: {
        ...context,
        engineAnalysis,
        user: {
          name,
          role: user?.role || 'user'
        }
      }
    });

    if (aiResponse) {
      return aiResponse;
    }
  } catch (error) {
    console.log('Moteur IA Galika indisponible :', error.message);
  }

  return `Je t'écoute ${name} 👋 Pose-moi ta question. Je vais essayer de te donner une explication claire et simple.`;
}

module.exports = {
  createResponse,
  needsWebSearch
};
