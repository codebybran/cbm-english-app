(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const clean = t => t.replace(/\.\.\./g, '').replace(/[?.,]/g, '').trim();
  const words = t => clean(t).split(/\s+/);

  let data, rate = 1, voice = null;

  const synth = window.speechSynthesis;
  function pickVoice() {
    const vs = synth.getVoices();
    voice = vs.find(v => v.lang === 'en-US' && /natural|google|samantha|aria|jenny/i.test(v.name))
         || vs.find(v => v.lang === 'en-US') || vs.find(v => v.lang.startsWith('en')) || null;
    $('#voiceWarn').hidden = !!voice || !vs.length;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; } else $('#voiceWarn').hidden = false;

  let token = 0;
  function say(text) {
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = rate; if (voice) u.voice = voice;
      u.onend = u.onerror = res;
      synth.speak(u);
    });
  }
  async function play(parts, node) {
    if (!synth) return;
    synth.cancel(); const my = ++token;
    document.querySelectorAll('.playing').forEach(n => n.classList.remove('playing'));
    node && node.classList.add('playing');
    for (const p of [].concat(parts)) {
      if (my !== token) return;
      await say(p);
      if (my !== token) return;
      await new Promise(r => setTimeout(r, 250));
    }
    if (my === token) node && node.classList.remove('playing');
  }
  const speakBlock = (b, node) => play(clean(b.text) + (b.text.endsWith('?') ? '?' : ''), node);
  const speakWords = (b, node) => play(words(b.text), node);

  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === t));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === t.dataset.view));
    synth && synth.cancel();
  });
  document.querySelectorAll('.speed-btn').forEach(b => b.onclick = () => {
    rate = parseFloat(b.dataset.rate);
    document.querySelectorAll('.speed-btn').forEach(x => x.classList.toggle('active', x === b));
  });

  const LEVELS = { '1A': 'data/level1a.json', '1B': 'data/level1b.json' };
  const store = {}, all = {};
  const norm = d => {
    const list = d.blocks || d.chunks, cats = d.categories || [];
    list.forEach(b => {
      b.catName = typeof b.cat === 'number' ? (cats.find(c => c.id === b.cat) || {}).name : b.cat;
      all[b.id] = b;
    });
    return { title: d.title, blocks: list, dialogues: d.dialogues || [] };
  };

  function renderStudy() {
    const root = $('#study'); root.innerHTML = '';
    [...new Set(data.blocks.map(b => b.catName))].forEach(name => {
      root.appendChild(el('h2', '', name));
      data.blocks.filter(b => b.catName === name).forEach(b => {
        const card = el('article', 'block');
        card.append(el('p', 'chunk', b.text), el('span', 'linked', b.linked), el('p', 'rule', b.rule));
        const btns = el('div', 'btns');
        const full = el('button', 'btn fill', '🔊 Bloque completo');
        const wbw = el('button', 'btn', '🔊 Palabra por palabra');
        full.onclick = () => speakBlock(b, card);
        wbw.onclick = () => speakWords(b, card);
        btns.append(full, wbw); card.append(btns);
        root.appendChild(card);
      });
    });
  }

  const ROUND = 10;
  function renderListening() {
    const root = $('#listening');
    let queue, i, score;

    function start() {
      queue = shuffle(data.blocks).slice(0, ROUND).map((b, n) => ({ b, type: n % 2 && words(b.text).length > 1 ? 'build' : 'pick' }));
      i = 0; score = 0; next();
    }
    function next() {
      root.innerHTML = '';
      if (i >= queue.length) {
        const end = el('div', 'ex', `<h2>Resultado: ${score} de ${ROUND}</h2>`);
        const again = el('button', 'btn fill', 'Practicar otra ronda'); again.onclick = start;
        end.appendChild(again); root.appendChild(end); return;
      }
      const { b, type } = queue[i];
      const card = el('div', 'ex');
      card.appendChild(el('div', 'meta', `<span>Ejercicio ${i + 1} de ${ROUND}</span><span>Aciertos: ${score}</span>`));
      card.appendChild(el('h2', '', type === 'pick' ? 'Escucha y elige lo que oyes' : 'Escucha y ordena las palabras'));
      const listen = el('button', 'btn fill', '🔊 Escuchar'); listen.onclick = () => speakBlock(b, listen);
      card.appendChild(listen);
      const fb = el('p', 'fb');
      const done = ok => {
        if (ok) score++;
        fb.className = 'fb ' + (ok ? 'ok' : 'bad');
        fb.textContent = ok ? '¡Correcto!' : `Respuesta: ${b.text}`;
        const nx = el('button', 'btn fill', i + 1 < ROUND ? 'Siguiente' : 'Ver resultado');
        nx.onclick = () => { i++; next(); }; card.appendChild(nx); nx.focus();
      };

      if (type === 'pick') {
        const pool = shuffle(data.blocks.filter(x => x.id !== b.id));
        const opts = shuffle([b, ...pool.slice(0, 3)]);
        const box = el('div', 'opts');
        opts.forEach(o => {
          const btn = el('button', 'opt', o.text);
          btn.onclick = () => {
            box.querySelectorAll('.opt').forEach(x => { x.disabled = true; if (x.textContent === b.text) x.classList.add('ok'); });
            if (o !== b) btn.classList.add('bad');
            done(o === b);
          };
          box.appendChild(btn);
        });
        card.append(box, fb);
      } else {
        const target = words(b.text);
        const tray = el('div', 'tray'), bank = el('div', 'tray');
        let order = shuffle(target.map((w, k) => ({ w, k })));
        if (order.map(o => o.w).join() === target.join()) order.reverse();
        order.forEach(o => {
          const chip = el('button', 'chip', o.w);
          chip.onclick = () => (chip.parentNode === bank ? tray : bank).appendChild(chip);
          bank.appendChild(chip);
        });
        const check = el('button', 'btn', 'Comprobar');
        check.onclick = () => {
          const got = [...tray.children].map(c => c.textContent);
          if (got.length !== target.length) { fb.className = 'fb bad'; fb.textContent = 'Usa todas las palabras.'; return; }
          document.querySelectorAll('.chip').forEach(c => c.disabled = true);
          check.remove(); done(got.join(' ') === target.join(' '));
        };
        card.append(tray, bank, check, fb);
      }
      root.appendChild(card);
    }
    start();
  }

  function renderSpeaking() {
    const root = $('#speaking'); root.innerHTML = '';
    root.appendChild(el('p', 'rule', 'Escucha, repite cada línea y practica con un compañero: uno es A y el otro es B.'));
    data.dialogues.forEach(d => {
      root.appendChild(el('h2', '', d.title));
      const allBtn = el('button', 'btn fill', '🔊 Escuchar diálogo completo');
      allBtn.onclick = () => play(d.lines.map(l => l.text), allBtn);
      root.appendChild(allBtn);
      d.lines.forEach(l => {
        const row = el('div', 'line ' + l.who);
        const bub = el('div', 'bubble');
        const tags = l.blocks.map(id => all[id].linked).join('  ');
        bub.append(el('p', '', l.text), el('span', 'rule', tags));
        const btn = el('button', 'btn', '🔊'); btn.setAttribute('aria-label', `Escuchar línea de ${l.who}`);
        btn.onclick = () => play(l.text, bub);
        bub.appendChild(document.createElement('br')); bub.appendChild(btn);
        row.append(el('div', 'who', l.who), bub);
        root.appendChild(row);
      });
    });
  }

  function show(level) {
    data = store[level];
    $('#levelTitle').textContent = data.title;
    document.querySelectorAll('.lvl-btn').forEach(b => b.classList.toggle('active', b.dataset.level === level));
    synth && synth.cancel();
    renderStudy(); renderListening(); renderSpeaking();
  }
  document.querySelectorAll('.lvl-btn').forEach(b => b.onclick = () => show(b.dataset.level));

  Promise.all(Object.entries(LEVELS).map(([k, u]) => fetch(u).then(r => r.json()).then(d => { store[k] = norm(d); })))
    .then(() => show('1A'))
    .catch(() => { $('#levelTitle').textContent = 'No se pudieron cargar los datos. Abre el proyecto con un servidor local.'; });
})();
