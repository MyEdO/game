import { openApp, consoleGuard, evaluate, realKey, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';

async function main() {
  const session = await openApp();
  await evaluate(session, "window.__wfrp.scenario('entrainement')");
  await evaluate(session, "window.__wfrp.ready()");
  await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
  await sleep(400);
  await clickButtonByText(session, 'Commencer le combat', { exact: true });
  await sleep(500);
  // focus explicitement une case via JS (pour isoler la question Tab, PAS pour valider le flux)
  await evaluate(session, "document.querySelectorAll('button.cc-cell[data-cell]')[0].focus()");
  console.log('active apres focus JS:', await evaluate(session, "document.activeElement.tagName+' data-cell='+document.activeElement.dataset.cell"));
  for (let i=0;i<5;i++){
    await realKey(session, { key: 'Tab' });
    await sleep(60);
    console.log('tab', i+1, await evaluate(session, "document.activeElement.tagName+' cls='+document.activeElement.className+' cell='+(document.activeElement.dataset?document.activeElement.dataset.cell:'')"));
  }
  await session.close();
}
main().catch(e=>{console.error(e); process.exit(1);});
