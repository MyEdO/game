import { openApp, evaluate, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp();
  await evaluate(session, "window.__wfrp.scenario('entrainement')");
  await evaluate(session, "window.__wfrp.ready()");
  await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
  await sleep(400);
  await clickButtonByText(session, 'Commencer le combat', { exact: true });
  await sleep(400);
  console.log(await evaluate(session, `JSON.stringify(Array.from(document.querySelectorAll('button.cc-cell')).map(e => ({cell:e.dataset.cell, gated: e.hasAttribute('data-gated'), ariaDisabled: e.getAttribute('aria-disabled'), disabled: e.disabled, label: e.getAttribute('aria-label')})), null, 1)`));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
