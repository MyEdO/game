import { openApp, evaluate, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp(undefined, { width: 1366, height: 650 });
  await evaluate(session, "window.__wfrp.editorOpen('entrainement')");
  await sleep(700);
  console.log(await evaluate(session, "JSON.stringify(Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim().startsWith('+')).map(b=>({t:b.textContent.trim(), cls:b.className, parent:b.parentElement.tagName+'.'+b.parentElement.className})))"));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
