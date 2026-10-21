import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { battleRng, seedBattleRng } from '../noyau/battleRng';
import { applyAttackResult, applyCast, applyOpposedCritical, resolveAttack, type CastCritChoice } from '../noyau/combatFlow';
import { avanceEtapeCascade, draineCascade, type ChoisitCle } from './cascade.testkit';
import { createHero } from '../engine/character';
import { rederivePassiveAttack, issueAuJet, coupAApplique, causeDuCoupCritique, type AttackResult } from '../engine/combat';
import { setRule, resetRule } from '../engine/policy';
import { evaluateMissile, type CastResult, type MissileResult } from '../engine/magic';
import { bus, EVT } from '../noyau/bus';
import { findSpell, type SpellData } from '../data';
import { hasCondition } from '../engine/conditions';
import { critTableRows, critTableKeyFor, critImmediateSummary } from '../engine/critical';
import { findTableEntry } from '../engine/tables';
import { recomputeLoadout } from '../engine/items';
import { testScene } from '../scenes/test-fixture';
import { spawnEnemy } from '../noyau/monde/spawn';
import { t as tr } from '../i18n';
import { locationLabel, type Combatant, type ItemInstance, type Weapon } from '../engine/types';
import { LOCALISATIONS_DE_COUP } from '../engine/types';

/** Le compte des Blessures critiques d'un coup, joué par le store : LDB 18 l.17, l.44, l.53 ; AA 07 l.36. */

const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;

interface Coup { seed?: number; roll?: number; double?: boolean; current?: number; important?: boolean; chanceux?: boolean; pa?: number; endurance?: number; pieces?: ItemInstance[]; de?: number; tenu?: boolean; choisir?: ChoisitCle; martyr?: boolean; demoniaque?: number; sousAttaque?: boolean; arme?: Weapon; retenu?: boolean; vehicule?: string; grapple?: boolean }

/** Un coup (de double, sauf `double: false`) sur la cible, par la couture du jeu (`rederivePassiveAttack` → `applyAttackResult`),
 *  la cascade drainée au dé `de` et au choix `choisir`. `tenu` = un siège MJ tient la cible. `pieces` = l'armure portée par la cible, à la place de sa PA plate.
 *  `martyr` = l'autre ennemi la garde (LDB 43 l.107) ; `demoniaque` = l'Indice de sa sauvegarde (LDB 85 l.98). `sousAttaque` = le coup d'une sous-attaque.
 *  `arme` = l'arme du coup ; `retenu` = Retenir ses coups (LDB 18 l.30 ; AA 07 l.59) ; `vehicule` = la cible est ce véhicule, tel que le jeu le fait naître ; `grapple` = une Empoignade (LDB 14 l.159). */
function coup({ seed = 7, roll = 44, double = true, current = 2, important = true, chanceux = false, pa = 0, endurance, pieces = [], de = 1, tenu = false, choisir, martyr = false, demoniaque, sousAttaque = false, arme = epee, retenu = false, vehicule, grapple = false }: Coup = {}) {
  useGame.getState().seedRng(seed);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
  useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...useGame.getState().net, mode: tenu ? 'host' : 'local', mySeat: 0, gmSeat: tenu ? 1 : undefined } });
  useGame.getState().startScene(structuredClone(testScene()));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const ennemis = b.combatants.filter((c) => c.kind === 'enemy');
  if (vehicule) b.combatants[b.combatants.indexOf(ennemis[0])] = ennemis[0] = spawnEnemy({ ref: vehicule }, ennemis[0].id, ennemis[0].pos!);
  const [cible, pretre] = ennemis;
  pretre.items = (pretre.items ?? []).filter((i) => i.kind !== 'armor');
  pretre.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
  pretre.wounds = { current: 20, max: 20 } as Combatant['wounds'];
  if (martyr) cible.activeEffects = [{ label: 'Martyr', bonus: 0, duration: { scale: 'rounds', left: 4 }, martyrGuard: pretre.id }] as never;
  if (demoniaque != null) cible.traits = [...(cible.traits ?? []), { id: 'demoniaque', value: demoniaque }] as never;
  if (!vehicule) {
    cible.items = [...(cible.items ?? []).filter((i) => i.kind !== 'armor'), ...structuredClone(pieces)];
    cible.armour = { tete: pa, corps: pa, brasG: pa, brasD: pa, jambeG: pa, jambeD: pa };
    if (pieces.length) recomputeLoadout(cible);
    if (endurance != null) cible.characteristics = { ...cible.characteristics, endurance };
    cible.wounds = { current, max: 20 } as Combatant['wounds'];
    cible.important = important;
    if (chanceux) cible.talents = [...(cible.talents ?? []), { talentId: 'chanceux', times: 1 }];
  }
  const res = rederivePassiveAttack(H, cible, arme, { roll, target: 90, success: true, sl: 0, isDouble: double } as never, 'melee', { rng: battleRng() }, 'corps', retenu);
  const auJet = { critical: res.critical, woundsLost: res.woundsLost ?? 0, cause: causeDuCoupCritique(res), critLocation: res.critLocation, ligne: issueAuJet(cible, coupAApplique(res, grapple, cible), arme, H).ligne };
  applyAttackResult(useGame.getState, useGame.setState, H, cible, arme, res, { ...(sousAttaque ? { sousAttaque: true } : {}), ...(grapple ? { suite: { grapple: true } } : {}) });
  const kinds: string[] = [];
  const origines: (string | undefined)[] = [];
  const offres = new Map<string, boolean>();
  for (let i = 0; i < 200 && useGame.getState().pendingCascade; i++) {
    const p = useGame.getState().pendingCascade!;
    const etape = p.participants[p.cursor];
    if (etape?.kind === 'critical') origines.push(etape.reveal?.origine);
    if (etape?.kind === 'deviation') offres.set(etape.id, !!etape.options?.some((o) => o.key === 'devier'));
    const k = avanceEtapeCascade(useGame.getState, () => de, choisir);
    if (k !== undefined) kinds.push(k);
  }
  const apres = useGame.getState().battle!.combatants;
  return { res, H, auJet, kinds, origines, offres: [...offres.values()], cible: apres.find((c) => c.id === cible.id)!, pretre: apres.find((c) => c.id === pretre.id)! };
}

/** Un Coup Critique (double 44) qui DÉPASSE les 2 Blessures restantes de la cible. */
function coupQuiDepasse(important: boolean, opts: Omit<Coup, 'important'> = {}) {
  const r = coup({ ...opts, important });
  expect(r.auJet.critical, 'le double fait le Coup Critique').toBe(true);
  expect(r.auJet.woundsLost, 'le coup dépasse les Blessures restantes').toBeGreaterThan(2);
  return r;
}

const LOCS = LOCALISATIONS_DE_COUP;
const piece = (qualites: string[], pa: number, locs: readonly string[] = LOCS): ItemInstance =>
  ({ uid: 'p1', label: 'Pièce', kind: 'armor', equipped: true, pa, locs: [...locs], qualities: qualites.map((id) => ({ id })) }) as unknown as ItemInstance;

const totalPA = (c: Combatant) => Object.values(c.armour ?? {}).reduce((t, n) => t + n, 0);
const portee = (c: Combatant, uid: string) => c.items!.find((i) => i.uid === uid)!;
const casse = (c: Combatant, uid: string) => (portee(c, uid).damageTaken ?? 0) > (portee(c, uid).pa ?? 0);
const journal = () => useGame.getState().battle!.log.map((l) => l.text);

describe('le store joue le compte des Blessures critiques du coup', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  it("'ldb' : Coup Critique ET dépassement — deux Blessures critiques, à la même Localisation (LDB 18 l.17, l.53)", () => {
    const { res, cible } = coupQuiDepasse(true);
    expect(cible.criticalWounds).toBe(2);
    expect(res.critLocation).toBeDefined();
    expect(res.location).toBe(res.critLocation);
  });

  for (const [endurance, be, seconde] of [[35, 3, 30], [10, 1, 50]] as const) {
    it(`'ldb' : BE ${be} — deux lignes de table, la seconde au d100 ${seconde} (LDB 18 l.17 ; #1595 c.6222318751)`, () => {
      const { res, cible } = coupQuiDepasse(true, { endurance, de: 50 });
      const depassement = (res.woundsLost ?? 0) - 2;
      expect(depassement > 0 && depassement < be, `dépassement ${depassement}, BE ${be}`).toBe(seconde === 30);
      const rangee = (r: number) => findTableEntry(critTableRows('ldb', critTableKeyFor(res.critLocation!)), r).id;
      expect(cible.critEntriesSuffered).toEqual([rangee(50), rangee(seconde)]);
    });
  }

  // LDB 18 l.53, l.17 ; LDB 13 l.161 ; #1595 c.6240485441 Q3.
  it("'ldb' : le dépassement se mesure sur les PB d'avant la perte de la ligne du Coup Critique", () => {
    const sonde = coup({ current: 20 });
    const ligne = critTableRows('ldb', critTableKeyFor(sonde.res.critLocation!))
      .filter((e) => !e.lethal)
      .reduce((a, e) => (critImmediateSummary(e.ops ?? []).woundsLost > critImmediateSummary(a.ops ?? []).woundsLost ? e : a));
    expect(critImmediateSummary(ligne.ops ?? []).woundsLost, 'la ligne retire des PB').toBeGreaterThan(0);
    const blessures = sonde.auJet.woundsLost;
    const { cible } = coup({ current: blessures, de: ligne.max });
    expect(cible.critEntriesSuffered).toEqual([ligne.id]);
    expect(cible.criticalWounds).toBe(1);
    expect(cible.wounds.current).toBe(0);
  });

  it("'ldb' : la Déviation du premier Critique laisse le second (LDB 63 l.30 ; LDB 18 l.17)", () => {
    const { cible } = coupQuiDepasse(true, { pa: 1, endurance: 10 });
    expect(totalPA(cible), 'un PA sacrifié').toBe(5);
    expect(cible.criticalWounds).toBe(1);
  });

  it("'aa' : une seule Blessure critique par coup, pour le Chanceux hors Mort subite (AA 07 l.36, l.67)", () => {
    setRule('combat-aa-blessures', 'aa');
    expect(coupQuiDepasse(true, { chanceux: true }).cible.criticalWounds).toBe(1);
  });

  it("'ldb' : le figurant tombe par la Mort subite, sans Blessure critique (LDB 18 l.44, l.46)", () => {
    const { cible } = coupQuiDepasse(false);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(cible.wounds.current).toBe(0);
    expect(hasCondition(cible, 'inconscient')).toBe(true);
  });

  it("Mort subite : le double en mêlée sur un figurant blindé TENU n'ouvre aucune étape, la PA reste (LDB 18 l.44)", () => {
    const { cible, kinds } = coupQuiDepasse(false, { pa: 1, endurance: 10, tenu: true });
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(totalPA(cible)).toBe(6);
    expect(kinds).toEqual([]);
  });

  it("Mort subite : l'automate ne dévie rien sur le figurant que personne ne tient (LDB 18 l.44 ; LDB 63 l.30)", () => {
    const { cible, kinds } = coupQuiDepasse(false, { pa: 1, endurance: 10 });
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(totalPA(cible)).toBe(6);
    expect(kinds).toEqual([]);
    expect(useGame.getState().battle!.log.map((l) => l.text)).not.toContain(tr('cf.deflect', { name: cible.label }));
  });

  it("Mort subite : le Critique d'un Test opposé ne frappe pas le figurant (LDB 14 l.3 ; LDB 18 l.44)", () => {
    const { H, cible } = coupQuiDepasse(false, { pa: 1, endurance: 10 });
    const log: string[] = [];
    applyOpposedCritical(useGame.getState, useGame.setState, cible, 44, { attackerId: H.id, weapon: epee.label, weaponObj: epee }, log);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(totalPA(cible)).toBe(6);
    expect(useGame.getState().pendingCascade ?? null).toBeNull();
  });

  /** Le plus grand nombre de fenêtres de sévérité ouvertes à la fois par le coup. */
  function fenetresDuCoup(de: number) {
    let fenetres = 0;
    const stop = useGame.subscribe((s) => { fenetres = Math.max(fenetres, s.pendingCascade?.participants.filter((p) => p.kind === 'deviation').length ?? 0); });
    const { cible } = coupQuiDepasse(true, { de });
    stop();
    return { fenetres, cible };
  }

  it("'ldb' : un premier Critique létal arrête le compte (LDB 18 l.53)", () => {
    const { fenetres, cible } = fenetresDuCoup(100);
    expect(fenetres, 'aucune fenêtre de sévérité après la Blessure létale').toBe(1);
    expect(cible.critEntriesSuffered).toHaveLength(1);
    expect(cible.criticalWounds).toBe(1);
    expect(cible.dead).toBe(true);
    expect(fenetresDuCoup(1).fenetres, 'le premier Critique non létal laisse la seconde fenêtre').toBe(2);
  });

  it("'ldb' : sous-attaque sans fenêtre, le premier Critique létal arrête l'application (LDB 18 l.53)", () => {
    const r = coup({ seed: 111, sousAttaque: true });
    const [premiere] = r.cible.critEntriesSuffered ?? [];
    expect(critTableRows('ldb', critTableKeyFor(r.res.critLocation!)).find((e) => e.id === premiere)?.lethal, 'la graine 111 tire un premier Critique létal').toBe(true);
    expect(r.cible.critEntriesSuffered).toHaveLength(1);
    expect(r.cible.dead).toBe(true);
  });

  it("'ldb' : Dévier le Coup Critique fait naître le dépassement (LDB 63 l.30 ; LDB 18 l.17)", () => {
    const blessures = coup({ pa: 1, current: 20 }).auJet.woundsLost;
    const subi = coup({ pa: 1, current: blessures, tenu: true, choisir: () => 'subir' });
    expect(subi.cible.criticalWounds, 'subi, le coup tombe pile à 0 : aucun dépassement').toBe(1);
    let n = 0;
    const parId = new Map<string, { origine: string; overkill: number; mod?: number }>();
    const stop = useGame.subscribe((s) => {
      for (const p of s.pendingCascade?.participants ?? []) if (p.critSeverity) parId.set(p.id, { origine: p.critSeverity.origine, overkill: p.critSeverity.overkill, mod: p.table?.mod });
    });
    const devie = coup({ pa: 1, current: blessures, tenu: true, choisir: (s) => (n++ === 0 ? 'devier' : s.defaultChoice ?? s.options![0].key) });
    stop();
    const fenetres = [...parId.values()];
    expect(fenetres.map((f) => f.origine), 'le compte relu à PA−1 : le Coup Critique, puis le dépassement').toEqual(['coup-critique', 'depassement']);
    expect(fenetres[1].overkill, 'le dépassement se mesure après la Déviation').toBe(1);
    expect(fenetres[1].mod, 'LDB 18 l.17').toBe(-20);
    expect(totalPA(devie.cible), 'un PA sacrifié').toBe(5);
    expect(devie.cible.critEntriesSuffered, 'la Blessure critique du dépassement, née de la Déviation').toHaveLength(1);
    expect(devie.cible.wounds.current).toBe(0);
  });

  it("deux Blessures critiques et une sauvegarde : un seul dé de sauvegarde à travers les fenêtres (LDB 85 l.98 ; LDB 18 l.17)", () => {
    const { cible, kinds } = coupQuiDepasse(true, { pa: 1, endurance: 10, demoniaque: 8, tenu: true, choisir: () => 'subir' });
    expect(kinds.filter((k) => k === 'sauvegarde')).toHaveLength(1);
    expect(cible.criticalWounds).toBe(2);
  });

  it("Martyr, sauvegarde et fenêtre de Critique : le prêtre encaisse une seule fois (LDB 43 l.107 ; LDB 85 l.98)", () => {
    const temoin = coup({ current: 20, martyr: true, double: false, roll: 45 });
    const reentre = coup({ current: 20, martyr: true, pa: 1, demoniaque: 8, tenu: true, choisir: () => 'subir' });
    expect(temoin.kinds, 'le témoin ne ré-entre pas').toEqual([]);
    expect(reentre.kinds.filter((k) => k === 'sauvegarde')).toHaveLength(1);
    expect(reentre.kinds).toContain('deviation');
    expect(reentre.cible.criticalWounds).toBe(1);
    expect(temoin.pretre.wounds.current).toBeLessThan(20);
    expect(reentre.pretre.wounds.current).toBe(temoin.pretre.wounds.current);
  });

  it("Impénétrable se lit à la Localisation RELANCÉE du Critique, pas à celle de la touche (LDB 63 l.78 ; LDB 18 l.53)", () => {
    const { res, auJet, cible } = coup({ seed: 1, roll: 33, current: 20, pieces: [piece(['impenetrable'], 1, ['corps'])] });
    expect(auJet.critical, 'le double impair reste un Coup Critique au jet').toBe(true);
    expect(res.critLocation, 'la relance quitte la pièce Impénétrable').not.toBe('corps');
    expect(cible.criticalWounds).toBe(1);
  });

  it("Partielle et Impénétrable : le double impair ignore les PA de Partielle et la Blessure critique (LDB 63 l.78, l.86)", () => {
    const temoin = coup({ roll: 33, current: 20, pieces: [piece(['impenetrable'], 2)] });
    const partielle = coup({ roll: 33, current: 20, pieces: [piece(['partielle', 'impenetrable'], 2)] });
    expect(partielle.cible.criticalWounds ?? 0).toBe(0);
    expect(partielle.auJet.woundsLost).toBe(temoin.auJet.woundsLost + 2);
  });
});

describe('Bâclée : la casse suit le Coup Critique, dévié, subi ou ignoré (LDB 60 l.50 ; #1595 c.6225326419)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('Bâclée seule, le porteur dévie : la pièce casse, la Déviation est jouée, aucun Critique', () => {
    const { cible } = coup({ roll: 44, current: 20, tenu: true, choisir: () => 'devier', pieces: [piece(['bacle'], 1)] });
    expect(casse(cible, 'p1')).toBe(true);
    expect(journal()).toContain(tr('cf.deflect', { name: cible.label }));
    expect(cible.criticalWounds ?? 0).toBe(0);
  });

  it('Bâclée seule, le porteur refuse : la pièce casse, le Critique est subi', () => {
    const { res, cible } = coup({ roll: 44, current: 20, tenu: true, choisir: () => 'subir', pieces: [piece(['bacle'], 1)] });
    expect(casse(cible, 'p1')).toBe(true);
    expect(journal()).toContain(tr('cf.shoddyBreaks', { name: cible.label, loc: locationLabel(res.critLocation!, cible.bodyShape) }));
    expect(cible.criticalWounds).toBe(1);
  });

  it('une autre pièce dévie : elle perd 1 PA, la Bâclée casse', () => {
    const autre = { ...piece([], 2), uid: 'p2' } as ItemInstance;
    const { cible } = coup({ roll: 44, current: 20, pieces: [piece(['bacle'], 1), autre] });
    expect(portee(cible, 'p2').damageTaken).toBe(1);
    expect(casse(cible, 'p1')).toBe(true);
    expect(cible.criticalWounds ?? 0).toBe(0);
  });

  it('le dépassement seul ne casse rien (LDB 13 l.161)', () => {
    const { auJet, cible } = coup({ roll: 45, double: false, current: 1, pieces: [piece(['bacle'], 1)] });
    expect(auJet.critical, 'aucun double : pas de Coup Critique').toBe(false);
    expect(portee(cible, 'p1').damageTaken, 'la Blessure critique du dépassement est déviée').toBe(1);
    expect(casse(cible, 'p1')).toBe(false);
  });

  const subi = { tenu: true, choisir: () => 'subir' } as const;
  /** Les Blessures appliquées du même coup (double 44, graine 7) sur la cible sans armure. */
  const nu = (o: Coup = {}) => coup({ roll: 44, current: 20, ...subi, ...o }).res.woundsLost!;

  it("'ldb' : les PA de la Bâclée cassée ne comptent pas dans les Blessures du coup, le dépassement en naît (LDB 18 l.53, l.55 ; LDB 60 l.50 ; #1595 c.6228496170 Q1)", () => {
    const w = nu();
    const { res, cible } = coup({ roll: 44, current: w - 1, ...subi, pieces: [piece(['bacle'], 2)] });
    expect(res.woundsLost).toBe(w);
    expect(res.critiques, 'Coup Critique et dépassement').toBe(2);
    expect(casse(cible, 'p1')).toBe(true);
  });

  it("'aa' : mêmes Blessures, une seule Blessure critique (AA 07 l.42 ; #1595 c.6228496170 Q1)", () => {
    setRule('combat-aa-blessures', 'aa');
    try {
      const w = nu({ chanceux: true });
      const { res, cible } = coup({ roll: 44, current: w - 1, chanceux: true, ...subi, pieces: [piece(['bacle'], 2)] });
      expect(res.woundsLost).toBe(w);
      expect(res.critiques).toBe(1);
      expect(casse(cible, 'p1')).toBe(true);
    } finally { resetRule('combat-aa-blessures'); }
  });

  it('une Bâclée hors de la Localisation relancée reste entière (LDB 60 l.50 ; LDB 18 l.53)', () => {
    const temoin = coup({ roll: 44, current: 20, ...subi });
    const lieu = temoin.res.critLocation!;
    const { res, cible } = coup({ roll: 44, current: 20, ...subi, pieces: [piece(['bacle'], 2, LOCS.filter((l) => l !== lieu))] });
    expect(res.critLocation).toBe(lieu);
    expect(res.woundsLost).toBe(temoin.res.woundsLost);
    expect(casse(cible, 'p1')).toBe(false);
  });

  it("Bâclée seule : le second Critique n'offre aucune Déviation, la pièce est cassée (LDB 60 l.50 ; LDB 63 l.30)", () => {
    const { res, offres } = coup({ roll: 44, current: 1, ...subi, pieces: [piece(['bacle'], 1)] });
    expect(res.critiques).toBe(2);
    expect(offres[0], 'le Coup Critique est offert').toBe(true);
    expect(offres.slice(1)).not.toContain(true);
  });

  it('Bâclée et couche Flexible : le second Critique est encore offert (LDB 63 l.30)', () => {
    const { res, offres } = coup({ roll: 44, current: 1, ...subi, pieces: [piece(['bacle'], 1), { ...piece(['flexible'], 1), uid: 'p2' } as ItemInstance] });
    expect(res.critiques).toBe(2);
    expect(offres).toEqual([true, true]);
  });

  it('R1 : la Bâclée dévie son propre Coup Critique, puis casse (LDB 60 l.50 ; LDB 63 l.30 ; #1595 c.6228496170 R1)', () => {
    const { cible } = coup({ roll: 44, current: 1, tenu: true, choisir: () => 'devier', pieces: [piece(['bacle'], 1)] });
    expect(journal()).toContain(tr('cf.deflect', { name: cible.label }));
    expect(cible.criticalWounds, 'le dépassement reste').toBe(1);
    expect(casse(cible, 'p1')).toBe(true);
  });

  it('Bâclée et Impénétrable, double impair : la Blessure critique est ignorée, la pièce casse (LDB 63 l.78)', () => {
    const { auJet, cible } = coup({ roll: 33, current: 20, pieces: [piece(['bacle', 'impenetrable'], 1)] });
    expect(auJet.critical).toBe(true);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(casse(cible, 'p1')).toBe(true);
  });
});

describe("'aa' : le Critique du passage à 0 est un Coup Critique (AA 07 l.25, l.36 ; #1595 c.6226467544)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); setRule('combat-aa-blessures', 'aa'); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  const inoffensive = { label: 'Bâton', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'inoffensive' }] } as unknown as Weapon;
  const estoc = { ...epee, label: 'Estoc', qualities: [{ id: 'perforante' }] } as Weapon;
  const rapiere = { ...epee, label: 'Rapière', qualities: [{ id: 'empaleuse' }] } as Weapon;
  const subi = { tenu: true, choisir: () => 'subir' } as const;

  it("passage à 0 sur un impair : Impénétrable à la Localisation de touche n'ignore pas la Blessure, la Bâclée casse (LDB 63 l.78 ; LDB 60 l.50 ; #1595 c.6228496170 R2)", () => {
    const { auJet, res, cible } = coup({ roll: 45, double: false, current: 2, chanceux: true, ...subi, pieces: [piece(['bacle', 'impenetrable'], 1, ['corps'])] });
    expect(auJet.critical, 'aucun double').toBe(false);
    expect(res.woundsLost, 'les Blessures appliquées font passer à 0').toBeGreaterThanOrEqual(2);
    expect(cible.wounds.current).toBe(0);
    expect(res.critLocation, 'la Localisation de touche est gardée').toBeUndefined();
    expect(cible.criticalWounds).toBe(1);
    expect(casse(cible, 'p1')).toBe(true);
  });

  it('arme Inoffensive sur une cible déjà à 0 : 0 Blessure, un Coup Critique à la Localisation relancée (LDB 62 l.327 ; AA 07 l.25 ; #1595 c.6227274650 Q1)', () => {
    const { auJet, res, origines, cible } = coup({ arme: inoffensive, roll: 45, double: false, current: 0, chanceux: true });
    expect(auJet.woundsLost).toBe(0);
    expect(origines).toEqual(['coup-critique']);
    expect(res.critLocation).toBeDefined();
    expect(cible.criticalWounds).toBe(1);
  });

  it('coup retenu sur une cible déjà à 0 : le double tombe, une seule Blessure critique, Coup Critique relancé (AA 07 l.42, l.59 ; #1595 c.6227274650 Q2)', () => {
    const { auJet, res, origines, cible } = coup({ retenu: true, current: 0, chanceux: true });
    expect(auJet.critical, 'Retenir ses coups ignore le double').toBe(false);
    expect(origines).toEqual(['coup-critique']);
    expect(res.critLocation).toBeDefined();
    expect(res.critiques).toBe(1);
    expect(cible.criticalWounds).toBe(1);
  });

  const atouts: [string, Weapon, Coup][] = [['Perforante', estoc, { pa: 2 }], ['Empaleuse', rapiere, { pieces: [piece(['points-faibles'], 2)] }]];
  for (const [atout, arme, armure] of atouts) {
    it(`coup retenu sur une cible déjà à 0 : ${atout} ne joue pas à la Localisation relancée (AA 07 l.59, l.61 ; LDB 62 l.248, l.270 ; LDB 63 l.90)`, () => {
      const blessures = (o: Coup) => coup({ roll: 45, double: false, current: 0, chanceux: true, ...subi, ...armure, ...o }).res;
      const temoin = blessures({ retenu: true });
      const retenu = blessures({ arme, retenu: true });
      expect(retenu.critLocation).toBeDefined();
      expect(retenu.woundsLost, `${atout} perdu`).toBe(temoin.woundsLost);
      expect(blessures({ arme }).woundsLost, `${atout} joue sans la retenue`).toBeGreaterThan(temoin.woundsLost!);
    });
  }
});

describe("Impénétrable et Bâclée au Projectile et au Critique opposé (LDB 63 l.78 ; LDB 60 l.50 ; LDB 14 l.3 ; #1595 c.6228496170 Q3, Q4a)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-critical-deflect'); });

  const bacle = piece(['bacle'], 1);
  const impenetrable = (locs: readonly string[] = LOCS) => ({ ...piece(['impenetrable'], 1, locs), uid: 'p2' }) as ItemInstance;

  /** Le Carreau en Incantation critique au jet `roll`, sur la cible tenue à 1 PB sous `pieces(Localisation de touche)`, Critiques subis. */
  function carreauSur(roll: number, pieces: (touche: string) => ItemInstance[]) {
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    const { mage, cible } = carreauEnCombat();
    const sort = findSpell('Carreau')!;
    const touche = evaluateMissile(mage, cible, sort, { ...incantationCritique, roll });
    cible.important = true;
    cible.items = [...(cible.items ?? []), ...structuredClone(pieces(touche.location!))];
    recomputeLoadout(cible);
    cible.wounds = { current: 1, max: 20 } as Combatant['wounds'];
    const finales: MissileResult[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; to: string; result: MissileResult }) => { if (p.kind === 'spell' && p.to === cible.id) finales.push(p.result); });
    try {
      applyCast(useGame.getState, useGame.setState, mage, cible, sort, evaluateMissile(mage, cible, sort, { ...incantationCritique, roll }), true, false, 'critique');
      draineCascade(useGame.getState, 200, () => 1, () => 'subir');
      return { touche: touche.location!, finale: finales[0], apres: useGame.getState().battle!.combatants.find((c) => c.id === cible.id)! };
    } finally { lache(); }
  }

  it('Projectile, double impair, Impénétrable à la Localisation relancée : le Coup Critique est ignoré, le dépassement reste, la Bâclée casse', () => {
    const { apres } = carreauSur(33, () => [bacle, impenetrable()]);
    expect(apres.criticalWounds).toBe(1);
    expect(casse(apres, 'p1')).toBe(true);
  });

  it('Projectile, double pair : le Coup Critique est subi', () => {
    const { apres } = carreauSur(44, () => [bacle, impenetrable()]);
    expect(apres.criticalWounds).toBe(2);
    expect(casse(apres, 'p1')).toBe(true);
  });

  it('Projectile, double impair, Impénétrable à la seule Localisation de touche : le Coup Critique est subi', () => {
    const { touche, finale, apres } = carreauSur(33, (t) => [impenetrable([t])]);
    expect(finale.location, 'la relance quitte la pièce Impénétrable').not.toBe(touche);
    expect(apres.criticalWounds).toBe(2);
  });

  /** Le Critique d'un Test opposé au double `roll` sur la cible sous Bâclée et Impénétrable, Déviation coupée. */
  function oppose(roll: number) {
    setRule('combat-critical-deflect', false);
    const { H, cible } = coup({ roll: 45, double: false, current: 20, pieces: [bacle, impenetrable()] });
    const log: string[] = [];
    applyOpposedCritical(useGame.getState, useGame.setState, cible, roll, { attackerId: H.id, weapon: epee.label, weaponObj: epee }, log);
    return { cible, log };
  }

  it('Critique opposé, double 33 et Impénétrable : aucune Blessure critique, une ligne, la Bâclée casse', () => {
    const { cible, log } = oppose(33);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(log.filter((l) => l.startsWith(`L'armure Impénétrable de ${cible.label}`))).toHaveLength(1);
    expect(casse(cible, 'p1')).toBe(true);
  });

  it('Critique opposé, double 44 : la Blessure critique est subie, la Bâclée casse', () => {
    const { cible } = oppose(44);
    expect(cible.criticalWounds).toBe(1);
    expect(casse(cible, 'p1')).toBe(true);
  });
});

describe('véhicule routier : la coque refuse le Critique (EDOC 07 l.334)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('double sur une diligence : la coque refuse le Critique', () => {
    const { auJet, cible } = coup({ vehicule: 'diligence' });
    expect(auJet.critical, 'le double fait le Coup Critique au jet').toBe(true);
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(journal()).toContain(tr('cf.coqueSansCritique', { name: cible.label }));
  });
});

/** Un sorcier à Carreau face à un ennemi de la rencontre, le combat ouvert par le store. */
function carreauEnCombat(): { mage: Combatant; cible: Combatant } {
  const w = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
  w.spells = ['carreau'];
  useGame.setState({ party: [w], battle: null, pendingCast: null, pendingCascade: null, suspendedCascades: [] });
  useGame.getState().startScene(structuredClone(testScene()));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  useGame.getState().seedRng(7);
  const b = useGame.getState().battle!;
  const mage = b.combatants.find((c) => c.label === 'W')!;
  const cible = b.combatants.find((c) => c.kind === 'enemy')!;
  mage.pos = { x: 10, y: 10 };
  cible.pos = { x: 12, y: 10 };
  cible.items = (cible.items ?? []).filter((i) => i.kind !== 'armor');
  return { mage, cible };
}
const incantationCritique: CastResult = { cast: true, roll: 20, target: 90, sl: 4, isCritical: true, isFumble: false, log: 'jet' };

describe("Mort subite : l'Incantation critique d'un Projectile magique (LDB 18 l.44)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("le figurant blindé tombe sans Blessure critique, sans étape, la PA reste", () => {
    const { mage, cible } = carreauEnCombat();
    cible.armour = { tete: 1, corps: 1, brasG: 1, brasD: 1, jambeG: 1, jambeD: 1 };
    cible.important = false;
    cible.wounds = { current: 1, max: 20 } as Combatant['wounds'];
    const res = evaluateMissile(mage, cible, findSpell('Carreau')!, incantationCritique);
    expect(res.woundsLost ?? 0, 'le Projectile dépasse la Blessure restante').toBeGreaterThan(1);
    applyCast(useGame.getState, useGame.setState, mage, cible, findSpell('Carreau')!, res, true, false, 'critique');
    const kinds = draineCascade(useGame.getState, 200, () => 1);
    const apres = useGame.getState().battle!.combatants.find((c) => c.id === cible.id)!;
    expect(apres.criticalWounds ?? 0).toBe(0);
    expect(totalPA(apres)).toBe(6);
    expect(kinds.filter((k) => k === 'deviation' || k === 'critical')).toEqual([]);
    expect(hasCondition(apres, 'inconscient')).toBe(true);
  });

  it('la Localisation de la touche ne se relance pas (LDB 18 l.44, l.53 ; #1595 c.6219992594)', () => {
    const { mage, cible } = carreauEnCombat();
    cible.important = false;
    cible.wounds = { current: 1, max: 20 } as Combatant['wounds'];
    const res = evaluateMissile(mage, cible, findSpell('Carreau')!, incantationCritique);
    const lieux: (string | undefined)[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; result: MissileResult }) => { if (p.kind === 'spell') lieux.push(p.result.location); });
    seedBattleRng(1);
    applyCast(useGame.getState, useGame.setState, mage, cible, findSpell('Carreau')!, res, true, false, 'critique');
    draineCascade(useGame.getState, 200, () => 1);
    lache();
    expect(lieux, 'la graine 1 relancerait la Localisation au Corps').toEqual([res.location]);
  });
});

describe("'aa' : l'Incantation critique d'un Projectile sur une cible debout (LDB 46 l.30 ; AA 07 l.36, l.67 ; #1595 c.6219992594)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); setRule('combat-aa-blessures', 'aa'); });
  afterEach(() => { resetRule('combat-aa-blessures'); vi.clearAllTimers(); vi.useRealTimers(); });

  /** Le Projectile en Incantation critique sur la cible debout à 20 PB, PA 0, `choix` = l'effet choisi (absent : celui par défaut). */
  function projectileDebout(chanceux: boolean, choix: 'critique' | undefined) {
    const { mage, cible } = carreauEnCombat();
    cible.important = true;
    cible.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
    cible.wounds = { current: 20, max: 20 } as Combatant['wounds'];
    if (chanceux) cible.talents = [...(cible.talents ?? []), { talentId: 'chanceux', times: 1 }] as never;
    const res = evaluateMissile(mage, cible, findSpell('Carreau')!, incantationCritique);
    applyCast(useGame.getState, useGame.setState, mage, cible, findSpell('Carreau')!, res, true, false, choix);
    draineCascade(useGame.getState, 200, () => 50);
    return useGame.getState().battle!.combatants.find((c) => c.id === cible.id)!;
  }

  for (const choix of ['critique', undefined] as const) {
    it(`cible Chanceux, effet ${choix ?? 'par défaut'} : une Blessure critique, sur la table AA`, () => {
      const apres = projectileDebout(true, choix);
      expect(apres.wounds.current, 'la cible reste debout').toBeGreaterThan(0);
      expect(apres.criticalWounds).toBe(1);
      expect(apres.critEntriesSuffered).toHaveLength(1);
      expect(apres.critEntriesSuffered![0]).toMatch(/^aa-/);
    });
  }

  it('cible sans Chanceux : la Mort subite refuse la Blessure critique, au Projectile comme au double de mêlée', () => {
    expect(projectileDebout(false, 'critique').criticalWounds ?? 0).toBe(0);
    const { auJet, cible } = coup({ current: 20 });
    expect(auJet.critical, 'le double fait le Coup Critique au jet').toBe(true);
    expect(cible.criticalWounds ?? 0).toBe(0);
  });

  it("cible sans Chanceux : le journal dit l'effet choisi, jamais une Blessure critique", () => {
    projectileDebout(false, 'critique');
    expect(journal()).toContain(tr('cf.castCritical'));
    expect(journal().filter((l) => /blessure critique/i.test(l))).toEqual([]);
  });
});

describe("Projectile magique : l'animation de la touche porte son compte de Blessures critiques (LDB 46 l.30 ; LDB 18 l.17)", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { resetRule('combat-aa-blessures'); vi.clearAllTimers(); vi.useRealTimers(); });

  interface Emission { phase: 'applyCast' | 'drain'; to: string; critiques?: number; woundsLost?: number; cwAuMoment: number }
  /** Les `ANIM_ATTACK` de sort, chacune avec la phase où elle tombe et les Blessures critiques de sa cible à cet instant. */
  function ecoute() {
    const phase: { v: Emission['phase'] } = { v: 'applyCast' };
    const emis: Emission[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; to: string; result: MissileResult }) => {
      if (p.kind !== 'spell') return;
      const cw = useGame.getState().battle?.combatants.find((c) => c.id === p.to)?.criticalWounds ?? 0;
      emis.push({ phase: phase.v, to: p.to, critiques: p.result.critiques, woundsLost: p.result.woundsLost, cwAuMoment: cw });
    });
    return { phase, emis, lache };
  }

  /** Une cible de la rencontre debout à 20 PB, PA 0, que personne ne tient. */
  function debout(c: Combatant) {
    c.items = (c.items ?? []).filter((i) => i.kind !== 'armor');
    c.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
    c.important = true;
    c.wounds = { current: 20, max: 20 } as Combatant['wounds'];
  }

  /** Le Projectile en Incantation critique (`'critique'`) par `applyCast`, la cascade drainée au dé 50. */
  function lance(prepare: (cible: Combatant, autre: Combatant) => void = () => {}, opts: { surincante?: boolean; sort?: SpellData } = {}) {
    useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
    const { mage, cible } = carreauEnCombat();
    const autre = useGame.getState().battle!.combatants.filter((c) => c.kind === 'enemy')[1];
    autre.pos = { x: 12, y: 11 };
    debout(cible); debout(autre);
    prepare(cible, autre);
    const sort = opts.sort ?? findSpell('Carreau')!;
    const res = evaluateMissile(mage, cible, sort, incantationCritique);
    const { phase, emis, lache } = ecoute();
    try {
      applyCast(useGame.getState, useGame.setState, mage, cible, sort, res, true, false, 'critique', opts.surincante ? { extraTargets: [autre] } : undefined);
      phase.v = 'drain';
      draineCascade(useGame.getState, 200, () => 50);
    } finally { lache(); }
    return { emis, res, cible, autre };
  }

  it("'ldb', cible debout : la touche s'annonce une fois, à sa clôture, Critique compris", () => {
    const { emis, res, cible } = lance();
    expect(res.woundsLost, 'la touche blesse').toBeGreaterThan(0);
    expect(emis).toEqual([{ phase: 'drain', to: cible.id, critiques: 1, woundsLost: res.woundsLost, cwAuMoment: 1 }]);
  });

  it("sauvegarde (Démoniaque, LDB 85 l.98) : rien avant le dé, une émission après, avec la Blessure réellement retirée", () => {
    const { emis, res, cible } = lance((c) => { c.traits = [...(c.traits ?? []), { id: 'demoniaque', value: 1 }] as never; });
    expect(res.woundsLost, 'la touche blessait avant la sauvegarde').toBeGreaterThan(0);
    expect(emis).toEqual([{ phase: 'drain', to: cible.id, critiques: 0, woundsLost: 0, cwAuMoment: 0 }]);
  });

  it("Surincantation « Cible » (LDB 47 l.28) : une émission par cible, après sa fenêtre, initiale d'abord", () => {
    const { emis, cible, autre } = lance(() => {}, { surincante: true });
    expect(emis.map((e) => [e.phase, e.to, e.critiques, e.cwAuMoment])).toEqual([['drain', cible.id, 1, 1], ['drain', autre.id, 1, 1]]);
  });

  it("immunité de Domaine (Manifestation de Ghur) : une émission, sans Blessure ni Critique", () => {
    const bete = { ...findSpell('Carreau')!, domainId: 'bete' };
    const { emis, cible } = lance((c) => { c.traits = [...(c.traits ?? []), { id: 'manifestation-de-ghur' }] as never; }, { sort: bete });
    expect(emis).toEqual([{ phase: 'applyCast', to: cible.id, critiques: 0, woundsLost: 0, cwAuMoment: 0 }]);
  });

  it("parité mêlée, 'ldb', double sur une cible debout : une émission, après le Critique", () => {
    const melee: { to: string; critiques?: number; cw: number }[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; to: string; result: AttackResult }) => {
      if (p.kind === 'melee') melee.push({ to: p.to, critiques: p.result.critiques, cw: useGame.getState().battle?.combatants.find((c) => c.id === p.to)?.criticalWounds ?? 0 });
    });
    let cible: Combatant;
    try { ({ cible } = coup({ current: 20 })); } finally { lache(); }
    expect(cible.criticalWounds).toBe(1);
    expect(melee).toEqual([{ to: cible.id, critiques: 1, cw: 1 }]);
  });

  it("'aa', Incantation critique qui fait passer à 0, appliquée sans fenêtre : `ANIM_ATTACK` émet `critiques: 1` (AA 07 l.36, l.42)", () => {
    setRule('combat-aa-blessures', 'aa');
    const { mage, cible } = carreauEnCombat();
    cible.important = true;
    cible.talents = [{ talentId: 'chanceux', times: 1 }] as never; // AA 07 l.67
    cible.wounds = { current: 2, max: 20 } as Combatant['wounds'];
    cible.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 };
    const emis: (number | undefined)[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; to: string; result: MissileResult }) => {
      if (p.kind === 'spell' && p.to === cible.id) emis.push(p.result.critiques);
    });
    try {
      const res = evaluateMissile(mage, cible, findSpell('Carreau')!, incantationCritique);
      applyCast(useGame.getState, useGame.setState, mage, cible, findSpell('Carreau')!, res, true, false, 'critique');
    } finally {
      lache();
    }
    draineCascade(useGame.getState, 200, () => 1);
    const apres = useGame.getState().battle!.combatants.find((c) => c.id === cible.id)!;
    expect(apres.wounds.current).toBe(0);
    expect(apres.criticalWounds).toBe(1);
    expect(emis).toEqual([1]);
  });
});

describe('`critiques` compte les Blessures critiques INFLIGÉES, jamais les déviées (LDB 63 l.30, l.32)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { resetRule('combat-aa-blessures'); vi.clearAllTimers(); vi.useRealTimers(); });

  /** Le coup du store, avec les `critiques` de ses `ANIM_ATTACK` de mêlée. */
  function emisDuCoup(o: Coup) {
    const emis: (number | undefined)[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; result: AttackResult }) => { if (p.kind === 'melee') emis.push(p.result.critiques); });
    try { return { ...coup(o), emis }; } finally { lache(); }
  }
  const aaChanceux = (choix: 'devier' | 'subir'): Coup => ({ roll: 21, double: false, current: 1, chanceux: true, tenu: true, choisir: () => choix, pieces: [piece(['bacle'], 2)] });

  it("'aa', Chanceux, passage à 0 dévié : `critiques: 0`, la Bâclée casse", () => {
    setRule('combat-aa-blessures', 'aa');
    const { auJet, emis, cible } = emisDuCoup(aaChanceux('devier'));
    expect(auJet.woundsLost, 'le coup fait passer à 0').toBeGreaterThanOrEqual(1);
    expect(journal()).toContain(tr('cf.deflect', { name: cible.label }));
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(casse(cible, 'p1')).toBe(true);
    expect(emis).toEqual([0]);
  });

  it("'aa', Chanceux, passage à 0 subi : `critiques: 1`", () => {
    setRule('combat-aa-blessures', 'aa');
    const { emis, cible } = emisDuCoup(aaChanceux('subir'));
    expect(cible.criticalWounds).toBe(1);
    expect(emis).toEqual([1]);
  });

  it("'ldb', cible importante, double 33 dévié : `critiques: 0`", () => {
    const { auJet, emis, cible } = emisDuCoup({ roll: 33, current: 18, pa: 2, tenu: true, choisir: () => 'devier' });
    expect(auJet.critical).toBe(true);
    expect(journal()).toContain(tr('cf.deflect', { name: cible.label }));
    expect(cible.criticalWounds ?? 0).toBe(0);
    expect(emis).toEqual([0]);
  });

  it("Projectile en Incantation critique, Critique dévié : `ANIM_ATTACK` émet `critiques: 0`", () => {
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    const { mage, cible } = carreauEnCombat();
    cible.important = true;
    cible.items = [...(cible.items ?? []), piece([], 2)];
    recomputeLoadout(cible);
    cible.wounds = { current: 20, max: 20 } as Combatant['wounds'];
    const emis: (number | undefined)[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; to: string; result: MissileResult }) => { if (p.kind === 'spell' && p.to === cible.id) emis.push(p.result.critiques); });
    let kinds: string[];
    try {
      const res = evaluateMissile(mage, cible, findSpell('Carreau')!, incantationCritique);
      applyCast(useGame.getState, useGame.setState, mage, cible, findSpell('Carreau')!, res, true, false, 'critique');
      kinds = draineCascade(useGame.getState, 200, () => 50, () => 'devier');
    } finally { lache(); }
    const apres = useGame.getState().battle!.combatants.find((c) => c.id === cible.id)!;
    expect(kinds).toContain('deviation');
    expect(journal()).toContain(tr('cf.deflect', { name: apres.label }));
    expect(apres.criticalWounds ?? 0).toBe(0);
    expect(emis).toEqual([0]);
  });
});

describe('la ligne de touche du journal dit le coup APPLIQUÉ (LDB 18 l.53, l.55 ; LDB 63 l.30, l.32)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  /** Le coup joué, la touche FINALE émise à l'application, et la ligne de touche du journal. */
  function joue(opts: Coup) {
    const emis: AttackResult[] = [];
    const h = (p: { result: AttackResult }) => { emis.push(p.result); };
    bus.on(EVT.ANIM_ATTACK, h as never);
    try {
      const r = coup(opts);
      const ligne = journal().find((l) => l.startsWith('H touche'));
      return { ...r, finale: emis[0], ligne: ligne ?? '' };
    } finally { bus.off(EVT.ANIM_ATTACK, h as never); }
  }
  const lieu = (c: Combatant, res: AttackResult) => tr('touche.nouvelleLocalisation', { lieu: locationLabel(res.location!, c.bodyShape) });

  it("'ldb' : Dévier le Coup Critique — Localisation relancée, Blessures recomptées à PA−1, sans marque Critique", () => {
    const r = joue({ pa: 2, current: 20, tenu: true, choisir: () => 'devier' });
    expect(totalPA(r.cible), 'un PA sacrifié').toBe(11);
    expect(r.finale.critiques).toBe(0);
    expect(r.ligne).toContain(`(${lieu(r.cible, r.finale)})`);
    expect(r.ligne).toContain(`= ${20 - r.cible.wounds.current} Blessures`);
    expect(r.ligne).not.toContain('CRITIQUE');
  });

  it("'ldb' : Subir le Coup Critique — la ligne porte la marque Critique", () => {
    const r = joue({ pa: 2, current: 20, tenu: true, choisir: () => 'subir' });
    expect(r.finale.critiques).toBe(1);
    expect(r.ligne).toContain(`(${lieu(r.cible, r.finale)})`);
    expect(r.ligne).toContain(`= ${r.finale.woundsLost} Blessures — CRITIQUE !`);
  });

  it("'aa' : le Chanceux dévie le Critique de la chute à 0 — les Blessures recomptées à PA−1 (AA 07 l.36 ; LDB 63 l.32)", () => {
    setRule('combat-aa-blessures', 'aa');
    const temoin = joue({ pa: 2, endurance: 10, current: 3, double: false, roll: 21, chanceux: true, tenu: true, choisir: () => 'subir' });
    const r = joue({ pa: 2, endurance: 10, current: 3, double: false, roll: 21, chanceux: true, tenu: true, choisir: () => 'devier' });
    expect(temoin.finale.critiques, "le témoin subit le Critique de la chute à 0").toBe(1);
    expect(r.finale.woundsLost).toBe((temoin.finale.woundsLost ?? 0) + 1);
    expect(r.ligne).toContain(`= ${r.finale.woundsLost} Blessures.`);
    expect(r.ligne).not.toContain('CRITIQUE');
  });

  it("'ldb' : le figurant tombe par la Mort subite — aucune marque Critique (LDB 18 l.44)", () => {
    const r = joue({ important: false });
    expect(r.auJet.critical).toBe(true);
    expect(r.cible.criticalWounds ?? 0).toBe(0);
    expect(r.ligne).not.toContain('CRITIQUE');
  });

  it('Empoignade réussie : la ligne ne chiffre ni Dégâts ni Blessures (LDB 14 l.159)', () => {
    const r = joue({ current: 20, double: false, roll: 45, grapple: true });
    expect(r.cible.wounds.current).toBe(20);
    expect(r.ligne).toMatch(/^H touche /);
    expect(r.ligne).not.toMatch(/Blessures|dégâts/);
  });
});

describe('Projectile magique : une seule ligne de touche, celle du coup APPLIQUÉ (LDB 18 l.53 ; LDB 63 l.30, l.32)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Le Carreau en Incantation critique, effet `effet`, sur la cible tenue par le siège MJ, debout à 20 PB sous 2 PA ;
   *  ses lignes de touche après `applyCast`, puis après la cascade drainée au dé 50 et au choix `choix`. */
  function carreau(effet: CastCritChoice, o: { choix?: 'devier' | 'subir'; demoniaque?: number } = {}) {
    useGame.setState({ net: { ...useGame.getState().net, mode: 'host', mySeat: 0, gmSeat: 1 } });
    const { mage, cible } = carreauEnCombat();
    cible.important = true;
    cible.items = [...(cible.items ?? []), piece([], 2)];
    recomputeLoadout(cible);
    cible.wounds = { current: 20, max: 20 } as Combatant['wounds'];
    if (o.demoniaque != null) cible.traits = [...(cible.traits ?? []), { id: 'demoniaque', value: o.demoniaque }] as never;
    const sort = findSpell('Carreau')!;
    const touches = () => journal().filter((l) => l.startsWith(`${mage.label} lance ${sort.label} sur ${cible.label}`));
    const finales: MissileResult[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; to: string; result: MissileResult }) => { if (p.kind === 'spell' && p.to === cible.id) finales.push(p.result); });
    try {
      applyCast(useGame.getState, useGame.setState, mage, cible, sort, evaluateMissile(mage, cible, sort, incantationCritique), true, false, effet);
      const auLancement = touches();
      draineCascade(useGame.getState, 200, () => 50, o.choix ? () => o.choix! : undefined);
      return { auLancement, lignes: touches(), finale: finales[0], apres: useGame.getState().battle!.combatants.find((c) => c.id === cible.id)! };
    } finally { lache(); }
  }

  it('Critique dévié : une ligne, à la Localisation et aux Blessures appliquées, sans marque Critique', () => {
    const r = carreau('critique', { choix: 'devier' });
    expect(journal()).toContain(tr('cf.deflect', { name: r.apres.label }));
    expect(r.finale.critiques).toBe(0);
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0]).toContain(`(${tr('touche.nouvelleLocalisation', { lieu: locationLabel(r.finale.location!, r.apres.bodyShape) })})`);
    expect(r.lignes[0]).toContain(`= ${20 - r.apres.wounds.current} Blessures.`);
    expect(r.lignes[0]).not.toContain('CRITIQUE');
  });

  it('Critique subi : une ligne, marquée Critique une fois', () => {
    const r = carreau('critique', { choix: 'subir' });
    expect(r.finale.critiques).toBe(1);
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0]).toContain(`= ${r.finale.woundsLost} Blessures — CRITIQUE !`);
    expect(r.lignes[0], 'aucun point après « ! »').not.toContain('!.');
    expect(r.lignes[0].split('CRITIQUE').length - 1).toBe(1);
  });

  it('sauvegarde suspendue (Démoniaque, LDB 85 l.98) : rien au lancement, une ligne après la reprise', () => {
    const r = carreau('critique', { demoniaque: 1 });
    expect(r.auLancement).toEqual([]);
    expect(r.lignes).toHaveLength(1);
  });

  it('Puissance totale (LDB 46 l.31) : une ligne, sans marque Critique', () => {
    const r = carreau('puissance');
    expect(r.lignes).toHaveLength(1);
    expect(r.lignes[0]).not.toContain('CRITIQUE');
  });
});

describe('Tirs déviés (LDB 14 l.106, l.116) : la ligne chiffrée de la victime porte la phrase de la déviation', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] } as unknown as Weapon;

  it('une touche au hasard : la phrase du tas et la ligne de la victime, une fois chacune', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
    useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
    useGame.getState().startScene(structuredClone(testScene()));
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const [cible, voisin, ...autres] = b.combatants.filter((c) => c.kind === 'enemy');
    H.pos = { x: 10, y: 10 };
    cible.pos = { x: 13, y: 10 };
    voisin.pos = { x: 13, y: 11 };
    autres.forEach((c, i) => { c.pos = { x: 1, y: 1 + i }; });
    let tir: ReturnType<typeof resolveAttack> = null;
    for (let graine = 1; graine < 60 && !tir?.victim; graine++) {
      useGame.getState().seedRng(graine);
      tir = resolveAttack(useGame.getState, H, cible, undefined, false, true, false, arc);
    }
    const { victim, res, weapon } = tir!;
    expect(victim, 'une graine touche le tas').toBeDefined();
    applyAttackResult(useGame.getState, useGame.setState, H, victim!, weapon, res);
    draineCascade(useGame.getState, 200, () => 50);
    const texte = journal().join('\n');
    expect(texte.split('Tir dans le tas').length - 1).toBe(1);
    expect(texte.split(`H touche ${victim!.label}`).length - 1).toBe(1);
    expect(journal().find((l) => l.startsWith(`H touche ${victim!.label}`))).toMatch(/ Blessures.* Tir dans le tas/);
  });

  it('tir dévié dans la mêlée (LDB 14 l.116) : la phrase de la déviation et la ligne de l’allié touché, une fois chacune', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 7 });
    useGame.setState({ party: [hero], battle: null, pendingCascade: null, suspendedCascades: [], net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
    useGame.getState().startScene(structuredClone(testScene()));
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const [tireur, voisin, ...autres] = b.combatants.filter((c) => c.kind === 'enemy');
    H.pos = { x: 10, y: 10 };
    voisin.pos = { x: 11, y: 10 };
    tireur.pos = { x: 14, y: 10 };
    H.engagedWith = [voisin.id];
    voisin.engagedWith = [H.id];
    autres.forEach((c, i) => { c.pos = { x: 1, y: 1 + i }; });
    let tir: ReturnType<typeof resolveAttack> = null;
    for (let graine = 1; graine < 200 && !tir?.victim; graine++) {
      useGame.getState().seedRng(graine);
      tir = resolveAttack(useGame.getState, tireur, H, undefined, false, false, false, arc);
    }
    const { victim, res, weapon } = tir!;
    expect(victim?.id, 'une graine dévie sur l’allié').toBe(voisin.id);
    applyAttackResult(useGame.getState, useGame.setState, tireur, victim!, weapon, res);
    draineCascade(useGame.getState, 200, () => 50);
    const texte = journal().join('\n');
    expect(texte.split(tr('cf.strayMelee', { name: voisin.label })).length - 1).toBe(1);
    expect(texte.split(`${tireur.label} touche ${voisin.label}`).length - 1).toBe(1);
  });
});

describe('la ligne de touche qualifie la Localisation relancée, au jet comme au journal (LDB 18 l.53, l.55 ; AA 07 l.25, l.32)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  const rapiere = { ...epee, label: 'Rapière', qualities: [{ id: 'empaleuse' }] } as Weapon;
  const relancee = (c: Combatant, lieu: Parameters<typeof locationLabel>[0]) => `(${tr('touche.nouvelleLocalisation', { lieu: locationLabel(lieu, c.bodyShape) })})`;
  const ligneDuJournal = () => journal().find((l) => l.startsWith('H touche')) ?? '';

  const armes = [
    { cause: 'double', jeu: 'ldb', o: { roll: 44, current: 20 } },
    { cause: 'empaleuse', jeu: 'ldb', o: { roll: 30, double: false, current: 20, arme: rapiere } },
    { cause: null, jeu: 'aa', o: { roll: 21, double: false, current: 0, chanceux: true } },
  ] as const;
  for (const { cause, jeu, o } of armes) it(`arme, ${cause ?? 'passage à 0'} en '${jeu}' : aperçu et journal disent la nouvelle Localisation`, () => {
    if (jeu === 'aa') setRule('combat-aa-blessures', 'aa');
    const r = coup(o);
    expect(r.auJet.cause).toBe(cause);
    expect(r.auJet.critLocation, 'la Localisation est relancée à la naissance du coup').toBeDefined();
    expect(r.auJet.ligne, 'aperçu').toContain(relancee(r.cible, r.auJet.critLocation!));
    expect(ligneDuJournal(), 'journal').toContain(relancee(r.cible, r.auJet.critLocation!));
  });

  it("Projectile, Incantation critique : le journal dit la nouvelle Localisation (LDB 46 l.30)", () => {
    const { mage, cible } = carreauEnCombat();
    useGame.setState({ net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined } });
    cible.important = true;
    cible.wounds = { current: 20, max: 20 } as Combatant['wounds'];
    const sort = findSpell('Carreau')!;
    const finales: MissileResult[] = [];
    const lache = bus.on(EVT.ANIM_ATTACK, (p: { kind: string; to: string; result: MissileResult }) => { if (p.kind === 'spell' && p.to === cible.id) finales.push(p.result); });
    try {
      applyCast(useGame.getState, useGame.setState, mage, cible, sort, evaluateMissile(mage, cible, sort, incantationCritique), true, false, 'critique');
      draineCascade(useGame.getState, 200, () => 50);
    } finally { lache(); }
    const ligne = journal().find((l) => l.startsWith(`${mage.label} lance ${sort.label} sur ${cible.label}`)) ?? '';
    expect(ligne).toContain(relancee(cible, finales[0].location!));
  });

  it('contre-témoin, Empoignade sur un double : la Localisation née relancée ne qualifie aucune ligne (LDB 14 l.159)', () => {
    const r = coup({ roll: 44, current: 20, grapple: true });
    expect(r.auJet.critLocation, 'le coup naît avec sa Localisation relancée').toBeDefined();
    const touche = `(${locationLabel('corps', r.cible.bodyShape)})`;
    expect(r.auJet.ligne, 'aperçu').toContain(touche);
    expect(ligneDuJournal(), 'journal').toContain(touche);
  });
});
