// Essai de gabarit : injecte un <style> et mesure les pistes + boîtes à quelques vues, en combat (ouverture puis tour).
const LIB = '/home/user/game/.wt-1919-H1/scripts/recette/lib.mjs';
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText } = await import(LIB);
const css = process.argv[2] || '';
const session = await openApp();
const MES = `(() => { const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)];};
  const f=document.querySelector('.stage-flot'); const cs=getComputedStyle(f);
  return { rows: cs.gridTemplateRows, cols: cs.gridTemplateColumns, groupe:r('.party-dock'), frise:r('.initiative-strip'), fil:r('.combat-feed'), ouv:r(".cc-phase[data-phase='ouverture']"), rail:r('.hud-rail'), topbar:r('.hud-topbar') }; })()`;
try {
  await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(session, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500);
  await resoudreModales(session, 'intro');
  await evaluate(session, `(() => { const s=document.createElement('style'); s.id='essai'; s.textContent=${JSON.stringify(css)}; document.head.appendChild(s); return true; })()`);
  await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
  await sleep(1500);
  await resoudreModales(session, 'ouverture', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  for (const [w, h] of [[1707, 780], [1366, 650], [900, 780]]) { await setViewport(session, w, h); await sleep(500); console.log('ouverture', w, h, JSON.stringify(await evaluate(session, MES))); }
  await clickButtonByText(session, 'Commencer le combat');
  await sleep(1000);
  await resoudreModales(session, 'round');
  await evaluate(session, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(1000);
  for (const [w, h] of [[1707, 780], [1366, 650], [900, 780]]) { await setViewport(session, w, h); await sleep(500); console.log('heros', w, h, JSON.stringify(await evaluate(session, MES))); }
} finally { await session.close(); }
