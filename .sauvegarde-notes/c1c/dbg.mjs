const L = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur } = L;
const s = await openApp();
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o');
  await sleep(800);
  await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(900); await resoudreModales(s, 'tour');
  for (const w of [1707, 900]) {
    await setViewport(s, w, 780); await sleep(800);
    console.log(w, JSON.stringify(await evaluate(s, `[...document.querySelectorAll('.stage-flot figcaption')].map((f) => { const cs = getComputedStyle(f); const r = f.getBoundingClientRect(); return { html: f.innerHTML.slice(0, 200), ov: cs.overflow, ws: cs.whiteSpace, to: cs.textOverflow, r: [r.x, r.y, r.width, r.height].map(Math.round) }; })`)));
  }
} finally { await s.close(); }
