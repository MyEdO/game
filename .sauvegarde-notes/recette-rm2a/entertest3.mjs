import { openApp, evaluate, realKey, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';

async function cycle(session, n, key) {
  await evaluate(session, "document.querySelectorAll('button.cc-cell[data-cell]')[0].focus()");
  await realKey(session, { key: 'ArrowDown' });
  await sleep(400);
  await realKey(session, { key });
  await sleep(400);
  const codexModal = await evaluate(session, "!!document.querySelector('.codex-modal')");
  console.log('cycle', n, 'touche='+key, '-> codex-modal ouvert ?', codexModal);
  if (codexModal) { await realKey(session, { key: 'Escape' }); await sleep(300); }
  else { await evaluate(session, "document.activeElement && document.activeElement.blur && document.activeElement.blur()"); }
}

async function main() {
  const session = await openApp();
  await evaluate(session, "window.__wfrp.scenario('entrainement')");
  await evaluate(session, "window.__wfrp.ready()");
  await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
  await sleep(400);
  await clickButtonByText(session, 'Commencer le combat', { exact: true });
  await sleep(400);
  for (let i=1;i<=6;i++) await cycle(session, i, ' ');
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
