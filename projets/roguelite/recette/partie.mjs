// Une partie de bout en bout : bâtir, équiper, progresser, approvisionner, loger et renvoyer au relais, partir,
// franchir les salles en utilisant les sacs, rentrer. Chaque geste doit être visible, cliquable, et son effet constaté.
// Usage : node projets/roguelite/recette/partie.mjs <dossier-des-captures> <partie-fixe.json>
import { CAPTURES, erreurs, geste, lancer, page, recharger, sauvegarde, surLaPartieFixe } from './commun.mjs';

/** Les bâtiments d'une partie neuve (`nouvellePartie`) : la partie bâtit depuis le premier palier. */
const SANS_BATIMENT = (e) => { for (const k of Object.keys(e.batiments)) e.batiments[k] = 0; };

(async () => {
  const b = await lancer();
  const echecs = [];
  const constater = (ok, quoi) => { if (!ok) echecs.push(quoi); console.log(`${ok ? '✓' : '✗'} ${quoi}`); };
  // En expédition, sur une partie neuve : la Chronique s'ouvre sur la salle, sans le rail du hameau, et se ferme
  // (croix, Échap) en rendant la salle.
  const q = await page(b, [1366, 768], surLaPartieFixe(SANS_BATIMENT));
  await geste(q, 'ouvrir-depart'); await q.click('[data-a="preparer"]'); await q.click('[data-a="partir"]');
  for (const fermer of [() => q.click('[data-a="fermer-panneau"]'), () => q.keyboard.press('Escape')]) {
    await q.click('[data-a="chronique"]');
    const ouverte = await q.isVisible('.chronique');
    constater(ouverte && !(await q.$('.rail-batiments')), 'la Chronique s’ouvre en expédition, sans le rail du hameau');
    if (!ouverte) break;
    await q.screenshot({ path: `${CAPTURES}/partie-chronique-expedition.png` });
    await fermer();
    constater(await q.isVisible('[data-a="avancer"]') && !(await q.$('.chronique')), 'la Chronique fermée rend la salle');
  }
  await q.context().close();
  let p = await page(b, [1366, 768], surLaPartieFixe((e) => {
    SANS_BATIMENT(e);
    e.or = 900; e.trophees = 4;
    // Le pas, puis le plan suivi en partie, laissent au héros servi de quoi prendre une Compétence à la fiche.
    for (const h of e.roster) h.c.xp = 630;
    e.roster[3].c.wounds.current = 2;
  }));
  const or = async () => Number((await p.textContent('.ressources .etiquette')).replace(/\D/g, ''));
  // Au socle qui demande qui tente : chaque carte ouverte dit sa Compétence, sa cible et ses chances, une seule marque au moins les meilleures.
  const chancesAuSocle = async () => ({
    ouvertes: await p.$$eval('.socle-compagnie .carte-heros:not([disabled])', (e) => e.map((x) => x.querySelector('.ligne-etat.visee')?.textContent ?? '')),
    meilleures: await p.$$eval('.socle-compagnie .carte-heros.meilleur:not([disabled])', (e) => e.length),
  });
  const lesChancesSeDisent = (s) => s.ouvertes.length > 0 && s.ouvertes.every((t) => /\d+ · \d+\s%$/.test(t)) && s.meilleures > 0;

  // L'hospice au palier 1, un héros aux plaies à panser : le refus se dit avant le clic ; au clic, le refus comme le soin
  // joué se lisent en toast par-dessus le panneau.
  const plaies = (e, or) => {
    e.or = or; e.batiments.temple = 1;
    e.roster[0].c.traumas = [
      { uid: 't1', label: 'Déchirure musculaire (Mineure)', location: 'brasG', kind: 'dechirure', severity: 'mineur', recoveryDays: 23, recoveryTotal: 25 },
      { uid: 't2', label: 'Fracture (Mineure)', location: 'jambeD', kind: 'fracture', severity: 'mineur', recoveryDays: 37, recoveryTotal: 40 },
    ];
  };
  for (const bourse of [6, 20]) {
    const h = await page(b, [1829, 1029], surLaPartieFixe((e) => plaies(e, bourse)));
    await geste(h, 'batiment', 'temple'); await geste(h, 'client', (await sauvegarde(h)).roster[0].c.id);
    const panser = '[data-a="hospice"][data-k="panser"]';
    if (bourse === 6) {
      const ferme = await h.$eval(panser, (x) => [x.disabled, x.dataset.bulle, x.textContent.trim()]);
      constater(ferme[0] && ferme[1] === 'Il faut 20 CO.' && ferme[2].includes('20 CO'), `trop peu d’or : « Panser » porte son prix, fermé sur « Il faut 20 CO. » (${ferme.join(' | ')})`);
      await h.screenshot({ path: `${CAPTURES}/hospice-sans-or.png` });
      await h.$eval(panser, (x) => { x.disabled = false; });
    }
    await h.click(panser);
    const dit = await h.evaluate(() => {
      const t = document.getElementById('toast'); const r = t.getBoundingClientRect();
      const dessus = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !t.hidden && !!dessus && t.contains(dessus) && !!document.querySelector('.page-service') ? t.textContent : null;
    });
    const attendu = bourse === 6 ? 'Il faut 20 CO.' : (await sauvegarde(h)).journal[0];
    constater(dit === attendu, `${bourse === 6 ? 'le refus' : 'le soin joué'} se lit en toast par-dessus le panneau (${dit})`);
    await h.context().close();
  }

  await geste(p, 'batiment', 'forge');
  const avant = await or();
  await p.click('.tete-service [data-a="ameliorer"]');
  constater((await or()) < avant, 'la forge s’agrandit et coûte de l’or');
  constater((await p.textContent('.article [data-a="arme"]')).includes('CO'), 'chaque offre de la forge porte son prix dans son geste');
  await p.click('.emplacement[data-k="armure"]'); await p.click('[data-a="armure"][data-k="armure-moyenne"]');
  await p.click('.emplacement[data-k="main"]'); await p.click('[data-a="arme"][data-k="pique-d-armes"]');
  await p.click('.emplacement[data-k="tir"]'); await p.click('[data-a="arme"][data-k="arbalete"]');
  const porte = await p.$$eval('.emplacement .nom-objet', (e) => e.map((x) => x.textContent));
  constater(porte.includes('Pique d\'armes') && porte.includes('Armure moyenne'), `la forge équipe le héros servi (${porte.join(', ')})`);
  const pa = await p.textContent('.emplacement[data-k="armure"] .resume');
  constater(/Tête 2 · Bras 2 · Corps 2 · Jambes 2/.test(pa), `l’armure moyenne porte 2 PA sur chaque Localisation (${pa})`);
  constater(porte.includes('Pique d\'armes') && porte.includes('Arbalète'), 'l’arme à distance a son emplacement : l’arme de mêlée reste en main');

  await geste(p, 'fermer-panneau'); await geste(p, 'batiment', 'salle'); await p.click('.tete-service [data-a="ameliorer"]');
  const pxDe = async () => Number(await p.textContent('.bourse-px .chiffres'));
  const px = await pxDe();
  await p.click('.page-service .c.carr [data-a="pas"]');
  constater((await pxDe()) < px, 'la salle d’armes augmente une Caractéristique d’un pas de +5 contre des PX');
  // « Suivre le plan » : un clic dépense des PX et coche des cases de carrière (CRB 048 l.45).
  const cases = () => p.$$eval('.page-service .exige', (e) => parseInt(e.find((x) => x.textContent.includes('Cases de carrière'))?.querySelector('.cpt')?.textContent ?? 'NaN', 10));
  const [pxAvantPlan, casesAvantPlan] = [await pxDe(), await cases()];
  await p.click('.page-service [data-a="plan"]');
  constater((await pxDe()) < pxAvantPlan && (await cases()) > casesAvantPlan, `« Suivre le plan » dépense des PX et coche des cases de carrière (${await p.textContent('#toast')})`);
  await geste(p, 'fermer-panneau'); await p.click('.socle-compagnie .carte-heros');
  const pxDeLaFiche = await pxDe();
  await p.click('.progression .achat [data-a="pas"]:not(:disabled)');
  constater((await pxDe()) < pxDeLaFiche, 'la fiche augmente une Compétence contre des PX, en deux clics depuis le hameau');

  await p.click('.croix-ecran');
  const blesse = (await sauvegarde(p)).roster[3].c.id;
  await geste(p, 'batiment', 'relais'); await geste(p, 'client', blesse);
  const orAvantChambre = await or();
  await p.click('[data-a="chambre"]');
  const carteAuRelais = `.socle-compagnie .carte-heros.retrait[data-id="${blesse}"]`;
  constater((await or()) < orAvantChambre && (await p.textContent(`${carteAuRelais} .sejour-hospice`)).includes('Auberge'), 'le relais loue une chambre au blessé : sa carte porte l’auberge et ses jours restants');
  const orAvantRenvoi = await or();
  await p.click(`[data-a="congedier"][data-id="${blesse}"]`); await p.click(`[data-a="congedier-ok"][data-id="${blesse}"]`);
  constater((await or()) === orAvantRenvoi && !(await p.$(`.socle-compagnie [data-id="${blesse}"]`)), 'le relais renvoie le héros, confirmé, sans rien rapporter');
  await geste(p, 'fermer-panneau'); await geste(p, 'batiment', 'temple'); await p.click('.tete-service [data-a="ameliorer"]');
  const orAvantRemede = await or();
  await p.click('.remedes [data-a="provision"]');
  constater((await or()) < orAvantRemede, 'l’hospice vend une potion au héros servi');
  await geste(p, 'fermer-panneau');
  await geste(p, 'ouvrir-depart'); await p.click('[data-a="preparer"]');
  constater((await p.$$eval('.emporte .case-objet', (e) => e.length)) > 0, 'le héros part avec la potion achetée à l’hospice');
  // Au départ, un héros emmené au sac vide achète une potion dans sa colonne : son sac la montre, la bourse baisse du
  // prix, le départ reste ouvert.
  const auSacVide = await p.$$eval('.emporte:not(.libre)', (cs) => cs.find((c) => !c.querySelector('.case-objet'))?.querySelector('[data-a="provision"]:not([disabled])')?.dataset.id ?? null);
  constater(!!auSacVide, 'la colonne d’un héros emmené au sac vide offre les potions de l’hospice');
  if (auSacVide) {
    const potion = `.emporte [data-a="provision"][data-id="${auSacVide}"]`;
    const prix = Number((await p.textContent(potion)).match(/(\d+) CO/)[1]);
    const orAvantPotion = await or();
    await p.click(potion);
    const sac = await p.$eval(potion, (x) => x.closest('.emporte').querySelectorAll('.cases-sac .case-objet').length);
    constater(sac === 1 && (await or()) === orAvantPotion - prix && await p.isVisible('[data-a="partir"]'), `le héros emmené achète une potion au départ : son sac la montre, la bourse baisse de ${prix} CO (${orAvantPotion} → ${await or()})`);
    const deborde = await p.$eval('.corps-service', (c) => c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1);
    constater(!deborde, 'les colonnes du départ tiennent sans ascenseur');
  }
  // Au départ, chaque colonne place son héros et lui donne sa consigne : l'un et l'autre s'arment et se sauvegardent.
  const place = await p.$eval('.emporte [data-a="rang"][data-k="derriere"]:not(.armee)', (x) => x.dataset.id);
  await p.click(`[data-a="rang"][data-id="${place}"][data-k="derriere"]`);
  await p.click(`[data-a="consigne"][data-id="${place}"][data-k="soldats"]`);
  const lu = (await sauvegarde(p)).roster.find((h) => h.c.id === place);
  constater(lu.rang === 'derriere' && lu.c.aiDoctrine === 'soldats' && await p.$(`[data-a="consigne"][data-id="${place}"][data-k="soldats"].armee`),
    'le départ place un héros derrière et lui donne « Tenir la ligne » : la plaque s’arme, la sauvegarde garde son rang et sa doctrine');
  const partirVisible = await p.$eval('[data-a="partir"]', (el) => { const r = el.getBoundingClientRect(); const f = el.closest('.fond').getBoundingClientRect(); return r.bottom <= f.bottom && r.top >= f.top; });
  constater(partirVisible, '« Partir » est visible au pied de son cadre');
  await p.click('[data-a="partir"]');
  constater(await p.isVisible('[data-a="avancer"]'), 'l’expédition commence');
  // Un camp, une rencontre et un autel profané après la première salle, et un blessé à y soigner.
  p = await recharger(p, (e) => {
    e.expedition.salles.splice(1, 0, { type: 'camp', ennemis: [], faite: false }, { type: 'rencontre', ennemis: [], faite: false }, { type: 'autel', ennemis: [], faite: false });
    const blesse = e.roster.find((h) => h.carriere === 'soldat');
    blesse.c.wounds.current = 2;
  }, '[data-a="avancer"]');

  let salles = 0;
  let aVuUnCarton = false;
  for (let n = 0; n < 8; n++) {
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
      const salle = await p.textContent('.carton .ruban');
      const debords = await p.$eval('.carton [data-place="texte"]', (t) => {
        const r = t.getBoundingClientRect();
        return [t, ...t.querySelectorAll('*')].filter((el) => el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2).filter((el) => getComputedStyle(el).overflow !== 'visible')
          .concat([...t.querySelectorAll('[data-a="action"]')].filter((a) => { const b = a.getBoundingClientRect(); return b.left < r.left - 1 || b.right > r.right + 1 || b.bottom > r.bottom + 1; }))
          .map((el) => el.dataset.k ?? el.className);
      });
      constater(!debords.length, `${salle} : les choix tiennent dans le carton${debords.length ? ` (débordent : ${debords.join(', ')})` : ''}`);
      // La cache se fouille, la rencontre s'intimide, l'autel se pille, le camp se lève par le repos.
      const k = await p.$('.carton [data-a="action"][data-k="fouiller"]') ? 'fouiller' : await p.$('.carton [data-a="action"][data-k="intimider"]') ? 'intimider'
        : await p.$('.carton [data-a="action"][data-k="piller"]') ? 'piller' : 'reposer';
      if (k === 'piller') {
        constater((await p.textContent('.carton [data-a="action"][data-k="piller"]')).includes('Raté : Corruption'), 'l’autel dit le risque de son échec : la Corruption');
        await p.screenshot({ path: `${CAPTURES}/partie-autel.png` });
      }
      if (k === 'intimider') {
        // Rejouée sur une autre graine tant qu'elle réussit : raté, le Test se raconte avant le combat qu'il déclenche.
        const avantLeTest = await sauvegarde(p);
        for (let essai = 1; essai <= 12; essai++) {
          await p.click('.carton [data-a="action"][data-k="intimider"]');
          await p.click('.socle-compagnie .carte-heros:not([disabled])');
          if (await p.$('.carton [data-a="avancer"]')) break;
          p = await recharger(p, () => ({ ...avantLeTest, graine: avantLeTest.graine + essai }), '.carton [data-a="action"][data-k="intimider"]');
        }
        constater(!(await p.isVisible('#combat')) && (await p.textContent('.carton .issue')).includes('Raté') && !(await p.$('.carton [data-a="fermer"]')),
          'l’intimidation ratée se raconte d’abord, sans combat ni « Continuer » : le carton n’offre que « Combattre »');
        await p.click('.carton [data-a="avancer"]');
        constater(await p.isVisible('#combat'), '« Combattre » livre le combat de la rencontre');
        await p.waitForTimeout(400); await p.click('[data-v="0"]'); await p.click('#combat-fin');
      } else if (k === 'reposer' && await p.$('.carton [data-a="action"][data-k="soigner"]:not([disabled])')) {
        await p.click('.carton [data-a="action"][data-k="soigner"]');
        const consigne = () => p.textContent('.socle-compagnie').catch(() => '');
        constater((await consigne()).includes('Qui soigne'), 'le camp demande qui soigne');
        const soigneurs = await chancesAuSocle();
        constater(lesChancesSeDisent(soigneurs) && soigneurs.ouvertes.every((t) => t.startsWith('Guérison')), `chaque soigneur dit sa Guérison et ses chances (${soigneurs.ouvertes.join(' ; ')})`);
        await p.click('.socle-compagnie .carte-heros:not([disabled])');
        constater((await consigne()).includes('Qui est soigné'), 'puis qui est soigné');
        await p.click('.socle-compagnie .carte-heros:not([disabled])');
        console.log('  camp :', (await p.$$eval('.carton .recit p', (e) => e.map((x) => x.textContent))).join(' / ').slice(0, 160));
        constater((await p.textContent('.carton').catch(() => '')).includes('Les soins du camp'), 'le soin du camp se raconte au carton');
        await p.click('.carton [data-a="fermer"]');
        constater(!!(await p.$('.carton [data-a="action"][data-k="reposer"]')), 'le camp reste dressé après le soin');
      }
      if (k !== 'intimider') {
        await p.click(`.carton [data-a="action"][data-k="${k}"]`);
        if (k !== 'reposer') {
          constater(await p.isVisible('.socle-compagnie.a-choisir'), `${salle} : le socle demande qui tente l’action`);
          const tentent = await chancesAuSocle();
          constater(lesChancesSeDisent(tentent), `${salle} : chaque héros qui peut tenter dit sa cible et ses chances (${tentent.ouvertes.join(' ; ')})`);
          await p.click('.socle-compagnie .carte-heros:not([disabled])');
        }
      }
    }
    if (await p.$('.carton')) {
      if ((await p.textContent('.carton .ruban')) === 'Autel') await p.screenshot({ path: `${CAPTURES}/partie-autel-recit.png` });
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
