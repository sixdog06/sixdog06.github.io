/* 亮暗主题切换：右上角按钮，选择持久化到 localStorage。
   页面 <head> 里的内联脚本负责首屏前应用已存主题（避免闪烁），
   本文件只负责创建按钮和切换。 */
(function () {
  'use strict';
  var root = document.documentElement;

  function isDark() {
    return root.getAttribute('data-theme') === 'dark';
  }

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';

  function render() {
    btn.textContent = isDark() ? '☀ light' : '☾ dark';
    btn.setAttribute('aria-label', isDark() ? '切换到亮色主题' : '切换到暗色主题');
  }

  btn.addEventListener('click', function () {
    if (isDark()) {
      root.removeAttribute('data-theme');
      try { localStorage.setItem('theme', 'light'); } catch (e) {}
    } else {
      root.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('theme', 'dark'); } catch (e) {}
    }
    render();
  });

  render();
  document.body.appendChild(btn);
})();
