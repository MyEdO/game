/**
 * LOT 5 — DOCTRINES TACTIQUES data-driven (déterministe, sans dé). Deux volets :
 *  (a) `pickDoctrine` CLASSE correctement à partir de signaux DATA (traits/Intelligence/groups/sorts) et
 *      HONORE l'override `aiDoctrine` en PRIORITÉ ;
 *  (b) chaque doctrine produit un COMPORTEMENT DISTINCT vérifiable vs `standard` (le défaut neutre), prouvant
 *      que les poids effectifs changent réellement le choix de l'IA — SANS toucher une garde RAW.
 *
 * « Un loup ≠ une bande de brigands ≠ une compagnie d'élite ». Pur : `chooseEnemyAction`/`pickDoctrine` sont
 * déterministes ; on donne des Caractéristiques RÉELLES pour que les espérances de dégâts soient chiffrables.
 */
import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, pickDoctrine, type EnemyTurnInput, type CastableSpell } from '../noyau/monde/ai';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant, Weapon } from '../engine/types';
import type { SpellData } from '../data';
import { chebyshev } from '../engine/grid';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const RANGED: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [] };

/** Sort RÉSOLU minimal (`CastableSpell`) pour piloter l'énumération op-driven. */
function spellData(over: Partial<SpellData> = {}): SpellData {
  return { id: 'sp', label: 'Sort', ecole: 'sort', subType: null, family: 'arcane', cn: 0, range: null, target: null, duration: null, desc: '', source: { book: 'LDB', page: 0 }, ...over } as SpellData;
}
function castable(over: Partial<CastableSpell> & { id?: string } = {}): CastableSpell {
  const data = over.data ?? spellData({ id: over.id ?? 'sp', missile: true, damage: 8 });
  return { id: over.id ?? data.id, data, cn: over.cn ?? data.cn ?? 0, range: over.range ?? null, shape: over.shape ?? 'single', landProb: over.landProb ?? 1, focusState: over.focusState ?? 'none', active: over.active ?? false };
}

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const ARMOUR = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 12, max: 12 }, weapons: [MELEE],
    characteristics: { ...CHARS }, advantage: 0, conditions: [], armour: { ...ARMOUR },
    skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}

const scene = emptyScene('scene-test', 24, 24);

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (a) CLASSIFICATION par signaux + OVERRIDE prioritaire
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('pickDoctrine — classification par signaux DATA (pas de nom en dur)', () => {
  it('un LOUP (Bestial, Int animale, mêlée seule) → meute', () => {
    const loup = mk('loup', 'enemy', { x: 0, y: 0 }, {
      traits: [{ id: 'bestial' } as never], characteristics: { ...CHARS, intelligence: 14 }, weapons: [MELEE],
    });
    expect(pickDoctrine(loup, [])).toBe('meute');
  });

  it('un SOLDAT (groupe militaire, ni Bestial ni Stupide) → soldats', () => {
    const soldat = mk('soldat', 'enemy', { x: 0, y: 0 }, { groups: ['soldat'], weapons: [MELEE] });
    expect(pickDoctrine(soldat, [])).toBe('soldats');
  });

  it('un MAGE (possède des sorts, Int vive) → artillerie', () => {
    const mage = mk('mage', 'enemy', { x: 0, y: 0 }, { spells: ['carreau'], weapons: [], characteristics: { ...CHARS, intelligence: 40 } });
    expect(pickDoctrine(mage, [])).toBe('artillerie');
  });

  it('un ZOMBIE (Fabriqué → mindless) → horde', () => {
    const zombie = mk('zombie', 'enemy', { x: 0, y: 0 }, { traits: [{ id: 'fabrique' } as never], weapons: [MELEE] });
    expect(pickDoctrine(zombie, [])).toBe('horde');
  });

  it('une créature STUPIDE → horde (avance droit, immunité psy)', () => {
    const troll = mk('troll', 'enemy', { x: 0, y: 0 }, { traits: [{ id: 'stupide' } as never], weapons: [MELEE] });
    expect(pickDoctrine(troll, [])).toBe('horde');
  });

  it('un TIRAILLEUR (arme à distance + Agilité haute) → tirailleurs', () => {
    const skirm = mk('skirm', 'enemy', { x: 0, y: 0 }, { weapons: [RANGED], characteristics: { ...CHARS, agilite: 45 } });
    expect(pickDoctrine(skirm, [])).toBe('tirailleurs');
  });

  it('une RACAILLE (groupe criminel, sans signal militaire/magique) → racaille', () => {
    const brigand = mk('brigand', 'enemy', { x: 0, y: 0 }, { groups: ['criminel'], weapons: [MELEE] });
    expect(pickDoctrine(brigand, [])).toBe('racaille');
  });

  it('une fixture GÉNÉRIQUE (sans groups/trait/sort, Caractéristiques moyennes) → standard (défaut neutre)', () => {
    const plain = mk('plain', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE] });
    expect(pickDoctrine(plain, [])).toBe('standard');
  });

  it('Caractéristiques ABSENTES (combattant de test minimal) → standard (aucun signal chiffrable)', () => {
    const bare = { id: 'b', label: 'b', kind: 'enemy', pos: { x: 0, y: 0 }, wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never, conditions: [], advantage: 0, armour: {} as never, skills: [], talents: [], movement: 4 } as Combatant;
    expect(pickDoctrine(bare, [])).toBe('standard');
  });

  it('OVERRIDE `aiDoctrine` HONORÉ en PRIORITÉ (court-circuite la sélection auto)', () => {
    // Un loup (signaux → meute) FORCÉ en embuscade par la donnée : l'override gagne.
    const loup = mk('loup', 'enemy', { x: 0, y: 0 }, {
      traits: [{ id: 'bestial' } as never], characteristics: { ...CHARS, intelligence: 14 }, weapons: [MELEE], aiDoctrine: 'embuscade',
    });
    expect(pickDoctrine(loup, [])).toBe('embuscade');
    // EMBUSCADE n'a PAS de signal auto : SEUL l'override la rend sélectionnable.
    const sansOverride = mk('x', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE] });
    expect(pickDoctrine(sansOverride, [])).not.toBe('embuscade');
  });

  it('OVERRIDE invalide ignoré → retombe sur la sélection auto', () => {
    const mage = mk('mage', 'enemy', { x: 0, y: 0 }, { spells: ['carreau'], weapons: [], characteristics: { ...CHARS, intelligence: 40 }, aiDoctrine: 'inexistant' });
    expect(pickDoctrine(mage, [])).toBe('artillerie');
  });

  // #127 — signal RÉEL de charge d'embuscade : l'État Surpris (LDB 16 l.131-139), posé par `applySurprise`
  // (LDB 13 l.52-81) SEULEMENT sur le camp pris en embuscade et JAMAIS sur l'embusqueur, retiré en fin de
  // Round (etats.json `surpris.effects[0]` onRoundEnd) : l'embuscade se lit dans l'ÉTAT, pas dans un override.
  it('un ennemi qui ouvre le combat depuis l’embuscade (héros Surpris) → embuscade AUTO (sans override)', () => {
    const enemy = mk('e', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE] }); // fixture générique (→ standard SANS le signal)
    const surprisedHero = mk('h', 'hero', { x: 1, y: 0 }, { conditions: [{ id: 'surpris', value: 1 } as never] });
    expect(pickDoctrine(enemy, [], [surprisedHero])).toBe('embuscade');
  });

  it('un ennemi VISIBLE (aucun héros Surpris) → PAS d’embuscade auto (reste standard)', () => {
    const enemy = mk('e', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE] });
    const hero = mk('h', 'hero', { x: 1, y: 0 });
    expect(pickDoctrine(enemy, [], [hero])).toBe('standard');
  });

  it('un ennemi lui-même Surpris (victime, pas embusqueur) → PAS embuscade même si un héros l’est aussi', () => {
    const enemy = mk('e', 'enemy', { x: 0, y: 0 }, { weapons: [MELEE], conditions: [{ id: 'surpris', value: 1 } as never] });
    const hero = mk('h', 'hero', { x: 1, y: 0 });
    expect(pickDoctrine(enemy, [], [hero])).not.toBe('embuscade');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// (b) COMPORTEMENTS DISTINCTS vs standard (les poids changent réellement le choix)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('Doctrines — comportements distincts vs standard', () => {
  it('TIRAILLEUR garde la distance : en portée de tir, il TIRE (ne charge pas au contact)', () => {
    const e = mk('e', 'enemy', { x: 10, y: 10 }, { weapons: [RANGED], characteristics: { ...CHARS, agilite: 45 }, movement: 4 });
    const h = mk('h', 'hero', { x: 10, y: 14 }); // à portée, LdV dégagée
    expect(pickDoctrine(e, [])).toBe('tirailleurs');
    const a = chooseEnemyAction(input(e, [h]));
    expect(a.kind).toBe('shoot');
  });

  it('ARTILLERIE pose une ZdE sur un paquet — et la décision ZdE est doctrine-AGNOSTIQUE (op-driven)', () => {
    // NOUVELLE RÉFÉRENCE (op-driven) : il n'y a PLUS de poids `aoePerExtraHero` par doctrine. La valeur d'une
    // ZdE = Σ de la sortie de ses GameOp sur les héros couverts (`spellActionValue`), identique pour TOUTE
    // doctrine. Une ZdE qui couvre 2 héros (16 Blessures-équiv.) bat un missile mono (~10) → castArea, que le
    // lanceur soit classé `standard` OU `artillerie`. La distinction d'artillerie vit dans ses poids
    // de POSITIONNEMENT (dangerAvoid/preferredRange/coverGain), pas dans la valeur des sorts.
    const h1 = mk('h1', 'hero', { x: 10, y: 16 }, { weapons: [MELEE] });
    const h2 = mk('h2', 'hero', { x: 11, y: 16 }, { weapons: [MELEE] }); // collés (un centre couvre les 2)
    const areaSp = castable({ id: 'vortex-d-ames', shape: { area: { radius: 1 } }, range: 30, data: spellData({ id: 'vortex-d-ames', effects: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'wounds', amount: 8 }] } } }) });
    const missileSp = castable({ id: 'carreau', range: 30 });
    const common: Partial<EnemyTurnInput> = { spells: [areaSp, missileSp] };
    // STANDARD (Int 20) ET ARTILLERIE (Int 40) : même décision ZdE (valeur op-driven, pas de poids de doctrine).
    const plain = mk('plain', 'enemy', { x: 10, y: 10 }, { weapons: [], characteristics: { ...CHARS, intelligence: 20 } });
    expect(pickDoctrine(plain, [])).toBe('standard');
    expect(chooseEnemyAction(input(plain, [h1, h2], common)).kind).toBe('castArea');
    const arty = mk('arty', 'enemy', { x: 10, y: 10 }, { weapons: [], spells: ['carreau'], characteristics: { ...CHARS, intelligence: 40 } });
    expect(pickDoctrine(arty, [])).toBe('artillerie');
    expect(chooseEnemyAction(input(arty, [h1, h2], common)).kind).toBe('castArea');
  });

  it('MEUTE prend la proie au FLANC/DOS (flankRear renforcé)', () => {
    // Héros orienté au NORD ; l'ennemi vient du sud. Au contact, la case de DOS (sud) est gratuite.
    const e = mk('e', 'enemy', { x: 10, y: 14 }, {
      traits: [{ id: 'bestial' } as never], characteristics: { ...CHARS, intelligence: 14 }, weapons: [MELEE], movement: 6,
    });
    const h = mk('h', 'hero', { x: 10, y: 10 });
    expect(pickDoctrine(e, [])).toBe('meute');
    const a = chooseEnemyAction(input(e, [h], { facing: { h: 'N' } }));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      expect(chebyshev(a.to, { x: 10, y: 10 })).toBe(1); // au contact
      expect(`${a.to.x},${a.to.y}`).not.toBe('10,9'); // pas plein front (nord)
    }
  });

  it('HORDE avance DROIT sans éviter le danger, là où STANDARD contourne la case exposée', () => {
    // L'ennemi (mêlée) ne peut atteindre QUE `prey` ce tour ; il l'aborde par l'une de deux cases de contact
    // équidistantes. La case EST est plus exposée à un archer ; STANDARD préfère l'OUEST (danger-map),
    // mais la HORDE (dangerAvoid=0) est indifférente → elle prend la case par défaut (la plus directe).
    const prey = mk('prey', 'hero', { x: 10, y: 15 }, { weapons: [] });
    const archer = mk('archer', 'hero', { x: 13, y: 16 }, { weapons: [{ label: 'Fronde', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 6, qualities: [] }] });
    // STANDARD (fixture générique) : contourne par l'ouest (case éloignée de l'archer).
    const plain = mk('plain', 'enemy', { x: 10, y: 10 }, { weapons: [MELEE], movement: 5 });
    expect(pickDoctrine(plain, [])).toBe('standard');
    const aStd = chooseEnemyAction(input(plain, [prey, archer]));
    expect(aStd.kind).toBe('move');
    if (aStd.kind === 'move') expect(aStd.to.x).toBeLessThan(prey.pos!.x); // ouest, à l'abri
    // HORDE (Stupide) : indifférente au danger → ne préfère PAS l'ouest (prend l'est, la case par défaut).
    const horde = mk('horde', 'enemy', { x: 10, y: 10 }, { traits: [{ id: 'stupide' } as never], weapons: [MELEE], movement: 5 });
    expect(pickDoctrine(horde, [])).toBe('horde');
    const aH = chooseEnemyAction(input(horde, [prey, archer]));
    expect(aH.kind).toBe('move');
    if (aH.kind === 'move') expect(aH.to.x).toBeGreaterThanOrEqual(prey.pos!.x); // PAS le contournement prudent
  });

  it('RACAILLE Empêtrée sous 1/3 PB ne FUIT PAS (M=0) : elle se LIBÈRE (recover empetre), pas son tour gâché', () => {
    // Une racaille très entamée déclencherait le repli « doctrine » (retreatBelow 1/3) — MAIS Empêtrée
    // (Mouvement 0) `fleeMove` renverrait `end` (tour perdu). La garde `!empetre` la laisse atteindre le
    // fallback `recover empetre` (se libérer, LDB 16 l.66). (Fix L6 — point B.)
    const rab = mk('rab', 'enemy', { x: 5, y: 5 }, {
      groups: ['criminel'], weapons: [MELEE], movement: 0,
      wounds: { current: 2, max: 12 }, // < 1/3
      conditions: [{ id: 'empetre', value: 1, sourceId: 'h' } as never],
    });
    const h = mk('h', 'hero', { x: 11, y: 11 }); // loin (pas au contact) → aucune mêlée jouable
    expect(pickDoctrine(rab, [])).toBe('racaille');
    expect(chooseEnemyAction(input(rab, [h], { movement: 0 }))).toEqual({ kind: 'recover', state: 'empetre' });
  });

  it('EMBUSCADE ≠ MEUTE : l’embusqué a l’initiative et NE recule JAMAIS (pas de retreatBelow), là où la racaille fuirait', () => {
    // Même fixture très entamée et NON Engagée : la racaille (retreatBelow 1/3) FUIT ; l’embuscade (aucun
    // macro de repli, override-only) reste à l’attaque. Prouve un comportement DISTINCT (≠ identité nominale).
    const lowHP = { current: 2, max: 12 };
    const rab = mk('rab', 'enemy', { x: 5, y: 5 }, { groups: ['criminel'], weapons: [MELEE], wounds: { ...lowHP }, movement: 5 });
    const amb = mk('amb', 'enemy', { x: 5, y: 5 }, { weapons: [MELEE], wounds: { ...lowHP }, movement: 5, aiDoctrine: 'embuscade' });
    const h = mk('h', 'hero', { x: 5, y: 9 }); // à portée d’approche, pas au contact
    expect(pickDoctrine(rab, [])).toBe('racaille');
    expect(pickDoctrine(amb, [])).toBe('embuscade');
    const aRab = chooseEnemyAction(input(rab, [h]));
    const aAmb = chooseEnemyAction(input(amb, [h]));
    // La racaille fuit (s’éloigne du héros) ; l’embuscade fonce dessus (s’en rapproche). Distinction nette.
    expect(aRab.kind).toBe('move');
    expect(aAmb.kind).toBe('move');
    const dist = (p: { x: number; y: number }) => chebyshev(p, h.pos!);
    const d0 = dist({ x: 5, y: 5 }); // distance de départ au héros
    if (aRab.kind === 'move' && aAmb.kind === 'move') {
      expect(dist(aRab.to)).toBeGreaterThan(d0); // racaille S'ÉLOIGNE (repli)
      expect(dist(aAmb.to)).toBeLessThan(d0); // embuscade SE RAPPROCHE (charge l'isolé)
    }
  });

  it('EMBUSCADE auto (signal Surpris, sans override) route bien via `chooseEnemyAction` — flankRear renforcé', () => {
    // Même géométrie que le test MEUTE (proie orientée NORD, ennemi venant du SUD) : le signal d'embuscade
    // (héros Surpris) doit router `chooseEnemyAction` → doctrine `embuscade` (Weff.flankRear=12) SANS override.
    const e = mk('e', 'enemy', { x: 10, y: 14 }, { weapons: [MELEE], movement: 6 });
    const h = mk('h', 'hero', { x: 10, y: 10 }, { conditions: [{ id: 'surpris', value: 1 } as never] });
    expect(pickDoctrine(e, [], [h])).toBe('embuscade');
    const a = chooseEnemyAction(input(e, [h], { facing: { h: 'N' } }));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      expect(chebyshev(a.to, { x: 10, y: 10 })).toBe(1); // au contact
      expect(`${a.to.x},${a.to.y}`).not.toBe('10,9'); // pas plein front (nord)
    }
  });

  it('SOLDATS tiennent la formation : cohésion renforcée → préfèrent la case qui NE les isole PAS de l’escouade', () => {
    // L'ennemi peut aborder `prey` par deux cases de contact équidistantes : l'une PROCHE de l'allié
    // (en formation), l'autre LOIN (isolée > 3 cases de tout allié). La cohésion renforcée des soldats
    // fait pencher pour la case en formation, là où le standard (cohésion faible) prend la case par défaut.
    const prey = mk('prey', 'hero', { x: 10, y: 15 }, { weapons: [] });
    const ally = mk('ally', 'enemy', { x: 6, y: 15 }); // à l'OUEST de la proie → la case de contact ouest reste près de l'allié
    const soldat = mk('soldat', 'enemy', { x: 10, y: 10 }, { groups: ['soldat'], weapons: [MELEE], movement: 5 });
    expect(pickDoctrine(soldat, [soldat])).toBe('soldats');
    const a = chooseEnemyAction(input(soldat, [prey], { squad: [ally] }));
    expect(a.kind).toBe('move');
    if (a.kind === 'move') {
      // la case d'approche reste à portée de soutien de l'allié (chebyshev ≤ ~5, pas la case isolée à l'est)
      expect(a.to.x).toBeLessThanOrEqual(prey.pos!.x);
    }
  });
});
