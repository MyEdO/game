// Chaque écran, à trois tailles : aucun cadre qui doit tenir (cartouche, socle, note, frise, colonne des services,
// pied d'une page, bande des Caractéristiques, borne du round, barre de l'actif) ne rogne son contenu, et aucun
// bouton ni son libellé ne sort de l'écran. Les cadres de liste défilent, c'est voulu.
import { chromium, CAPTURES, ouvrir, geste } from './commun.mjs';

/** La taille de l'interface éprouvée (`petite`, `moyenne`, `grande`), quatrième argument ; `moyenne` par défaut. */
const TAILLE = process.argv[4] ?? 'moyenne';

const DOIVENT_TENIR = '.cartouche-lieu-fixe > .fond, .socle-compagnie > .fond, .note-lieu > .fond, .frise-route > .fond, .colonne-services > .fond, .pied-service, .bande > .fond, .carte-partir > .fond, .borne-round > .fond, .barre-rejeu > .fond';

(async () => {
  const b = await chromium.launch();
  const erreurs = [];
  let defauts = 0;
  for (const taille of [[1280, 720], [1366, 768], [1920, 1080]]) {
    const p = await ouvrir(b, taille, (t) => {
      localStorage.setItem('grisefosse-taille', t);
      const e = JSON.parse(localStorage.getItem('grisefosse-v1'));
      e.or = 900; e.trophees = 5;
      for (const k of Object.keys(e.batiments)) e.batiments[k] = 1;
      for (const h of e.roster) { h.c.xp = 400; h.c.wounds.current = 1; }
      localStorage.setItem('grisefosse-v1', JSON.stringify(e));
    }, erreurs, TAILLE);
    const relever = async (ecran) => {
      const rognes = await p.$$eval(DOIVENT_TENIR, (fs) => fs.filter((f) => f.scrollHeight > f.clientHeight + 2 || f.scrollWidth > f.clientWidth + 2).map((f) => f.closest('.cadre')?.className.replace('cadre bois pan ', '') ?? f.className));
      if (rognes.length) { defauts++; console.log(`${taille.join('x')} ${ecran} : rogne → ${rognes.join(', ')}`); }
      const dehors = await p.$$eval('button, .outil .libelle', (els) => els.filter((el) => {
        if (!el.checkVisibility() || (!document.querySelector('#combat').hidden && !el.closest('#combat'))) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
      }).map((el) => (el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 30)));
      if (dehors.length) { defauts++; console.log(`${taille.join('x')} ${ecran} : hors de l'écran → ${dehors.join(', ')}`); }
    };
    await relever('hameau');
    for (const id of ['relais', 'temple', 'salle', 'forge', 'cartographe', 'peage', 'memorial']) { await geste(p, 'batiment', id); await relever(id); }
    await geste(p, 'chronique'); await relever('chronique');
    await geste(p, 'batiment', 'cartographe'); await p.click('[data-a="preparer"]'); await relever('départ');
    await geste(p, 'fermer-panneau'); await p.click('.socle-compagnie .carte-heros');
    for (const o of ['talents', 'sorts', 'equipement']) { const t = await p.$(`[data-a="onglet"][data-k="${o}"]`); if (t) await t.click(); await relever(`fiche ${o}`); }
    await p.click('.croix-ecran'); await geste(p, 'attendre'); await geste(p, 'ouvrir-depart'); await p.click('[data-a="preparer"]'); await p.click('[data-a="partir"]'); await relever('expédition');
    await p.click('[data-a="avancer"]');
    if (await p.isVisible('#combat')) { await p.waitForTimeout(800); await relever('rejeu'); await p.click('.fin-rejeu [data-v="0"]'); await relever('issue'); await p.click('#combat-fin'); }
    if (await p.$('.carton')) await relever('carton');
    await p.screenshot({ path: `${CAPTURES}/debords-${taille.join('x')}.png` });
    await p.context().close();
  }
  console.log(defauts ? `${defauts} écran(s) rognent un cadre` : 'aucun cadre rogné', '· erreurs de page :', erreurs.length ? erreurs : 'aucune');
  await b.close();
  process.exit(defauts || erreurs.length ? 1 : 0);
})();
