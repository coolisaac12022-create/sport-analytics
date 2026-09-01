'use strict';

const context = {
  users: new Map()
};

function setUser(user) {
  if (!user || !user.id) return;

  const id = String(user.id);

  if (!context.users.has(id)) {
    context.users.set(id, {
      user: {
        id: user.id,
        name: user.name || 'Utilisateur',
        role: user.role || 'user'
      },
      events: []
    });
  } else {
    context.users.get(id).user = {
      id: user.id,
      name: user.name || 'Utilisateur',
      role: user.role || 'user'
    };
  }
}

function addEvent(userId, event) {
  if (!userId || !event) return;

  const id = String(userId);

  if (!context.users.has(id)) {
    setUser({
      id: userId,
      name: 'Utilisateur',
      role: 'user'
    });
  }

  const userContext = context.users.get(id);

  userContext.events.push({
    type: event.type || 'unknown',
    data: event.data || {},
    timestamp: new Date().toISOString()
  });

  if (userContext.events.length > 100) {
    userContext.events.shift();
  }
}

function getUser(userId) {
  const item = context.users.get(String(userId));
  return item ? item.user : null;
}

function getRecentEvents(userId, limit = 20) {
  const item = context.users.get(String(userId));

  if (!item) return [];

  return item.events.slice(-limit);
}

function getContext(userId) {
  const item = context.users.get(String(userId));

  if (!item) {
    return {
      user: null,
      events: []
    };
  }

  return {
    user: item.user,
    events: item.events.slice(-20)
  };
}

module.exports = {
  setUser,
  addEvent,
  getUser,
  getRecentEvents,
  getContext
};
