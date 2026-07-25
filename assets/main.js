(function () {
  'use strict';
  var text = '$ whoami  →  小拳头 // developer & game maker';
  var el = document.getElementById('typed');
  var menu = document.getElementById('menu');
  if (!el || !menu) return;
  var i = 0;
  (function tick() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i++);
      setTimeout(tick, 45);
    } else {
      menu.hidden = false;
    }
  })();
})();
