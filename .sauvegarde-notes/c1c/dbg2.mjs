const L = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur } = L;
const s = await openApp();
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o'); await sleep(800);
  await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(900); await resoudreModales(s, 'tour');
  for (const w of [1707, 700, 1100]) {
    await setViewport(s, w, 780); await sleep(400);
    await evaluate(s, `window.__wfrp.turn(window.__wfrp.store.getState().battle.order[0])`);
    await sleep(200);
    const r = await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const out = []; for (let i = b.order.length - 1; i >= 0; i--) { const r = window.__wfrp.turn(b.order[i]); out.push(String(r).slice(0, 60)); if (typeof r === 'string' && r.startsWith('\\u2713')) return { id: b.order[i], out, turn: window.__wfrp.store.getState().battle.turn, n: b.order.length }; } return out; })()`);
    console.log(w, JSON.stringify(r));
    for (let k = 0; k < 8; k++) {
      await sleep(250);
      console.log('  ', k, JSON.stringify(await evaluate(s, `(() => { const t = document.querySelector('.is-tiles'); const a = t.querySelector('[aria-current="step"]'); const cells = [...t.querySelectorAll('.is-cell')]; return { st: t.scrollTop, sl: t.scrollLeft, sh: t.scrollHeight, ch: t.clientHeight, idx: a ? cells.indexOf(a) : null, n: cells.length, turn: window.__wfrp.store.getState().battle.turn }; })()`)));
    }
  }
} finally { await s.close(); }
