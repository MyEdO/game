import { openApp, evaluate, realKey, sleep } from '/home/user/game/scripts/recette/lib.mjs';

async function main() {
  const session = await openApp();
  await sleep(500);
  console.log('active0:', await evaluate(session, "document.activeElement.tagName"));
  for (let i=0;i<5;i++){
    await realKey(session, { key: 'Tab' });
    await sleep(50);
    console.log('tab', i+1, await evaluate(session, "document.activeElement.tagName+'.'+document.activeElement.className"));
  }
  await session.close();
}
main().catch(e=>{console.error(e); process.exit(1);});
