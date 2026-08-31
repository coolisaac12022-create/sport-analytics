'use strict';

/**
 * Galika - moteur d'analyse sportive
 *
 * Analyse uniquement les données statistiques fournies.
 * Ne génère pas de recommandations de pari.
 */

function average(values) {
  const valid = values.filter((v) => Number.isFinite(Number(v))).map(Number);
  if (!valid.length) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function analyzeTeam(team = {}) {
  const recent = team.recent || {};

  const goalsFor = average(recent.goalsFor || []);
  const goalsAgainst = average(recent.goalsAgainst || []);
  const possession = average(recent.possession || []);
  const shots = average(recent.shots || []);

  const attack =
    goalsFor * 0.6 +
    shots * 0.08 +
    possession * 0.06;

  const defense =
    Math.max(0, 3 - goalsAgainst) * 0.7;

  const form = average(recent.points || []);

  return {
    team: team.name || 'Équipe inconnue',
    attack: Number(attack.toFixed(2)),
    defense: Number(defense.toFixed(2)),
    form: Number(form.toFixed(2)),
    goalsFor: Number(goalsFor.toFixed(2)),
    goalsAgainst: Number(goalsAgainst.toFixed(2)),
    possession: Number(possession.toFixed(2)),
    shots: Number(shots.toFixed(2))
  };
}

function compareTeams(home, away) {
  const a = analyzeTeam(home);
  const b = analyzeTeam(away);

  return {
    home: a,
    away: b,
    differences: {
      attack: Number((a.attack - b.attack).toFixed(2)),
      defense: Number((a.defense - b.defense).toFixed(2)),
      form: Number((a.form - b.form).toFixed(2))
    }
  };
}

function generateReport(home, away) {
  const comparison = compareTeams(home, away);
  const { a, b } = { a: comparison.home, b: comparison.away };

  const observations = [];

  if (a.attack > b.attack) {
    observations.push(`${a.team} présente une production offensive supérieure sur les données fournies.`);
  } else if (b.attack > a.attack) {
    observations.push(`${b.team} présente une production offensive supérieure sur les données fournies.`);
  } else {
    observations.push('Les deux équipes présentent des indicateurs offensifs proches.');
  }

  if (a.defense > b.defense) {
    observations.push(`${a.team} affiche de meilleurs indicateurs défensifs.`);
  } else if (b.defense > a.defense) {
    observations.push(`${b.team} affiche de meilleurs indicateurs défensifs.`);
  } else {
    observations.push('Les indicateurs défensifs sont relativement équilibrés.');
  }

  if (a.form > b.form) {
    observations.push(`${a.team} possède une meilleure dynamique récente.`);
  } else if (b.form > a.form) {
    observations.push(`${b.team} possède une meilleure dynamique récente.`);
  } else {
    observations.push('La dynamique récente est similaire.');
  }

  return {
    match: `${a.team} vs ${b.team}`,
    comparison,
    observations,
    generatedAt: new Date().toISOString()
  };
}

module.exports = {
  average,
  analyzeTeam,
  compareTeams,
  generateReport
};
