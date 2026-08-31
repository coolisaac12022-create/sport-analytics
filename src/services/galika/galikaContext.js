'use strict';

const context = {
  users: new Map(),
  events: []
};

function setUser(user) {
  if (!user || !user.id) return;

  context.users.set(String(user.id), {
    id: user.id,
    name: user.name || 'Utilisateur',
    role: user.role || 'user'
  });
}

function addEvent(event) {
  if (!event) return;

  context.events.push({
    type: event.type || 'unknown',
    data: event.data || {},
    timestamp: new Date().toISOString()
  });

  if (context.events.length > 100) {
    context.events.shift();
  }
}

function getUser(userId) {
  return context.users.get(String(userId)) || null;
}

function getRecentEvents(limit = 20) {
  return context.events.slice(-limit);
}

module.exports = {
  setUser,
  addEvent,
  getUser,
  getRecentEvents
};
