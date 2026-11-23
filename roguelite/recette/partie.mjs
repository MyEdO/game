// Une partie de bout en bout : bâtir, équiper, progresser, approvisionner, partir, franchir les salles en utilisant
// les sacs, rentrer. Chaque geste doit être visible, cliquable, et son effet constaté.
import { chromium, CAPTURES, ouvrir, geste } from './commun.mjs';

(async () => {
  const b = await chromium.launch();
  const erreurs = [];
  const echecs = [];
  const constater = (ok, quoi) => { if (!ok) echecs.push(quoi); console.log(`${ok ? '✓' : '✗'} ${quoi}`); };
  const p = await ouvrir(b, [1366, 768], () => {
    const e = JSON.parse(localStorage.getItem('grisefosse-v1'));
    e.or = 900; e.trophees = 4;
    for (const h of e.roster) h.c.xp = 600;
    localStorage.setItem('grisefosse-v1', JSON.stringify(e));
  }, erreurs);
  const or = async () => Number((await p.textContent('.ressources .etiquette')).replace(/\D/g, ''));

  await geste(p, 'batiment', 'forge');
  const avant = await or();
  await p.click('.hote [data-a="ameliorer"]');
  constater((await or()) < avant, 'la forge s’agrandit et coûte de l’or');
  await p.click('.offre[data-k="moyenne"]'); await p.click('.offre[data-k="epee-batarde"]');
  const porte = await p.$$eval('.emplacement .nom-objet', (e) => e.map((x) => x.textContent));
  constater(porte.includes('Épée bâtarde') && porte.includes('Armure moyenne'), `la forge équipe le héros servi (${porte.join(', ')})`);

  await p.click('.services [data-id="salle"]'); await p.click('.hote [data-a="ameliorer"]'); await p.click('.page-service [data-a="heros"]');
  const px = Number(await p.textContent('.bourse-px .chiffres'));
  await p.click('button.c.carr');
  constater(Number(await p.textContent('.bourse-px .chiffres')) < px, 'la fiche augmente une Caractéristique contre des PX');

  await p.click('.croix-ecran'); await geste(p, 'batiment', 'temple'); await p.click('.hote [data-a="ameliorer"]'); await geste(p, 'fermer-panneau');
  await geste(p, 'ouvrir-depart'); await p.click('[data-a="preparer"]');
  await p.click('.emporte .offre');
  constater((await p.$$eval('.emporte .case-objet', (e) => e.length)) > 0, 'le départ approvisionne un héros');
  const partirVisible = await p.$eval('[data-a="partir"]', (el) => { const r = el.getBoundingClientRect(); const f = el.closest('.fond').getBoundingClientRect(); return r.bottom <= f.bottom && r.top >= f.top; });
  constater(partirVisible, '« Partir » est visible au pied de son cadre');
  await p.click('[data-a="partir"]');
  constater(await p.isVisible('[data-a="avancer"]'), 'l’expédition commence');

  let salles = 0;
  for (let n = 0; n < 7; n++) {
    if (!(await p.$('[data-a="avancer"]:not([disabled])'))) break;
    await p.click('[data-a="avancer"]');
    if (await p.isVisible('#combat')) { await p.waitForTimeout(600); await p.click('[data-v="0"]'); await p.click('#combat-fin'); }
    salles++;
    console.log('  salle :', await p.textContent('.carton .ruban'), '·', (await p.$$eval('.carton .recit p', (e) => e.map((x) => x.textContent))).join(' / ').slice(0, 120));
    if (n === 0) {
      await p.click('.socle-compagnie .carte-heros');
      constater(await p.isVisible('.carton') && !(await p.$('.ident')), 'le carton ouvert ignore un clic au socle');
      const auPied = await p.$eval('.carton [data-a="fermer"]', (el) => { const r = el.getBoundingClientRect(); const f = el.closest('.fond').getBoundingClientRect(); return r.bottom <= f.bottom && r.top >= f.top; });
      constater(auPied, '« Continuer » est au pied du carton');
      if (await p.$('.carton [data-a="revoir"]')) {
        await p.click('.carton [data-a="revoir"]'); await p.waitForTimeout(400); await p.click('[data-v="0"]'); await p.click('#combat-fin');
        constater(await p.isVisible('.carton [data-a="fermer"]'), 'revoir le combat rend le carton');
      }
    }
    await p.click('.carton [data-a="fermer"]');
    const c = await p.$('.colonne-sacs button.boite-objet:not(:disabled)');
    if (c) { await c.click(); console.log('  sac :', await p.textContent('#toast')); }
  }
  constater(salles > 0, `${salles} salle(s) franchie(s)`);
  if (await p.$('[data-a="rentrer"]')) {
    await p.click('[data-a="rentrer"]');
    constater(await p.isVisible('.enseigne') === false && await p.isVisible('.carton [data-a="fermer"]'), 'le retour se raconte en carton au hameau');
    await p.click('.carton [data-a="fermer"]');
  }
  constater(await p.isVisible('.enseigne'), 'retour au hameau');
  await p.click('[data-a="reset"]'); await p.click('.carton [data-a="fermer"]');
  constater(await p.isVisible('.enseigne') && !(await p.$('.carton')), 'Recommencer se refuse sans rien effacer');
  await p.screenshot({ path: `${CAPTURES}/partie-fin.png` });

  console.log(echecs.length ? `${echecs.length} échec(s)` : 'partie complète', '· erreurs de page :', erreurs.length ? erreurs : 'aucune');
  await b.close();
  process.exit(echecs.length || erreurs.length ? 1 : 0);
})();
