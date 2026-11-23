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
  await p.click('.tete-service [data-a="ameliorer"]');
  constater((await or()) < avant, 'la forge s’agrandit et coûte de l’or');
  constater((await p.textContent('.article [data-a="arme"]')).includes('CO'), 'chaque offre de la forge porte son prix dans son geste');
  await p.click('.emplacement[data-k="armure"]'); await p.click('[data-a="armure"][data-k="moyenne"]');
  await p.click('.emplacement[data-k="main"]'); await p.click('[data-a="arme"][data-k="pique-d-armes"]');
  await p.click('.emplacement[data-k="tir"]'); await p.click('[data-a="arme"][data-k="arbalete"]');
  const porte = await p.$$eval('.emplacement .nom-objet', (e) => e.map((x) => x.textContent));
  constater(porte.includes('Pique d\'armes') && porte.includes('Armure de mailles'), `la forge équipe le héros servi (${porte.join(', ')})`);
  constater(porte.includes('Pique d\'armes') && porte.includes('Arbalète'), 'l’arme à distance a son emplacement : l’arme de mêlée reste en main');

  await geste(p, 'fermer-panneau'); await geste(p, 'batiment', 'salle'); await p.click('.tete-service [data-a="ameliorer"]');
  const pxDe = async () => Number(await p.textContent('.bourse-px .chiffres'));
  const px = await pxDe();
  await p.click('.page-service button.c.carr');
  constater((await pxDe()) < px, 'la salle d’armes augmente une Caractéristique contre des PX');
  await geste(p, 'fermer-panneau'); await p.click('.socle-compagnie .carte-heros');
  const pxDeLaFiche = await pxDe();
  await p.click('.competences [data-a="competence"]');
  constater((await pxDe()) < pxDeLaFiche, 'la fiche augmente une Compétence contre des PX, en deux clics depuis le hameau');

  await p.click('.croix-ecran'); await geste(p, 'batiment', 'temple'); await p.click('.tete-service [data-a="ameliorer"]');
  const orAvantRemede = await or();
  await p.click('.remedes [data-a="provision"]');
  constater((await or()) < orAvantRemede, 'l’hospice vend une potion au héros servi');
  await geste(p, 'fermer-panneau');
  await geste(p, 'ouvrir-depart'); await p.click('[data-a="preparer"]');
  constater((await p.$$eval('.emporte .case-objet', (e) => e.length)) > 0, 'le héros part avec la potion achetée à l’hospice');
  const partirVisible = await p.$eval('[data-a="partir"]', (el) => { const r = el.getBoundingClientRect(); const f = el.closest('.fond').getBoundingClientRect(); return r.bottom <= f.bottom && r.top >= f.top; });
  constater(partirVisible, '« Partir » est visible au pied de son cadre');
  await p.click('[data-a="partir"]');
  constater(await p.isVisible('[data-a="avancer"]'), 'l’expédition commence');

  let salles = 0;
  let aVuUnCarton = false;
  for (let n = 0; n < 7; n++) {
    if (!(await p.$('[data-a="avancer"]:not([disabled])'))) break;
    await p.click('[data-a="avancer"]');
    let suite = '';
    if (await p.isVisible('#combat')) {
      await p.waitForTimeout(600);
      constater(await p.isVisible('.ordre li.actif') && await p.isVisible('#combat .rang-heros .carte-heros'), 'le rejeu montre l’ordre du tour et les cartes des héros');
      await p.click('[data-v="0"]');
      suite = (await p.$('.suite-issue')) ? await p.textContent('.suite-issue') : '';
      constater(await p.isVisible('#combat-fin'), 'l’issue du combat porte son geste');
      await p.click('#combat-fin');
    }
    salles++;
    if (await p.$('.carton [data-a="action"]')) {
      await p.click('.carton [data-a="action"][data-k="fouiller"]');
      constater(await p.isVisible('.socle-compagnie.a-choisir'), 'la cache demande qui fouille');
      await p.click('.socle-compagnie .carte-heros:not([disabled])');
    }
    if (await p.$('.carton')) {
      console.log('  salle :', await p.textContent('.carton .ruban'), '·', (await p.$$eval('.carton .recit p', (e) => e.map((x) => x.textContent))).join(' / ').slice(0, 120));
      if (!aVuUnCarton) {
        aVuUnCarton = true;
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
    } else console.log('  salle : issue ·', suite);
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
  const largeurDuSocle = () => p.$eval('.socle-compagnie', (e) => e.getBoundingClientRect().width);
  const socleAvant = await largeurDuSocle();
  await p.click('[data-a="reglages"]'); await p.click('.carton [data-a="taille"][data-k="grande"]');
  const grande = await largeurDuSocle();
  await p.click('.carton [data-a="taille"][data-k="moyenne"]');
  constater(grande > socleAvant && await largeurDuSocle() === socleAvant, `la taille de l’interface se règle (${Math.round(socleAvant)} → ${Math.round(grande)} px)`);
  await p.click('.carton [data-a="reset"]'); await p.click('.carton [data-a="fermer"]');
  constater(await p.isVisible('.enseigne') && !(await p.$('.carton')), 'Recommencer se refuse sans rien effacer');
  await p.screenshot({ path: `${CAPTURES}/partie-fin.png` });

  console.log(echecs.length ? `${echecs.length} échec(s)` : 'partie complète', '· erreurs de page :', erreurs.length ? erreurs : 'aucune');
  await b.close();
  process.exit(echecs.length || erreurs.length ? 1 : 0);
})();
