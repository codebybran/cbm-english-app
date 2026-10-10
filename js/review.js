(() => {
  const C = window.CBM, { $, el, shuffle, play, ls, clean, ipaEl } = C;
  const root = $('#review'), KEY = 'cbm.srs', INT = [0, 1, 3, 7, 14, 30], NEW_DAY = 8, SIZE = 12;
  const fmt = d => d.toLocaleDateString('en-CA');
  const today = () => fmt(new Date());
  const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };
  const load = () => { try { const s = JSON.parse(ls.get(KEY, '{}')); return { cards: s.cards || {}, day: s.day || '', newToday: s.newToday || 0 }; } catch (e) { return { cards: {}, day: '', newToday: 0 }; } };
  const save = s => ls.set(KEY, JSON.stringify(s));
  const blocks = () => Object.values(C.store).filter(d => d.upTo <= C.data.upTo).flatMap(d => d.chunks);
  const es = id => ((C.ES.chunks || {})[id] || [])[0];

  function record(id, ok) {
    const s = load(), t = today(); let c = s.cards[id];
    if (!c) { c = { b: 0, d: t, ok: 0, bad: 0 }; if (s.day !== t) { s.day = t; s.newToday = 0; } s.newToday++; }
    if (ok) { c.ok++; if (c.d <= t) { c.b = Math.min(c.b + 1, 5); c.d = plus(INT[c.b]); } }
    else { c.bad++; c.b = Math.max(0, c.b - 2); c.d = t; }
    s.cards[id] = c; save(s);
  }
  C.srs = { record };

  function plan() {
    const s = load(), t = today(), all = blocks(), nt = s.day === t ? s.newToday : 0;
    const due = all.filter(b => s.cards[b.id] && s.cards[b.id].d <= t)
      .sort((a, b) => s.cards[a.id].b - s.cards[b.id].b || (s.cards[a.id].d < s.cards[b.id].d ? -1 : 1));
    const fresh = all.filter(b => !s.cards[b.id]).slice(0, Math.max(0, NEW_DAY - nt));
    return { s, all, due, fresh };
  }

  let queue, k, hits, first, retried, busy = false;
  function intro() {
    busy = false; root.innerHTML = '';
    const p = plan(), t = today(), c = el('div', 'ex', '<h2>Repaso espaciado</h2>');
    c.appendChild(el('p', 'rule', 'La app recuerda qué bloques fallas y te los vuelve a mostrar en el momento justo: los que fallas, pronto; los que dominas, cada vez más tarde. Un poco cada día rinde más que mucho un solo día.'));
    const labels = ['Sin ver', 'Aprendiendo', '1 día', '3 días', '7 días', '14 días', '30 días'], counts = labels.map(() => 0);
    p.all.forEach(b => { const x = p.s.cards[b.id]; counts[x ? x.b + 1 : 0]++; });
    const bar = el('div', 'srs'); labels.forEach((l, i) => bar.appendChild(el('div', '', `<b>${counts[i]}</b><span>${l}</span>`)));
    c.append(bar, el('p', 'rule', `Pendientes hoy: ${p.due.length} · Nuevos disponibles hoy: ${p.fresh.length}`));
    const list = p.due.concat(p.fresh).slice(0, SIZE);
    if (list.length) {
      const go = el('button', 'btn fill', `Empezar repaso (${list.length} bloques)`); go.onclick = () => begin(list); c.appendChild(go);
    } else {
      const next = Object.values(p.s.cards).map(x => x.d).filter(d => d > t).sort()[0];
      c.appendChild(el('p', 'fb ok', 'Hoy no tienes repasos pendientes.' + (next ? ` El próximo es el ${next}.` : '')));
      const seen = p.all.filter(b => p.s.cards[b.id]);
      if (seen.length) { const r = el('button', 'btn', 'Practicar 10 al azar'); r.onclick = () => begin(shuffle(seen).slice(0, 10)); c.appendChild(r); }
    }
    root.appendChild(c);
  }
  function begin(list) { busy = true; queue = list.slice(); k = 0; hits = 0; first = new Set(); retried = new Set(); ask(); }
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { if (t.dataset.view === 'review' && !busy) intro(); }));

  function ask() {
    if (k >= queue.length) return done();
    const b = queue[k], x = load().cards[b.id], mean = !!(x && x.b >= 2 && es(b.id));
    const label = o => (mean ? es(o.id) : o.text), want = label(b);
    const pool = blocks().filter(o => o.id !== b.id && (!mean || es(o.id)));
    const near = shuffle(pool.filter(o => o.cat === b.cat)).concat(shuffle(pool.filter(o => o.cat !== b.cat)));
    const seen = new Set([want]), others = near.filter(o => !seen.has(label(o)) && seen.add(label(o))).slice(0, 3);
    root.innerHTML = '';
    const c = el('div', 'ex'), box = el('div', 'opts'), lis = el('button', 'btn fill', 'Escuchar');
    const say = clean(b.text) + (b.text.endsWith('?') ? '?' : '');
    c.appendChild(el('div', 'meta', `<span>Bloque ${k + 1} de ${queue.length}</span><span>Aciertos: ${hits}</span>`));
    c.appendChild(el('h2', '', mean ? 'Escucha y elige qué significa' : 'Escucha y elige lo que oyes'));
    lis.onclick = () => play(say, lis);
    shuffle([b, ...others]).forEach(o => {
      const btn = el('button', 'opt', label(o));
      btn.onclick = () => answer(o === b, btn, box, c, want);
      box.appendChild(btn);
    });
    c.append(lis, box); root.appendChild(c); play(say, lis);
  }

  function answer(ok, btn, box, c, want) {
    const b = queue[k];
    box.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === want) x.classList.add('ok'); });
    if (!ok) btn.classList.add('bad');
    if (!first.has(b.id)) { first.add(b.id); if (ok) hits++; }
    record(b.id, ok);
    c.appendChild(el('p', 'fb ' + (ok ? 'ok' : 'bad'), ok ? '¡Correcto!' : 'Era: ' + want));
    c.appendChild(el('p', 'chunk', b.text)); c.appendChild(el('span', 'linked', b.linked)); c.appendChild(ipaEl(b.text));
    if (es(b.id)) c.appendChild(el('p', 'rule', 'Significado: ' + es(b.id)));
    if (!ok && !retried.has(b.id)) { retried.add(b.id); queue.push(b); c.appendChild(el('p', 'rule', 'Lo volverás a ver al final de esta sesión.')); }
    const nx = el('button', 'btn fill', k + 1 >= queue.length ? 'Ver resultado' : 'Siguiente');
    nx.onclick = () => { k++; ask(); }; c.appendChild(nx);
  }

  function done() {
    busy = false; root.innerHTML = '';
    const s = load(), tm = plus(1), n = Object.values(s.cards).filter(x => x.d === tm).length;
    const c = el('div', 'ex', `<h2>Resultado: ${hits} de ${first.size} a la primera</h2>`);
    c.appendChild(el('p', 'rule', `Para mañana tienes ${n} bloque${n === 1 ? '' : 's'} programado${n === 1 ? '' : 's'}. Los que fallaste volverán antes.`));
    const home = el('button', 'btn fill', 'Volver al repaso'); home.onclick = intro; c.appendChild(home); root.appendChild(c);
  }

  C.hooks.push(intro);
  if (C.data) intro();
})();
