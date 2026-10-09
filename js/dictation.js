(() => {
  const C = window.CBM, { $, el, shuffle, words, play, ls, meaning, ipaEl } = C;
  const root = $('#dictation'), KEY = 'cbm.dict', ROUND = 8;
  const norm = w => w.toLowerCase().replace(/[^a-z0-9]/g, '');
  const stat = () => { try { return Object.assign({ ok: 0, tot: 0 }, JSON.parse(ls.get(KEY, '{}'))); } catch (e) { return { ok: 0, tot: 0 }; } };
  const bump = (ok, tot) => { const s = stat(); s.ok += ok; s.tot += tot; ls.set(KEY, JSON.stringify(s)); };

  function pool() {
    const out = [], up = C.data.upTo, es = C.ES.chunks || {};
    Object.values(C.store).filter(d => d.upTo <= up).forEach(d => {
      d.chunks.forEach(b => out.push({ t: b.text, ph: b.linked, es: (es[b.id] || [])[0], nota: (es[b.id] || [])[1] }));
      d.dialogues.forEach(x => x.lines.forEach(l => out.push({ t: l.text, ph: l.linked, es: l.es })));
    });
    return out.filter(i => words(i.t).length > 2);
  }

  function diff(target, said) {
    const a = target.map(norm), b = said.map(norm), n = a.length, m = b.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const hit = new Array(n).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { hit[i] = true; i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
    }
    return hit;
  }

  let items, k, hits, total;
  function intro() {
    const s = stat(), pct = s.tot ? Math.round(100 * s.ok / s.tot) : 0;
    root.innerHTML = '';
    const c = el('div', 'ex', '<h2>Dictado en 3 pasos</h2>');
    c.appendChild(el('p', 'rule', 'Cada frase tiene tres pasos: 1) solo audio, escribes lo que oyes; 2) completas huecos; 3) ves el texto completo. Cambia la velocidad en el menú (0.8x, 1.0x o 1.2x).'));
    c.appendChild(el('p', 'rule', s.tot ? `Acumulado: ${s.ok} de ${s.tot} palabras (${pct} %).` : 'Aún no has hecho dictados.'));
    const go = el('button', 'btn fill', 'Empezar (' + ROUND + ' frases)'); go.onclick = start;
    c.appendChild(go); root.appendChild(c);
  }
  function start() { items = shuffle(pool()).slice(0, ROUND); k = 0; hits = 0; total = 0; step1(); }

  function card(n, title) {
    root.innerHTML = '';
    const c = el('div', 'ex');
    c.appendChild(el('div', 'meta', `<span>Frase ${k + 1} de ${items.length}</span><span>Paso ${n} de 3</span>`));
    const bar = el('div', 'stepbar'); [1, 2, 3].forEach(i => bar.appendChild(el('i', i <= n ? 'on' : '')));
    c.append(bar, el('h2', '', title));
    root.appendChild(c); return c;
  }
  const listenBtn = it => { const b = el('button', 'btn fill', 'Escuchar'); b.onclick = () => play(it.t, b); return b; };

  function step1() {
    const it = items[k], c = card(1, 'Solo audio: escribe lo que oyes');
    const ta = el('textarea', 'dict-in'); ta.placeholder = 'Escribe aquí…'; ta.spellcheck = false; ta.autocomplete = 'off';
    const out = el('div'), chk = el('button', 'btn', 'Comprobar'), lis = listenBtn(it);
    chk.onclick = () => {
      const tg = words(it.t), said = ta.value.trim().split(/\s+/).filter(Boolean), hit = diff(tg, said);
      const ok = hit.filter(Boolean).length; hits += ok; total += tg.length; bump(ok, tg.length);
      ta.disabled = true; chk.remove();
      const q = el('div', 'dq'); tg.forEach((w, i) => q.appendChild(el('span', 'dw ' + (hit[i] ? 'ok' : 'bad'), w)));
      const said_ = el('p', 'said'); said_.textContent = 'Tú escribiste: ' + (ta.value.trim() || '(nada)');
      out.append(q, el('p', 'fb ' + (ok === tg.length ? 'ok' : 'bad'), ok === tg.length ? '¡Perfecto!' : `${ok} de ${tg.length} palabras.`), said_);
      const nx = el('button', 'btn fill', 'Paso 2: completar huecos'); nx.onclick = step2; out.appendChild(nx);
    };
    c.append(lis, ta, chk, out); play(it.t, lis);
  }

  function step2() {
    const it = items[k], tg = words(it.t), c = card(2, 'Completa los huecos');
    const hide = new Set(shuffle(tg.map((_, i) => i)).slice(0, Math.max(1, Math.round(tg.length * 0.4))));
    const q = el('div', 'dq'), ins = [];
    tg.forEach((w, i) => {
      if (!hide.has(i)) { q.appendChild(el('span', 'dw', w)); return; }
      const inp = el('input', 'gap'); inp.size = Math.max(3, w.length); inp.spellcheck = false; inp.autocomplete = 'off';
      q.appendChild(inp); ins.push([inp, w]);
    });
    const chk = el('button', 'btn', 'Comprobar'), out = el('div');
    chk.onclick = () => {
      let ok = 0;
      ins.forEach(([inp, w]) => { const good = norm(inp.value) === norm(w); if (good) ok++; inp.disabled = true; inp.classList.add(good ? 'ok' : 'bad'); if (!good) inp.after(el('span', 'fixw', w)); });
      chk.remove();
      out.appendChild(el('p', 'fb ' + (ok === ins.length ? 'ok' : 'bad'), `${ok} de ${ins.length} huecos.`));
      const nx = el('button', 'btn fill', 'Paso 3: ver el texto'); nx.onclick = step3; out.appendChild(nx);
    };
    c.append(listenBtn(it), q, chk, out);
  }

  function step3() {
    const it = items[k], c = card(3, 'Ahora lee y escucha con el texto');
    c.append(el('p', 'chunk', it.t), el('span', 'linked', it.ph || ''), ipaEl(it.t), listenBtn(it), meaning(it.t, it.es, it.nota));
    const last = k + 1 >= items.length, nx = el('button', 'btn fill', last ? 'Ver resultado' : 'Siguiente frase');
    nx.onclick = () => { k++; if (last) done(); else step1(); }; c.appendChild(nx);
  }
  function done() {
    const pct = total ? Math.round(100 * hits / total) : 0, s = stat();
    root.innerHTML = '';
    const c = el('div', 'ex', `<h2>Resultado: ${hits} de ${total} palabras (${pct} %)</h2>`);
    c.appendChild(el('p', 'rule', `Acumulado: ${s.ok} de ${s.tot} palabras (${s.tot ? Math.round(100 * s.ok / s.tot) : 0} %).`));
    const again = el('button', 'btn fill', 'Otra ronda'); again.onclick = start;
    const home = el('button', 'btn', 'Salir'); home.onclick = intro;
    c.append(again, home); root.appendChild(c);
  }

  C.hooks.push(intro);
  if (C.data) intro();
})();
