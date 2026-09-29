import { openApp, evaluate, sleep, resoudreModales, realKey } from '/home/user/game/scripts/recette/lib.mjs';
const session = await openApp('http://localhost:5173/', { timeoutMs: 90000 });
try {
  const id = process.argv[2] ?? 'arene';
  console.log(await evaluate(session, `(() => { try { window.__wfrp.scenario(${JSON.stringify(id)}, 7); return 'ok'; } catch (e) { return String(e); } })()`));
  await evaluate(session, `window.__wfrp.ready(20000)`, { timeoutMs: 25000 }).catch((e) => console.log('ready', e.message));
  await resoudreModales(session, 'intro').catch((e) => console.log('resoudreModales', e.message));
  const liste = await evaluate(session, `(() => { try { return JSON.stringify(window.__wfrp.fight()); } catch (e) { return String(e); } })()`);
  console.log('rencontres', liste);
  const enc = (() => { try { const l = JSON.parse(liste); return Array.isArray(l) ? (l[0]?.id ?? l[0]) : null; } catch { return null; } })();
  if (enc) console.log(await evaluate(session, `(() => { try { window.__wfrp.fight(${JSON.stringify(enc)}); return 'fight ok'; } catch (e) { return String(e); } })()`));
  await sleep(2500);
  await resoudreModales(session, 'combat').catch((e) => console.log('resoudreModales', e.message));
  for (let i = 0; i < 20; i++) {
    const n = await evaluate(session, `document.querySelectorAll('.combat-console [data-cell]').length`);
    if (n > 0) break;
    const m = await evaluate(session, `JSON.stringify(window.__wfrp.battle().modales)`);
    console.log('attente', i, m);
    if (m.includes('pendingRoundStart')) await realKey(session, { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await sleep(1500);
  }
  console.log(JSON.stringify(await evaluate(session, `({ st: (({screen, inCombat, sceneId}) => ({screen, inCombat, sceneId}))(window.__wfrp.state()), console: !!document.querySelector('.combat-console'), refs: document.querySelectorAll('.combat-console .codex-ref').length, cells: document.querySelectorAll('.combat-console [data-cell]').length, kb: document.querySelectorAll('[aria-keyshortcuts="ArrowDown"]').length, allRefs: document.querySelectorAll('.codex-ref').length, allCells: document.querySelectorAll('[data-cell]').length, kbAll: [...document.querySelectorAll('[aria-keyshortcuts="ArrowDown"]')].slice(0,5).map(e => e.textContent.slice(0,30)), btns: [...document.querySelectorAll('.combat-console button')].slice(0,12).map(b => (b.dataset.cell||'') + ':' + b.textContent.slice(0,20)), actif: (() => { const b = window.__wfrp.battle(); return typeof b === 'string' ? b.slice(0,300) : JSON.stringify(b).slice(0,300); })(), dialogs: [...document.querySelectorAll('[role=dialog]')].map(d => d.getAttribute('aria-label') || d.textContent.slice(0,40)) })`)));
} finally { await session.close(); }
