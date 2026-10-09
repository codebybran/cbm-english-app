(() => {
  const C = window.CBM, { $, el, shuffle, play, ls } = C;
  const root = $('#reduced'), KEY = 'cbm.red', ROUND = 10;
  let rules = [], items, k, hits;
  const stat = () => { try { return Object.assign({ n: 0, ok: 0 }, JSON.parse(ls.get(KEY, '{}'))); } catch (e) { return { n: 0, ok: 0 }; } };
  const bump = ok => { const s = stat(); s.n++; if (ok) s.ok++; ls.set(KEY, JSON.stringify(s)); };
  const tidy = t => t.replace(/\.\.\./g, '').replace(/\s+/g, ' ').trim();
  const ws = s => s.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/).filter(Boolean);
  const key = s => ws(s).join(' ');
  const show = s => s.replace(/\.$/, '');

  function reduce(t) {
    let out = t; const used = [];
    rules.forEach(r => {
      out = out.replace(new RegExp('\\b' + r.full + '\\b', 'gi'), m => {
        if (!used.includes(r)) used.push(r);
        return (/^[A-Z]/.test(m) ? r.red[0].toUpperCase() : r.red[0].toLowerCase()) + r.red.slice(1);
      });
    });
    return { red: out, used };
  }
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const sents = t => tidy(t).split(/(?<=[.?!])\s+/).filter(s => /^[A-Z]/.test(s) && s.split(/\s+/).length > 2);
  function pool() {
    const m = new Map(), up = C.data.upTo;
    Object.values(C.store).filter(d => d.upTo <= up).forEach(d => {
      d.chunks.forEach(b => sents(b.text).forEach(s => m.set(key(s), s)));
      d.dialogues.forEach(x => x.lines.forEach(l => sents(l.text).forEach(s => m.set(key(s), s))));
    });
    return [...m.values()];
  }
  function question(t, all) {
    const others = all.filter(s => key(s) !== key(t)).map(s => [dist(ws(t), ws(s)), Math.random(), s])
      .sort((x, y) => x[0] - y[0] || x[1] - y[1]).slice(0, 3).map(x => x[2]);
    return { full: t, opts: shuffle([t, ...others]) };
  }

  function intro() {
    root.innerHTML = '';
    const s = stat(), c = el('div', 'ex', '<h2>¿Qué dijo? Formas reducidas</h2>');
    c.appendChild(el('p', 'rule', 'Los nativos no dicen "I want to go": dicen "I wanna go". Aquí escucharás frases con formas reducidas ("wanna", "gimme", "I\'m"...) y elegirás la frase completa que dijeron. Al responder puedes comparar el audio reducido con el completo.'));
    c.appendChild(el('p', 'rule', 'La voz es la del navegador: algunas voces pronuncian mejor estas formas que otras.'));
    c.appendChild(el('p', 'rule', s.n ? `Aciertos acumulados: ${s.ok} de ${s.n}.` : 'Aún no has practicado.'));
    if (!rules.length) { c.appendChild(el('p', 'fb bad', 'No se pudo cargar data/reductions.json.')); root.appendChild(c); return; }
    const go = el('button', 'btn fill', 'Empezar'); go.onclick = start; c.appendChild(go); root.appendChild(c);
  }
  function start() {
    const all = pool(), targets = all.filter(s => reduce(s).used.length);
    items = shuffle(targets).slice(0, ROUND).map(t => question(t, all)); k = 0; hits = 0; ask();
  }

  function ask() {
    const q = items[k], red = reduce(q.full).red; root.innerHTML = '';
    const c = el('div', 'ex'), box = el('div', 'opts'), lis = el('button', 'btn fill', 'Escuchar');
    c.appendChild(el('div', 'meta', `<span>Pregunta ${k + 1} de ${items.length}</span><span>Aciertos: ${hits}</span>`));
    c.appendChild(el('h2', '', 'Escucha y elige lo que dijo'));
    lis.onclick = () => play(red, lis);
    q.opts.forEach(o => {
      const b = el('button', 'opt', show(o));
      b.onclick = () => answer(o === q.full, b, box, c);
      box.appendChild(b);
    });
    c.append(lis, box); root.appendChild(c); play(red, lis);
  }

  function answer(ok, btn, box, c) {
    const q = items[k], { red, used } = reduce(q.full);
    box.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === show(q.full)) x.classList.add('ok'); });
    if (!ok) btn.classList.add('bad'); else hits++;
    bump(ok);
    c.appendChild(el('p', 'fb ' + (ok ? 'ok' : 'bad'), ok ? '¡Correcto!' : 'Respuesta: ' + show(q.full)));
    c.appendChild(el('p', 'chunk', `«${show(red)}» = «${show(q.full)}»`));
    used.forEach(r => c.appendChild(el('p', 'rule', `<b>${r.full} → ${r.red}</b> · ${r.note}`)));
    const a = el('button', 'btn', 'Escuchar reducida'), b = el('button', 'btn', 'Escuchar completa');
    a.onclick = () => play(red, a); b.onclick = () => play(q.full, b);
    const last = k + 1 >= items.length, nx = el('button', 'btn fill', last ? 'Ver resultado' : 'Siguiente');
    nx.onclick = () => { k++; if (last) done(); else ask(); };
    c.append(a, b, nx);
  }
  function done() {
    root.innerHTML = ''; const s = stat();
    const c = el('div', 'ex', `<h2>Resultado: ${hits} de ${items.length}</h2>`);
    c.appendChild(el('p', 'rule', `Aciertos acumulados: ${s.ok} de ${s.n}.`));
    const again = el('button', 'btn fill', 'Otra ronda'); again.onclick = start;
    const home = el('button', 'btn', 'Salir'); home.onclick = intro;
    c.append(again, home); root.appendChild(c);
  }

  fetch('data/reductions.json').then(r => r.json()).then(j => { rules = j; if (C.data) intro(); }).catch(() => { if (C.data) intro(); });
  C.hooks.push(intro);
  if (C.data) intro();
})();
