import { openApp, evaluate, realKey, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';

async function main() {
  const session = await openApp();
  await evaluate(session, "window.__wfrp.scenario('entrainement')");
  await evaluate(session, "window.__wfrp.ready()");
  await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
  await sleep(400);
  await clickButtonByText(session, 'Commencer le combat', { exact: true });
  await sleep(400);
  await evaluate(session, "document.querySelectorAll('button.cc-cell[data-cell]')[0].focus()");
  await realKey(session, { key: 'ArrowDown' });
  await sleep(500);
  console.log('focus avant Entree:', await evaluate(session, "document.activeElement.tagName+' '+document.activeElement.textContent"));
  console.log('infobulle avant Entree:', await evaluate(session, "!!document.querySelector('.infobulle')"));
  await realKey(session, { key: 'Enter' });
  await sleep(150);
  console.log('T+150ms infobulle presente:', await evaluate(session, "!!document.querySelector('.infobulle')"), 'codexModal:', await evaluate(session, "!!document.querySelector('.codex-modal')"), 'active:', await evaluate(session, "document.activeElement.tagName+' '+document.activeElement.textContent"));
  await sleep(500);
  console.log('T+650ms infobulle presente:', await evaluate(session, "!!document.querySelector('.infobulle')"), 'codexModal:', await evaluate(session, "!!document.querySelector('.codex-modal')"), 'active:', await evaluate(session, "document.activeElement.tagName+' '+document.activeElement.textContent"));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
