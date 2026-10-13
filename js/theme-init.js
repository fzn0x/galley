// Set the theme before first paint so night users never see a white flash.
(function () {
  'use strict';
  let theme = null;
  try { theme = JSON.parse(localStorage.getItem('galley:v1') || '{}').theme || null; } catch (e) { /* storage blocked */ }
  if (!theme) theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  document.documentElement.setAttribute('data-theme', theme);
})();
