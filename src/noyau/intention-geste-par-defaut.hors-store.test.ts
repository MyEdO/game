/**
 * LE MODÈLE DE GESTES DU CHAMP (#1411, P0-A) — spec HUD § « ARBITRAGE 2026-08-19 »
 * (`docs/plans/2026-08-16-spec-hud-combat.md`), qui SUPPLANTE le verbatim « actions par défaut du
 * grid » du 2026-08-16. Options choisies par l'utilisateur, verbatim de la spec :
 *  1. « Clic-ennemi nu = Attaque auto À PORTÉE seulement — à portée = attaque de l'arme équipée ; hors
 *     portée = refus dit (ou simple sélection/examen) — le déplacement reste un geste séparé » ;
 *  2. « Clic-sol au-delà de la Marche = Course à ARMER (école BG3) — cliquer au-delà de la Marche =
 *     refus dit ; il faut armer la case Course pour débloquer la zone étendue » ;
 *  3. « Zones par défaut = Marche seule — la Course ne se peint qu'à l'armement de sa case ».
 *
 * Et les trois lois d'accompagnement : refus VISIBLE (jamais le journal, invisible en combat),
 * annulation GRATUITE par construction, intention JAMAIS bloquante des modes de ciblage. Les zones peintes se lisent
 * à `porteesDuTour` (`localIntent.ts`), la lecture du champ de chaque hôte.
 *
 * L'approche vers l'ennemi cliqué s'arme donc par la CHARGE : sans elle le clic ne s'approche plus,
 * avec elle la case Charge garde son effet (une affordance qui ne fait rien serait morte).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { computeRunReach, displayedReach } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { cliquerSurLeCombattant } from './combatOrParty';
import { porteesDuTour } from './localIntent';

/** Même combat témoin que `intention-portee.hors-store.test.ts` : un héros au tour ENTIER, ennemis parqués loin. */
function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero], screen: 'campaign' });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'ennemi')) e.pos = { x: 20 + i++, y: 20 };
  H.pos = { x: 6, y: 10 };
  const turn = b.order.indexOf(H.id);
  banc.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false, preview: null }, localIntent: null });
  return { H, E: b.combatants.find((c) => c.kind === 'ennemi')! };
}

const get = () => banc.getState();

/** Une case de la zone de COURSE hors de la Marche. */
function caseDeCourse(): { x: number; y: number } {
  const marche = displayedReach(get);
  const k = [...computeRunReach(get).keys()].find((c) => !marche.has(c))!;
  const [x, y] = k.split(',').map(Number);
  return { x, y };
}

/** Le REFUS affiché (canal LOCAL `state.refus` → bannière `ui/CombatBanner`). Ni le journal de partie
 *  (invisible en combat), ni `battle.log` (qui garde les FAITS, et voyagerait aux invités). */
const refusAffiche = () => get().refus;

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
  banc.setState({ battle: null, pendingAttack: null, pendingRun: null, pendingCascade: null, localIntent: null, refus: null });
});

describe('(a) le clic-SOL au-delà de la Marche exige la Course ARMÉE', () => {
  it('la zone de COURSE ne se peint QU’À l’armement (par défaut : la Marche seule), et le désarmement l’efface', () => {
    setup();
    const zones = () => porteesDuTour(get, true);
    expect(zones().marche.size, 'témoin : la Marche est bien peinte').toBeGreaterThan(0);
    expect(zones().course.size, 'la zone de Course se peint sans avoir été demandée').toBe(0);
    banc.jouerLaCase('course');
    expect(zones().course.size, 'la Course armée ne peint pas sa zone').toBeGreaterThan(0);
    get().desarmerLeMode();
    expect(zones().course.size, 'le désarmement laisse la zone de Course peinte').toBe(0);
  });

  it('sans Course armée : ni déplacement, ni Course — un refus VISIBLE (bandeau, pas le journal)', () => {
    const { H } = setup();
    const loin = caseDeCourse();
    get().cliquerLaCase(loin, undefined, { confirm: true });
    expect(get().pendingRun ?? get().pendingCascade, 'la Course est partie sans avoir été armée').toBeFalsy();
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'le héros a bougé sur un refus').toEqual({ x: 6, y: 10 });
    const refus = refusAffiche();
    expect(refus, 'le refus est MUET — rien dans le canal visible').not.toBeNull();
    expect(refus!.texte, 'le refus ne dit pas COMMENT le débloquer').toContain('Course');
    expect(get().battle!.log.filter((e) => e.text === refus!.texte), 'un refus a persisté dans le journal de COMBAT').toEqual([]);
  });

  it('Course ARMÉE : la même case commet bien la Course', () => {
    setup();
    const loin = caseDeCourse();
    banc.jouerLaCase('course');
    get().cliquerLaCase(loin);
    expect(get().pendingRun ?? get().pendingCascade, 'la Course armée ne s’est pas commise').toBeTruthy();
    expect(get().localIntent, 'le clic dissout l’intention (elle a servi)').toBeNull();
    expect(refusAffiche(), 'un geste ARMÉ ne se refuse pas').toBeNull();
  });

  it('DANS la Marche, rien n’a changé : le clic-sol déplace sans rien armer', () => {
    const { H } = setup();
    const [x, y] = [...displayedReach(get).keys()].map((k) => k.split(',').map(Number)).find(([a, b]) => a !== 6 || b !== 10)!;
    get().cliquerLaCase({ x, y }, undefined, { confirm: true });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x, y });
    expect(refusAffiche()).toBeNull();
  });

});

describe('(b) un MODE DE CIBLAGE garde son commit-CASE sous une intention armée', () => {
  it('mode Téléportation + intention de Mouvement armée : la case du MODE se commet (hors portée de Marche comprise)', () => {
    const { H } = setup();
    const b = get().battle!;
    const dest = { x: 19, y: 3 }; // très loin : jamais dans la portée peinte par l'intention
    expect(displayedReach(get).has(`${dest.x},${dest.y}`), 'témoin : la case est bien hors de la Marche').toBe(false);
    banc.jouerLaCase('mouvement');
    banc.setState({ battle: { ...b, action: 'teleportation', reachable: new Map([[`${dest.x},${dest.y}`, 1]]) } });
    get().cliquerLaCase(dest);
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'le commit-CASE du mode n’a pas été atteint').toEqual(dest);
    expect(get().battle!.action, 'le mode ne s’est pas refermé : son commit n’a pas tourné').toBeNull();
  });
});

describe('(c) le clic-ENNEMI frappe à PORTÉE, et ne s’approche que si la Charge est ARMÉE', () => {
  it('ennemi HORS de portée, rien d’armé : ni approche, ni attaque — un refus VISIBLE', () => {
    const { H, E } = setup();
    E.pos = { x: 11, y: 10 }; // 5 cases : hors mêlée, mais dans la portée de Charge (2×M = 8)
    const depart = { ...H.pos! };
    cliquerSurLeCombattant(get, E.id, { confirm: true });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'le héros s’est approché tout seul').toEqual(depart);
    expect(get().pendingAttack, 'une attaque s’est ouverte hors de portée').toBeNull();
    expect(refusAffiche()?.texte, 'le refus est MUET').toContain('Charge');
  });

  it('LE MÊME clic, Charge ARMÉE : l’approche se fait (l’affordance de la case Charge reste vivante)', () => {
    const { H, E } = setup();
    E.pos = { x: 11, y: 10 };
    const depart = { ...H.pos! };
    banc.jouerLaCase('charge');
    cliquerSurLeCombattant(get, E.id, { confirm: true });
    expect(get().battle!.combatants.find((c) => c.id === H.id)!.pos, 'la Charge armée n’a pas approché').not.toEqual(depart);
    expect(refusAffiche(), 'un geste ARMÉ ne se refuse pas').toBeNull();
  });

  it('ennemi AU CONTACT, rien d’armé : l’attaque part, comme avant (le clic à portée est intact)', () => {
    const { H, E } = setup();
    E.pos = { x: H.pos!.x + 1, y: H.pos!.y };
    cliquerSurLeCombattant(get, E.id, { confirm: true });
    expect(get().pendingAttack).toMatchObject({ attackerId: H.id, targetId: E.id });
    expect(refusAffiche()).toBeNull();
  });
});

describe('(d) l’annulation reste GRATUITE par construction', () => {
  it('armer puis désarmer ne dépense NI Mouvement, NI Action, NI Avantage', () => {
    const { H } = setup();
    const avant = { mv: get().battle!.movementUsed ?? 0, acted: get().battle!.acted, adv: H.advantage };
    banc.jouerLaCase('course');
    get().desarmerLeMode();
    expect(get().localIntent).toBeNull();
    const b = get().battle!;
    expect({ mv: b.movementUsed ?? 0, acted: b.acted, adv: b.combatants.find((c) => c.id === H.id)!.advantage }).toEqual(avant);
  });
});
