const fetch = require('node-fetch');

const BASE_URL = 'https://api.football-data.org/v4';
const API_KEY = process.env.SPORTS_API_KEY;

const FREE_COMPETITION_CODES = ['PL','PD','SA','BL1','FL1','CL','DED','PPL','ELC','BSA','WC','EC'];

let teamCache = null;
let teamCacheLoadedAt = 0;
const TEAM_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

function mapStatus(s) {
  if (s === 'FINISHED' || s === 'AWARDED') return 'FT';
  if (s === 'IN_PLAY') return 'LIVE';
  if (s === 'PAUSED') return 'HT';
  if (s === 'POSTPONED') return 'PST';
  if (s === 'SUSPENDED') return 'SUSP';
  if (s === 'CANCELLED') return 'CANC';
  return 'NS';
}

function transformMatch(m) {
  return {
    fixture: { id: m.id, date: m.utcDate, status: { short: mapStatus(m.status) } },
    league: {
      name: (m.competition && m.competition.name) || null,
      season: (m.season && m.season.startDate) ? m.season.startDate.slice(0, 4) : null
    },
    teams: {
      home: { name: (m.homeTeam && (m.homeTeam.name || m.homeTeam.shortName)) || 'Unknown', logo: m.homeTeam && m.homeTeam.crest },
      away: { name: (m.awayTeam && (m.awayTeam.name || m.awayTeam.shortName)) || 'Unknown', logo: m.awayTeam && m.awayTeam.crest }
    },
    goals: {
      home: (m.score && m.score.fullTime) ? m.score.fullTime.home : null,
      away: (m.score && m.score.fullTime) ? m.score.fullTime.away : null
    }
  };
}

async function request(path, params = {}) {
  console.log('API CONFIG:', { keyPresent: Boolean(API_KEY), baseUrl: BASE_URL });

  if (!API_KEY) {
    throw new Error('SPORTS_API_KEY manquante.');
  }

  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString(), {
    headers: { 'X-Auth-Token': API_KEY, accept: 'application/json' }
  });

  if (res.status === 429) {
    throw new Error('Erreur API Football-Data (429) : quota depasse.');
  }
  if (!res.ok) {
    throw new Error(`Erreur API Football-Data (${res.status}).`);
  }

  return res.json();
}

async function getFixturesByDate(date) {
  const data = await request('/matches', { dateFrom: date, dateTo: date });
  return (data.matches || []).map(transformMatch);
}

async function getUpcomingMatchesByLeague(code) {
  const data = await request(`/competitions/${code}/matches`, { status: 'SCHEDULED,LIVE,IN_PLAY,PAUSED,TIMED' });
  return (data.matches || []).map(transformMatch);
}

async function getPastMatchesByLeague(code) {
  const data = await request(`/competitions/${code}/matches`, { status: 'FINISHED' });
  return (data.matches || []).map(transformMatch);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function loadTeamCache() {
  const now = Date.now();
  if (teamCache && (now - teamCacheLoadedAt) < TEAM_CACHE_TTL_MS) return teamCache;

  const cache = {};
  for (let i = 0; i < FREE_COMPETITION_CODES.length; i++) {
    const code = FREE_COMPETITION_CODES[i];
    try {
      const data = await request(`/competitions/${code}/teams`);
      (data.teams || []).forEach((t) => {
        cache[t.name.toLowerCase()] = t;
        if (t.shortName) cache[t.shortName.toLowerCase()] = t;
      });
    } catch (e) {
      console.error(`Erreur chargement equipes ${code} :`, e.message);
    }
    if (i < FREE_COMPETITION_CODES.length - 1) await sleep(6500);
  }
  teamCache = cache;
  teamCacheLoadedAt = now;
  return cache;
}

async function getTeamByName(name) {
  if (!name) return null;
  const cache = await loadTeamCache();
  const key = name.toLowerCase();

  if (cache[key]) {
    const t = cache[key];
    return { id: t.id, idTeam: t.id, name: t.name, logo: t.crest };
  }

  const match = Object.keys(cache).find((k) => k.includes(key) || key.includes(k));
  if (match) {
    const t = cache[match];
    return { id: t.id, idTeam: t.id, name: t.name, logo: t.crest };
  }
  return null;
}

async function getLastResultsByTeam(teamId) {
  if (!teamId) return [];
  const data = await request(`/teams/${teamId}/matches`, { status: 'FINISHED', limit: 5 });
  return (data.matches || []).map(transformMatch);
}

module.exports = {
  getFixturesByDate,
  getUpcomingMatchesByLeague,
  getPastMatchesByLeague,
  getTeamByName,
  getLastResultsByTeam
};
