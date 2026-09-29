import { openApp, consoleGuard, evaluate, cliquerSelecteur, clickButtonByText, shot, sleep } from '/home/user/game/scripts/recette/lib.mjs';
const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); };
const OUT = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/recette-rm2a';
async function main() {
  const session = await openApp(undefined, { width: 1366, height: 650 });
  const guard = consoleGuard(session);
  try {
    log(await evaluate(session, "window.__wfrp.scenario('pastilles-entite')"));
    await evaluate(session, "window.__wfrp.ready()");
    await sleep(600);
    await clickButtonByText(session, 'Commencer le combat', { exact: true }).catch(() => {});
    await sleep(400);
    const sel = '[data-pastille-entite="coffre-de-cour"] button';
    log('nb pastilles au total:', await evaluate(session, "document.querySelectorAll('.pastille-entite').length"));
    const present = await evaluate(session, `!!document.querySelector(${JSON.stringify(sel)})`);
    log('pastille du coffre presente ?', present);
    if (present) {
      const offresAvant = await evaluate(session, `(() => {
        const el = document.querySelector('.pastille-entite');
        return el ? el.querySelector('button')?.textContent : null;
      })()`);
      log('libelle pastille avant clic:', offresAvant);
      await cliquerSelecteur(session, sel);
      await sleep(150);
      log('juste apres clic (150ms) -> .pp-panel ?', await evaluate(session, "!!document.querySelector('.pp-panel')"), '| pastille encore la ?', await evaluate(session, "!!document.querySelector('.pastille-entite')"));
      await sleep(300);
      const m = await evaluate(session, `(() => {
        const btn = document.querySelector(${JSON.stringify(sel)});
        const panel = document.querySelector('.pp-panel');
        if (!btn || !panel) return { btnFound: !!btn, panelFound: !!panel, panelClass: panel?panel.className:null };
        const b = btn.getBoundingClientRect(), p = panel.getBoundingClientRect();
        return { btn: {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}, panel: {x:Math.round(p.x),y:Math.round(p.y),w:Math.round(p.width),h:Math.round(p.height)}, vw: window.innerWidth, vh: window.innerHeight, horsEcran: p.x<0||p.right>window.innerWidth||p.y<0||p.bottom>window.innerHeight };
      })()`);
      log('Mesure PanneauParametre :', m);
      await shot(session, 'editor-panneau-parametre', OUT);
    }
  } finally {
    log('Erreurs console:', guard.errors());
    await session.close();
  }
}
main().then(()=>console.log('---OK---')).catch(e=>{console.error('ECHEC', e && e.stack||e); process.exitCode=1;});
