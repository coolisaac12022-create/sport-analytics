// Service d'intégration avec une API sportive externe.
// Par défaut : TheSportsDB (gratuite). Pour changer de fournisseur (API-Football, SportRadar, etc.),
// il suffit de modifier ce fichier — le reste de l'app n'a pas besoin de changer.

const fetch = require('node-fetch');

const BASE_URL = process.env.SPORTS_API_BASE_URL || 'https://www.thesportsdb.com/api/v1/json';
const API_KEY = process.env.SPORTS_API_KEY || '3'; // "3" = clé de test publique TheSportsDB

async function request(pathname) {
  const url = `${BASE_URL}/${API_KEY}/${pathname}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erreur API sportive (${res.status}) : ${url}`);
  }
  return res.json();
}

// Recherche une ligue par nom (ex : "English Premier League")
async function searchLeague(name) {
  const data = await request(`search_all_leagues.php?s=${encodeURIComponent(name)}`);
  return data.countrys || data.leagues || [];
}

// Récupère les prochains matchs d'une ligue (par id de ligue TheSportsDB)
async function getUpcomingMatchesByLeague(leagueId) {
  const data = await request(`eventsnextleague.php?id=${leagueId}`);
  return data.events || [];
}

// Récupère les derniers matchs terminés d'une ligue
async function getPastMatchesByLeague(leagueId) {
  const data = await request(`eventspastleague.php?id=${leagueId}`);
  return data.events || [];
}

// Récupère les détails d'une équipe par nom
async function getTeamByName(name) {
  const data = await request(`searchteams.php?t=${encodeURIComponent(name)}`);
  return (data.teams && data.teams[0]) || null;
}

// Récupère les 5 derniers résultats d'une équipe (pour calculer sa forme)
async function getLastResultsByTeam(teamId) {
  const data = await request(`eventslast.php?id=${teamId}`);
  return data.results || [];
}

module.exports = {
  searchLeague,
  getUpcomingMatchesByLeague,
  getPastMatchesByLeague,
  getTeamByName,
  getLastResultsByTeam
};
