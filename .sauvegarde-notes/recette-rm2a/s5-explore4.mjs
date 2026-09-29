import { openApp, evaluate, clickButtonByText, sleep } from '/home/user/game/scripts/recette/lib.mjs';
async function main() {
  const session = await openApp(undefined, { width: 1366, height: 650 });
  await evaluate(session, "window.__wfrp.editorOpen('entrainement')");
  await sleep(700);
  await clickButtonByText(session, 'Triggers');
  await sleep(300);
  console.log('rows:', await evaluate(session, "JSON.stringify(Array.from(document.querySelectorAll('.logic-dock button, .logic-dock [role=button]')).map(b=>b.textContent.trim()).slice(0,20))"));
  await session.close();
}
main().catch(e=>{console.error(e);process.exit(1);});
