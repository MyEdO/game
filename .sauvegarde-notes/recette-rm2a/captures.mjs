import { openApp, consoleGuard, evaluate, survoler, clickButtonByText, shot, setViewport, sleep } from '/home/user/game/scripts/recette/lib.mjs';
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); };
const OUT = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/recette-rm2a';
const VUES = [ [360,740,'360x740'], [700,780,'700x780'], [900,780,'900x780'], [1366,650,'1366x650'], [1707,780,'1707x780'] ];

async function main() {
  const session = await openApp();
  const guard = consoleGuard(session);
  try {
    await evaluate(session, "window.__wfrp.scenario('entrainement')");
    await evaluate(session, "window.__wfrp.ready()");
    await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
    await sleep(500);
    await clickButtonByText(session, 'Commencer le combat', { exact: true }).catch(() => {});
    await sleep(400);
    await evaluate(session, "window.__wfrp.turn('pregen-707')"); // Wilhelmina, porte une case refusee
    await sleep(300);
    await evaluate(session, `(() => {
      const els = Array.from(document.querySelectorAll('button.cc-cell[data-gated]'));
      if (els[0]) els[0].setAttribute('data-recette-gated', '');
    })()`);
    const okCellSel = "button.cc-cell[data-cell]:not([disabled])";

    for (const [w, h, tag] of VUES) {
      await setViewport(session, w, h);
      await sleep(300);
      await survoler(session, okCellSel, { attenteMs: 400 });
      await shot(session, `tooltip-${tag}`, OUT);
      await survoler(session, 'body', { attenteMs: 50 });
      await sleep(150);
      const gatedPresent = await evaluate(session, "!!document.querySelector('[data-recette-gated]')");
      if (gatedPresent) {
        await survoler(session, '[data-recette-gated]', { attenteMs: 400 });
        await shot(session, `tooltip-refus-${tag}`, OUT);
        await survoler(session, 'body', { attenteMs: 50 });
      }
      log(`vue ${tag} capturee (gated:${gatedPresent})`);
    }
  } finally {
    log('Erreurs console:', guard.errors());
    await session.close();
  }
}
main().then(()=>console.log('---OK---')).catch(e=>{console.error('ECHEC', e && e.stack||e); process.exitCode=1;});
