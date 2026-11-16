/* DIYbrary shared code: categories, book cleaning, library card, and the open-book player. */
(function () {
  const CATS = [
    { id: 'food', no: 100, name: 'Food & Drink' },
    { id: 'art', no: 200, name: 'Art & Craft' },
    { id: 'games', no: 300, name: 'Games & Tricks' },
    { id: 'sports', no: 400, name: 'Sports & Moves' },
    { id: 'tech', no: 500, name: 'Tech' },
    { id: 'style', no: 600, name: 'Style' },
    { id: 'life', no: 700, name: 'Life Skills' }
  ];
  const COLORS = ['#f0553a', '#17988f', '#3b6fd4', '#8a4fc7', '#d98a00', '#2f9e55', '#d6427f', '#39445f'];
  const DIFF = ['', 'Beginner', 'Some practice', 'Tricky'];
  const IMG_OK = /^data:image\/(jpeg|png|webp|svg\+xml)[;,]/;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = (v, n) => String(v == null ? '' : v).slice(0, n);
  const img = v => (typeof v === 'string' && IMG_OK.test(v) ? v : '');
  const cat = id => CATS.find(c => c.id === id) || null;
  const slug = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function callNo(b) {
    const c = cat(b.cat);
    const a = String(b.author || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '---';
    return (c ? c.no : '000') + ' ' + a;
  }

  /* Everything in a book file is untrusted: force every field to a safe type and size. */
  function clean(b) {
    b = b && typeof b === 'object' ? b : {};
    const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
    const t = b.test && typeof b.test === 'object' ? b.test : null;
    return {
      v: 1,
      id: String(b.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90),
      title: str(b.title, 60), author: str(b.author, 30),
      cat: cat(b.cat) ? b.cat : '',
      hook: str(b.hook, 240),
      diff: [1, 2, 3].includes(+b.diff) ? +b.diff : 1,
      mins: Math.max(1, Math.min(60, Math.round(+b.mins) || 10)),
      color: COLORS.includes(b.color) ? b.color : COLORS[0],
      cover: img(b.cover), thumb: img(b.thumb),
      materials: arr(b.materials, 15).map(m => str(m, 60)),
      steps: arr(b.steps, 10).map(s => ({ img: img(s && s.img), text: str(s && s.text, 220), tip: str(s && s.tip, 140), warn: str(s && s.warn, 140) })),
      quiz: [0, 1, 2].map(i => {
        const q = (Array.isArray(b.quiz) && b.quiz[i]) || {};
        return { q: str(q.q, 140), choices: [0, 1, 2].map(j => str(q.choices && q.choices[j], 80)), answer: [0, 1, 2].includes(q.answer) ? q.answer : -1 };
      }),
      test: t ? { tester: str(t.tester, 30), stuck: str(t.stuck, 400), changes: [0, 1].map(i => str(t.changes && t.changes[i], 200)) } : null,
      updated: +b.updated || 0
    };
  }

  /* Library card: lives in this browser only. */
  const CARD_KEY = 'diybrary-card';
  function getCard() {
    try { const c = JSON.parse(localStorage.getItem(CARD_KEY)); if (c && typeof c === 'object') return { name: str(c.name, 30), stamps: c.stamps && typeof c.stamps === 'object' ? c.stamps : {} }; } catch (e) {}
    return { name: '', stamps: {} };
  }
  function saveCard(c) { try { localStorage.setItem(CARD_KEY, JSON.stringify(c)); } catch (e) {} }

  /* ---------- player ---------- */
  let P = null;
  function open(book, opts) {
    opts = opts || {};
    const b = clean(book);
    const pages = [{ k: 'cover' }, { k: 'materials' }].concat(b.steps.map((s, i) => ({ k: 'step', i })), [{ k: 'quiz' }]);
    if (opts.notes && b.test) pages.push({ k: 'notes' });
    pages.push({ k: 'done' });
    P = { b, pages, i: 0, opts, picks: [-1, -1, -1], checked: false, ticks: {} };
    let el = document.getElementById('player');
    if (!el) {
      el = document.createElement('div'); el.id = 'player';
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      document.body.appendChild(el);
      el.addEventListener('click', onClick);
      el.addEventListener('change', onChange);
      document.addEventListener('keydown', e => {
        if (!P) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight' && !/INPUT|TEXTAREA/.test(e.target.tagName)) go(1);
        else if (e.key === 'ArrowLeft' && !/INPUT|TEXTAREA/.test(e.target.tagName)) go(-1);
      });
    }
    el.hidden = false; draw();
  }
  function close() { const el = document.getElementById('player'); if (el) el.hidden = true; const o = P && P.opts; P = null; if (o && o.onClose) o.onClose(); }
  function go(d) { if (!P) return; const n = P.i + d; if (n < 0 || n >= P.pages.length) return; P.i = n; draw(); }

  function draw() {
    const { b, pages, i } = P, pg = pages[i], el = document.getElementById('player');
    let label = '', body = '';
    if (pg.k === 'cover') {
      label = 'Call no. ' + callNo(b);
      body = `${b.cover ? `<img class="shot" src="${esc(b.cover)}" alt="">` : ''}
        <h2>${esc(b.title || 'Untitled book')}</h2>
        <p>by <b>${esc(b.author || 'Unknown author')}</b></p>
        <p class="big">${esc(b.hook)}</p>
        <div class="facts"><span class="pill">${esc(DIFF[b.diff])}</span><span class="pill">About ${b.mins} min</span><span class="pill">${b.steps.length} steps</span>${cat(b.cat) ? `<span class="pill">${esc(cat(b.cat).name)}</span>` : ''}</div>`;
    } else if (pg.k === 'materials') {
      label = 'What you need';
      body = `<h2>Gather your materials</h2><p>Tick each one off before you start.</p><ul class="checks">${b.materials.filter(m => m.trim()).map((m, j) => `<li><label><input type="checkbox" data-tick="${j}" ${P.ticks[j] ? 'checked' : ''}>${esc(m)}</label></li>`).join('') || '<li>No materials listed.</li>'}</ul>`;
    } else if (pg.k === 'step') {
      const s = b.steps[pg.i];
      label = `Step ${pg.i + 1} of ${b.steps.length}`;
      body = `${s.img ? `<img class="shot" src="${esc(s.img)}" alt="Photo for step ${pg.i + 1}">` : ''}
        <p class="big">${esc(s.text)}</p>
        ${s.tip ? `<div class="note tip"><b>Pro tip</b>${esc(s.tip)}</div>` : ''}
        ${s.warn ? `<div class="note warn"><b>Watch out</b>${esc(s.warn)}</div>` : ''}`;
    } else if (pg.k === 'quiz') {
      label = 'Did you get it?';
      const qs = b.quiz.filter(q => q.q.trim());
      let score = 0;
      body = `<h2>Quick check</h2>` + (qs.length ? b.quiz.map((q, qi) => {
        if (!q.q.trim()) return '';
        if (P.checked && P.picks[qi] === q.answer) score++;
        return `<div class="q"><p>${esc(q.q)}</p>${q.choices.map((c, ci) => {
          let cls = '';
          if (P.checked) cls = ci === q.answer ? 'right' : (P.picks[qi] === ci ? 'wrong' : '');
          return c.trim() ? `<label class="${cls}"><input type="radio" name="q${qi}" data-q="${qi}" value="${ci}" ${P.picks[qi] === ci ? 'checked' : ''} ${P.checked ? 'disabled' : ''}>${esc(c)}</label>` : '';
        }).join('')}</div>`;
      }).join('') + (P.checked ? `<p class="big">You got ${score} of ${qs.length}.</p>` : `<div><button class="btn teal" data-act="check">Check my answers</button></div>`) : '<p>This book has no quiz yet.</p>');
    } else if (pg.k === 'notes') {
      label = 'Test and revise notes';
      body = `<h2>Silent test notes</h2><p><b>Tester:</b> ${esc(b.test.tester) || '(none yet)'}</p><p><b>Where the tester got stuck:</b><br>${esc(b.test.stuck) || '(none yet)'}</p><p><b>What the author changed:</b></p><ul>${b.test.changes.map(c => `<li>${esc(c) || '(blank)'}</li>`).join('')}</ul><p class="note tip">Only the author and teacher see this page. It is removed when the book is shelved.</p>`;
    } else {
      label = 'The end';
      const card = getCard(), st = b.id && card.stamps[b.id];
      if (P.opts.stampable && b.id) {
        body = `<div class="center pagebody" style="padding:0"><h2>You finished the book!</h2>
          ${st ? `<span class="stamp">Tried it<br>${esc(st.date)}</span><p>Rate this book:</p><div class="stars">${[1, 2, 3, 4, 5].map(n => `<button data-star="${n}" class="${st.stars >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">&#9733;</button>`).join('')}</div><p>Saved to your library card.</p>`
            : `<p class="big">Did you actually try it?</p><button class="btn" data-act="stamp">Stamp my library card</button>`}</div>`;
      } else {
        body = `<div class="center pagebody" style="padding:0"><h2>End of the book</h2><p>${P.opts.preview ? 'This is a preview. Readers can stamp their library card here once the book is on the shelves.' : 'Nice work.'}</p></div>`;
      }
    }
    el.innerHTML = `<div class="page" style="--bk:${esc(b.color)}">
      <div class="pagehead"><span>${esc(label)}</span><span class="sp"></span><button class="mini" data-act="close">Close book</button></div>
      <div class="pagebody">${body}</div>
      <div class="pagefoot"><button class="btn alt" data-act="prev" ${i === 0 ? 'disabled' : ''}>Back</button>
        <div class="dots">${pages.map((p, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>
        ${i === pages.length - 1 ? `<button class="btn" data-act="close">Done</button>` : `<button class="btn" data-act="next">${i === 0 ? 'Start' : 'Next'}</button>`}</div></div>`;
    const pb = el.querySelector('.pagebody'); if (pb) pb.scrollTop = 0;
    const nx = el.querySelector('[data-act="next"]'); if (nx) nx.focus({ preventScroll: true });
  }
  function onClick(e) {
    if (e.target.id === 'player') return;
    const t = e.target.closest('[data-act],[data-star]'); if (!t || !P) return;
    if (t.dataset.star) {
      const card = getCard(); if (card.stamps[P.b.id]) { card.stamps[P.b.id].stars = +t.dataset.star; saveCard(card); draw(); }
      return;
    }
    const a = t.dataset.act;
    if (a === 'close') close();
    else if (a === 'next') go(1);
    else if (a === 'prev') go(-1);
    else if (a === 'check') { P.checked = true; draw(); }
    else if (a === 'stamp') {
      const card = getCard();
      card.stamps[P.b.id] = { title: P.b.title, author: P.b.author, date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }), stars: 0 };
      saveCard(card); draw();
    }
  }
  function onChange(e) {
    if (!P) return;
    const t = e.target;
    if (t.dataset.q != null) P.picks[+t.dataset.q] = +t.value;
    if (t.dataset.tick != null) P.ticks[t.dataset.tick] = t.checked;
  }

  window.DIY = { CATS, COLORS, DIFF, esc, cat, slug, callNo, clean, getCard, saveCard, open, close };
})();
