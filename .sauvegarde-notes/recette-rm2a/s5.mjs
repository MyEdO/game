import { openApp, consoleGuard, evaluate, clickButtonByText, cliquerSelecteur, shot, setViewport, sleep } from '/home/user/game/scripts/recette/lib.mjs';

const log = (...a) => { const s = a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); };
const OUT = '/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/recette-rm2a';

async function ouvrirTriggerFlow(session) {
  await evaluate(session, "window.__wfrp.editorOpen('entrainement')");
  await sleep(700);
  await clickButtonByText(session, 'Triggers');
  await sleep(300);
  await clickButtonByText(session, 'entrer-en-lice (7,1) 1×122', { exact: true });
  await sleep(400);
}

async function mesurerAddMenu(session, label) {
  // "+ Bloc" est un <summary> (details/summary), pas un <button> : on le marque puis clic reel dessus.
  await evaluate(session, `(() => {
    const s = Array.from(document.querySelectorAll('summary.btn')).find(b => b.textContent.trim() === ${JSON.stringify(label)});
    if (s) s.setAttribute('data-recette-summary', '');
  })()`);
  await cliquerSelecteur(session, '[data-recette-summary]');
  await sleep(300);
  const m = await evaluate(session, `(() => {
    const btn = Array.from(document.querySelectorAll('summary.btn')).find(b => b.textContent.trim() === ${JSON.stringify(label)});
    const menu = document.querySelector('.eff-add-menu');
    if (!btn || !menu) return { btnFound: !!btn, menuFound: !!menu };
    const b = btn.getBoundingClientRect(), m2 = menu.getBoundingClientRect();
    return {
      btn: { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) },
      menu: { x: Math.round(m2.x), y: Math.round(m2.y), w: Math.round(m2.width), h: Math.round(m2.height) },
      vw: window.innerWidth, vh: window.innerHeight,
      colleAuBouton: Math.abs(m2.y - b.bottom) <= 4 || Math.abs(m2.bottom - b.y) <= 4,
      ouvertVersLeHaut: m2.bottom <= b.y + 4,
      horsEcran: m2.x < 0 || m2.right > window.innerWidth || m2.y < 0 || m2.bottom > window.innerHeight,
    };
  })()`);
  return m;
}

async function main() {
  const session = await openApp(undefined, { width: 1366, height: 650 });
  const guard = consoleGuard(session);
  try {
    await ouvrirTriggerFlow(session);
    log('== AddMenu "+ Bloc", vers le BAS (place normale) ==');
    const m1 = await mesurerAddMenu(session, '+ Bloc');
    log('Mesure :', m1);
    await shot(session, 'editor-addmenu-bas-1366x650', OUT);
    await cliquerSelecteur(session, '[data-recette-summary]'); // referme
    await sleep(200);

    log('\n== AddMenu "+ Bloc", forcer OUVERT VERS LE HAUT (fenetre basse, bouton scrolle en bas) ==');
    await setViewport(session, 1366, 420);
    await sleep(300);
    await evaluate(session, "document.querySelectorAll('summary.btn')[document.querySelectorAll('summary.btn').length-1].scrollIntoView({block:'end'})");
    await sleep(200);
    const m2 = await mesurerAddMenu(session, '+ Bloc');
    log('Mesure :', m2);
    await shot(session, 'editor-addmenu-haut', OUT);

  } finally {
    log('\nErreurs console:', guard.errors());
    await session.close();
  }
}
main().then(()=>console.log('---OK---')).catch(e=>{console.error('ECHEC', e && e.stack||e); process.exitCode=1;});
