(function () {
  'use strict';

  if (!window.GalikaObserver) return;

  function collectPageContext() {
    const main = document.querySelector('main');

    return {
      page: window.location.pathname,
      title: document.title,
      text: main
        ? main.innerText.slice(0, 3000)
        : document.body.innerText.slice(0, 3000)
    };
  }

  window.GalikaPageContext = {
    collect: collectPageContext
  };

  window.GalikaObserver.send(
    'PAGE_CONTEXT',
    collectPageContext()
  );

  console.log('Galika Page Context actif');
})();
