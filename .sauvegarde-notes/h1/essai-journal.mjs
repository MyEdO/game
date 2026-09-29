// Mesure : le panneau du journal de combat DANS LE FLUX du rail (variante injectée) contre ANCRÉ à son bouton (livré).
const LIB = '/home/user/game/.wt-1919-H1/scripts/recette/lib.mjs';
const { openApp, evaluate, setViewport, sleep, resoudreModales, attendreSelecteur, clickButtonByText, cliquerSelecteur } = await import(LIB);
const FLUX = `.hud-rail .ld-panel { position: static !important; }`;
const session = await openApp();
const MES = `(() => { const r=(s)=>{const e=document.querySelector(s); if(!e) return null; const b=e.getBoundingClientRect(); return [Math.round(b.x*10)/10,Math.round(b.y*10)/10,Math.round(b.width*10)/10,Math.round(b.height*10)/10];};
  const g = document.querySelector('.party-dock').getBoundingClientRect();
  return { centreGroupe: Math.round((g.x + g.width/2) * 10) / 10, axe: innerWidth/2, groupe: r('.party-dock'), rail: r('.hud-rail'), bouton: r('.hud-rail .ld-btn'), panneau: r('.ld-panel'), cols: getComputedStyle(document.querySelector('.stage-flot')).gridTemplateColumns }; })()`;
try {
  await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
  await attendreSelecteur(session, '.stage .party-dock', { timeoutMs: 20000 });
  await sleep(500);
  await resoudreModales(session, 'intro');
  await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
  await sleep(1500);
  await resoudreModales(session, 'ouverture', { labels: ['Tout lancer', 'Lancer', 'Continuer', 'Appliquer', 'Poursuivre', 'Suivant', 'Valider', 'Terminer', 'Fermer'] });
  await clickButtonByText(session, 'Commencer le combat');
  await sleep(1000);
  await resoudreModales(session, 'round');
  await evaluate(session, `(() => { const b = window.__wfrp.store.getState().battle; const id = b.order.find((x) => (b.combatants.find((c) => c.id === x) || {}).kind === 'hero'); return window.__wfrp.turn(id); })()`);
  await sleep(1000);
  for (const variante of ['ancre', 'flux']) {
    if (variante === 'flux') await evaluate(session, `(() => { const s=document.createElement('style'); s.textContent=${JSON.stringify(FLUX)}; document.head.appendChild(s); return true; })()`);
    for (const [w, h] of [[1707, 780], [1366, 650], [900, 780], [700, 780], [360, 740]]) {
      await setViewport(session, w, h); await sleep(400);
      const ferme = await evaluate(session, MES);
      await cliquerSelecteur(session, '.hud-rail .ld-btn'); await sleep(400);
      const ouvert = await evaluate(session, MES);
      await cliquerSelecteur(session, '.hud-rail .ld-btn'); await sleep(300);
      console.log(variante, `${w}x${h}`, 'groupe fermé→ouvert', ferme.centreGroupe, '→', ouvert.centreGroupe, '(axe', ferme.axe + ')', 'bouton', JSON.stringify(ferme.bouton), '→', JSON.stringify(ouvert.bouton), 'panneau', JSON.stringify(ouvert.panneau));
    }
  }
} finally { await session.close(); }
