import { openApp, evaluate, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp(undefined, { width: 1366, height: 650 });
  await evaluate(session, "window.__wfrp.editorOpen('entrainement')");
  await sleep(700);
  console.log('summary.btn:', await evaluate(session, "JSON.stringify(Array.from(document.querySelectorAll('summary.btn')).map(b=>b.textContent.trim()))"));
  console.log('details.eff-add count:', await evaluate(session, "document.querySelectorAll('details.eff-add').length"));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
