const L = await import('/home/user/game/.wt-1919-H2/scripts/recette/lib.mjs');
const s = await L.openApp();
try {
  await L.sleep(1500);
  console.log(JSON.stringify(await L.evaluate(s, `(async () => { await document.fonts.ready; const e = document.createElement('div'); e.style.cssText = 'position:absolute;font-family:var(--font-display);font-size:11px;letter-spacing:0.4px'; e.textContent = 'Maistre Marchand'; document.body.appendChild(e); const h1 = e.getBoundingClientRect().height; e.innerHTML = 'Maistre<br>Marchand'; const h2 = e.getBoundingClientRect().height; const f = getComputedStyle(e).fontFamily; e.remove(); return { h1, h2, f }; })()`)));
} finally { await s.close(); }
