const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, realKey } = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
process.env.WFRP_DEV_URL ||= 'http://localhost:5236/';
const s = await openApp();
try {
  await evaluate(s, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(s, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500); await resoudreModales(s, 'intro');
  await setViewport(s, 1707, 780);
  await evaluate(s, `window.__wfrp.fight('enc-mutants')`); await sleep(1500);
  await resoudreModales(s, 'o', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await clickButtonByText(s, 'Commencer le combat'); await sleep(1200); await resoudreModales(s, 'r');
  await evaluate(s, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(1000); await resoudreModales(s, 't');
  const who = `(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.className || a.tagName) : null; })()`;
  console.log(await evaluate(s, `(() => { const t = document.querySelector('.combat-console button.cc-cell[data-gated]'); t.setAttribute('data-x',''); const all = [...document.querySelectorAll('.combat-console button:not([disabled])')]; const i = all.indexOf(t); const p = all[i - 1]; p.focus(); return { i, prev: p.getAttribute('aria-label'), actif: document.activeElement === p, hasFocus: document.hasFocus() }; })()`));
  for (let i = 0; i < 4; i++) { await realKey(s, { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await sleep(200); console.log('tab', i, await evaluate(s, who), await evaluate(s, `!!document.activeElement && document.activeElement.hasAttribute('data-x')`)); }
} finally { await s.close(); }
