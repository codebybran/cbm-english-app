(() => {
  const C = window.CBM, { $, el, words, play, ls } = C;
  const root = $('#simulation'), KEY = 'cbm.sim', PASS = 75;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const norm = w => w.toLowerCase().replace(/[^a-z0-9]/g, '');
  const ALI = [[/\bwanna\b/gi, 'want to'], [/\bhafta\b/gi, 'have to'], [/\bgimme\b/gi, 'give me'], [/\blemme\b/gi, 'let me'], [/\bdunno\b/gi, "don't know"], [/\bcuz\b/gi, 'because'], [/\bok\b/gi, 'okay']];
  const prep = t => ALI.reduce((s, [a, b]) => s.replace(a, b), t).trim().split(/\s+/).filter(Boolean);
  const MSG = {
    'not-allowed': 'El navegador bloqueó el micrófono. Permítelo en el candado de la barra de direcciones.',
    'service-not-allowed': 'El navegador no permite el reconocimiento de voz en esta página.',
    'no-speech': 'No te escuché. Acerca el micrófono e inténtalo de nuevo.',
    'audio-capture': 'No encuentro un micrófono conectado.',
    network: 'El reconocimiento de voz necesita conexión a internet.'
  };
  const stat = () => { try { return Object.assign({ n: 0, ok: 0 }, JSON.parse(ls.get(KEY, '{}'))); } catch (e) { return { n: 0, ok: 0 }; } };
  const bump = ok => { const s = stat(); s.n++; if (ok) s.ok++; ls.set(KEY, JSON.stringify(s)); };

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
  function best(target, cands) {
    let top = null;
    cands.forEach(t => {
      const hit = diff(target, prep(t)), pct = Math.round(100 * hit.filter(Boolean).length / target.length);
      if (!top || pct > top.pct) top = { hit, pct, text: t };
    });
    return top || { hit: target.map(() => false), pct: 0, text: '' };
  }

  let sess = 0, cur = null, dlg, role, hide, i, scores, log;
  const stopAll = () => { sess++; if (cur) { try { cur.abort(); } catch (e) {} cur = null; } };
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { if (t.dataset.view !== 'simulation') stopAll(); }));

  function listen(onInterim) {
    return new Promise(res => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      const r = new SR(); cur = r; let snap = null, err = '';
      r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 3;
      r.onresult = e => { snap = e.results; onInterim(Array.from(e.results, x => x[0].transcript).join(' ')); };
      r.onerror = e => { err = e.error; };
      r.onend = () => {
        if (cur === r) cur = null;
        res({ err, cands: [0, 1, 2].map(a => Array.from(snap || [], x => (x[a] || x[0]).transcript).join(' ').trim()).filter(Boolean) });
      };
      try { r.start(); } catch (e) { cur = null; res({ err: 'start', cands: [] }); }
    });
  }

  function intro() {
    stopAll(); root.innerHTML = '';
    const c = el('div', 'ex', '<h2>Conversación simulada</h2>');
    c.appendChild(el('p', 'rule', 'La app dice la línea de tu compañero y tú respondes hablando. Se compara lo que dijiste con la línea del diálogo y ves qué palabras coinciden. Cambia la velocidad en el menú.'));
    c.appendChild(el('p', 'rule', 'Importante: el reconocimiento de voz funciona solo en Chrome o Edge, necesita internet y envía tu voz a los servidores del navegador. Mide si te entienden, no si tu pronunciación es perfecta.'));
    const s = stat();
    c.appendChild(el('p', 'rule', s.n ? `Turnos superados: ${s.ok} de ${s.n}.` : 'Aún no has practicado.'));
    if (!SR) { c.appendChild(el('p', 'fb bad', 'Tu navegador no admite reconocimiento de voz. Usa Chrome o Edge.')); root.appendChild(c); return; }
    c.appendChild(el('h2', '', 'Elige un diálogo'));
    Object.entries(C.store).filter(([k, d]) => d.upTo <= C.data.upTo).forEach(([k, d]) => d.dialogues.forEach(x => {
      const b = el('button', 'btn', `${x.title} (${k})`); b.onclick = () => pickRole(x); c.appendChild(b);
    }));
    root.appendChild(c);
  }

  function pickRole(x) {
    dlg = x; root.innerHTML = '';
    const c = el('div', 'ex', `<h2>${x.title}</h2>`);
    c.appendChild(el('p', 'rule', '¿Qué papel quieres hacer? La app hará el otro.'));
    const chk = el('input'); chk.type = 'checkbox';
    const lab = el('label', 'chk'); lab.append(chk, ' Hablar de memoria (ocultar mi línea)');
    c.appendChild(lab);
    ['A', 'B'].forEach(r => { const b = el('button', 'btn fill', 'Soy el Estudiante ' + r); b.onclick = () => begin(r, chk.checked); c.appendChild(b); });
    const back = el('button', 'btn', 'Volver'); back.onclick = intro;
    c.appendChild(back); root.appendChild(c);
  }

  function begin(r, h) {
    stopAll(); role = r; hide = h; i = 0; scores = [];
    root.innerHTML = '';
    const c = el('div', 'ex', `<h2>${dlg.title} · tú eres ${role}</h2>`);
    log = el('div', 'sim-log'); c.appendChild(log); root.appendChild(c);
    run(sess);
  }

  function bubble(l, me) {
    const row = el('div', 'line ' + l.who), bub = el('div', 'bubble' + (me ? ' me' : ''));
    row.append(el('div', 'who', l.who), bub); log.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return bub;
  }

  async function run(my) {
    while (i < dlg.lines.length) {
      const l = dlg.lines[i];
      if (l.who !== role) {
        const b = bubble(l, false); b.appendChild(el('p', '', l.text));
        await play(l.text, b); if (my !== sess) return;
      } else {
        const r = await turn(l, my); if (my !== sess) return;
        scores.push(r);
      }
      i++;
    }
    finish();
  }

  function turn(l, my) {
    return new Promise(done => {
      const bub = bubble(l, true), target = words(l.text);
      const txt = el('p', '', hide ? 'Di tu línea…' : l.text), out = el('div', 'simout'), ctl = el('div', 'simctl');
      const talk = el('button', 'btn fill', 'Hablar'), hear = el('button', 'btn', 'Escuchar modelo'), skip = el('button', 'btn', 'Saltar');
      let busy = false, bestPct = 0, next = null;
      hear.onclick = () => play(l.text, hear);
      if (hide) { const hint = el('button', 'btn', 'Ver pista'); hint.onclick = () => { txt.textContent = l.text; hint.remove(); }; ctl.appendChild(hint); }
      const finish_ = r => { ctl.innerHTML = ''; done(r); };
      skip.onclick = () => { bump(false); out.textContent = 'Línea saltada.'; finish_({ pct: 0, skipped: true }); };
      talk.onclick = async () => {
        if (busy) { if (cur) cur.stop(); return; }
        busy = true; talk.classList.add('recording'); talk.textContent = 'Escuchando… (pulsa para terminar)'; out.textContent = '';
        const { cands, err } = await listen(t => { out.textContent = '… ' + t; });
        busy = false; talk.classList.remove('recording'); talk.textContent = 'Hablar de nuevo';
        if (my !== sess) return;
        out.textContent = '';
        if (!cands.length) { out.appendChild(el('p', 'fb bad', MSG[err] || 'No te escuché. Inténtalo de nuevo.')); return; }
        const res = best(target, cands), ok = res.pct >= PASS; bestPct = Math.max(bestPct, res.pct);
        const q = el('div', 'dq'); target.forEach((w, k) => q.appendChild(el('span', 'dw ' + (res.hit[k] ? 'ok' : 'bad'), w)));
        const heard = el('p', 'said'); heard.textContent = 'Entendí: ' + res.text;
        out.append(q, el('p', 'fb ' + (ok ? 'ok' : 'bad'), (ok ? '¡Bien! ' : 'Casi. ') + res.pct + ' % de coincidencia.'), heard);
        if (!next) { next = el('button', 'btn fill', 'Continuar'); next.onclick = () => { bump(bestPct >= PASS); finish_({ pct: bestPct }); }; ctl.appendChild(next); }
      };
      ctl.append(talk, hear, skip);
      bub.append(txt, out, ctl);
    });
  }

  function finish() {
    const ok = scores.filter(s => !s.skipped), avg = ok.length ? Math.round(ok.reduce((a, s) => a + s.pct, 0) / ok.length) : 0;
    const card = log.parentNode;
    card.appendChild(el('h2', '', `Diálogo completo: promedio de ${avg} % en ${ok.length} turnos`));
    const again = el('button', 'btn fill', 'Repetir este diálogo'); again.onclick = () => begin(role, hide);
    const other = el('button', 'btn', 'Elegir otro'); other.onclick = intro;
    card.append(again, other);
  }

  C.hooks.push(intro);
  if (C.data) intro();
})();
