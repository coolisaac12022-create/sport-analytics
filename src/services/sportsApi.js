const fetch = require('node-fetch');

const configuredBase = (process.env.SPORTS_API_BASE_URL || '').replace(/\/+$/, '');
const BASE_URL = configuredBase.includes('api-sports.io') ? configuredBase : 'https://v3.football.api-sports.io';

const API_KEY = process.env.SPORTS_API_KEY;

async function request(path, params = {}) {
  if (!API_KEY) {
    throw new Error('SPORTS_API_KEY manquante.');
  }

  const url = new URL(`${BASE_URL}/${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString(), {
    headers: {
      'x-apisports-key': API_KEY,
      accept: 'application/json'
    }
  });

  if (!res.ok) {
    throw new Error(`Erreur API Football (${res.status}).`);
  }

  const data = await res.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(JSON.stringify(data.errors));
  }

  return data.response || [];
}

// Tous les matchs d'une date.
// Cette fonction permettra d'économiser les requêtes du forfait gratuit.
async function getFixturesByDate(date) {
  return request('fixtures', {
    date
  });
}

// Prochains matchs d'une compétition.
async function getUpcomingMatchesByLeague(leagueId) {
  return request('fixtures', {
    league: leagueId,
    next: 20
  });
}

// Derniers matchs d'une compétition.
async function getPastMatchesByLeague(leagueId) {
  return request('fixtures', {
    league: leagueId,
    last: 20
  });
}

// Recherche d'une équipe par nom.
async function getTeamByName(name) {
  const teams = await request('teams', {
    search: name
  });

  return teams[0]?.team || null;
}

// Derniers matchs d'une équipe.
async function getLastResultsByTeam(teamId) {
  return request('fixtures', {
    team: teamId,
    last: 5
  });
}

module.exports = {
  getFixturesByDate,
  getUpcomingMatchesByLeague,
  getPastMatchesByLeague,
  getTeamByName,
  getLastResultsByTeam
};
