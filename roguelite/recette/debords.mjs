// Chaque écran, à trois tailles : aucun cadre qui doit tenir (cartouche, socle, note, frise, colonne des services,
// pied d'une page, bande des Caractéristiques) ne rogne son contenu. Les cadres de liste défilent, c'est voulu.
import { chromium, CAPTURES, ouvrir, geste } from './commun.mjs';

const DOIVENT_TENIR = '.cartouche-lieu-fixe > .fond, .socle-compagnie > .fond, .note-lieu > .fond, .frise-route > .fond, .colonne-services > .fond, .pied-service, .bande > .fond, .carte-partir > .fond';

(async () => {
  const b = await chromium.launch();
  const erreurs = [];
  let defauts = 0;
  for (const taille of [[1280, 720], [1366, 768], [1920, 1080]]) {
    const p = await ouvrir(b, taille, () => {
      const e = JSON.parse(localStorage.getItem('grisefosse-v1'));
      e.or = 900; e.trophees = 5;
      for (const k of Object.keys(e.batiments)) e.batiments[k] = 1;
      for (const h of e.roster) h.c.xp = 400;
      localStorage.setItem('grisefosse-v1', JSON.stringify(e));
    }, erreurs);
    const relever = async (ecran) => {
      const rognes = await p.$$eval(DOIVENT_TENIR, (fs) => fs.filter((f) => f.scrollHeight > f.clientHeight + 2 || f.scrollWidth > f.clientWidth + 2).map((f) => f.closest('.cadre')?.className.replace('cadre bois pan ', '') ?? f.className));
      if (rognes.length) { defauts++; console.log(`${taille.join('x')} ${ecran} : rogne → ${rognes.join(', ')}`); }
    };
    await relever('hameau');
    for (const id of ['relais', 'temple', 'salle', 'forge', 'cartographe', 'peage', 'memorial']) { await geste(p, 'batiment', id); await relever(id); }
    await geste(p, 'chronique'); await relever('chronique');
    await geste(p, 'batiment', 'cartographe'); await p.click('[data-a="preparer"]'); await relever('départ');
    await geste(p, 'fermer-panneau'); await p.click('.socle-compagnie .carte-heros');
    for (const o of ['talents', 'sorts', 'equipement']) { const t = await p.$(`[data-a="onglet"][data-k="${o}"]`); if (t) await t.click(); await relever(`fiche ${o}`); }
    await p.screenshot({ path: `${CAPTURES}/debords-${taille.join('x')}.png` });
    await p.context().close();
  }
  console.log(defauts ? `${defauts} écran(s) rognent un cadre` : 'aucun cadre rogné', '· erreurs de page :', erreurs.length ? erreurs : 'aucune');
  await b.close();
  process.exit(defauts || erreurs.length ? 1 : 0);
})();
