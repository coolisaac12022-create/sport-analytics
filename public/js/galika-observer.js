(function () {
  'use strict';

  const token = localStorage.getItem('token');

  if (!token) return;

  window.GalikaObserver = {
    send(type, data = {}) {
      fetch('/api/galika/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          data
        })
      }).catch(() => {});
    }
  };

  console.log('Galika Observer actif');
})();
