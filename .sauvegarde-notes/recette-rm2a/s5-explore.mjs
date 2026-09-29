import { openApp, evaluate, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp();
  console.log(await evaluate(session, "window.__wfrp.editorOpen()"));
  await sleep(600);
  console.log(await evaluate(session, "window.__wfrp.editorOpen('entrainement')"));
  await sleep(800);
  console.log('screen:', await evaluate(session, "window.__wfrp.state().screen"));
  console.log('buttons with +:', await evaluate(session, "JSON.stringify(Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim().startsWith('+')).map(b=>b.textContent.trim()).slice(0,30))"));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
