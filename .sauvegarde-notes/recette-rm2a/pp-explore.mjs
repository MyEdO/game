import { openApp, evaluate, clicReel, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp();
  console.log(await evaluate(session, "window.__wfrp.scenario('pastilles-entite')"));
  await evaluate(session, "window.__wfrp.ready()");
  console.log('entities:', await evaluate(session, "JSON.stringify(window.__wfrp.entities())"));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
