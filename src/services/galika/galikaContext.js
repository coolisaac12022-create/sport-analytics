'use strict';

const pool = require('../../config/db');

async function setUser(user) {
  return user || null;
}

async function addEvent(userId, event) {
  if (!userId || !event) return;

  await pool.query(
    `INSERT INTO galika_events
      (user_id, event_type, event_data)
     VALUES ($1, $2, $3::jsonb)`,
    [
      userId,
      event.type || 'unknown',
      JSON.stringify(event.data || {})
    ]
  );

  await pool.query(
    `DELETE FROM galika_events
     WHERE user_id = $1
     AND id NOT IN (
       SELECT id
       FROM galika_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 100
     )`,
    [userId]
  );
}

async function getUser(userId) {
  if (!userId) return null;

  const result = await pool.query(
    `SELECT id, name, role
     FROM users
     WHERE id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function getRecentEvents(userId, limit = 20) {
  if (!userId) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const result = await pool.query(
    `SELECT
       event_type AS type,
       event_data AS data,
       created_at AS timestamp
     FROM galika_events
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  return result.rows.reverse();
}

async function getContext(userId) {
  const user = await getUser(userId);
  const events = await getRecentEvents(userId, 20);

  return {
    user,
    events
  };
}

module.exports = {
  setUser,
  addEvent,
  getUser,
  getRecentEvents,
  getContext
};
