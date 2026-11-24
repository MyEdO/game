// Chaque écran, à trois tailles : aucun cadre qui doit tenir (cartouche, socle, note, frise, tête, corps et pied
// d'un service, bande des Caractéristiques) ne rogne son contenu, et aucun
// bouton ni son libellé ne sort de l'écran. Les cadres de liste de la fiche défilent, c'est voulu.
// Usage : node projets/roguelite/recette/debords.mjs <dossier-des-captures> <partie-fixe.json> [taille]
import { CAPTURES, erreurs, geste, lancer, page, recharger, surLaPartieFixe } from './commun.mjs';

/** La taille de l'interface éprouvée (`petite`, `moyenne`, `grande`), troisième argument ; `moyenne` par défaut. */
const TAILLE = process.argv[4] ?? 'moyenne';
/** Le rang du lanceur dans la compagnie de la partie fixe : le pyromancien. */
const LANCEUR = 2;

// À la taille `grande` (vue de 720 de haut), l'étal d'une forge agrandie défile : ses offres ne tiennent pas toutes.
const DOIVENT_TENIR = `.cartouche-lieu-fixe > .fond, .socle-compagnie > .fond, .frise-route, .tete-service, .corps-service, .porteur, ${TAILLE === 'grande' ? '' : '.etal, '}.corps-service .colonne, .pied-service, .bande > .fond`;

(async () => {
  const b = await lancer();
  let defauts = 0;
  for (const taille of [[1280, 720], [1366, 768], [1920, 1080]]) {
    let p = await page(b, taille, { 'grisefosse-taille': TAILLE, ...surLaPartieFixe((e) => {
      for (const h of e.roster) h.c.wounds.current = 1;
      e.roster[LANCEUR].c.xp = 3000;
    }) });
    const relever = async (ecran) => {
      const rognes = await p.$$eval(DOIVENT_TENIR, (fs) => fs.filter((f) => f.scrollHeight > f.clientHeight + 2 || f.scrollWidth > f.clientWidth + 2).map((f) => f.closest('.cadre')?.className.replace('cadre bois pan ', '') ?? f.className));
      if (rognes.length) { defauts++; console.log(`${taille.join('x')} ${ecran} : rogne → ${rognes.join(', ')}`); }
      const dehors = await p.$$eval('button', (els) => els.filter((el) => {
        if (!el.checkVisibility() || (!document.querySelector('#combat').hidden && !el.closest('#combat'))) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1);
      }).map((el) => (el.textContent || el.getAttribute('aria-label') || el.className).trim().slice(0, 30)));
      if (dehors.length) { defauts++; console.log(`${taille.join('x')} ${ecran} : hors de l'écran → ${dehors.join(', ')}`); }
    };
    await relever('hameau');
    for (const id of ['relais', 'temple', 'salle', 'forge', 'cartographe', 'peage', 'memorial']) {
      await geste(p, 'batiment', id); await relever(id);
      if (id === 'forge') for (const k of ['secondaire', 'tir', 'armure']) { await p.click(`.emplacement[data-k="${k}"]`); await relever(`forge ${k}`); }
      await geste(p, 'fermer-panneau');
    }
    // Le lanceur passé au niveau 2 : ses Compétences et les sorts de sa voie tiennent à la salle d'armes.
    await geste(p, 'batiment', 'salle'); await p.click(`.socle-compagnie .carte-heros >> nth=${LANCEUR}`);
    for (let n = 0; n < 80 && await p.$('.salle [data-a="niveau"]:disabled'); n++) {
      const augmentation = await p.$('.salle :is(.c.carr, .achat):not(.faite) [data-a="pas"]:not(:disabled)');
      if (!augmentation) break;
      await augmentation.click();
    }
    await p.click('.salle [data-a="niveau"]'); await p.click('.salle [data-a="talent"]');
    if (!(await p.$('.salle [data-a="sort"]'))) { defauts++; console.log(`${taille.join('x')} : le lanceur n'a pas atteint sa voie`); }
    await relever('salle, lanceur de niveau 2'); await geste(p, 'fermer-panneau');
    await geste(p, 'chronique'); await relever('chronique'); await geste(p, 'fermer-panneau');
    await geste(p, 'batiment', 'cartographe'); await p.click('[data-a="preparer"]'); await relever('départ');
    await geste(p, 'fermer-panneau'); await p.click('.socle-compagnie .carte-heros');
    for (const o of ['progression', 'talents', 'sorts', 'equipement']) { const t = await p.$(`[data-a="onglet"][data-k="${o}"]`); if (t) await t.click(); await relever(`fiche ${o}`); }
    await p.click('.croix-ecran');
    // Une compagnie à 1 Blessure ne part pas (`compagnieEpuisee`) : l'expédition s'éprouve sur la compagnie guérie.
    p = await recharger(p, (e) => { for (const h of e.roster) h.c.wounds.current = h.c.wounds.max; });
    await geste(p, 'ouvrir-depart'); await p.click('[data-a="preparer"]'); await p.click('[data-a="partir"]'); await relever('expédition');
    await p.click('[data-a="avancer"]');
    if (await p.isVisible('#combat')) { await p.waitForTimeout(800); await relever('rejeu'); await p.click('[data-v="0"]'); await relever('issue'); await p.click('#combat-fin'); }
    if (await p.$('.carton')) await relever('carton');
    await p.screenshot({ path: `${CAPTURES}/debords-${taille.join('x')}.png` });
    await p.context().close();
  }
  console.log(defauts ? `${defauts} écran(s) rognent un cadre` : 'aucun cadre rogné', '· erreurs de page :', erreurs.length ? erreurs : 'aucune');
  await b.close();
  process.exit(defauts || erreurs.length ? 1 : 0);
})();
