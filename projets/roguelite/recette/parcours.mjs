// Le parcours du néophyte (MyEdO/game#4947), étape par étape, sur des états forcés dans la sauvegarde fixe : une
// capture par étape et par taille d'écran (`parcours-<étape>-<largeur>.png`), et les repères qui se vérifient au DOM
// (pastille, refus et identité au survol, mort et victoire finale).
// Usage : node projets/roguelite/recette/parcours.mjs <dossier-des-captures> <partie-fixe.json>
import { CAPTURES, erreurs, lancer, page, recharger, surLaPartieFixe } from './commun.mjs';

const b = await lancer();
const echecs = [];
const constater = (ok, quoi) => { console.log(ok ? '✓' : '✗', quoi); if (!ok) echecs.push(quoi); };
const clic = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);

/** Une page sur la sauvegarde fixe que `regler` transforme (un objet JSON en entrée et en sortie, côté Node). */
async function partie(l, h, regler = (e) => e) {
  const p = await page(b, [l, h], surLaPartieFixe(regler));
  await p.evaluate(() => document.fonts.ready);
  return p;
}
const image = async (p, etape, l) => { await p.waitForTimeout(250); await p.screenshot({ path: `${CAPTURES}/parcours-${etape}-${l}.png` }); };

for (const [l, h] of [[1280, 720], [1920, 1080]]) {
  // 1. Premier lancement : une partie neuve.
  {
    const p = await page(b, [l, h]);
    if (l === 1280) constater((await p.textContent('.recit-lieu .but')).includes('Autel du Chaos'), '1 : le but est nommé au panneau Partir');
    await image(p, '1-lancement', l);
    await p.context().close();
  }
  // 2, 6, 7, 8 : la compagnie au retour — un blessé, une séquelle, un héros à l'hospice, un sans PX.
  {
    const p = await partie(l, h, (e) => {
      e.roster[0].c.xp = 0;
      e.roster[1].c.wounds.current = 3;
      e.roster[2].c.traumas = [{ id: 'fracture-mineure-bras', label: 'Fracture mineure (bras)', recoveryDays: 20 }];
      e.roster[3].sejour = { ou: 'temple', reste: 3, total: 7 };
      return e;
    });
    if (l === 1280) {
      const pastilles = await p.$$eval('.socle-compagnie .carte-heros', (cs) => cs.map((c) => !!c.querySelector('.pastille-progres')));
      constater(!pastilles[0] && pastilles[1], `7 : pastille sur qui peut progresser, aucune à 0 PX (${pastilles.join(', ')})`);
    }
    await p.hover('.socle-compagnie .carte-heros >> nth=1'); await p.waitForTimeout(400);
    if (l === 1280) constater(await p.isVisible('.apercu-du-jeu'), '2 : l’identité d’un héros au survol de sa carte');
    await image(p, '2-identite', l);
    await p.mouse.move(0, 0); await image(p, '6-retour-hameau', l);
    if (l === 1280) {
      const carte = await p.$eval('.socle-compagnie .carte-heros.retrait', (c) => ({ sejour: c.querySelector('.sejour-hospice')?.textContent ?? '', marque: !!c.querySelector('.au-batiment .medaillon'), vie: !!c.querySelector('.jauge.cire') }));
      constater(carte.sejour.includes('Hospice') && carte.sejour.includes('3 j') && carte.marque && !carte.vie, `8 : la carte du héros à l’hospice porte la marque du bâtiment et ses jours restants, sans barre de vie (${carte.sejour})`);
    }
    await clic(p, 'button[data-a="batiment"][data-id="temple"]'); await image(p, '6-chapelle', l);
    await clic(p, '[data-a="fermer-panneau"]'); await clic(p, 'button[data-a="batiment"][data-id="cartographe"]'); await clic(p, '[data-a="preparer"]');
    if (l === 1280) constater(await p.$eval('.socle-compagnie .carte-heros.retrait', (c) => c.disabled), '8 : le héros à l’hospice ne peut pas partir');
    await image(p, '8-depart', l);
    await p.mouse.move(0, 0);
    // 3, 4 : partir, la route.
    await clic(p, '[data-a="partir"]'); await image(p, '4-expedition', l);
    await p.context().close();
  }
  // 7. Progresser : à la salle d'armes puis à la fiche, le pas de CC du Soldat dit au survol l'écart de ses chances
  // de toucher.
  {
    const p = await partie(l, h);
    const pas = '.progression [data-a="pas"][data-k="capacite-de-combat"]';
    const ditLEcart = async () => {
      await p.hover(pas); await p.waitForTimeout(400);
      return (await p.isVisible('.apercu-du-jeu')) && /% de chances de toucher/.test(await p.textContent('.apercu-du-jeu'));
    };
    await clic(p, 'button[data-a="batiment"][data-id="salle"]');
    constater(await ditLEcart(), `7 : à la salle d’armes, le pas de CC dit au survol l’écart de chances de toucher (${l})`);
    await image(p, '7-salle', l);
    await clic(p, '[data-a="fermer-panneau"]'); await clic(p, '.socle-compagnie .carte-heros');
    constater(await ditLEcart(), `7 : à la fiche, le pas de CC dit au survol l’écart de chances de toucher (${l})`);
    await image(p, '7-fiche', l);
    await p.context().close();
  }
  // 9. La mort : sans Destin, à 1 Blessure, face au maître triplé.
  {
    let p = await partie(l, h);
    for (const a of ['ouvrir-depart', 'preparer', 'partir']) await clic(p, `[data-a="${a}"]`);
    p = await recharger(p, (e) => {
      e.expedition.index = e.expedition.salles.length - 1;
      const s = e.expedition.salles[e.expedition.index];
      s.ennemis = [...s.ennemis, ...s.ennemis, ...s.ennemis];
      for (const x of e.roster) { x.c.wounds.current = 1; x.c.fate = 0; }
    }, '[data-a="avancer"]');
    await clic(p, '[data-a="avancer"]');
    if (await p.isVisible('#combat')) { await p.click('[data-v="0"]'); await p.click('#combat-fin'); }
    await image(p, '9-carton', l);
    if (l === 1280) constater((await p.textContent('.carton').catch(() => '')).includes('ne revient pas'), '9 : la mort se raconte au carton');
    if (await p.$('.carton')) await p.click('.carton [data-a="fermer"]');
    await clic(p, 'button[data-a="batiment"][data-id="memorial"]'); await image(p, '9-jardin', l);
    await clic(p, '[data-a="fermer-panneau"]'); await clic(p, 'button[data-a="batiment"][data-id="relais"]'); await image(p, '9-relais', l);
    await p.context().close();
  }
  // 10. La fin : tous les maîtres vaincus, l'Autel compris.
  {
    const p = await partie(l, h, (e) => { e.bossVaincus = ['reikwald', 'tertres', 'hardes', 'autel']; return e; });
    if (l === 1280) constater(await p.isVisible('.bandeau-victoire'), '10 : la victoire finale est annoncée');
    await image(p, '10-victoire', l);
    await p.context().close();
  }
}
await b.close();
console.log(echecs.length ? `${echecs.length} échec(s)` : 'parcours complet', '· erreurs de page :', erreurs.length ? erreurs : 'aucune');
process.exit(echecs.length || erreurs.length ? 1 : 0);
