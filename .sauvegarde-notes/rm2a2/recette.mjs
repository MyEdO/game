import { openApp, consoleGuard, evaluate, survoler, clickButtonByText, shot, setViewport, sleep, realKey } from '/home/user/game/.wt-1806-L1/scripts/recette/lib.mjs';
const OUT = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rm2a2';
const TAG = process.argv[2] || 'apres';
const log = (...a) => console.log(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));

const rects = `(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.left), r: Math.round(b.right), y: Math.round(b.top), b: Math.round(b.bottom) }; };
  const bulle = document.querySelector('.infobulle[role="tooltip"]');
  const lum = document.querySelector('[data-recette-lumiere]');
  const fin = Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => /Fin du tour/.test(b.textContent || b.getAttribute('aria-label') || ''));
  const croise = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  return { bulle: r(bulle), lumiere: r(lum), finDuTour: r(fin), recouvre: croise(r(bulle), r(fin)), texte: bulle ? bulle.textContent.slice(0, 80) : null };
})()`;

async function main() {
  const session = await openApp();
  const guard = consoleGuard(session);
  try {
    await setViewport(session, 900, 780);
    await evaluate(session, "window.__wfrp.scenario('entrainement')");
    await evaluate(session, 'window.__wfrp.ready()');
    await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
    await sleep(500);
    await clickButtonByText(session, 'Commencer le combat', { exact: true }).catch(() => {});
    await sleep(400);
    await evaluate(session, "window.__wfrp.turn('pregen-707')");
    await sleep(400);
    const marque = await evaluate(session, `(() => {
      const cases = Array.from(document.querySelectorAll('button.cc-cell'));
      const lum = cases.find((b) => /Lumi[eè]re/.test(b.textContent || ''));
      const autre = cases.find((b) => b !== lum && !b.disabled && !b.hasAttribute('data-gated'));
      if (lum) lum.setAttribute('data-recette-lumiere', '');
      if (autre) autre.setAttribute('data-recette-autre', '');
      return { lumiere: lum ? { texte: lum.textContent, gated: lum.hasAttribute('data-gated') } : null, autre: autre ? autre.textContent : null };
    })()`);
    log('cases marquées', marque);

    // Point 1 : le refus de « Lumière » à 900×780.
    await survoler(session, '[data-recette-lumiere]', { attenteMs: 500 });
    const mesure = await evaluate(session, rects);
    log('P1 mesure', mesure);
    const png = await shot(session, `refus-lumiere-900x780-${TAG}`, OUT, { neutraliser: false });
    log('P1 capture', png);
    await survoler(session, 'body', { attenteMs: 300 });

    if (TAG === 'apres') {
      // Point 3 : survol → Échap → re-survol sans sortie (fermée) → sortie → re-survol (rouverte), sur 2 ancrages.
      for (const sel of ['[data-recette-lumiere]', '[data-recette-autre]']) {
        const p = await survoler(session, sel, { attenteMs: 500 });
        const ouverte1 = await evaluate(session, `!!document.querySelector('.infobulle[role="tooltip"]')`);
        await realKey(session, { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
        await sleep(300);
        const apresEchap = await evaluate(session, `!!document.querySelector('.infobulle[role="tooltip"]')`);
        await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x + 2, y: p.y + 1, buttons: 0 });
        await sleep(400);
        const survolSansSortie = await evaluate(session, `!!document.querySelector('.infobulle[role="tooltip"]')`);
        await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 450, y: 150, buttons: 0 });
        await sleep(400);
        await survoler(session, sel, { attenteMs: 500 });
        const reSurvol = await evaluate(session, `!!document.querySelector('.infobulle[role="tooltip"]')`);
        log('P3 cycle', sel, { ouverte1, apresEchap, survolSansSortie, reSurvol });
        await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 450, y: 150, buttons: 0 });
        await sleep(400);
      }
    }
  } finally {
    log('Erreurs console:', guard.errors());
    await session.close();
  }
}
main().then(() => console.log('---OK---')).catch((e) => { console.error('ECHEC', (e && e.stack) || e); process.exitCode = 1; });
