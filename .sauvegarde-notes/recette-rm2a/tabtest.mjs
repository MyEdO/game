import { openApp, consoleGuard, evaluate, realKey, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';

async function main() {
  const session = await openApp();
  const guard = consoleGuard(session);
  await evaluate(session, "window.__wfrp.scenario('entrainement')");
  await evaluate(session, "window.__wfrp.ready()");
  await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
  await sleep(400);
  await clickButtonByText(session, 'Commencer le combat', { exact: true });
  await sleep(400);
  console.log('active just after click:', await evaluate(session, "document.activeElement.tagName+'.'+document.activeElement.className"));
  for (let i=0;i<8;i++){
    await realKey(session, { key: 'Tab' });
    await sleep(50);
    const info = await evaluate(session, "(() => { const e=document.activeElement; return e? e.tagName+' | '+e.className+' | data-cell='+(e.dataset?e.dataset.cell:'') : 'null'; })()");
    console.log('tab', i+1, '->', info);
  }
  console.log('errors', guard.errors());
  await session.close();
}
main().catch(e=>{console.error(e); process.exit(1);});
