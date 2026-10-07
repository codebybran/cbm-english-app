(function () {
  var KEY = 'cbm.theme', root = document.documentElement, t = 'light';
  try { t = localStorage.getItem(KEY) || 'light'; } catch (e) {}
  root.setAttribute('data-theme', t);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('themeBtn');
    function label() { b.textContent = root.getAttribute('data-theme') === 'dark' ? 'Modo claro' : 'Modo oscuro'; }
    label();
    b.onclick = function () {
      var n = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', n);
      try { localStorage.setItem(KEY, n); } catch (e) {}
      label();
    };
  });
})();
