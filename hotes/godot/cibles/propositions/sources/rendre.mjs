const module = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const { chromium } = module.default ?? module;
(async () => {
  const [, , html, png, echelle = '2'] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1707, height: 780 }, deviceScaleFactor: Number(echelle) });
  const erreurs = [];
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  p.on('pageerror', (e) => erreurs.push(String(e)));
  p.on('requestfailed', (r) => erreurs.push('requete ' + r.url()));
  await p.goto('file://' + html);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  // débordements et chevauchements des pièces d'interface
  const rapport = await p.evaluate(() => {
    const pieces = [...document.querySelectorAll('[data-piece]')].map((e) => ({ n: e.dataset.piece, r: e.getBoundingClientRect() }));
    const hors = pieces.filter(({ r }) => r.left < 0 || r.top < 0 || r.right > 1707 || r.bottom > 780).map((x) => x.n);
    const croise = [];
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
      const a = pieces[i].r, c = pieces[j].r;
      if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) croise.push(pieces[i].n + ' x ' + pieces[j].n);
    }
    const coupe = [...document.querySelectorAll('[data-texte]')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.dataset.texte);
    return { pieces: pieces.length, hors, croise, coupe, defile: document.documentElement.scrollWidth > 1707 || document.documentElement.scrollHeight > 780 };
  });
  await p.screenshot({ path: png, clip: { x: 0, y: 0, width: 1707, height: 780 } });
  console.log('erreurs', erreurs.length, erreurs.slice(0, 5).join(' | '));
  console.log(JSON.stringify(rapport));
  await b.close();
})();
