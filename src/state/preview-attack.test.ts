import { describe, it, expect } from 'vitest';
import { FLOWS } from './rollFlowSpecs';
import { ARME_INTROUVABLE } from './mount';
import { attackWeaponOf } from './combatFlow';
import type { PendingAttack } from './pendings';
import type { RollBreakdown } from '../engine/combat';
import { useGame } from './store';
import { previewAttack, previewDefense, defenseDodgeMods, resolveAttack, eligibleAttackTargetIds, outOfSightTargetIds, attackPlan, resolveDualSecond } from './combatFlow';
import { attackModifiers, bestRangedDefense, combatBaseValue, combatValue, combineMods, type ModLine } from '../engine/combat';
import { clampTarget } from '../engine/tests';
import { setRule, resetRule } from '../engine/policy';
import { volatileCharLines } from '../engine/characteristics';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import { inexplique } from './cascadeTestKit';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { Scene } from './scene';

/**
 * LOT 3 (R4) — `previewAttack` rejoue le MÊME env + modificateurs que la résolution, sans tirer le dé :
 * l'aperçu affiché AVANT « Lancer » ne doit jamais mentir (parité aperçu↔jet).
 */
const combatant = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'A', label: 'A', kind: 'hero',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 35, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 8, h: 8 }, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(64).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

// Mode local : l'actif héros est piloté à la main (`controlsCombatant` → surfaçage des cibles éligibles).
const NET_LOCAL = { mode: 'local', mySeat: 0, ownership: {}, slots: [0, 0, 0, 0] };
const mkGet = (combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: scene(), battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;

describe('previewAttack — parité aperçu ↔ résolution (R4)', () => {
  it('la valeur de toucher prévue == la cible du jet réellement résolu', () => {
    const a = combatant({ id: 'A', advantage: 1 });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const get = mkGet([a, b]);
    const preview = previewAttack(get, a, b);
    expect(preview.inRange).toBe(true);
    seedBattleRng(1);
    const r = resolveAttack(get, a, b);
    expect(r).not.toBeNull();
    expect(preview.target).toBe(r!.res.attackerDetail!.target); // l'aperçu ne ment pas
  });

  it('estimation de dégâts : dmg = arme + Force, soak = Endurance + PA', () => {
    const a = combatant({ id: 'A' }); // F 35 → BF 3 ; Épée +BF+4 → 7
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as never }); // E 35 → BE 3, PA corps 2
    const p = previewAttack(mkGet([a, b]), a, b, 'corps');
    expect(p.dmg).toBe(7);
    expect(p.soak).toBe(5); // BE 3 + PA 2
  });

  it('mêlée hors de portée (au-delà de l’Allonge) → inRange false', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 5, y: 0 } });
    expect(previewAttack(mkGet([a, b]), a, b).inRange).toBe(false);
  });

  it('le surnombre (2 contre 1) augmente la valeur de toucher prévue de +20 (LDB 14 l.110)', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const ally = combatant({ id: 'A2', pos: { x: 1, y: 1 } }); // 2e attaquant au contact de B
    const solo = previewAttack(mkGet([a, b]), a, b).target;
    const duo = previewAttack(mkGet([a, ally, b]), a, b).target;
    expect(duo - solo).toBe(20);
  });

  it('choix d’arme : previewAttack(weaponUid) prend l’arme choisie + applique le -20 main secondaire, parité résolution', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [
      { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], hand: 'main', hands: 1, uid: 'm' },
      { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [], hand: 'off', hands: 1, uid: 'o' },
    ] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const get = mkGet([a, b]);
    const main = previewAttack(get, a, b); // auto → Épée (main), aucune pénalité
    expect(main.weapon.label).toBe('Épée');
    expect(main.mods.some((m) => m.label === 'Main secondaire')).toBe(false);
    expect(main.difficulty, 'sans circonstance, la Difficulté de combat déclarée').toBe('intermediaire');
    const off = previewAttack(get, a, b, undefined, { weaponUid: 'o' }); // Dague (main secondaire) → -20
    expect(off.weapon.label).toBe('Dague');
    // « Attaquer avec votre main secondaire » est une entrée −20 du Tableau des Difficultés de Combat
    // (LDB 14) : elle COMPOSE le palier de la ligne au lieu d'y flotter en chip (#1153 L3b).
    expect(off.difficulty).toBe('difficile');
    expect(off.difficultyParts?.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
    expect(off.mods.some((m) => m.label === 'Main secondaire')).toBe(false);
    expect(off.target, 'le −20 reste porté par la cible, palier ou chip').toBe(main.target - 20);
    seedBattleRng(2);
    const r = resolveAttack(get, a, b, undefined, undefined, undefined, undefined, off.weapon);
    expect(r!.weapon.label).toBe('Dague'); // parité : la résolution utilise la même arme choisie
  });

  it('eligibleAttackTargetIds : seuls les ennemis vivants à portée sont éligibles', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } }); // épée, Allonge Moyenne = 1 case
    const near = combatant({ id: 'E1', kind: 'enemy', pos: { x: 1, y: 0 } }); // adjacent → éligible
    const far = combatant({ id: 'E2', kind: 'enemy', pos: { x: 5, y: 0 } }); // hors de portée → non
    const dead = combatant({ id: 'E3', kind: 'enemy', pos: { x: 1, y: 1 }, wounds: { current: 0, max: 10 } as never }); // mort → non
    const get = (() => ({ scene: scene(), battle: { combatants: [a, near, far, dead], order: ['A', 'E1', 'E2', 'E3'], turn: 0, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;
    const ids = eligibleAttackTargetIds(get);
    expect(ids.has('E1')).toBe(true);
    expect(ids.has('E2')).toBe(false);
    expect(ids.has('E3')).toBe(false);
  });

  it('tir sans Ligne de Vue → blocked', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    const s = scene();
    (s.layers[0].tiles as string[])[3] = 'mur'; // mur intercalé sur la ligne (x=3,y=0)
    const get = (() => ({ scene: s, battle: { combatants: [a, b], movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;
    expect(previewAttack(get, a, b).blocked).toBe(true);
  });

  it('outOfSightTargetIds (grisage hors-LdV) : ennemi derrière un mur grisé au tir, pas en mêlée, pas les morts', () => {
    const s = scene();
    (s.layers[0].tiles as string[])[3] = 'mur'; // mur sur la ligne y=0 entre x=0 et x=6
    const archer = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never });
    const hidden = combatant({ id: 'E1', kind: 'enemy', pos: { x: 6, y: 0 } }); // derrière le mur
    const seen = combatant({ id: 'E2', kind: 'enemy', pos: { x: 0, y: 5 } }); // ligne dégagée
    const deadHidden = combatant({ id: 'E3', kind: 'enemy', pos: { x: 6, y: 1 }, wounds: { current: 0, max: 10 } as never });
    const mk = (cs: Combatant[], order: string[]) =>
      (() => ({ scene: s, battle: { combatants: cs, order, turn: 0, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;
    const ids = outOfSightTargetIds(mk([archer, hidden, seen, deadHidden], ['A', 'E1', 'E2', 'E3']));
    expect(ids.has('E1')).toBe(true);
    expect(ids.has('E2')).toBe(false);
    expect(ids.has('E3')).toBe(false);
    // En mêlée la LdV ne bloque pas le ciblage → aucun grisage.
    const swordsman = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    expect(outOfSightTargetIds(mk([swordsman, hidden, seen], ['A', 'E1', 'E2'])).size).toBe(0);
  });

  it('décomposition : target = base NUE + Σ mods (somme BRUTE — le plafond a sa propre ligne)', () => {
    const a = combatant({ id: 'A', advantage: 1 });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const p = previewAttack(mkGet([a, b]), a, b);
    // La somme est BRUTE depuis #1153 L3a : re-combiner (`combineMods`) amputerait la ligne de plafond
    // que l'aperçu vient d'émettre. C'est `inexplique === 0` qui juge, comme partout ailleurs.
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
    expect(p.base, 'base = valeur de combat NUE').toBe(combatBaseValue(a, 'melee', p.weapon));
    expect(p.base).toBe(50); // CC 50, pas de Spé
  });

  it('issue #202 — buff de Caractéristique (Bénédiction de Bataille +10 CC) : target INCHANGÉ, base amputé, ligne étiquetée `famille: \'jet\'`', () => {
    const a = combatant({ id: 'A', activeEffects: [{ label: 'Bénédiction de Bataille', char: 'capacite-de-combat', bonus: 10 }] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const withoutBuff = previewAttack(mkGet([combatant({ id: 'A' }), b]), combatant({ id: 'A' }), b);
    const withBuff = previewAttack(mkGet([a, b]), a, b);
    expect(withBuff.target).toBe(withoutBuff.target + 10); // le buff reste bien PORTÉ au jet (byte-identique à l'avant-split)
    expect(withBuff.base).toBe(withoutBuff.base); // le +10 est sorti de `base` vers une ModLine
    expect(inexplique({ base: withBuff.base, mods: withBuff.mods, target: withBuff.target, difficulty: withBuff.difficulty })).toBe(0);
    const line = withBuff.mods.find((m) => m.label === 'Bénédiction de Bataille');
    expect(line).toEqual({ label: 'Bénédiction de Bataille', value: 10, famille: 'jet' });
  });
});

/**
 * #1153 L3a — l'aperçu affiche la cible que `rollTest` jettera. Deux grandeurs y sont confrontées :
 * la cible NON ÉCRÊTÉE (`combatValue + combineMods(mods)`, la somme combinée seule) et la cible
 * RENDUE — leur écart est l'amputation du plafond des Difficultés, portée par sa propre ligne, plus
 * la borne `targetMax` de `clampTarget`.
 */
const cibleNonEcretee = (a: Combatant, kind: 'melee' | 'ranged', w: Combatant['weapons'][number], mods: ModLine[]): number =>
  combatValue(a, kind, w) + combineMods(mods);

describe('previewAttack — plafond des Difficultés NOMMÉ et cible écrêtée (#1153 L3a)', () => {
  const foe = () => combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
  const hors = (p: { mods: ModLine[] }) => p.mods.filter((m) => m.label !== 'plafond Difficultés');

  it('NOMINAL (aucun plafond, aucune borne) : la cible rendue EST la cible non écrêtée', () => {
    const a = combatant({ id: 'A', advantage: 1 });
    const b = foe();
    const p = previewAttack(mkGet([a, b]), a, b);
    expect(p.target).toBe(cibleNonEcretee(a, 'melee', p.weapon, hors(p)));
    expect(p.mods.some((m) => m.label === 'plafond Difficultés')).toBe(false);
    expect(p.clamped).toBeUndefined();
  });

  it('CIRCONSTANCES mordantes : cible INCHANGÉE, amputation NOMMÉE dans la composition du palier', () => {
    // Deux entrées de la TABLE des Difficultés de Combat : Localisation visée −20 (`LDB 14 l.73`) et
    // Main secondaire −20 (l.78). Σ = −40 → la combinaison plafonne à −30 (l.95). Le plafond ne borne
    // QUE cette famille : c'est le seul régime où il mord.
    const gauchere = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], hand: 'off' };
    const a = combatant({ id: 'A', weapons: [gauchere] as never });
    const b = foe();
    const p = previewAttack(mkGet([a, b]), a, b, 'tete');
    const mods = attackModifiers(a, b, p.weapon, { kind: 'melee', location: 'tete' });
    const somme = mods.reduce((s, m) => s + m.value, 0);
    const combine = combineMods(mods);
    expect(somme, 'la fixture doit VRAIMENT franchir le plafond des malus').toBe(-40);
    expect(combine).toBe(-30);

    expect(p.target, 'la cible ne bouge pas d’un point').toBe(cibleNonEcretee(a, 'melee', p.weapon, mods));
    // L'amputation reste imputable : elle est une COMPOSANTE du palier dérivé (`LDB 14 l.95` : « le
    // Test devient simplement Très Difficile (-30) »), jamais un résidu muet en chip « autres ».
    expect(p.difficulty).toBe('tresDifficile');
    expect(p.difficultyParts?.find((m) => m.label === 'plafond Difficultés')?.value).toBe(combine - somme);
    expect(p.mods.some((m) => m.famille === 'circonstance'), 'le palier porte les circonstances').toBe(false);
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
  });

  it('les ÉTATS du jeteur ne se plafonnent PAS : 4 pions Exténué pèsent −40 sur la cible (LDB 16 l.11)', () => {
    // « si vous avez 3 États *Exténué*, vous subissez une pénalité de -30 à tous vos Tests » — la
    // règle d'accumulation serait morte au 4ᵉ pion si le plafond des Difficultés (LDB 14 l.95) la bornait.
    const trois = combatant({ id: 'A', conditions: [{ id: 'extenue', value: 3 }] as never } as never);
    const quatre = combatant({ id: 'A', conditions: [{ id: 'extenue', value: 4 }] as never } as never);
    const b = foe();
    const sain = previewAttack(mkGet([combatant({ id: 'A' }), b]), combatant({ id: 'A' }), b);
    const p3 = previewAttack(mkGet([trois, b]), trois, b);
    const p4 = previewAttack(mkGet([quatre, b]), quatre, b);
    expect(p3.target).toBe(sain.target - 30);
    expect(p4.target).toBe(sain.target - 40);
    expect(p4.mods.find((m) => m.label.includes('Exténué'))).toMatchObject({ value: -40, famille: 'jet' });
    expect(inexplique({ base: p4.base, mods: p4.mods, target: p4.target, difficulty: p4.difficulty })).toBe(0);
  });

  it('BORNE : l’Avantage hors plafond ne promet plus une cible > 99 que le jet n’atteindra jamais', () => {
    const a = combatant({ id: 'A', advantage: 6 }); // CC 50 + 60 hors plafond = 110
    const b = foe();
    const p = previewAttack(mkGet([a, b]), a, b);
    const nonEcretee = cibleNonEcretee(a, 'melee', p.weapon, hors(p));
    expect(nonEcretee, 'la fixture doit franchir la borne — sinon le test ne mesure rien').toBe(110);
    expect(p.target).toBe(clampTarget(nonEcretee).target);
    expect(p.target).toBe(99);
    expect(p.clamped, 'écrêtage MESURÉ → la chip « plafond 99 » devient nommable').toBe(-11);
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty, clamped: p.clamped })).toBe(0);
  });

  it('la BORNE suit la POLICY : « Tests supérieurs à 100 % » (LDB 12 l.73-77) active ⇒ cible 110, aucun écrêtage', () => {
    // La borne n'est pas un nombre en dur du monteur : `clampTarget` lit `targetMax`, que la règle
    // optionnelle `test-over-100` porte à 999 (`engine/testPolicy.ts`). Le même aperçu rend alors la
    // cible entière, et le DR gagne ses tranches au-delà de 100 (LDB 12 l.77).
    const a = combatant({ id: 'A', advantage: 6 });
    const b = foe();
    setRule('test-over-100', true);
    try {
      const p = previewAttack(mkGet([a, b]), a, b);
      expect(p.target).toBe(110);
      expect(p.clamped).toBeUndefined();
      expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
    } finally {
      resetRule('test-over-100');
    }
  });

  /**
   * SONDE PROMUE (#1153 L3a) — les DEUX lignes volatiles de Caractéristique du pool non-cumul
   * (meilleur bonus ET pire pénalité, `volatileCharLines`) sur un vrai `Combatant` : un buff magique
   * et une SÉQUELLE réelle (`traumaById`), sur une arme à Résolution ALTERNATIVE (`resolveChar`,
   * ADE II 8 l.233) pour que la carac du jet soit celle que la séquelle frappe. Elles vivent DANS
   * `combatBaseValue` (via `effectiveChar`) : les afficher sans les retirer de la base doublerait le
   * compte, et leur ligne doit porter le nom de SON octroyeur, jamais un libellé de famille partagé.
   */
  it('POOL non-cumul : buff ET séquelle sortent de la base en lignes DISTINCTES, cible intacte', () => {
    const trauma = traumaById(dechirureFractureFicheId('fracture', 'majeur', 'corps'), undefined, 'corps');
    const belier = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], resolveChar: 'force' } as never;
    const a = combatant({
      id: 'A', weapons: [belier], traumas: [trauma] as never,
      activeEffects: [{ label: 'Bénédiction de Bataille', char: 'force', bonus: 10 }] as never,
    } as never);
    const b = foe();
    const lignes = volatileCharLines(a, 'force');
    expect(lignes.map((l) => l.value), 'la fixture doit produire LES DEUX lignes du pool').toEqual([10, -30]);

    const p = previewAttack(mkGet([a, b]), a, b);
    expect(p.weapon.label, 'l’aperçu doit bien tirer l’arme à Résolution alternative').toBe('Bélier');
    expect(p.base, 'les deux lignes sont SORTIES de la base').toBe(combatBaseValue(a, 'melee', belier) + 20);
    // La ligne REBASÉE se recolle à la grandeur du moteur : valeur de combat FONDUE (les volatiles
    // dedans) + les seuls modificateurs SITUATIONNELS combinés. Les lignes du pool ne sont donc
    // comptées qu'une fois — les verser dans `combineMods` les compterait deux.
    const noms = new Set(lignes.map((l) => l.label));
    const situationnels = p.mods.filter((m) => !noms.has(m.label) && m.label !== 'plafond Difficultés');
    expect(p.base + p.mods.reduce((s, m) => s + m.value, 0))
      .toBe(combatValue(a, 'melee', belier) + combineMods(situationnels));
    const labels = p.mods.map((m) => m.label);
    expect(new Set(labels).size, 'aucun libellé dupliqué : chaque composante nomme SON octroyeur').toBe(labels.length);
    expect(labels).toContain('Bénédiction de Bataille');
    expect(labels).toContain(trauma.label);
    expect(inexplique({ base: p.base, mods: p.mods, target: p.target, difficulty: p.difficulty })).toBe(0);
  });
});

describe('resolveDualSecond — la 2ᵉ frappe vise la cible que le moteur jetterait (#1153 L3a)', () => {
  it('BORNE : la cible de la 2ᵉ frappe est écrêtée à 99 comme tout autre jet (`rollTest`)', () => {
    const a = combatant({ id: 'A', advantage: 6, weapons: [
      { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], hand: 'main', hands: 1, uid: 'm' },
      { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [], hand: 'main', hands: 1, uid: 'o' },
    ] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never });
    const off = a.weapons[1];
    seedBattleRng(7);
    const res = resolveDualSecond(mkGet([a, b]), a, b, off, 50, { critValue: 30 });
    const avant = cibleNonEcretee(a, 'melee', off, attackModifiers(a, b, off, { kind: 'melee' }));
    expect(avant, 'la fixture franchit la borne').toBe(110);
    expect(res.attackerDetail!.target, 'la 2ᵉ frappe est bornée comme les autres jets').toBe(99);
  });

  it('MODS AU JET : la 2ᵉ frappe subit la somme ENTIÈRE des pénalités du jeteur (−40)', () => {
    // État Aveuglé ×2 (−20, `LDB 16`) + Maladresse du Round précédent (`LDB 14 l.26` ; −20 en fixture) : deux
    // modificateurs du JETEUR, hors table des Difficultés de Combat — rien à plafonner (l.48/95).
    const a = combatant({ id: 'A', conditions: [{ id: 'aveugle', value: 2 }] as never, nextActionPenalty: 20, weapons: [
      { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], hand: 'main', hands: 1, uid: 'm' },
      { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, reach: 'Très courte', qualities: [], hand: 'main', hands: 1, uid: 'o' },
    ] as never } as never);
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never });
    const off = a.weapons[1];
    const mods = attackModifiers(a, b, off, { kind: 'melee' });
    const somme = mods.reduce((s, m) => s + m.value, 0);
    expect(somme, 'les deux sources somment −40 brut').toBe(-40);
    expect(mods.every((m) => m.famille === 'jet'), 'aucune entrée de la table ici').toBe(true);
    expect(combineMods(mods), 'aucun plafond ne mord sur des mods au jet').toBe(-40);

    seedBattleRng(7);
    const res = resolveDualSecond(mkGet([a, b]), a, b, off, 50, { critValue: 30 });
    expect(res.attackerDetail!.target).toBe(combatValue(a, 'melee', off) - 40);
  });
});

describe('attackPlan — gate PRÉ-clic du tir (parité avec le refus de sort)', () => {
  // Arc de Portée 4 m : bande Extrême ≤ ×3 = 12 m = 6 cases (1 case = 2 m).
  const archer = (over: Partial<Combatant> = {}) =>
    combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 4, qualities: [] }] as never, ...over });

  it('cible sans Ligne de Vue → blocked (la modale ne s’ouvre jamais)', () => {
    const a = archer();
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    const s = scene();
    (s.layers[0].tiles as string[])[3] = 'mur';
    const get = (() => ({ scene: s, battle: { combatants: [a, b], movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;
    const plan = attackPlan(get, a, b);
    expect(plan.kind).toBe('blocked');
    expect((plan as { reason: string }).reason).toMatch(/ligne de vue/i);
  });

  it('au-delà de Portée ×3 → blocked « hors de portée » ; à exactement ×3 → attack', () => {
    const a = archer();
    const far = combatant({ id: 'B', kind: 'enemy', pos: { x: 7, y: 0 } }); // 14 m > 12 m
    const edge = combatant({ id: 'C', kind: 'enemy', pos: { x: 6, y: 0 } }); // 12 m = Extrême
    const get = mkGet([a, far, edge]);
    const out = attackPlan(get, a, far);
    expect(out.kind).toBe('blocked');
    expect((out as { reason: string }).reason).toMatch(/hors de portée/i);
    expect(attackPlan(get, a, edge).kind).toBe('attack');
  });
});

/**
 * PARITÉ PRÉ/POST-JET de la Difficulté (#1153 L4) — la ligne RÉSOLUE dit la MÊME chose que le
 * pré-jet : même Difficulté (texte ET modificateur), mêmes chips, même cible. Avant ce lot, le
 * post-jet (`bd`, `engine/combat.ts`) recevait les modificateurs BRUTS : la Difficulté disparaissait
 * de la ligne au moment du résultat et les circonstances y ressortaient en chips — deux écrans pour
 * un seul jet. Le tir MOBILE à courte portée est choisi parce que sa combinaison ne tombe sur AUCUN
 * cran de l'échelle : c'est le régime « Combinée » qui doit traverser le jet intact.
 */
describe('Difficulté — parité PRÉ-jet ↔ ligne RÉSOLUE (#1153 L4)', () => {
  const archer = () => combatant({
    id: 'A', pos: { x: 0, y: 0 },
    weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never,
  });
  /** Le tireur a DÉJÀ bougé ce Round (`LDB 14 l.70` : −10) — lu à l'identique par l'aperçu et par la résolution. */
  const getMobile = (combatants: Combatant[]): (() => GameState) =>
    (() => ({ scene: scene(), battle: { combatants, movementUsed: 1 }, facing: {}, gameTime: 0, log: () => {}, net: NET_LOCAL })) as unknown as () => GameState;

  it('tir mobile à courte portée : le résultat annonce la MÊME Difficulté combinée que l’aperçu', () => {
    const a = archer();
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 3, y: 0 } });
    const get = getMobile([a, b]);
    const p = previewAttack(get, a, b);
    expect(p.difficultyCombined, 'la fixture doit VRAIMENT tomber hors des crans — sinon elle ne juge pas le régime').toEqual(expect.any(Number));
    seedBattleRng(3);
    const r = resolveAttack(get, a, b);
    const d = r!.res.attackerDetail!;
    expect(d.difficulty).toBe(p.difficulty);
    expect(d.difficultyCombined).toBe(p.difficultyCombined);
    expect(d.difficultyParts?.map((m) => `${m.label} ${m.value}`)).toEqual(p.difficultyParts?.map((m) => `${m.label} ${m.value}`));
    expect(d.mods?.map((m) => `${m.label} ${m.value}`)).toEqual(p.mods.filter((m) => m.famille === 'jet').map((m) => `${m.label} ${m.value}`));
    expect(d.target, 'la cible du jet est celle que l’aperçu promettait').toBe(p.target);
    expect(inexplique({ base: d.base, mods: d.mods, target: d.target, difficulty: d.difficulty, difficultyCombined: d.difficultyCombined, clamped: d.clamped })).toBe(0);
  });

  it('mêlée à la Localisation visée : le résultat annonce le MÊME cran (−20) que l’aperçu', () => {
    const a = combatant({ id: 'A' });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const get = mkGet([a, b]);
    const p = previewAttack(get, a, b, 'tete');
    expect(p.difficulty, 'entrée de la table `LDB 14 l.73`').toBe('difficile');
    seedBattleRng(4);
    const r = resolveAttack(get, a, b, 'tete');
    const d = r!.res.attackerDetail!;
    expect(d.difficulty).toBe('difficile');
    expect(d.difficultyCombined).toBeUndefined();
    expect(d.difficultyParts?.map((m) => m.label)).toEqual(p.difficultyParts?.map((m) => m.label));
    expect(d.target).toBe(p.target);
    expect(inexplique({ base: d.base, mods: d.mods, target: d.target, difficulty: d.difficulty, clamped: d.clamped })).toBe(0);
  });

  /**
   * RANGÉE DÉFENSE — la ligne adverse du pré-jet annonce la Difficulté que le défenseur subira
   * VRAIMENT. Sous la neige épaisse (`LDB 14 l.82`), la résolution passe la pénalité d'esquive au
   * jet ; l'aperçu l'ignorait et disait « Intermédiaire (+0) » quand le résultat dirait « Très
   * difficile (−30) ». Les deux lisent désormais la même liste (`defenseTargetMods`) et la même
   * pénalité de contexte (`defenseDodgeMods`).
   */
  it('la rangée DÉFENSE dit la même Difficulté avant et après le jet (neige épaisse)', () => {
    const a = combatant({ id: 'A' });
    // Défenseur SANS arme et bien plus Agile que combattant : sa meilleure défense est l'Esquive —
    // la seule que la neige épaisse pénalise (`LDB 14 l.82`).
    const b = combatant({
      id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never,
      characteristics: { 'capacite-de-combat': 25, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 70, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    });
    const neige = (): GameState => ({ ...mkGet([a, b])(), scene: { ...scene(), weather: 'neige' } }) as unknown as GameState;
    const dodge = defenseDodgeMods(neige(), b);
    expect(dodge.map((m) => m.value), 'la fixture doit VRAIMENT porter la pénalité de neige').toEqual([-30]);

    const pending = previewDefense(b, { vsWeapon: a.weapons[0], dodgeMods: dodge });
    expect(pending.label).toBe('Esquive');
    expect(pending.difficulty, 'la circonstance compose le palier').toBe('tresDifficile');

    seedBattleRng(6);
    const r = resolveAttack(neige, a, b);
    const dd = r!.res.defenderDetail!;
    expect(dd.difficulty, 'le résultat dit la MÊME Difficulté que la rangée pré-jet').toBe(pending.difficulty);
    expect(dd.difficultyParts?.map((m) => `${m.label} ${m.value}`)).toEqual(pending.difficultyParts?.map((m) => `${m.label} ${m.value}`));
    expect(inexplique({ base: dd.base, mods: dd.mods, target: dd.target, difficulty: dd.difficulty, difficultyCombined: dd.difficultyCombined, clamped: dd.clamped })).toBe(0);
  });

  /**
   * MÊME contrat pour le TIR DÉFENDU (`LDB 13 l.135` : Protectrice 2+ / Bout Portant / tireur Engagé).
   * La pénalité d'esquive du contexte ne dépend pas de l'arme qui attaque — « Attaquer ou esquiver
   * dans une haute épaisseur de neige » la donne aux DEUX (`LDB 14 l.82`) — mais la résolution du tir
   * ne la passait pas : le pré-jet disait « Très difficile (−30) » et le résultat « Intermédiaire ».
   */
  it('TIR DÉFENDU : la rangée défense et le jet résolu disent la même Difficulté (neige)', () => {
    const archer = combatant({
      id: 'A', pos: { x: 0, y: 0 },
      weapons: [{ label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] }] as never,
    });
    // Défenseur AGILE (Esquive = meilleure défense) et au CONTACT : à bout portant, le tir s'oppose (LDB 14 l.40).
    const b = combatant({
      id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never,
      characteristics: { 'capacite-de-combat': 25, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 70, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    });
    const neige = (): GameState => ({ ...mkGet([archer, b])(), scene: { ...scene(), weather: 'neige' } }) as unknown as GameState;
    const dodge = defenseDodgeMods(neige(), b);
    expect(dodge.map((m) => m.value), 'la fixture doit VRAIMENT porter la pénalité de neige').toEqual([-30]);

    const rd = bestRangedDefense(archer, b, archer.weapons[0], 1, true, 2);
    expect(rd?.mode, 'la fixture doit VRAIMENT ouvrir une défense au tir').toBe('esquive');
    const pending = previewDefense(b, { mode: rd!.mode, parryWeapon: rd!.parryWeapon, vsWeapon: archer.weapons[0], dodgeMods: dodge });
    expect(pending.difficulty).toBe('tresDifficile');

    seedBattleRng(8);
    const dd = resolveAttack(neige, archer, b)!.res.defenderDetail!;
    expect(dd.difficulty, 'le tir défendu applique la MÊME pénalité d’esquive que l’aperçu').toBe(pending.difficulty);
    expect(dd.difficultyParts?.map((m) => `${m.label} ${m.value}`)).toEqual(pending.difficultyParts?.map((m) => `${m.label} ${m.value}`));
    expect(inexplique({ base: dd.base, mods: dd.mods, target: dd.target, difficulty: dd.difficulty, difficultyCombined: dd.difficultyCombined, clamped: dd.clamped })).toBe(0);
  });

  /**
   * CÂBLAGE de la CHANCE, mesuré sur le CHEMIN RÉEL (l'action publique `FLOWS.attack.bonusSL`, celle
   * que la modale appelle sur le STORE) et non sur la présence d'un argument dans le source : un
   * paramètre nommé `compo` qui vaudrait `undefined` passerait tous les scans. Dépenser un point de
   * Chance relève le DR — jamais la Difficulté ni ses chips.
   */
  it('la CHANCE re-dérive sans changer la Difficulté annoncée (action réelle du flux)', () => {
    const a = combatant({ id: 'A', kind: 'hero', fortune: 2 } as never);
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    useGame.setState({
      // Neige épaisse : la scène pose une circonstance d'attaque (LDB 14 l.82) dans l'`env` — c'est
      // EXACTEMENT ce que la re-dérivation ne reçoit plus. Sans elle, la fixture ne discrimine rien.
      mode: 'battle', scene: { ...scene(), weather: 'neige' }, party: [a], gameTime: 0,
      battle: { combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn: 0, round: 1, movementUsed: 0, acted: false, log: [], over: null, action: null, selectedSpellId: null, reachable: new Map() },
      net: { mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
    } as never);
    seedBattleRng(5);
    const r = resolveAttack(useGame.getState, a, b, 'tete')!; // Localisation visée : entrée de la table (−20)
    const avant = r.res.attackerDetail!;
    expect(avant.difficulty, 'la fixture doit VRAIMENT composer un palier depuis l’env').toBe('tresDifficile');

    useGame.setState({ pendingAttack: { attackerId: a.id, targetId: b.id, location: 'tete', result: r.res } } as never);
    FLOWS.attack.bonusSL(useGame.getState, useGame.setState);
    const apres = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(apres.sl, 'la Chance donne bien +1 DR').toBe(avant.sl + 1);
    expect(apres.difficulty, 'la Difficulté ne bouge pas d’un cran').toBe(avant.difficulty);
    expect(apres.difficultyParts?.map((m) => `${m.label} ${m.value}`)).toEqual(avant.difficultyParts?.map((m) => `${m.label} ${m.value}`));
    expect(apres.mods?.map((m) => `${m.label} ${m.value}`)).toEqual(avant.mods?.map((m) => `${m.label} ${m.value}`));
    expect(inexplique({ base: apres.base, mods: apres.mods, target: apres.target, difficulty: apres.difficulty, difficultyCombined: apres.difficultyCombined, clamped: apres.clamped })).toBe(0);
  });

  /**
   * RÉGRESSION DE RECETTE — un TIR à bout portant (l'attaquant porte AUSSI une arme de mêlée) dont on
   * dépense la Chance : la re-dérivation repassait par le choix d'arme (`pickAttackWeaponList`, qui
   * reprend la mêlée dès qu'elle est à portée) et rendait « Corps à corps » avec la base de l'épée,
   * pendant que la Difficulté composée du TIR était transportée telle quelle — d'où une chip
   * « autres » à chaque clic. Le +1 DR ne change QUE le DR : arme, libellé, base, cible, Difficulté
   * et composition sont FIGÉS par la résolution d'origine.
   */
  it('CHANCE sur un TIR à bout portant : rien ne bouge que le DR (l’arme ne se re-choisit pas)', () => {
    const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [], uid: 'bow' };
    const epee = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, reach: 'Moyenne', qualities: [], uid: 'sw' };
    const a = combatant({ id: 'A', kind: 'hero', fortune: 2, pos: { x: 0, y: 0 }, weapons: [arc, epee] } as never);
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } }); // AU CONTACT : la mêlée est à portée
    useGame.setState({
      mode: 'battle', scene: scene(), party: [a], gameTime: 0,
      battle: { combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn: 0, round: 1, movementUsed: 0, acted: false, log: [], over: null, action: null, selectedSpellId: null, reachable: new Map() },
      net: { mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
      pendingAttack: { attackerId: a.id, targetId: b.id, location: null, result: null, weaponUid: 'bow' },
    } as never);
    seedBattleRng(3);
    FLOWS.attack.roll(useGame.getState, useGame.setState);
    const avant = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(avant.label, 'la fixture doit VRAIMENT résoudre un TIR').toBe('Projectiles');

    FLOWS.attack.bonusSL(useGame.getState, useGame.setState);
    const apres = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(apres.sl).toBe(avant.sl + 1);
    expect(apres.label, 'le tir ne devient pas une frappe').toBe(avant.label);
    expect(apres.base, 'la base reste celle de l’arme tirée').toBe(avant.base);
    expect(apres.target).toBe(avant.target);
    expect(apres.difficulty).toBe(avant.difficulty);
    expect(apres.difficultyParts?.map((m) => `${m.label} ${m.value}`)).toEqual(avant.difficultyParts?.map((m) => `${m.label} ${m.value}`));
    expect(inexplique({ base: apres.base, mods: apres.mods, target: apres.target, difficulty: apres.difficulty, difficultyCombined: apres.difficultyCombined, clamped: apres.clamped }), 'aucune chip « autres » à l’écran').toBe(0);
  });
});

/**
 * CHEMIN RÉEL DU BOUTON « +1 DR » (repro de recette #1153) — la modale d'attaque lance par
 * `attackRoll` (`combatSlice`) et influence par `attackBonusSL`, PAS par le `resolve` du flux. Le jet
 * initial ne figeait pas l'arme RÉELLEMENT tirée : la re-dérivation repassait par le choix d'arme
 * (`pickAttackWeaponList`, `mount.ts` — la mêlée l'emporte dès qu'elle est à portée) et un tir au
 * contact devenait « Corps à corps » avec la base des mains nues, la Difficulté composée du TIR
 * restant transportée → chip « autres » à chaque clic.
 */
describe('BOUTON « +1 DR » sur la ligne résolue — le chemin du store fige l’arme (#1153)', () => {
  const arbalete = { label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [], uid: 'it-99' };

  /** Fixture du recetteur : Tireur ADJACENT au Gobelin (les mains nues sont à portée). */
  const ouvrir = (weaponUid?: string) => {
    const a = combatant({ id: 'A', kind: 'hero', fortune: 4, pos: { x: 0, y: 0 }, weapons: [arbalete] } as never);
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never });
    useGame.setState({
      mode: 'battle', scene: scene(), party: [a], gameTime: 0,
      battle: { combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn: 0, round: 1, movementUsed: 0, acted: false, log: [], over: null, action: null, selectedSpellId: null, reachable: new Map() },
      net: { mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
      pendingAttack: { attackerId: a.id, targetId: b.id, location: null, result: null, ...(weaponUid ? { weaponUid } : {}) },
    } as never);
    seedBattleRng(3);
    useGame.getState().attackRoll();
    return useGame.getState().pendingAttack!.result!.attackerDetail!;
  };

  it('arme CHOISIE (`attackSetWeapon`) : 2 clics « +1 DR » ne changent que le DR', () => {
    const avant = ouvrir('it-99');
    expect(avant.label, 'la fixture doit VRAIMENT résoudre un TIR').toBe('Projectiles');
    for (let i = 0; i < 2; i++) useGame.getState().attackBonusSL();
    const apres = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(apres.label, 'le tir ne devient pas une frappe').toBe(avant.label);
    expect(apres.base).toBe(avant.base);
    expect(apres.target).toBe(avant.target);
    expect(apres.difficulty).toBe(avant.difficulty);
    expect(apres.sl).toBe(avant.sl + 2);
    expect(inexplique({ base: apres.base, mods: apres.mods, target: apres.target, difficulty: apres.difficulty, difficultyCombined: apres.difficultyCombined, clamped: apres.clamped }), 'aucune chip « autres »').toBe(0);
  });

  it('arme AUTO-CHOISIE (aucun uid au pending) : le jet FIGE l’arme, la re-dérivation ne la re-choisit pas', () => {
    const avant = ouvrir();
    // Le gel porte sur l'OBJET arme, jamais sur l'uid : `weaponUid` reste le choix du JOUEUR, et son
    // absence discrimine l'attaque naturelle (`attackWeaponOf`, #1026).
    expect(useGame.getState().pendingAttack!.weapon?.uid, 'le jet fige l’arme réellement tirée').toBe('it-99');
    expect(useGame.getState().pendingAttack!.weaponUid, 'l’uid du joueur n’est pas réécrit').toBeUndefined();
    for (let i = 0; i < 2; i++) useGame.getState().attackBonusSL();
    const apres = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(apres.label).toBe(avant.label);
    expect(apres.base).toBe(avant.base);
    expect(apres.target).toBe(avant.target);
    expect(inexplique({ base: apres.base, mods: apres.mods, target: apres.target, difficulty: apres.difficulty, difficultyCombined: apres.difficultyCombined, clamped: apres.clamped })).toBe(0);
  });

  /** Les canaux FRÈRES de la même ligne résolue passent tous par `rederiveAttack`, donc par
   *  `pa.weaponUid` : dé CHOISI (Résilience, `LDB 17 l.68`) et Relance de Chance (`l.56`). */
  it('dé CHOISI et Relance : mêmes arme, base et Difficulté que le jet d’origine', () => {
    const avant = ouvrir('it-99');
    useGame.getState().attackSetForcedRoll(5);
    const force = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(force.label, 'le dé choisi ne re-choisit pas l’arme').toBe(avant.label);
    expect(force.base).toBe(avant.base);
    expect(force.difficulty).toBe(avant.difficulty);
    expect(inexplique({ base: force.base, mods: force.mods, target: force.target, difficulty: force.difficulty, difficultyCombined: force.difficultyCombined, clamped: force.clamped })).toBe(0);

    useGame.getState().attackReroll();
    const relance = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(relance.label).toBe(avant.label);
    expect(relance.base).toBe(avant.base);
    expect(inexplique({ base: relance.base, mods: relance.mods, target: relance.target, difficulty: relance.difficulty, difficultyCombined: relance.difficultyCombined, clamped: relance.clamped })).toBe(0);
  });

  /**
   * LE CAS DE LA RECETTE — l'uid désigne une arme que le combattant ne TIENT pas. `Combatant.weapons`
   * ne porte que le loadout ACTIF (`recomputeLoadout`, `engine/items.ts`) alors que `items` porte
   * toutes les possessions : `weapons.find(uid)` échoue et l'auto-choix reprenait la main — au
   * contact, la mêlée l'emporte, et le TIR résolu devenait « Corps à corps » au premier clic
   * d'influence. L'arme FIGÉE au jet rend la re-dérivation indépendante de la résolution d'uid.
   */
  it('uid HORS loadout actif : le jet fige l’arme tirée, les influences ne re-choisissent pas', () => {
    const arc = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [], uid: 'w-arc' };
    const a = combatant({ id: 'A', kind: 'hero', fortune: 4, pos: { x: 0, y: 0 }, weapons: [arc] } as never);
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never });
    useGame.setState({
      mode: 'battle', scene: scene(), party: [a], gameTime: 0,
      battle: { combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn: 0, round: 1, movementUsed: 0, acted: false, log: [], over: null, action: null, selectedSpellId: null, reachable: new Map() },
      net: { mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
      // `it-99` : uid d'une possession NON tenue (hors loadout actif) — exactement ce que la recette a posé.
      pendingAttack: { attackerId: a.id, targetId: b.id, location: null, result: null, weaponUid: 'it-99' },
    } as never);
    expect(a.weapons.map((w) => w.uid), 'la fixture doit VRAIMENT désigner un uid absent des armes tenues').not.toContain('it-99');

    seedBattleRng(3);
    const vues = ARME_INTROUVABLE.vues;
    useGame.getState().attackRoll();
    expect(ARME_INTROUVABLE.vues, 'l’uid introuvable est CRIÉ, jamais absorbé en silence').toBeGreaterThan(vues);
    const avant = useGame.getState().pendingAttack!.result!.attackerDetail!;

    for (let i = 0; i < 2; i++) useGame.getState().attackBonusSL();
    const apres = useGame.getState().pendingAttack!.result!.attackerDetail!;
    expect(apres.label, 'le jet résolu ne change pas d’arme sous l’influence').toBe(avant.label);
    expect(apres.base).toBe(avant.base);
    expect(apres.target).toBe(avant.target);
    expect(apres.difficulty).toBe(avant.difficulty);
    expect(inexplique({ base: apres.base, mods: apres.mods, target: apres.target, difficulty: apres.difficulty, difficultyCombined: apres.difficultyCombined, clamped: apres.clamped }), 'aucune chip « autres »').toBe(0);
  });
});

/**
 * TIR DÉFENDU + influence — LE cas de la recette (#1153). À bout portant, la cible oppose sa défense
 * (`LDB 14 l.40`) : le résultat porte donc un `defenderDetail`. La re-dérivation branchait sur
 * `finishMelee` dès qu'une défense existait, SANS regarder le type de l'arme : une arbalète repassait
 * par `attackTestLabel(weapon, 'melee')` et `combatValue(attacker, 'melee', …)` — « Corps à corps »,
 * base de Capacité de Combat — pendant que la Difficulté composée du TIR restait transportée, d'où la
 * chip « autres ». Le patron correct est celui de `finishDefenseResult` : brancher par `weapon.type`.
 */
describe('TIR DÉFENDU : les influences ne transforment pas le tir en frappe (#1153)', () => {
  const arbalete = { label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, qualities: [], uid: 'it-99' };

  const ouvrir = () => {
    const a = combatant({ id: 'A', kind: 'hero', fortune: 4, resilience: 2, pos: { x: 0, y: 0 }, weapons: [arbalete] } as never);
    // Cible ADJACENTE et AGILE : à bout portant elle oppose son Esquive → `defenderDetail` posé.
    const b = combatant({
      id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, weapons: [] as never,
      characteristics: { 'capacite-de-combat': 25, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 70, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    });
    useGame.setState({
      mode: 'battle', scene: scene(), party: [a], gameTime: 0,
      battle: { combatants: [a, b], order: [a.id, b.id], baseOrder: [a.id, b.id], turn: 0, round: 1, movementUsed: 0, acted: false, log: [], over: null, action: null, selectedSpellId: null, reachable: new Map() },
      // Pas de siege MJ : l'ennemi n'est pas SURFACE, il oppose donc sa defense automatiquement.
      net: NET_LOCAL,
      pendingAttack: { attackerId: a.id, targetId: b.id, location: null, result: null, weaponUid: 'it-99' },
    } as never);
    seedBattleRng(3);
    useGame.getState().attackRoll();
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.defenderDetail, 'la fixture doit VRAIMENT ouvrir une défense au tir').toBeDefined();
    expect(res.attackerDetail!.label, 'et résoudre un TIR').toBe('Projectiles');
    return res.attackerDetail!;
  };

  const memeLigne = (avant: RollBreakdown, apres: RollBreakdown, quoi: string) => {
    expect(apres.label, `${quoi} : le tir ne devient pas une frappe`).toBe(avant.label);
    expect(apres.base, `${quoi} : la base reste celle du tir`).toBe(avant.base);
    expect(apres.difficulty, `${quoi} : la Difficulté ne bouge pas`).toBe(avant.difficulty);
    expect(apres.difficultyParts?.map((m) => `${m.label} ${m.value}`)).toEqual(avant.difficultyParts?.map((m) => `${m.label} ${m.value}`));
    expect(inexplique({ base: apres.base, mods: apres.mods, target: apres.target, difficulty: apres.difficulty, difficultyCombined: apres.difficultyCombined, clamped: apres.clamped }), `${quoi} : aucune chip « autres »`).toBe(0);
  };

  it('CHANCE « +1 DR » ×2 : la ligne résolue reste le MÊME tir', () => {
    const avant = ouvrir();
    for (let i = 0; i < 2; i++) useGame.getState().attackBonusSL();
    memeLigne(avant, useGame.getState().pendingAttack!.result!.attackerDetail!, '+1 DR');
  });

  it('canaux FRÈRES sur le même tir défendu : dé choisi, Relance, Résilience', () => {
    const avant = ouvrir();
    useGame.getState().attackSetForcedRoll(5);
    memeLigne(avant, useGame.getState().pendingAttack!.result!.attackerDetail!, 'dé choisi');
    useGame.getState().attackReroll();
    memeLigne(avant, useGame.getState().pendingAttack!.result!.attackerDetail!, 'Relance');
    useGame.getState().attackForceSuccess();
    memeLigne(avant, useGame.getState().pendingAttack!.result!.attackerDetail!, 'Résilience');
  });
});

/**
 * ATTAQUE NATURELLE (#1026) — une gratuite de créature (Morsure, Attaque caudale) n'a AUCUNE arme
 * tenue qui la porte : `attackWeaponOf` la synthétise, et son discriminateur est « l'uid du pending ne
 * désigne aucune arme tenue ». Le gel du jet (#1153) fige l'OBJET arme, jamais l'uid : réécrire l'uid
 * avec l'arme auto-choisie transformait la morsure en Fléchette, à l'écran ET aux Dégâts.
 */
describe('ATTAQUE NATURELLE : le gel du jet ne la transforme pas en arme tenue (#1026)', () => {
  it('freeKind morsure + fléchettes tenues : l’arme reste la morsure (mêlée)', () => {
    const flechettes = { label: 'Fléchettes', type: 'ranged', damage: { plusBF: false, flat: 4 }, range: 20, qualities: [], uid: 'it-fl' };
    const a = combatant({
      id: 'A', kind: 'hero', pos: { x: 0, y: 0 }, weapons: [flechettes],
      traits: [{ id: 'morsure', label: 'Morsure', indice: 4 }],
    } as never);
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const battle = { combatants: [a, b] } as never;
    const pa = { attackerId: a.id, targetId: b.id, location: null, result: null, freeKind: 'morsure' } as unknown as PendingAttack;
    expect(attackWeaponOf(battle, a, b, pa).type, 'la morsure est une attaque de MÊLÉE').toBe('melee');

    // Et APRÈS le gel du jet (l'objet arme figé est l'arme TENUE) : la morsure prime toujours.
    const gele = { ...pa, weapon: flechettes } as unknown as PendingAttack;
    expect(attackWeaponOf(battle, a, b, gele).type, 'le gel ne prime jamais sur l’attaque naturelle').toBe('melee');
  });
});
