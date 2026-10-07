#!/usr/bin/env node
// CLI de preuve navigateur : LE PATRON D'INTENTION (spec HUD zone 4) — armer un geste depuis la
// console pour EN VOIR LA PORTÉE avant de cliquer le champ, sans rien changer aux gestes par défaut.
//
// Arbitrage fondateur (utilisateur, 2026-08-16, verbatim) : « Ca ne change pas les actions par défaut
// sur le grid comme le déplacement/attaque, ou la charge/course, c'est juste pour qu'on les
// selectionner volontairement depuis l'interface. Car actuellement pour charger, il est difficile de
// connaitre la distance. »
//
// Usage :
//   node scripts/recette/intentions-portee.mjs --out <dossier>
//   node scripts/recette/intentions-portee.mjs --url <autre serveur> --out <dossier>
//
// Sans `--url`, la cible est le serveur de DEV de cet arbre (`DEFAULT_URL`, scripts/port-dev.mjs).
//
// Ce qui est JOUÉ (aux vrais clics / aux vraies touches, jamais un setState forgé) :
//   1. armer Course à la case de console → la bande de Course s'allume à l'écran (capture) ;
//   2. cliquer une case LOINTAINE → le jet de Course part (modale) ;
//   3. armer Charge → la bande M×2 s'allume (capture), puis clic-ennemi → la Charge réelle part ;
//   4. Échap annule ; re-clic de la case annule ;
//   5. un clic-ennemi SANS intention reste une attaque normale (non-régression).
// Sortie : exit 1 au premier défaut (liste complète imprimée), exit 0 si tout passe.
import { openApp, evaluate, sleep, shot, cliquerPremierOffert, consoleGuard, frapperTouche, cliquerAction, resoudreModales, decrireChoix, piloterCombat, finDuTour } from './lib.mjs';
import { enteteArbre } from '../guards/lib/enteteArbre.mjs';
import { chebyshev } from '../../src/engine/grid.ts';

/** Les CHOIX faits à la place du joueur par les résolutions de fenêtres : imprimés au rapport. */
const choixFaits = [];

/** FILIGRANE : l'arbre RÉELLEMENT joué (une recette sans son arbre ne prouve rien). */
const filigrane = () => enteteArbre(process.cwd());

function parseArgs(argv) {
  const out = { url: undefined, out: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') out.url = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
    else throw new Error(`Option inconnue : ${argv[i]}`);
  }
  return out;
}

/** Arrêt du pilote : la main à un HÉROS piloté, Action et Mouvement intacts. */
const herosIntact = (l) => !!l.auto.active && l.auto.active.kind === 'hero' && !l.auto.active.aiDriven && !l.battle.acted && l.battle.movementUsed === 0;

/** Pilote le combat (`piloterCombat`, au geste du joueur) jusqu'au tour d'un héros intact, puis lit l'état. */
async function jusquAuHeros(session) {
  choixFaits.push(...(await piloterCombat(session, { arret: herosIntact })).choix);
  return etat(session);
}

/** Centre ÉCRAN d'une case, s'il tombe DANS la fenêtre et hors de la console (bande basse) — sinon
 *  `null` : `tileScreenPos` projette aussi les cases hors champ (coordonnées négatives). */
async function centreVisible(session, pt) {
  const r = await evaluate(session, `window.__wfrp.tileScreenPos(${JSON.stringify(pt)})`);
  if (!r) return null;
  const x = r.x + r.width / 2, y = r.y + r.height / 2;
  const vue = await evaluate(session, `({ w: window.innerWidth, h: window.innerHeight, console: (document.querySelector('.combat-console') || { getBoundingClientRect: () => ({ top: 1e9 }) }).getBoundingClientRect().top })`);
  if (x < 40 || y < 60 || x > vue.w - 40 || y > Math.min(vue.h - 40, vue.console - 20)) return null;
  return { x, y };
}

/** Clic RÉEL au centre d'une case de la carte (`tileScreenPos` → souris CDP). */
async function cliquerCase(session, pt) {
  const c = await centreVisible(session, pt);
  if (!c) throw new Error(`cliquerCase (${pt.x},${pt.y}) : case hors écran`);
  const { x, y } = c;
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(120);
  await session.rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await session.rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(350);
  return { x, y };
}

/** L'intention armée est-elle CELLE de cette action ? (l'id arrive en paramètre — jamais un
 *  branchement par identité littérale, garde `registry-id-branch-guard`). */
const armePour = (e, actionId) => !!e.intent && e.intent.actionId === actionId;

const etat = (session) => evaluate(session, `(() => {
  const s = window.__wfrp.store.getState();
  const b = s.battle;
  const a = b && b.combatants.find((c) => c.id === b.order[b.turn]);
  return {
    intent: s.localIntent, preview: b && b.preview ? { kind: b.preview.kind, tile: b.preview.tile } : null,
    actif: a ? { id: a.id, kind: a.kind, pos: a.pos, mvt: a.movement } : null,
    mouvementUse: b ? b.movementUsed : null, acted: b ? b.acted : null,
    pendingRun: !!s.pendingRun, pendingAttack: s.pendingAttack ? { cible: s.pendingAttack.targetId, charge: !!s.pendingAttack.fromCharge } : null,
    ennemis: b ? b.combatants.filter((c) => c.kind === 'enemy' && c.pos).map((c) => ({ id: c.id, pos: c.pos })) : [],
  };
})()`);

/** Les boutons de SORTIE d'une fenêtre de jet, par ordre de préférence (`cliquerPremierOffert`). */
const SORTIES_DU_JET = ['Renoncer', 'Annuler', 'Fermer'];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`FILIGRANE — ${filigrane()}`);
  const session = await openApp(args.url);
  const journal = consoleGuard(session);
  const echecs = [];
  const dire = (ok, quoi) => { console.log(`  ${ok ? '·' : '✗'} ${quoi}`); if (!ok) echecs.push(quoi); };
  try {
    await evaluate(session, `window.__wfrp.scenario('embuscade', 7)`);
    await sleep(1500);
    choixFaits.push(...(await resoudreModales(session, 'ouverture')));
    await evaluate(session, `window.__wfrp.fight('enc-mutants')`);
    await sleep(1600);
    let e = await jusquAuHeros(session);
    console.log(`Combat monté — actif ${e.actif.id} en (${e.actif.pos.x},${e.actif.pos.y}), Mouvement ${e.actif.mvt}, ${e.ennemis.length} ennemi(s).`);

    // ── 0. Les cases LOINTAINES visibles (au-delà de la Marche : d > M en Chebyshev, donc hors
    //    portée de Marche quel que soit le chemin), hors cases occupées ────────────────────────────
    const M = e.actif.mvt;
    const occupees = new Set(e.ennemis.map((en) => `${en.pos.x},${en.pos.y}`));
    const candidats = [];
    for (let d = M + 1; d <= M + 3; d++) {
      for (let dx = -d; dx <= d; dx++) {
        for (let dy = -d; dy <= d; dy++) {
          if (chebyshev({ x: 0, y: 0 }, { x: dx, y: dy }) !== d) continue;
          const pt = { x: e.actif.pos.x + dx, y: e.actif.pos.y + dy };
          if (!occupees.has(`${pt.x},${pt.y}`)) candidats.push(pt);
        }
      }
    }

    // ── 1. ARMER LA COURSE : la portée s'affiche ────────────────────────────────────────────────
    await cliquerAction(session, 'course');
    await sleep(400);
    e = await etat(session);
    dire(armePour(e, 'course'), 'la case Course ARME l’intention');
    dire(await evaluate(session, `!!document.querySelector('[data-action="course"].on')`), 'la case Course s’allume (état armé visible)');
    await shot(session, 'intention-course-overlay', args.out);

    // ── 2. Échap ANNULE ─────────────────────────────────────────────────────────────────────────
    await frapperTouche(session, { key: 'Escape' });
    await sleep(350);
    e = await etat(session);
    dire(e.intent === null, 'Échap dissout l’intention');

    // ── 3. RE-CLIC ANNULE ───────────────────────────────────────────────────────────────────────
    await cliquerAction(session, 'course');
    await sleep(300);
    await cliquerAction(session, 'course');
    await sleep(300);
    e = await etat(session);
    dire(e.intent === null, 'le re-clic de la case dissout l’intention');

    // ── 4. COMMIT : intention de Course + clic d'une case LOINTAINE → le jet de Course PART ──────
    //    On balaie les cases lointaines VISIBLES : hors de la bande de Course, le clic ne fait rien
    //    (le moteur refuse) ; dans la bande, le jet d'Athlétisme s'ouvre. C'est le geste du joueur.
    let caseCourse = null;
    let essais = 0;
    for (const pt of candidats) {
      if (essais >= 30) break;
      const vu = await centreVisible(session, pt);
      if (!vu) continue;
      essais++;
      await cliquerAction(session, 'course');
      await sleep(250);
      await cliquerCase(session, pt);
      await sleep(600);
      const s2 = await etat(session);
      if (s2.pendingRun || await evaluate(session, `!!document.querySelector('.modal-overlay')`)) { caseCourse = pt; e = s2; break; }
      if (s2.mouvementUse > 0) throw new Error(`la case (${pt.x},${pt.y}) a DÉPLACÉ le héros : elle n'était pas au-delà de la Marche`);
    }
    console.log(`Sondage de Course : ${essais} case(s) lointaine(s) visible(s) essayée(s) sur ${candidats.length} candidates → ${caseCourse ? `(${caseCourse.x},${caseCourse.y})` : 'aucune'}.`);
    if (!caseCourse) throw new Error('aucune case de la bande de Course atteinte');
    dire(true, `le clic sous intention de Course ouvre le JET de Course (case ${caseCourse.x},${caseCourse.y})`);
    dire(e.intent === null, 'l’intention se dissout au commit');
    await shot(session, 'intention-course-jet', args.out);
    await cliquerPremierOffert(session, SORTIES_DU_JET);
    await sleep(500);

    // ── 5. ARMER LA CHARGE : la bande M×2 s'affiche, puis clic-ennemi → charge réelle ────────────
    //    Terrain d'entraînement : la lice (x=7) lance l'exercice au contact, avec deux sparring-partners
    //    — c'est LE terrain de la Charge (cf. docs/test-scenarios.md).
    await evaluate(session, `window.__wfrp.scenario('entrainement', 4)`);
    await sleep(1600);
    choixFaits.push(...(await resoudreModales(session, 'ouverture entraînement')));
    console.log('goto lice :', await evaluate(session, `window.__wfrp.goto({ x: 7, y: 9 })`));
    await sleep(1600);
    e = await jusquAuHeros(session);

    const cibleDeCharge = (s2) => s2.ennemis
      .map((en) => ({ ...en, d: chebyshev(en.pos, s2.actif.pos) }))
      .filter((en) => en.d > 1 && en.d <= 2 * s2.actif.mvt)
      .sort((a, b) => a.d - b.d)[0];
    // La case Charger n'est DÉDUITE que d'un set qui ouvre un corps à corps (spec §1a G2) : le Tireur
    // ne la porte pas. On passe donc la main jusqu'au combattant qui l'offre ET qui a une cible en bande.
    const offreCharge = () => evaluate(session, `!!document.querySelector('.combat-console [data-action="charge"]')`);
    let cible = (await offreCharge()) ? cibleDeCharge(e) : null;
    // Personne dans la bande ? On finit le tour — les sparring-partners se rapprochent d'eux-mêmes.
    for (let tour = 0; !cible && tour < 12; tour++) {
      await finDuTour(session);
      e = await jusquAuHeros(session);
      cible = (await offreCharge()) ? cibleDeCharge(e) : null;
    }
    if (!cible) throw new Error(`aucun combattant n'a offert la Charge avec une cible dans sa bande (M×2 = ${2 * e.actif.mvt})`);
    console.log(`Cible de Charge : ${cible.id} à ${cible.d} cases (bande M×2 = ${2 * e.actif.mvt}).`);
    await cliquerAction(session, 'charge');
    await sleep(400);
    e = await etat(session);
    dire(armePour(e, 'charge'), 'la case Charger ARME l’intention');
    await shot(session, 'intention-charge-overlay', args.out);
    await cliquerCase(session, cible.pos);
    await sleep(900);
    e = await etat(session);
    dire(!!e.pendingAttack && e.pendingAttack.charge, 'le clic-ennemi sous intention lance la CHARGE réelle');
    dire(e.intent === null, 'l’intention de Charge se dissout au commit');
    await shot(session, 'intention-charge-commit', args.out);
    await cliquerPremierOffert(session, SORTIES_DU_JET);
    await sleep(600);

    // ── 6. NON-RÉGRESSION : clic-ennemi SANS intention = attaque normale ─────────────────────────
    //    Combat FRAIS : aucune intention n'a jamais été armée dans ce tour-là.
    await evaluate(session, `window.__wfrp.fight('enc-entrainement')`);
    await sleep(1600);
    e = await jusquAuHeros(session);
    dire(e.intent === null, 'aucune intention armée au début du tour');
    const proche = e.ennemis.map((en) => ({ ...en, d: chebyshev(en.pos, e.actif.pos) })).sort((a, b) => a.d - b.d)[0];
    console.log(`Clic-ennemi nu : ${proche.id} à ${proche.d} case(s) de ${e.actif.id}.`);
    await cliquerCase(session, proche.pos);
    await sleep(900);
    e = await etat(session);
    if (!e.pendingAttack) { await cliquerCase(session, proche.pos); await sleep(900); e = await etat(session); }
    dire(!!e.pendingAttack, `un clic-ennemi SANS intention ouvre l’attaque, comme avant (état : ${JSON.stringify(e.pendingAttack)})`);
    await shot(session, 'sans-intention-attaque', args.out);
  } finally {
    const err = journal.errors();
    console.log(`\n${decrireChoix(choixFaits)}`);
    if (err.length) {
      console.error(`\nCONSOLE — ${err.length} erreur(s) :`);
      for (const x of err) console.error(`  · ${x.text}`);
      echecs.push(`${err.length} erreur(s) de console`);
    } else {
      console.log('\nConsole : 0 erreur.');
    }
    await session.close();
  }
  if (echecs.length) {
    console.error(`\n${echecs.length} défaut(s) :`);
    for (const x of echecs) console.error(`  · ${x}`);
    process.exit(1);
  }
  console.log('\nPatron d’intention : conforme à l’écran.');
}

main().catch((e) => { console.error(`ERR ${e.message}`); process.exit(1); });
