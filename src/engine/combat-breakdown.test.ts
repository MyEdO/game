import { describe, it, expect } from 'vitest';
import { parseQualityInstance } from './qualities/normalize';
import { resolveMelee, resolveRanged, rangeBandModifier, rangeBandName, attackModifiers, psychDRAdjust, resolveStrayRangedHit, defenseModifiers, rollMeleeDefender, finishMelee, resolveMeleePassive, freeAttackWeapon, resolveBackstabAttack, rederivePassiveAttack, frozenDifficulty, REDERIVATIONS, attackTestLabel, type ModLine, type RollBreakdown } from './combat';
import { evaluateTest, hydrateTR, bumpSL } from './tests';
import { makeRNG } from './dice';
import { Combatant, Weapon, DIFFICULTY_MODIFIERS } from './types';
import { attaqueNaturelle } from './creatureAttacks';
import { ligneDeRegle } from './reglesChiffrees';

const mk = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x',
    name: 'X',
    kind: 'enemy',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 30, endurance: 30, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  }) as unknown as Combatant;

const sword: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [] };

describe('rollMeleeDefender : pénalité de main secondaire APPLIQUÉE au jet de parade (pas que l’affichage)', () => {
  const main: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: 'main', hands: 1, uid: 'm' };
  const off: Weapon = { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: 'off', hands: 1, uid: 'o' };
  it('parer avec l’arme de main secondaire (non Parade) → cible du jet -20 vs main principale', () => {
    const d = mk({ weapons: [main, off] });
    const withMain = rollMeleeDefender(d, 'parade', makeRNG(1), [], main).target;
    const withOff = rollMeleeDefender(d, 'parade', makeRNG(1), [], off).target;
    expect(withMain - withOff).toBe(20);
  });
});

describe('attackModifiers : pénalité de main secondaire (LDB 14 l.181)', () => {
  const off: Weapon = { label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], hand: 'off', hands: 1 };
  const main: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], hand: 'main', hands: 1 };
  it('arme de main secondaire → -20', () => {
    const mods = attackModifiers(mk(), mk(), off, { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
  });
  it('Ambidextre 1× → -10', () => {
    const mods = attackModifiers(mk({ talents: [{ talentId: 'ambidextre', times: 1 }] }), mk(), off, { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-10);
  });
  it('arme de main principale → aucune pénalité', () => {
    const mods = attackModifiers(mk(), mk(), main, { kind: 'melee' });
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
});

describe('parade : pénalité de main secondaire + exception Parade/Défensive (LDB 62 l.151)', () => {
  const parrySpec = { id: 'corps-a-corps', spec: 'parade', characteristic: 'capacite-de-combat', advances: 0 } as any;
  const offShield: Weapon = { label: 'Bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'defensive' }], hand: 'off', hands: 1 };
  it('parade main secondaire : bouclier Défensive + spé Parade → AUCUNE pénalité', () => {
    const mods = defenseModifiers(mk({ skills: [parrySpec] }), 'parade', [], offShield);
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
  it('parade main secondaire SANS spé Parade → -20', () => {
    const mods = defenseModifiers(mk({ skills: [] }), 'parade', [], offShield);
    expect(mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
  });
  it('parade main principale → aucune pénalité', () => {
    const mods = defenseModifiers(mk(), 'parade', [], { ...offShield, hand: 'main' });
    expect(mods.some((m) => m.label === 'Main secondaire')).toBe(false);
  });
});

describe('Taille en combat (T1) + env injecté — attackModifiers (LDB 14 l.118-131 / 85 l.301-303)', () => {
  // bow portée 60, distanceTiles 28 → 56 m ≤ 60 = Moyenne (+0, pas de ligne de portée) : isole la Taille.
  it('tir : mod de Taille de la cible (Grande → +20)', () => {
    const mods = attackModifiers(mk(), mk({ size: 'grande' }), bow, { kind: 'ranged', distanceTiles: 28, env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille (cible)'))?.value).toBe(20);
  });
  it('tir : env injecté (Couvert -20) figure dans les mods', () => {
    const mods = attackModifiers(mk(), mk(), bow, { kind: 'ranged', distanceTiles: 28, env: [{ label: 'Couvert (moyenne)', value: -20, famille: 'circonstance' }] });
    expect(mods.find((m) => m.label.startsWith('Couvert'))?.value).toBe(-20);
  });
  it('+10 au plus petit en mêlée (attaquant Petite vs cible Moyenne, LDB 85 l.366)', () => {
    const mods = attackModifiers(mk({ size: 'petite' }), mk({ size: 'moyenne' }), sword, { kind: 'melee', env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille (plus petit)'))?.value).toBe(10);
  });
  it('tir : +10 plus petit ET mod de cible se cumulent (halfling Petite tire un ogre Grande)', () => {
    const mods = attackModifiers(mk({ size: 'petite' }), mk({ size: 'grande' }), bow, { kind: 'ranged', distanceTiles: 28, env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille (cible)'))?.value).toBe(20);
    expect(mods.find((m) => m.label.startsWith('Taille (plus petit)'))?.value).toBe(10);
  });
  it('Moyenne par défaut (size absent des deux côtés) : aucun mod de Taille', () => {
    const mods = attackModifiers(mk(), mk(), bow, { kind: 'ranged', distanceTiles: 28, env: [] });
    expect(mods.find((m) => m.label.startsWith('Taille'))).toBeUndefined();
  });
  it('Peur : −1 DR au jet (PAS un −10 sur la cible) quand l’attaquant vise sa source (LDB 21 l.27)', () => {
    const a = mk({ psychState: [{ type: 'peur', sourceId: 'B', calmeDR: 0 }] });
    // Le modificateur n'est PLUS une ligne de mods sur la cible : c'est un ajustement de DR (psychDRAdjust).
    const mods = attackModifiers(a, mk({ id: 'B' }), sword, { kind: 'melee', env: [] });
    expect(mods.find((m) => m.label === 'Peur')).toBeUndefined();
    expect(psychDRAdjust(a, mk({ id: 'B' }))).toBe(-1);
  });
  it('Peur : aucun ajustement de DR si la cible n’est PAS la source de Peur', () => {
    const a = mk({ psychState: [{ type: 'peur', sourceId: 'B', calmeDR: 0 }] });
    expect(psychDRAdjust(a, mk({ id: 'C' }))).toBe(0);
  });
  it('Frénésie : +1 Bonus de Force au calcul des Dégâts (LDB 21 l.33)', () => {
    const tgt = mk({ id: 'T' });
    const fr = resolveMelee(mk({ psychState: [{ type: 'frenesie' }] }), tgt, sword, makeRNG(2), { defense: 'none' });
    const no = resolveMelee(mk(), tgt, sword, makeRNG(2), { defense: 'none' });
    if (fr.hit && no.hit) expect(fr.woundsLost!).toBe(no.woundsLost! + 1);
  });
});

describe('Esquive dans une haute épaisseur de neige −30 (LDB 14 l.82)', () => {
  it('defenseModifiers : −30 en esquive seulement (pas en parade)', () => {
    expect(defenseModifiers(mk(), 'esquive', [{ label: 'Neige épaisse', value: -30, famille: 'circonstance' }]).some((m) => m.value === -30)).toBe(true);
    expect(defenseModifiers(mk(), 'parade', [{ label: 'Neige épaisse', value: -30, famille: 'circonstance' }]).some((m) => m.value === -30)).toBe(false);
  });
  it('rollMeleeDefender : la neige abaisse la cible de l’esquive, pas de la parade', () => {
    const d = mk();
    expect(rollMeleeDefender(d, 'esquive', makeRNG(1), [{ label: 'Neige épaisse', value: -30, famille: 'circonstance' }]).target).toBe(rollMeleeDefender(d, 'esquive', makeRNG(1)).target - 30);
    expect(rollMeleeDefender(d, 'parade', makeRNG(1), [{ label: 'Neige épaisse', value: -30, famille: 'circonstance' }]).target).toBe(rollMeleeDefender(d, 'parade', makeRNG(1)).target);
  });
});

describe('Atouts Dévastatrice / Percutante (LDB 62 l.244/266)', () => {
  // roll 34 vs cible 52 → DR (sl) = 5−3 = 2 ; dé des unités = 4. Arme '+8' (ranged) ; cible mk() E30 → BE3, PA0.
  // Sans Atout : dégâts = 8 + 2 = 10 → woundsLost 7. Dévastatrice : 8 + max(2,4)=12 → 9. Percutante : 8+2+4=14 → 11.
  const ranged = (qualities: string[]) => ({ label: 'X', type: 'ranged' as const, damage: { plusBF: false, flat: 8 }, qualities: qualities.map((s) => parseQualityInstance(s)!) });
  it('Dévastatrice : dégâts utilisent max(DR, dé des unités)', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged([]), 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(7);
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['Dévastatrice']), 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(9);
  });
  it('De plaies atroces (qualité magique ADE II 4 l.239) = Dévastatrice : max(DR, dé des unités)', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['De plaies atroces']), 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(9);
  });
  it('Percutante : +dé des unités sur les dégâts', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['Percutante']), 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(11);
  });
  it('Inoffensive annule Dévastatrice et Percutante', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged(['Dévastatrice', 'Percutante', 'Inoffensive']), 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(7);
  });
});

describe('Taille — Frappe Mortelle (cleave) + Piétinement (LDB 85 l.362/387)', () => {
  const hit = evaluateTest(20, 60); // succès
  it('cleave posé sur une touche de mêlée d’un plus grand', () => {
    const r = resolveMeleePassive(mk({ size: 'enorme' }), mk({ size: 'moyenne' }), sword, hit, { rng: makeRNG(1595) });
    expect(r.hit).toBe(true);
    expect(r.cleave).toBe(true);
  });
  it('pas de cleave si l’attaquant n’est pas plus grand', () => {
    expect(resolveMeleePassive(mk(), mk(), sword, hit, { rng: makeRNG(1595) }).cleave).toBeFalsy();
  });
  it('Piétinement : Test OPPOSÉ de Corps à corps (Bagarre) — LDB 13 l.123 ; LDB 85 l.387', () => {
    const grand = mk({
      size: 'enorme', characteristics: { ...mk().characteristics, 'capacite-de-combat': 60 },
      skills: [
        { id: 'corps-a-corps', spec: 'base', characteristic: 'capacite-de-combat', advances: 5 },
        { id: 'corps-a-corps', spec: 'bagarre', characteristic: 'capacite-de-combat', advances: 20 },
      ],
    } as never);
    const r = resolveMelee(grand, mk({ size: 'moyenne', weapons: [sword] }), freeAttackWeapon(attaqueNaturelle([], 'pietinement')!), makeRNG(3), { defense: 'parade' });
    expect(r.defenderDetail, 'le défenseur oppose sa Parade').toBeDefined();
    expect(r.attackerDetail!.base, 'la Spé Bagarre, jamais la meilleure Spé').toBe(80);
  });
});

describe('Taille — défense −2 DR/catégorie en parade (LDB 85 l.370)', () => {
  const moy = mk({ size: 'moyenne', weapons: [sword] });
  const atk = evaluateTest(30, 50); // DR 2
  const def = evaluateTest(30, 60); // DR 3 (le défenseur l'emporterait : 3 > 2)
  it('un Moyen parant un Énorme subit −4 DR → l’attaquant touche', () => {
    expect(finishMelee(mk({ size: 'enorme' }), moy, sword, atk, def, 'parade', { rng: makeRNG(1595) }).hit).toBe(true);
  });
  it('en esquive, aucune pénalité de Taille → le défenseur évite', () => {
    expect(finishMelee(mk({ size: 'enorme' }), moy, sword, atk, def, 'esquive', { rng: makeRNG(1595) }).hit).toBe(false);
  });
  it('attaquant de même Taille : parade normale (pas de pénalité)', () => {
    expect(finishMelee(mk({ size: 'moyenne' }), moy, sword, atk, def, 'parade', { rng: makeRNG(1595) }).hit).toBe(false);
  });
});

describe('Taille — Dégâts ×N + Atouts conférés (LDB 85 l.360-361)', () => {
  const ranged = { label: 'Arc', type: 'ranged' as const, damage: { plusBF: false, flat: 8 }, qualities: [] };
  it('attaquant Énorme (+2 cat) vs Moyen : ×2 + Dévastatrice + Percutante, AVANT soak', () => {
    expect(resolveStrayRangedHit(mk(), mk(), ranged, 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(7); // 8+2 −3
    // (8 + max(2,4) + 4)×2 − 3 = 32 − 3 = 29
    expect(resolveStrayRangedHit(mk({ size: 'enorme' }), mk(), ranged, 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(29);
  });
  it('+1 cat (Grande vs Moyen) : Dévastatrice mais pas de ×N', () => {
    // 8 + max(2,4)=12, ×1 → 12 − 3 = 9
    expect(resolveStrayRangedHit(mk({ size: 'grande' }), mk(), ranged, 34, 52, { rng: makeRNG(1595) }).woundsLost).toBe(9);
  });
});

describe('resolveStrayRangedHit — tir dévié sur un allié (LDB 14 l.116)', () => {
  it('touche automatiquement la victime depuis le jet d’origine (sans relancer)', () => {
    const att = mk({ label: 'Tireur' });
    const ally = mk({ label: 'Allié', wounds: { current: 10, max: 10 } });
    const res = resolveStrayRangedHit(att, ally, bow, 30, 55, { rng: makeRNG(1595) }); // roll 30 ≤ cible 55 → touche
    expect(res.hit).toBe(true);
    expect(res.woundsLost).toBeGreaterThan(0); // dégâts recalculés sur l'allié
    expect(res.location).toBeTruthy();
  });
});

describe('AttackResult — détail des jets (breakdown) pour la modale', () => {
  it('mêlée opposée : détaille l’attaquant ET le défenseur (cible + DR)', () => {
    const res = resolveMelee(mk({ label: 'Att' }), mk({ label: 'Def' }), sword, makeRNG(7));
    expect(res.attackerDetail).toBeTruthy();
    expect(res.attackerDetail!.label).toBe('Corps à corps');
    expect(res.attackerDetail!.base).toBe(50); // CC de base
    // cible = base + modificateurs (Avantage, viser, États…)
    expect(res.attackerDetail!.target).toBe(res.attackerDetail!.base + res.attackerDetail!.modifier);
    expect(typeof res.attackerDetail!.sl).toBe('number'); // le DR du jet
    expect(res.defenderDetail).toBeTruthy(); // jet OPPOSÉ → le défenseur est détaillé aussi
    expect(['Parade', 'Esquive']).toContain(res.defenderDetail!.label);
  });

  it('distance : détaille l’attaquant, pas de défenseur (non opposé)', () => {
    const res = resolveRanged(mk({ label: 'Tir' }), mk({ label: 'Cible' }), bow, makeRNG(3));
    expect(res.attackerDetail!.label).toBe('Projectiles');
    expect(res.defenderDetail).toBeUndefined();
  });
});

/**
 * Z5c (`docs/charte-ui.md`) — le RÉSOLVEUR du Test opposé dit POURQUOI il a tranché, sur la LIGNE
 * du camp concerné : le départage à la valeur nue (LDB 12 l.160) n'est plus une déduction de l'UI.
 * L'annotation est CONDITIONNÉE aux DR que les lignes AFFICHENT (les DR naturels) : un verdict rendu
 * sur des DR AJUSTÉS (Taille en Parade, Défensive…) reste MUET — sa phrase citerait une égalité de DR
 * introuvable à l'écran.
 */
describe('AttackResult — la RAISON du départage voyage sur le détail de ligne (Z5c)', () => {
  // Attaquant CC 45, défenseur Agilité 30 (base d'Esquive) : DR STRICTEMENT égaux des deux côtés,
  // aucun ajustement de DR en jeu (épée sans qualité, même Taille, aucun Talent) — seul le
  // départage à la valeur nue peut trancher.
  const attaquant = mk({ label: 'Att', characteristics: { ...mk().characteristics, 'capacite-de-combat': 45 } });
  const defenseur = mk({ label: 'Def', characteristics: { ...mk().characteristics, agilite: 30 } });

  it('DR égaux, valeurs nues différentes → la raison va au VAINQUEUR, avec les deux grandeurs comparées', () => {
    const atk = evaluateTest(32, 45, 45); // DR 1
    const def = evaluateTest(21, 30, 30); // DR 1
    expect(atk.sl).toBe(def.sl);
    const res = finishMelee(attaquant, defenseur, sword, atk, def, 'esquive', { rng: makeRNG(1595) });
    expect(res.attackerDetail!.decided).toEqual({ by: 'valeur', own: 45, other: 30 });
    expect(res.defenderDetail!.decided, 'la ligne perdante n’explique rien : son verdict est dit par l’autre').toBeUndefined();
  });

  it('DR ET valeurs nues égaux → les DEUX lignes portent le statu quo', () => {
    const atk = evaluateTest(32, 45, 45);
    const def = evaluateTest(32, 45, 45);
    const res = finishMelee(attaquant, defenseur, sword, atk, def, 'esquive', { rng: makeRNG(1595) });
    expect(res.hit).toBe(false);
    expect(res.attackerDetail!.decided).toEqual({ by: 'egalite' });
    expect(res.defenderDetail!.decided).toEqual({ by: 'egalite' });
  });

  it('DR différents → AUCUNE raison : le cas nominal ne se commente pas', () => {
    const atk = evaluateTest(13, 45, 45); // DR 3
    const def = evaluateTest(21, 30, 30); // DR 1
    const res = finishMelee(attaquant, defenseur, sword, atk, def, 'esquive', { rng: makeRNG(1595) });
    expect(res.attackerDetail!.decided).toBeUndefined();
    expect(res.defenderDetail!.decided).toBeUndefined();
  });

  it('DR naturels DIFFÉRENTS, égalité créée par un AJUSTEMENT de DR → les deux lignes se TAISENT', () => {
    // Pénalité de Taille en Parade (LDB 85 l.370) : l'attaquant Grand retire 2 DR à la Parade du
    // défenseur Moyen. Les lignes affichent DR 3 (attaque) et DR 5 (parade) ; le verdict, lui, se joue
    // sur 3 contre 3 et se départage à la valeur nue (55 > 45, le défenseur l'emporte).
    const grand = mk({ label: 'Att', size: 'grande', characteristics: { ...mk().characteristics, 'capacite-de-combat': 45 } });
    const pareur = mk({ label: 'Def', size: 'moyenne', weapons: [sword], characteristics: { ...mk().characteristics, 'capacite-de-combat': 55 } });
    const atk = evaluateTest(13, 45, 45); // DR 3 naturel
    const def = evaluateTest(1, 55, 55); // DR 5 naturel → 3 une fois la Taille appliquée
    expect(atk.sl, 'précondition : les DR AFFICHÉS diffèrent').not.toBe(def.sl);
    const res = finishMelee(grand, pareur, sword, atk, def, 'parade', { rng: makeRNG(1595) });
    expect(res.hit, 'précondition : le défenseur l’emporte au départage à la valeur nue').toBe(false);
    expect(res.attackerDetail!.decided, 'aucune phrase : elle dirait « DR égaux » là où l’écran montre 3 contre 5').toBeUndefined();
    expect(res.defenderDetail!.decided).toBeUndefined();
  });
});

describe('attackTestLabel — libellé du Test SUIT combatValue, ne ment jamais (#203)', () => {
  const belier: Weapon = { label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [], resolveChar: 'force' };
  it('arme à Résolution alternative (bélier → Force, ADE II 8 l.233) → libellé de la Carac', () => {
    expect(attackTestLabel(mk(), belier, 'melee')).toBe('Force');
  });
  it('arme sans Groupe → la Compétence nue', () => {
    expect(attackTestLabel(mk(), sword, 'melee')).toBe('Corps à corps');
    expect(attackTestLabel(mk(), bow, 'ranged')).toBe('Projectiles');
  });
  it('Piétinement → « Corps à corps (Bagarre) », la Spé du Groupe que le jet résout (LDB 85 l.387)', () => {
    const avecSpe = mk({ skills: [{ id: 'corps-a-corps', spec: 'bagarre', characteristic: 'capacite-de-combat', advances: 3 }] });
    expect(attackTestLabel(avecSpe, freeAttackWeapon(attaqueNaturelle([], 'pietinement')!), 'melee')).toBe('Corps à corps (Bagarre)');
    expect(attackTestLabel(mk(), freeAttackWeapon(attaqueNaturelle([], 'pietinement')!), 'melee')).toBe('Corps à corps (Bagarre)');
  });
  it('arc de Groupe Arc → « Projectiles (Arc) »', () => {
    expect(attackTestLabel(mk(), { ...bow, subType: 'arc' }, 'ranged')).toBe('Projectiles (Arc)');
  });
  it('resolveMeleePassive avec un bélier : le breakdown affiche « Force », pas « Corps à corps »', () => {
    const hit = evaluateTest(20, 60);
    const r = resolveMeleePassive(mk({ characteristics: { ...mk().characteristics, force: 60 } }), mk(), belier, hit, { rng: makeRNG(1595) });
    expect(r.attackerDetail!.label).toBe('Force');
  });
});

describe('Bandes de portée (table des Difficultés, 14 - _GoBack.md l.82-118)', () => {
  // Arc portée 60 m ; échelle 1 case = 2 m → distanceTiles × 2 = mètres.
  it('Bout portant ≤ Portée÷10 → +40', () => expect(rangeBandModifier(2, 60)).toBe(40)); // 4 m ≤ 6
  it('Courte ≤ Portée÷2 → +20', () => expect(rangeBandModifier(10, 60)).toBe(20)); // 20 m ≤ 30
  it('Moyenne ≤ Portée → +0', () => expect(rangeBandModifier(28, 60)).toBe(0)); // 56 m ≤ 60
  it('Longue ≤ Portée×2 → −10 (corrige l’ancien 0)', () => expect(rangeBandModifier(50, 60)).toBe(-10)); // 100 m ≤ 120
  it('Extrême ≤ Portée×3 → −30', () => expect(rangeBandModifier(80, 60)).toBe(-30)); // 160 m ≤ 180
  it('hors de portée → null', () => expect(rangeBandModifier(100, 60)).toBeNull()); // 200 m > 180
  it('rangeBandName cohérent', () => {
    expect(rangeBandName(2, 60)).toBe('Bout portant');
    expect(rangeBandName(10, 60)).toBe('Courte portée');
    expect(rangeBandName(50, 60)).toBe('Longue');
  });
});

describe('Bandes de portée — échelle métrique de la Scène (#249, metresPerTile) : arme Portée 60 m', () => {
  // Scène Mer (MDG 13, ~10 m/case) : les mêmes seuils EN MÈTRES tombent sur MOINS de cases —
  // Courte ≤ Portée÷2 = 30 m → 3 cases au lieu de 15 (mpt=2, cf. describe ci-dessus).
  it('mpt=10 : Courte portée ≤ 3 cases (au lieu de 15 à mpt=2)', () => {
    expect(rangeBandModifier(3, 60, 10)).toBe(20); // 30 m ≤ 30
    expect(rangeBandModifier(4, 60, 10)).toBe(0); // 40 m > 30 → Moyenne
    expect(rangeBandModifier(15, 60, 2)).toBe(20); // même arme, échelle person-scale : Courte à 15 cases
  });
  it('mpt=10 : Bout portant/Moyenne/Longue/Extrême dérivent du MÊME seuil métrique', () => {
    expect(rangeBandModifier(0, 60, 10)).toBe(40); // 0 m ≤ 6
    expect(rangeBandModifier(1, 60, 10)).toBe(20); // 10 m > 6 (Bout portant) mais ≤ 30 (Courte)
    expect(rangeBandModifier(6, 60, 10)).toBe(0); // 60 m ≤ 60
    expect(rangeBandModifier(12, 60, 10)).toBe(-10); // 120 m ≤ 120
    expect(rangeBandModifier(18, 60, 10)).toBe(-30); // 180 m ≤ 180
    expect(rangeBandModifier(19, 60, 10)).toBeNull(); // 190 m > 180
  });
  it('attackModifiers propage metresPerTile jusqu’au mod de portée affiché', () => {
    const mods = attackModifiers(mk({ label: 'A' }), mk({ label: 'B' }), bow, { kind: 'ranged', distanceTiles: 3, metresPerTile: 10 });
    expect(mods).toContainEqual(ligneDeRegle('portee-d-une-arme', 'courte'));
  });
  it('sans metresPerTile (défaut 2, terrestre) : même distanceTiles=3 reste Bout Portant/hors-Courte, comportement BYTE-IDENTIQUE', () => {
    const mods = attackModifiers(mk({ label: 'A' }), mk({ label: 'B' }), bow, { kind: 'ranged', distanceTiles: 3 });
    expect(mods).toContainEqual(ligneDeRegle('portee-d-une-arme', 'bout-portant')); // 6 m ≤ 6, comme avant le câblage
  });
});

describe('attackModifiers — modificateurs étiquetés (source unique)', () => {
  it('tir à courte portée → mod « Courte portée » +20', () => {
    const mods = attackModifiers(mk({ label: 'A' }), mk({ label: 'B' }), bow, { kind: 'ranged', distanceTiles: 10 });
    expect(mods).toContainEqual(ligneDeRegle('portee-d-une-arme', 'courte'));
  });
  it('tireur qui a Visé → mod « Viser » +20 (action Viser, l.90)', () => {
    const mods = attackModifiers(mk({ label: 'A', aiming: true }), mk({ label: 'B' }), bow, { kind: 'ranged', distanceTiles: 28 });
    // La ligne porte SA règle : la chip du breakdown ouvre `regles/viser` (#1078).
    expect(mods).toContainEqual(ligneDeRegle('viser', 'viser'));
  });
  it('viser une localisation → mod « Localisation visée » −20 (« Une attaque ou un tir qui cherche à atteindre une Localisation particulière », LDB 14 l.73)', () => {
    const mods = attackModifiers(mk({ label: 'A' }), mk({ label: 'B' }), bow, { kind: 'ranged', distanceTiles: 28, location: 'tete' });
    expect(mods).toContainEqual(ligneDeRegle('viser-une-localisation', 'localisation'));
  });
  it('mêlée vs cible À Terre → la ligne NOMME l’État qui expose la cible (+20 À Terre, lié au Codex)', () => {
    const downed = mk({ label: 'B', conditions: [{ id: 'a-terre', value: 1 }] });
    const mods = attackModifiers(mk({ label: 'A' }), downed, sword, { kind: 'melee' });
    expect(mods).toContainEqual({ label: 'À Terre', value: 20, famille: 'circonstance', ref: { category: 'etats', id: 'a-terre' } });
  });

  it('bonus de flanc/dos ADDITIF : DEUX lignes nommées (À Terre +20, Assourdi +10), jamais fondues', () => {
    const target = mk({ label: 'B', conditions: [{ id: 'a-terre', value: 1 }, { id: 'assourdi', value: 1 }] });
    const mods = attackModifiers(mk({ label: 'A' }), target, sword, { kind: 'melee', flankRear: true });
    expect(mods).toContainEqual({ label: 'À Terre', value: 20, famille: 'circonstance', ref: { category: 'etats', id: 'a-terre' } });
    expect(mods).toContainEqual({ label: 'Assourdi', value: 10, famille: 'circonstance', ref: { category: 'etats', id: 'assourdi' } });
  });
});

describe('Charge montée — dégâts à la Force + Taille de la monture (LDB 14 l.183)', () => {
  it('dmgProxy augmente les dégâts (Force de la monture) et déclenche le balayage (Taille de la monture)', () => {
    const att = mk({ label: 'Cavalier', size: 'moyenne' }); // BF 3, Moyenne
    const def = mk({ label: 'Gobelin', size: 'moyenne' });
    const okAtk = { roll: 35, target: 50, success: true, sl: 2, isDouble: false }; // touche nette (déterministe)
    // Seul le proxy de dégâts (monture Grande, BF 6) change : touche identique → DÉGÂTS isolés.
    const normal = resolveMeleePassive(att, def, sword, okAtk, { rng: makeRNG(1595) });
    const charge = resolveMeleePassive(att, def, sword, okAtk, { rng: makeRNG(1595) }, undefined, [], { sb: 6, size: 'grande' });
    expect(normal.hit && charge.hit).toBe(true);
    expect(charge.damage!).toBeGreaterThan(normal.damage!); // Force de la monture (6) > Force du cavalier (3)
    expect(charge.cleave).toBe(true); // monture Grande vs Moyenne → Frappe Mortelle (balayage)
    expect(normal.cleave).toBeFalsy(); // à pied, Moyenne vs Moyenne → pas de balayage
  });
  it('le toucher reste celui du CAVALIER (le proxy n’affecte que les dégâts)', () => {
    const att = mk({ label: 'Cavalier' });
    const def = mk({ label: 'Cible' });
    const a = resolveMelee(att, def, sword, makeRNG(5), { defense: 'none' });
    const b = resolveMelee(att, def, sword, makeRNG(5), { defense: 'none', dmgProxy: { sb: 9, size: 'enorme' } });
    expect(a.attackerRoll).toBe(b.attackerRoll); // jet d'attaque identique : la CC du cavalier n'est pas touchée
  });
});

/**
 * TRANSPORT DE LA DIFFICULTÉ sur les chemins de RE-DÉRIVATION (#1153 L4) — promotion des sondes du
 * juge adversarial.
 *
 * CONTRAT : pour tout `AttackResult` produit par un chemin de re-dérivation (Chance « +1 DR », dé
 * choisi, Résilience, touche déviée), `attackerDetail` s'explique intégralement (`inexplique === 0`)
 * ET annonce la MÊME `difficulty`/`difficultyParts` que la résolution d'ORIGINE de la même attaque.
 *
 * Le défaut mesuré : le détail recomposait la Difficulté depuis des modificateurs RECONSTRUITS, alors
 * que la cible venait d'un jet fait ailleurs. Un re-jet ne connaît ni la distance, ni l'`env` de
 * scène, ni le flanc/dos — la ligne annonçait « Intermédiaire (+0) » sur une attaque à −30 et l'écart
 * partait en chip « autres ». La Difficulté est désormais COMPOSÉE une fois par qui roule le jet, puis
 * TRANSPORTÉE (`frozenDifficulty`) : dépenser un point de Chance ne rejoue pas les circonstances.
 */
/** L'arithmétique EXACTE de l'écran (`ui/RollLine.tsx` : `reconciled`) — reste ≠ 0 ⇒ chip « autres ». */
const inexplique = (d: RollBreakdown): number =>
  d.target - d.base
  - (d.difficultyCombined ?? (d.difficulty ? DIFFICULTY_MODIFIERS[d.difficulty] : 0))
  - (d.mods ?? []).reduce((s, m) => s + m.value, 0);

/** Ce que la ligne ANNONCE de sa Difficulté — la grandeur comparée avant/après re-dérivation. */
const dit = (d: RollBreakdown) => ({
  difficulty: d.difficulty,
  combined: d.difficultyCombined,
  parts: (d.difficultyParts ?? []).map((m: ModLine) => `${m.label}:${m.value}`),
});

describe('TIR + Chance : la re-dérivation dit la MÊME Difficulté que la résolution (#1153 L4)', () => {
  /** Trois bandes de portée de la table (`LDB 14`) : le palier composé doit traverser le re-jet. */
  for (const [dist, palier] of [[10, 'accessible'], [40, 'complexe'], [80, 'tresDifficile']] as const) {
    it(`à ${dist} cases (${palier}) : même Difficulté, et la ligne s'explique`, () => {
      const a = mk({ id: 'a', weapons: [bow] });
      const repli = REDERIVATIONS.recomposees; // aucune re-composition ne doit s'ajouter (#1153 L4, R5)
      const c = mk({ id: 'c' });
      const origine = resolveRanged(a, c, bow, makeRNG(9), dist).attackerDetail!;
      expect(origine.difficulty, 'la fixture doit VRAIMENT composer un palier').toBe(palier);
      expect(inexplique(origine)).toBe(0);
      const re = rederivePassiveAttack(a, c, bow, bumpSL(hydrateTR(origine)), 'ranged', { rng: makeRNG(1595) }, undefined, false, frozenDifficulty(origine));
      expect(dit(re.attackerDetail!)).toEqual(dit(origine));
      expect(inexplique(re.attackerDetail!), 'aucune chip « autres » après la Chance').toBe(0);
      expect(REDERIVATIONS.recomposees, 'la Difficulté est TRANSPORTÉE, jamais recomposée').toBe(repli);
    });
  }
});

describe('MÊLÉE + Chance : le surnombre survit au re-jet (#1153 L4)', () => {
  it('l’`env` de la scène est perdu par la re-dérivation — la Difficulté, elle, voyage', () => {
    const a = mk({ id: 'a', weapons: [sword] });
    const repli = REDERIVATIONS.recomposees; // aucune re-composition ne doit s'ajouter (#1153 L4, R5)
    const b = mk({ id: 'b', weapons: [sword] });
    const env: ModLine[] = [{ label: 'Surnombre (2 c.1)', value: 20, famille: 'circonstance' }];
    const r = resolveMelee(a, b, sword, makeRNG(11), { defense: 'parade', env });
    const origine = r.attackerDetail!;
    expect(origine.difficulty, 'les circonstances composent Accessible (+20)').toBe('accessible');
    expect(inexplique(origine)).toBe(0);
    const re = finishMelee(
      a, b, sword, bumpSL(hydrateTR(origine)), hydrateTR(r.defenderDetail!), 'parade',
      { rng: makeRNG(1595) }, undefined, [], [], undefined, undefined, false, undefined, frozenDifficulty(origine),
    );
    expect(dit(re.attackerDetail!)).toEqual(dit(origine));
    expect(inexplique(re.attackerDetail!)).toBe(0);
    expect(REDERIVATIONS.recomposees, 'la Difficulté est TRANSPORTÉE, jamais recomposée').toBe(repli);
  });
});

describe('COUP DANS LE DOS : le +20 est NOMMÉ à sa cause (#1153 L4, #1218)', () => {
  /** Le +20 du dos tourné est l'entrée `LDB 14 l.62` (`LDB 13 l.171`, `LDB 15 l.68` ; rappel `LDB 15
   *  l.66`) : il COMPOSE la Difficulté du jet, il n'est pas une chip hors table. */
  for (const [nom, cible] of [
    ['cible saine', mk({ id: 'c' })],
    ['cible À TERRE', mk({ id: 'c', conditions: [{ id: 'a-terre', value: 1 }] as never })],
  ] as const) {
    it(`${nom} : la Difficulté porte le dos tourné, et la ligne s'explique`, () => {
      const d = resolveBackstabAttack(mk({ id: 'f', weapons: [sword] }), cible, makeRNG(3)).attackerDetail!;
      expect(inexplique(d)).toBe(0);
      expect((d.difficultyParts ?? []).map((m) => `${m.label}:${m.value}`)).toContain('Dos tourné (adversaire en fuite):20');
      expect(d.difficulty, 'le +20 composé tombe sur Accessible').toBe('accessible');
      expect((d.mods ?? []).map((m) => m.label), 'plus aucune chip hors table ne porte ce +20').not.toContain('Dos tourné (adversaire en fuite)');
    });
  }
});

describe('PIÉTINEMENT et TIR DÉVIÉ : la ligne s’explique aussi (#1153 L4)', () => {
  it('Piétinement : la Difficulté est celle des mods qui ont fait la cible', () => {
    const d = resolveMelee(mk({ id: 'a', size: 'enorme' } as never), mk({ id: 'c' }), freeAttackWeapon(attaqueNaturelle([], 'pietinement')!), makeRNG(5)).attackerDetail!;
    expect(inexplique(d)).toBe(0);
  });

  it('tir DÉVIÉ : la cible chargée porte sa ligne nommée, jamais un `mods: []` muet', () => {
    const a = mk({ id: 'a', weapons: [bow] });
    const origine = resolveRanged(a, mk({ id: 'c' }), bow, makeRNG(9), 80).attackerDetail!; // bande Extrême (−30)
    // Le tir dévie vers l'allié intercalé : cible SANS le −20 du tir dans la mêlée (LDB 14 l.116).
    const d = resolveStrayRangedHit(a, mk({ id: 'x2' }), bow, origine.roll, origine.target + 20, { rng: makeRNG(1595) }, origine).attackerDetail!;
    expect(d.difficulty, 'même jet, même Difficulté').toBe(origine.difficulty);
    expect((d.mods ?? []).map((m) => `${m.label}:${m.value}`)).toContain('Tir dévié:20');
    expect(inexplique(d)).toBe(0);
  });
});

/* Le CÂBLAGE des re-dérivations du produit (la Chance passe-t-elle vraiment la composition figée ?)
   se mesure à l'EXÉCUTION, sur le chemin réel du flux : `preview-attack.test.ts`. Un scan de source
   dirait « transport présent » d'un argument nommé `compo` qui vaudrait `undefined`. */

describe('Re-dérivation passive = résolution passive au même dé (LDB 85 l.362, LDB 62 l.323, LDB 17 l.68)', () => {
  const imprecise = (type: 'melee' | 'ranged'): Weapon => ({
    label: 'Imprécise', type, damage: { plusBF: type === 'melee', flat: 4 }, ...(type === 'ranged' ? { range: 60 } : {}),
    qualities: [parseQualityInstance('Imprécise')!],
  });
  const grand = () => mk({ id: 'g', size: 'enorme' });
  const cible = () => mk({ id: 'c', size: 'moyenne' });
  for (const [nom, de] of [['touche', 22], ['échec', 88]] as const) {
    it(`mêlée, ${nom} : balayage de Taille et ajustements de DR identiques`, () => {
      const w = imprecise('melee');
      const atk = evaluateTest(de, 60);
      const origine = resolveMeleePassive(grand(), cible(), w, atk, { rng: makeRNG(1595) });
      if (atk.success) expect(origine.cleave, 'la fixture doit VRAIMENT poser le balayage').toBe(true);
      const compo = frozenDifficulty(origine.attackerDetail);
      expect(rederivePassiveAttack(grand(), cible(), w, atk, 'melee', { rng: makeRNG(1595) }, undefined, false, compo))
        .toEqual(resolveMeleePassive(grand(), cible(), w, atk, { rng: makeRNG(1595) }, undefined, [], undefined, false, compo));
    });
  }
  it('tir passif : ajustements de DR identiques à `resolveRanged`', () => {
    const w = imprecise('ranged');
    const a = mk({ id: 'a', weapons: [w] });
    const c = cible();
    const rng = makeRNG(5);
    let origine = resolveRanged(a, c, w, rng, 10);
    while (!origine.hit) origine = resolveRanged(a, c, w, rng, 10);
    const re = rederivePassiveAttack(a, c, w, hydrateTR(origine.attackerDetail!), 'ranged', { rng: makeRNG(1595) }, undefined, false, frozenDifficulty(origine.attackerDetail));
    expect(re).toEqual(origine);
  });
});

describe('Re-dérivation passive au même dé : Charge montée, Pratique/Peu fiable', () => {
  const cible = () => mk({ id: 'c', size: 'moyenne' });
  it('Charge montée (LDB 14 l.183) : la re-dérivation garde Force et Taille de la monture', () => {
    const epee: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
    const atk = evaluateTest(22, 60);
    const proxy = { sb: 6, size: 'grande' as const };
    const a = mk({ id: 'a', size: 'moyenne' });
    const origine = resolveMeleePassive(a, cible(), epee, atk, { rng: makeRNG(1595) }, undefined, [], proxy);
    expect(origine.cleave, 'la Taille de la monture pose le balayage').toBe(true);
    expect(rederivePassiveAttack(a, cible(), epee, atk, 'melee', { rng: makeRNG(1595) }, undefined, false, frozenDifficulty(origine.attackerDetail), proxy)).toEqual(origine);
  });
  for (const [q, delta] of [['Pratique', 1], ['Peu fiable', -1]] as const) {
    it(`${q} (LDB 60) : un tir passif RATÉ reçoit ${delta > 0 ? '+' : ''}${delta} DR`, () => {
      const arc: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 60, qualities: [parseQualityInstance(q)!] };
      const a = mk({ id: 'a', weapons: [arc] });
      const rng = makeRNG(5);
      let o = resolveRanged(a, cible(), arc, rng, 10);
      while (o.hit) o = resolveRanged(a, cible(), arc, rng, 10);
      expect(o.netSL).toBe(o.attackerDetail!.sl + delta);
      const re = rederivePassiveAttack(a, cible(), arc, hydrateTR(o.attackerDetail!), 'ranged', { rng: makeRNG(1595) }, undefined, false, frozenDifficulty(o.attackerDetail));
      expect(re).toEqual(o);
    });
  }
});
