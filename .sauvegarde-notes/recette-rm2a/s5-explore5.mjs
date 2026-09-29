import { openApp, evaluate, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp(undefined, { width: 1366, height: 650 });
  await evaluate(session, "window.__wfrp.editorOpen('entrainement')");
  await sleep(700);
  await clickButtonByText(session, 'Triggers');
  await sleep(300);
  await clickButtonByText(session, 'entrer-en-lice (7,1) 1×122', { exact: true });
  await sleep(400);
  console.log('summary.btn:', await evaluate(session, "JSON.stringify(Array.from(document.querySelectorAll('summary.btn')).map(b=>b.textContent.trim()))"));
  console.log('buttons +:', await evaluate(session, "JSON.stringify(Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.trim().startsWith('+')).map(b=>b.textContent.trim()))"));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
