import { openApp, evaluate, realKey, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';

async function main() {
  const session = await openApp();
  await evaluate(session, "window.__wfrp.scenario('entrainement')");
  await evaluate(session, "window.__wfrp.ready()");
  await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
  await sleep(400);
  await clickButtonByText(session, 'Commencer le combat', { exact: true });
  await sleep(500);
  await evaluate(session, "document.body.focus()");
  console.log('active0:', await evaluate(session, "document.activeElement.tagName"));
  for (let i=0;i<6;i++){
    await realKey(session, { key: 'Tab', modifiers: 8 }); // shift = bit 8 en CDP
    await sleep(60);
    console.log('shift-tab', i+1, await evaluate(session, "document.activeElement.tagName+' cell='+(document.activeElement.dataset?document.activeElement.dataset.cell:'')"));
  }
  await session.close();
}
main().catch(e=>{console.error(e); process.exit(1);});
