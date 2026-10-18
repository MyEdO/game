import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { battleRng } from './battleRng';
import { applyAttackResult, attackWeaponOf, victimeDuCoup, resolveCastChain } from './combatFlow';
import { draineCascade } from './cascadeTestKit';
import { toucheSauvee, hitModifiers } from './combat/hitModifiers';
import { createHero } from '../engine/character';
import { rederivePassiveAttack, issueAuJet, compteDuCoup, woundsAtCritLocation, apresDeviations, resolveStrayRangedHit, coupAApplique, ligneDuCoup, hitLocationByShape, reverseRoll, type AttackResult } from '../engine/combat';
import { makeRNG } from '../engine/dice';
import { recomputeLoadout } from '../engine/items';
import { setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import { locationLabel, type Combatant, type HitLocation, type ItemInstance, type Weapon } from '../engine/types';

/** Aperçu au jet = application : LDB 18 l.44, l.53, l.55 ; LDB 63 l.19, l.21, l.30, l.32, l.78 ; LDB 60 l.50 ;
 *  AA 07 l.65 ; #1595 c.6221792068 Q3, c.6228496170 Q1. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
const piece = (qualites: string[], pa: number, locs: readonly HitLocation[]): ItemInstance =>
  ({ uid: 'p1', label: 'Pièce', kind: 'armor', equipped: true, pa, locs: [...locs], qualities: qualites.map((id) => ({ id })) }) as unknown as ItemInstance;

interface Jet { seed: number; roll: number; paTouche?: number; pieces?: (lieu: HitLocation) => ItemInstance[]; tenue?: boolean; current?: number }

/** Le coup né au jet par la couture du jeu (`rederivePassiveAttack`), sur un ennemi important à 20 PB. */
function auJet({ seed, roll, paTouche = 0, pieces, tenue, current = 20 }: Jet, lieu?: HitLocation) {
  useGame.getState().seedRng(seed);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
  useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: tenue ? 0 : undefined } });
  useGame.getState().startScene(structuredClone(testScene()));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const cible = b.combatants.find((c) => c.kind === 'enemy')!;
  cible.items = [...(cible.items ?? []).filter((i) => i.kind !== 'armor'), ...(lieu && pieces ? pieces(lieu) : [])];
  cible.armour = { tete: 0, corps: paTouche, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
  recomputeLoadout(cible);
  cible.armour = { ...cible.armour, corps: Math.max(cible.armour.corps, paTouche) };
  cible.wounds = { current, max: 20 } as Combatant['wounds'];
  cible.important = true;
  const res = rederivePassiveAttack(H, cible, epee, { roll, target: 90, success: true, sl: 0, isDouble: roll % 11 === 0 } as never, 'melee', { rng: battleRng() }, 'corps');
  return { H, cible, res };
}

/** Le premier jet dont la Localisation relancée quitte le corps. */
function jetRelanceHorsDuCorps(roll: number): { seed: number; lieu: HitLocation } {
  for (let seed = 1; seed < 200; seed++) {
    const lieu = auJet({ seed, roll }).res.critLocation;
    if (lieu && lieu !== 'corps') return { seed, lieu };
  }
  throw new Error('aucune graine');
}

/** L'aperçu au jet, puis l'application du MÊME coup, la cascade drainée ; `offertes` : fenêtres Dévier/Subir. */
function apercuPuisApplication(jet: Jet, lieu: HitLocation) {
  const offertes: string[] = [];
  const { H, cible, res } = auJet(jet, lieu);
  expect(res.critLocation, 'le jet rejoue la même naissance').toBe(lieu);
  const { ligne, compte } = issueAuJet(cible, res, epee, H);
  const apercu = { critiques: compte.critiques.length, blessures: compte.blessures, lieu: compteDuCoup(res, epee, H, cible, 0).lieu, ligne };
  const intacte = structuredClone(cible);
  const touche = { woundsLost: res.woundsLost ?? 0, location: res.location };
  applyAttackResult(useGame.getState, useGame.setState, H, cible, epee, res);
  draineCascade(useGame.getState, 200, () => 1, (etape) => {
    if (!etape.options?.some((o) => o.key === 'subir')) return undefined;
    offertes.push(etape.id);
    return 'subir';
  });
  const apres = useGame.getState().battle!.combatants.find((c) => c.id === cible.id)!;
  const applique = { critiques: res.critiques ?? 0, blessures: res.woundsLost ?? 0, lieu: res.location };
  return { apercu, applique, intacte, touche, res, apres, offertes };
}

describe('aperçu au jet = application, par `compteDuCoup`', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); setRule('combat-critical-deflect', false); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-critical-deflect'); });

  it("T1 'ldb' : un double, PA différents à la touche et au lieu relancé", () => {
    const { seed, lieu } = jetRelanceHorsDuCorps(44);
    const { apercu, applique, intacte, touche, res } = apercuPuisApplication({ seed, roll: 44, paTouche: 3 }, lieu);
    expect(touche.location).toBe('corps');
    const attendu = woundsAtCritLocation(res, epee, intacte, lieu);
    expect(attendu, 'les Blessures au lieu relancé, sans les 3 PA du corps').toBeGreaterThan(touche.woundsLost);
    expect(apercu.blessures).toBe(attendu);
    expect(apercu.lieu).toBe(lieu);
    expect(apercu.critiques).toBe(1);
    expect(apercu.ligne).toContain(locationLabel(lieu, 'humanoide'));
    expect(applique).toEqual({ critiques: apercu.critiques, blessures: apercu.blessures, lieu: apercu.lieu });
  });

  it('T1 Impénétrable : le double impair ignore le Coup Critique au lieu relancé', () => {
    const { seed, lieu } = jetRelanceHorsDuCorps(33);
    const { apercu, applique, apres } = apercuPuisApplication({ seed, roll: 33, pieces: (l) => [piece(['impenetrable'], 1, [l])] }, lieu);
    expect(apercu.critiques, 'LDB 63 l.78').toBe(0);
    expect(apres.criticalWounds ?? 0).toBe(0);
    expect(applique).toEqual({ critiques: apercu.critiques, blessures: apercu.blessures, lieu: apercu.lieu });
  });

  it('T1 Bâclée : les Blessures se lisent pièce cassée, et la pièce casse', () => {
    const { seed, lieu } = jetRelanceHorsDuCorps(44);
    const { apercu, applique, intacte, res, apres } = apercuPuisApplication({ seed, roll: 44, pieces: (l) => [piece(['bacle'], 2, [l])] }, lieu);
    const attendu = woundsAtCritLocation(res, epee, apresDeviations(intacte, lieu, 0, { casse: true }), lieu);
    expect(attendu, 'LDB 60 l.50 : la pièce cassée ne protège plus').toBe(woundsAtCritLocation(res, epee, intacte, lieu) + 2);
    expect(apercu.blessures).toBe(attendu);
    expect(apercu.critiques).toBe(1);
    expect((apres.items!.find((i) => i.uid === 'p1')!.damageTaken ?? 0)).toBeGreaterThan(2);
    expect(applique).toEqual({ critiques: apercu.critiques, blessures: apercu.blessures, lieu: apercu.lieu });
  });

  for (const [nom, sansPrise] of [
    ['empoignade', (r: AttackResult, c: Combatant) => coupAApplique(r, true, c)],
    ['sauvegarde', (r: AttackResult) => toucheSauvee(r)],
    ['bouclier-anti-fleches', (r: AttackResult, c: Combatant) => {
      const H = useGame.getState().battle!.combatants.find((x) => x.kind === 'hero')!;
      H.pos = { x: 0, y: 0 };
      c.pos = { x: 12, y: 12 };
      c.activeEffects = [{ label: 'Bouclier', bonus: 0, arrowWard: { radiusMeters: 4 } }] as unknown as Combatant['activeEffects'];
      const fleche = { ...arc, organicProjectile: true } as Weapon;
      return hitModifiers().find((h) => h.id === 'arrow-ward')!.apply({
        get: useGame.getState, set: useGame.setState, attacker: H, target: c, weapon: fleche, attaque: 'ranged', res: r, sink: () => {}, ouvrirSauvegarde: () => {},
      });
    }],
  ] as const) it(nom + ' : un coup sans prise qui porte un critLocation ne relance pas, 0 Blessure (LDB 14 l.159 ; LDB 85 l.98 ; LDB 47)', () => {
    const { seed, lieu } = jetRelanceHorsDuCorps(44);
    const { H, cible, res } = auJet({ seed, roll: 44 }, lieu);
    const coup = sansPrise(res, cible);
    expect(coup.sansPrise).toBe(nom);
    expect(coup.critLocation, 'le verdict de naissance voyage avec le coup').toBe(lieu);
    const c = compteDuCoup(coup, epee, H, cible, 0);
    expect(c.compte.relance).toBe(false);
    expect(c.lieu).toBe(res.location);
    expect(c.compte.blessures).toBe(0);
    expect(c.compte.critiques).toHaveLength(0);
    expect(ligneDuCoup(coup), 'LDB 18 l.55 : seule une prise relancée nomme la nouvelle Localisation').not.toContain('nouvelle Localisation');
    expect(ligneDuCoup(res), 'le même coup avec prise la nomme').toContain('nouvelle Localisation');
  });
});

/** Chaque producteur fait naître le verdict sur la cible que le compte lit. AA 07 l.25, l.52 ; LDB 18 l.53, l.55. */
describe('le verdict de relance naît sur la cible au compte', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); setRule('combat-aa-blessures', 'aa'); setRule('combat-sudden-death', 'off'); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); resetRule('combat-sudden-death'); useGame.setState({ pendingCast: null }); });

  for (const current of [0, 3]) it('applyHit, né au jet (rederivePassiveAttack), coup non critique, cible à ' + current + ' Blessure : le compte relit le verdict de naissance', () => {
    const { H, cible, res } = auJet({ seed: 5, roll: 37, current });
    expect(res.critLocation !== undefined, 'AA 07 l.25 : relance sur un opposant déjà à 0').toBe(current === 0);
    expect(compteDuCoup(res, epee, H, cible, 0).compte.relance).toBe(current === 0);
  });

  /** Un Projectile incanté par castRoll sans double, appliqué par la chaîne d'incantation ; rend le journal et
   *  la Localisation de touche (LDB 46). `sauve` : la cible porte Protection 1+ (LDB 85 l.278). */
  function projectile(current: number, sauve = false): { journal: string; touche: string } {
    for (let seed = 1; seed < 100; seed++) {
      useGame.getState().seedRng(seed);
      const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
      useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
      useGame.getState().startScene(structuredClone(testScene()));
      useGame.getState().startCombat('enc-mutants');
      useGame.getState().confirmRoundStart();
      vi.clearAllTimers();
      const b = useGame.getState().battle!;
      const H = b.combatants.find((c) => c.kind === 'hero')!;
      const cible = b.combatants.find((c) => c.kind === 'enemy')!;
      H.spells = ['flechette'];
      H.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 30 });
      cible.wounds = { current, max: 20 } as Combatant['wounds'];
      cible.important = true;
      if (sauve) cible.traits = [...(cible.traits ?? []), { id: 'protection', value: 1 }];
      useGame.setState({ pendingCast: { casterId: H.id, targetId: cible.id, spellId: 'flechette', missile: true, focused: false, result: null } as never });
      useGame.getState().castRoll();
      const jet = useGame.getState().pendingCast!.result!;
      if (!jet.cast || jet.isCritical || jet.isFumble) continue;
      resolveCastChain(useGame.getState, useGame.setState);
      draineCascade(useGame.getState, 200, () => 1);
      return {
        journal: useGame.getState().battle!.log.map((l) => l.text).join('\n'),
        touche: locationLabel(hitLocationByShape(reverseRoll(jet.roll), cible.bodyShape), cible.bodyShape),
      };
    }
    throw new Error('aucune graine');
  }

  it("Projectile sur une cible déjà à 0 Blessure à l'application : la touche nomme la nouvelle Localisation (AA 07 l.25)", () => {
    expect(projectile(0).journal).toMatch(/Fléchette sur [^(]+\(nouvelle Localisation : [^)]+\) :/);
  });

  it('Projectile sur une cible à 15 Blessures : la touche porte sa Localisation de touche (AA 07 l.25)', () => {
    expect(projectile(15).journal).toMatch(/Fléchette sur [^(]+\([A-Z][^:)]*\) :/);
  });

  it('Projectile sauvé sur une cible déjà à 0 Blessure : le journal nomme la Localisation de touche (LDB 85 l.98, l.278 ; LDB 18 l.53)', () => {
    const { journal, touche } = projectile(0, true);
    expect(journal).toMatch(new RegExp(`Fléchette sur [^(]+\\(${touche}\\)\\.`));
  });
});

const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 7 }, qualities: [], range: 50 } as unknown as Weapon;

/** Touche déviée née contre la victime (LDB 14 l.106 ; LDB 14 l.116), posée au pending comme `attackRoll` la
 *  pose ; l'aperçu par l'expression de `useAttackJetProps`, puis l'application par `attackConfirm`. */
function devieePuisApplication(cas: 'tas' | 'melee') {
  useGame.getState().seedRng(3);
  const tireur = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Tireur', seed: 7 });
  const allie = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Allie', seed: 8 });
  useGame.setState({ party: [tireur, allie], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
  useGame.getState().startScene(structuredClone(testScene()));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const [H, A] = b.combatants.filter((c) => c.kind === 'hero');
  const [e1, e2] = b.combatants.filter((c) => c.kind === 'enemy');
  for (const c of [A, e1, e2]) c.wounds = { current: 20, max: 20 } as Combatant['wounds'];
  e1.important = cas === 'tas';
  e2.important = false;
  const [cible, victime] = cas === 'tas' ? [e1, e2] : [e1, A];
  const res = resolveStrayRangedHit(H, victime, arc, 44, 90, { rng: makeRNG(3) });
  useGame.setState({ pendingAttack: { attackerId: H.id, targetId: cible.id, location: null, result: res, victimId: victime.id, weapon: arc } });
  const s = useGame.getState();
  const pa = s.pendingAttack!;
  const battle = s.battle!;
  const target = battle.combatants.find((c) => c.id === pa.targetId)!;
  const encaisse = victimeDuCoup(battle, target, pa);
  const { compte } = issueAuJet(encaisse, coupAApplique(res, pa.grapple, encaisse), attackWeaponOf(battle, H, target, pa), H);
  const apercu = { critiques: compte.critiques.length, blessures: compte.blessures };
  const avant = structuredClone(victime);
  const visee = structuredClone(cible);
  useGame.getState().attackConfirm();
  draineCascade(useGame.getState, 200, () => 1);
  const apres = (c: Combatant) => useGame.getState().battle!.combatants.find((x) => x.id === c.id)!;
  const applique = { critiques: (apres(victime).criticalWounds ?? 0) - (avant.criticalWounds ?? 0), blessures: res.woundsLost ?? 0 };
  return { apercu, applique, res, perdues: avant.wounds.current - apres(victime).wounds.current, viseeIntacte: apres(cible).wounds.current === visee.wounds.current };
}

describe('aperçu au jet = application, Déviation au défaut (LDB 63 l.30)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("T1 'ldb' sur une cible TENUE : la Déviation offerte, Subir choisi, le compte est celui du jet", () => {
    const { seed, lieu } = jetRelanceHorsDuCorps(44);
    const { apercu, applique, offertes, apres } = apercuPuisApplication({ seed, roll: 44, tenue: true, pieces: (l) => [piece([], 2, [l])] }, lieu);
    expect(offertes.length, 'la Déviation est un choix du porteur tenu').toBeGreaterThan(0);
    expect(apercu.critiques).toBe(1);
    expect(apres.criticalWounds ?? 0).toBe(1);
    expect(applique).toEqual({ critiques: apercu.critiques, blessures: apercu.blessures, lieu: apercu.lieu });
  });
});

describe("aperçu au jet = application : la touche déviée se compte sur celui qui l'encaisse", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); setRule('combat-critical-deflect', false); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-critical-deflect'); useGame.setState({ pendingAttack: null }); });

  for (const cas of ['tas', 'melee'] as const) it(`${cas} : la victime encaisse, pas la cible visée`, () => {
    const { apercu, applique, res, perdues, viseeIntacte } = devieePuisApplication(cas);
    expect(res.critical, 'le double de 44 porte un Critique').toBeTruthy();
    expect(viseeIntacte, 'la cible visée ne perd rien').toBe(true);
    expect(perdues, 'la victime perd au moins les Blessures du coup').toBeGreaterThanOrEqual(applique.blessures);
    expect(applique.blessures).toBeGreaterThan(0);
    expect(apercu).toEqual(applique);
  });
});
