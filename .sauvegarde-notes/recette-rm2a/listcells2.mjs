import { openApp, evaluate, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp();
  await evaluate(session, "window.__wfrp.scenario('entrainement')");
  await evaluate(session, "window.__wfrp.ready()");
  await evaluate(session, "window.__wfrp.fight('enc-entrainement')");
  await sleep(400);
  await clickButtonByText(session, 'Commencer le combat', { exact: true });
  await sleep(400);
  const battle = JSON.parse(await evaluate(session, "JSON.stringify(window.__wfrp.battle())"));
  for (const c of battle.combatants.filter(c=>c.kind==='hero')) {
    await evaluate(session, `window.__wfrp.turn(${JSON.stringify(c.id)})`);
    await sleep(300);
    const cells = JSON.parse(await evaluate(session, `JSON.stringify(Array.from(document.querySelectorAll('button.cc-cell')).map(e => ({cell:e.dataset.cell, gated: e.hasAttribute('data-gated'), disabled: e.disabled, label: e.getAttribute('aria-label')})))`));
    console.log(c.id, c.name, '->', JSON.stringify(cells.filter(x=>x.gated)));
  }
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
