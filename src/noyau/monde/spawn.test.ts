import { describe, it, expect } from 'vitest';
import { creatureToCombatant, statblockToCombatant, skillsFromBook, spawnEnemy, entitySize } from './spawn';
import { armourFromTraits, weaponFromTrait, weaponsFromTraits } from '../../engine/creatureEquip';
import type { CustomStatblock } from '../../engine/statblock';
import { recomputeLoadout } from '../../engine/items';
import { blessingsOf, careerLabelFor, findCareerById, findCreatureById, findSpellById, miraclesOf, names, talentConcrete } from '../../data';
import { porteeDuCombattant } from '../apparence/combattant';
import { pettySpellQuotaFor } from '../../engine/creation';
import { CHAR_KEYS } from '../../engine/types';
import { knowsCastingSkill, castingValue, incantationArcane } from '../../engine/magic';
import { ficheDEntite, nomDEntite } from './sceneNpc';
import { actorStatus } from '../../engine/social';
import { adresseDeCreation } from '../../engine/adresseDeCreation';
import { sceneEntitySchema } from '../../data/schemas/defs-scenes/scene';
import { emptyScene, type SceneEntity } from './scene';
import { poserUneTroupe } from '../sceneEdit';
import { bourseOf } from '../../engine/bourse';
import { toBrass } from '../../engine/money';


/** Traits d'arme FR vérifiés dans L'ennemi dans l'Ombre ch.2 (Knud Cratinx & co). */
describe('weaponFromTrait — armement des monstres dans les Traits (FR)', () => {
  it('Arme +7 (sans type) → mêlée générique', () => {
    expect(weaponFromTrait({ id: 'arme', value: 7 })).toMatchObject({ label: 'Arme', type: 'melee', damage: { plusBF: false, flat: 7 } });
  });
  it('Arme (Épée) +7 → arme tenue « Épée »', () => {
    const w = weaponFromTrait({ id: 'arme', value: 7, arg: 'Épée' })!;
    expect(w).toMatchObject({ label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 7 } });
  });
  it('Arme (Dague) +4 → dague', () => {
    expect(weaponFromTrait({ id: 'arme', value: 4, arg: 'dague' })).toMatchObject({ trappingId: 'dague', label: 'Dague', type: 'melee', damage: { plusBF: false, flat: 4 } });
  });
  it('À distance (Arbalète) +9 (60) → arbalète à distance, portée 60', () => {
    const w = weaponFromTrait({ id: 'a-distance', value: 9, arg: 'arbalete', range: 60 })!;
    expect(w).toMatchObject({ label: 'Arbalète', type: 'distance', damage: { plusBF: false, flat: 9 }, range: 60 });
  });
  it('À distance +8 (50) (sans type) → distance générique', () => {
    expect(weaponFromTrait({ id: 'a-distance', value: 8, range: 50 })).toMatchObject({ type: 'distance', damage: { plusBF: false, flat: 8 }, range: 50 });
  });
  it('Arme (griffes) marquée natural (donnée) → attaque NATURELLE, aucune arme dessinée', () => {
    // La détection naturelle vit dans la DONNÉE (flag `natural`), pas dans une regex au runtime →
    // le trait porte `natural: true`.
    const w = weaponFromTrait({ id: 'arme', arg: 'griffes', natural: true })!;
    expect(w.type).toBe('melee');
    expect(w.natural).toBe(true);
  });
  it('Morsure +9 → attaque naturelle (pas d’arme tenue)', () => {
    const w = weaponFromTrait({ id: 'morsure', value: 9 })!;
    expect(w).toMatchObject({ label: 'Morsure', type: 'melee', damage: { plusBF: false, flat: 9 } });
  });
  it('un trait non-arme → null', () => {
    expect(weaponFromTrait({ id: 'corruption', arg: 'mineure' })).toBeNull();
    expect(weaponFromTrait({ id: 'mutation', arg: 'Écailles épineuses' })).toBeNull();
  });
  it('« 8 Tentacules +9 » (Pieuvre) → UNE arme naturelle Tentacules +9 (pas d’« Arme +BF »)', () => {
    const w = weaponFromTrait({ id: 'tentacules', count: 8, value: 9 })!;
    expect(w).toMatchObject({ label: 'Tentacules', type: 'melee', damage: { plusBF: false, flat: 9 } });
  });
});

describe('spawnEnemy — l’objet réel fait céder le Trait qui le résumait (LDB 85 ; #773, #3684)', () => {
  const tireur: CustomStatblock = { type: 'statblock', label: 'Tireur', char: { M: 4, 'capacite-de-combat': 36, 'capacite-de-tir': 43, force: 39, endurance: 32, B: 12 }, traits: [
    { id: 'a-distance', value: 9, arg: 'arbalete', range: 60 }, { id: 'arme', value: 7, arg: 'arme-simple' }, { id: 'armure', value: 2 },
  ] };

  it('une cotte de mailles portée donne ses PA, et le Trait Armure cède', () => {
    const c = spawnEnemy({ ref: 'gobelin' }, 'g-maille', { x: 0, y: 0 }, { inventaire: { 'cotte-de-mailles': true } });
    expect(c.armour).toEqual({ tete: 0, brasG: 2, brasD: 2, corps: 2, jambeG: 0, jambeD: 0 });
    expect(c.traits?.some((t) => t.id === 'armure')).toBe(false);
  });

  it('une cotte de mailles NON portée ne fait pas céder le Trait Armure', () => {
    const c = spawnEnemy({ ref: 'gobelin' }, 'g-sac', { x: 0, y: 0 }, { inventaire: { 'cotte-de-mailles': false } });
    expect(c.armour).toEqual(spawnEnemy({ ref: 'gobelin' }, 'g-nu', { x: 0, y: 0 }).armour);
  });

  it('une arme simple tenue remplace l’arme du Trait Arme', () => {
    const c = spawnEnemy({ ref: 'gobelin' }, 'g-arme', { x: 0, y: 0 }, { inventaire: { 'arme-simple': false } });
    expect(c.weapons.map((w) => w.uid)).toEqual(['g-arme-objet-arme-simple']);
    expect(c.traits?.some((t) => t.id === 'arme')).toBe(false);
  });

  it('il garde l’arme naturelle de ses Traits et ce que lui donnent ses mutations', () => {
    const sb: CustomStatblock = { type: 'statblock', label: 'Homme-bête', char: { B: 12, force: 40 }, traits: [{ id: 'arme', value: 7 }, { id: 'morsure', value: 6 }, { id: 'mutation', arg: 'cornes-asymetriques' }] };
    const c = spawnEnemy({ statblock: sb }, 'hb', { x: 0, y: 0 }, { inventaire: { 'arme-simple': false } });
    expect(c.weapons.map((w) => w.label)).toEqual(['Arme simple', 'Morsure', 'Cornes']);
    expect(c.armour.tete).toBe(1);
  });

  it('un Trait Arme naturel (Crocs) reste devant une arme tenue', () => {
    const sb: CustomStatblock = { type: 'statblock', label: 'Bête', char: { B: 12, force: 40 }, traits: [{ id: 'arme', value: 7, arg: 'Crocs', natural: true }] };
    const c = spawnEnemy({ statblock: sb }, 'bete', { x: 0, y: 0 }, { inventaire: { 'arme-simple': false } });
    expect(c.weapons.map((w) => w.label)).toEqual(['Arme simple', 'Crocs']);
    expect(c.traits?.map((t) => t.id)).toEqual(['arme']);
  });

  it('recomposé (`recomputeLoadout`), un PNJ sans inventaire garde les armes et l’armure de ses Traits', () => {
    const c = spawnEnemy({ ref: 'gobelin' }, 'g-recompose', { x: 0, y: 0 });
    const { weapons, armour } = structuredClone(c);
    recomputeLoadout(c);
    expect(c.weapons).toEqual(weapons);
    expect(c.armour).toEqual(armour);
  });

  it('un PNJ sans inventaire garde les armes et l’armure de ses Traits, sans objet', () => {
    const c = spawnEnemy({ statblock: tireur }, 'e-nu', { x: 0, y: 0 });
    expect(c.items).toBeUndefined();
    expect(c.weapons).toEqual(weaponsFromTraits(c.traits ?? []).map((w) => expect.objectContaining({ uid: w.uid, label: w.label })));
    expect(c.armour).toEqual(armourFromTraits(c.traits ?? []));
  });

  it('une arbalète d’inventaire fait céder le Trait À distance : UNE arme à distance, l’objet, avec Recharge', () => {
    const c = spawnEnemy({ statblock: tireur }, 'e-tireur', { x: 0, y: 0 }, { inventaire: { arbalete: false } });
    const ranged = c.weapons.filter((w) => w.type === 'distance');
    expect(ranged.map((w) => w.uid)).toEqual(['e-tireur-objet-arbalete']);
    expect(ranged[0].reload).toBeGreaterThan(0);
    expect(c.traits?.map((t) => t.id)).toEqual(['arme', 'armure']);
  });
});

describe('creatureToCombatant — fidélité du profil du bestiaire (LDB 76/78)', () => {
  const at = { x: 0, y: 0 };

  it('« – » imprimé → 0, pas 30 (Loup : CT –) — #2304', () => {
    const c = creatureToCombatant(findCreatureById('loup')!, 'e1', at);
    expect(c.characteristics['capacite-de-tir']).toBe(0);
  });

  it('Pieuvre des tourbières : arme Tentacules +9 dérivée du trait compté', () => {
    const c = creatureToCombatant(findCreatureById('pieuvre-des-tourbieres')!, 'e1', at);
    expect(c.weapons[0]).toMatchObject({ label: 'Tentacules', damage: { plusBF: false, flat: 9 } });
  });

  it('traits FACULTATIFS (LDB 76) fusionnés : Armure, psychologie ciblée, arme à distance', () => {
    const c = creatureToCombatant(findCreatureById('loup')!, 'e1', at, {
      optionals: [{ id: 'haine', arg: 'Sigmarites' }, { id: 'a-distance', value: 8, range: 50 }],
    });
    expect(c.traits).toContainEqual({ id: 'haine', arg: 'Sigmarites' }); // traits STRUCTURÉS au spawn (de-POC)
    expect(c.weapons.some((w) => w.type === 'distance' && w.damage && 'flat' in w.damage && !w.damage.plusBF && w.damage.flat === 8)).toBe(true);
    expect(c.psychTraits?.some((p) => p.type === 'haine')).toBe(true);
  });

  it('Taille facultative PRIME et applique « Utiliser les Tailles » (±10 F/E, ∓5 Ag) + PB par formule', () => {
    const wolf = findCreatureById('loup')!; // Taille de base : Moyenne (aucun trait), F 35 E 35
    const base = creatureToCombatant(wolf, 'e1', at);
    const big = creatureToCombatant(wolf, 'e1', at, { optionals: [{ id: 'taille', arg: 'Grande' }] });
    expect(big.size).toBe('grande');
    expect(big.characteristics.force).toBe(base.characteristics.force + 10);
    expect(big.characteristics.endurance).toBe(base.characteristics.endurance + 10);
    expect(big.characteristics.agilite).toBe(base.characteristics.agilite - 5);
    // Blessures recalculées par la formule de Taille (le B imprimé valait pour la taille de base)
    const bf = Math.floor(big.characteristics.force / 10), be = Math.floor(big.characteristics.endurance / 10), bfm = Math.floor(big.characteristics['force-mentale'] / 10);
    expect(big.wounds.max).toBe((bf + 2 * be + bfm) * 2); // Grande = ×2 (LDB 85)
  });

  describe('Caractéristiques aléatoires (LDB 77 l.108 : « soustrayez -10 et ajoutez 2d10 »)', () => {
    const mutant = findCreatureById('mutant')!;
    it('chaque caractéristique tirée reste dans [v−8, v+10] ; déterministe par id ; ids ≠ → profils ≠', () => {
      const a = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const b = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const c = creatureToCombatant(mutant, 'enemy-1', at, { randomChars: true });
      for (const k of CHAR_KEYS) {
        const v = mutant.char[k];
        if (typeof v !== 'number' || v === 0) continue;
        expect(a.characteristics[k]).toBeGreaterThanOrEqual(v - 8); // −10 + 2×1
        expect(a.characteristics[k]).toBeLessThanOrEqual(v + 10); // −10 + 2×10
      }
      expect(a.characteristics).toEqual(b.characteristics); // graine stable par id (rejouable)
      expect(CHAR_KEYS.some((k) => a.characteristics[k] !== c.characteristics[k])).toBe(true);
    });
    it('« Si une Caractéristique vaut 5, lancez juste 1d10 » (Pieuvre : Int 5) ; « – » reste 0', () => {
      const p = creatureToCombatant(findCreatureById('pieuvre-des-tourbieres')!, 'enemy-0', at, { randomChars: true });
      expect(p.characteristics.intelligence).toBeGreaterThanOrEqual(1);
      expect(p.characteristics.intelligence).toBeLessThanOrEqual(10);
      expect(p.characteristics['capacite-de-tir']).toBe(0); // inexistante : pas tirée
    });
    it('le tirage demandé par l’entité vaut aussi pour son statbloc d’auteur, seedé sur son id (#3704)', () => {
      const sb = { type: 'statblock' as const, label: 'Garde', char: { M: 4, 'capacite-de-combat': 40, 'capacite-de-tir': 35, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, B: 12 } };
      const rond = statblockToCombatant(sb, 'garde-0', at);
      const [a, b] = ['garde-0', 'garde-1'].map((id) => statblockToCombatant(sb, id, at, undefined, { randomChars: true }));
      expect(CHAR_KEYS.some((k) => a.characteristics[k] !== rond.characteristics[k]), 'tiré, le profil quitte le rond').toBe(true);
      expect(CHAR_KEYS.some((k) => a.characteristics[k] !== b.characteristics[k]), 'deux ids, deux profils').toBe(true);
    });
    it('Blessures recalculées par la formule (le B imprimé valait pour le profil rond)', () => {
      const c = creatureToCombatant(mutant, 'enemy-0', at, { randomChars: true });
      const bf = Math.floor(c.characteristics.force / 10), be = Math.floor(c.characteristics.endurance / 10), bfm = Math.floor(c.characteristics['force-mentale'] / 10);
      expect(c.wounds.max).toBe(bf + 2 * be + bfm); // Mutant : Taille Moyenne
    });
  });

  // #614 — overlay de spawn d'une Possession : le tirage LDB 77 se FIGE dans `Possession.charsRolled`,
  // fourni ici en override DIRECT (jamais relancé) — deux projections successives = mêmes stats.
  describe('SpawnExtras.charsRolled — override direct FIGÉ (#614, Possession.charsRolled)', () => {
    const mutant = findCreatureById('mutant')!;
    const frozen = { ...mutant.char } as any;
    for (const k of CHAR_KEYS) if (typeof frozen[k] === 'number') frozen[k] += 1; // profil distinct du catalogue

    it('deux projections avec le MÊME charsRolled → mêmes caractéristiques ET mêmes Blessures', () => {
      const a = creatureToCombatant(mutant, 'enemy-0', at, { charsRolled: frozen });
      const b = creatureToCombatant(mutant, 'enemy-1', at, { charsRolled: frozen });
      expect(a.characteristics).toEqual(b.characteristics);
      expect(a.wounds.max).toBe(b.wounds.max);
      expect(a.characteristics.force).toBe(frozen.force);
    });

    it('charsRolled PRIME sur randomChars (aucun tirage exécuté si le résultat est déjà figé)', () => {
      const c = creatureToCombatant(mutant, 'enemy-0', at, { charsRolled: frozen, randomChars: true });
      expect(c.characteristics).toEqual(frozen);
    });
  });

  describe('SpawnExtras.learnedTraits — dresse-* appris unis aux traits de base (LDB 23 l.130 → LDB 85)', () => {
    it('un trait appris (id seul) rejoint les traits du Combatant', () => {
      const c = creatureToCombatant(findCreatureById('loup')!, 'e1', at, { learnedTraits: ['dresse-monture'] });
      expect(c.traits?.some((t) => t.id === 'dresse-monture')).toBe(true);
    });
  });
});

// #152 (suite #143) : `CreatureData.followsCharacterRules` — bestiaire humain rétro-flagué (Cultiste,
// Brigand, Voleur…) — un ennemi spawné depuis une réf (`creatureToCombatant`, pas un statbloc d'éditeur)
// doit porter le MÊME flag que `statblockToCombatant` (#143) pour suivre les règles de Personnage
// (Corruption LDB 19, composant LDB 46, maladie/Corruption de fin de combat LDB 18/20).
describe('creatureToCombatant — #152 : CreatureData.followsCharacterRules propagé au Combatant', () => {
  const at = { x: 0, y: 0 };
  it('créature du bestiaire FLAGUÉE (Cultiste, humain) → Combatant.followsCharacterRules', () => {
    const c = creatureToCombatant(findCreatureById('cultiste')!, 'e1', at);
    expect(c.followsCharacterRules).toBe(true);
  });
  it('créature GÉNÉRIQUE du bestiaire non flaguée (Orc) → pas de followsCharacterRules', () => {
    const c = creatureToCombatant(findCreatureById('orc')!, 'e1', at);
    expect(c.followsCharacterRules).toBeUndefined();
  });
});

// EDO 01 l.504 ; LDB 19.
describe('creatureToCombatant — CreatureData.corruption projeté au Combatant', () => {
  const at = { x: 0, y: 0 };
  it('entrée portant `corruption: 6` → Combatant.corruption === 6', () => {
    const c = creatureToCombatant({ ...findCreatureById('cultiste')!, corruption: 6 }, 'e1', at);
    expect(c.corruption).toBe(6);
  });
  it('entrée sans `corruption` → aucune clé `corruption` sur le Combatant', () => {
    const creature = findCreatureById('cultiste')!;
    expect('corruption' in creature).toBe(false);
    const c = creatureToCombatant(creature, 'e1', at);
    expect('corruption' in c).toBe(false);
  });
});

// LDB 10 l.943 ; LDB 85 l.344.
describe('spawn — Taille d’un profil : Trait Taille, sinon Talent de Taille, sinon Moyenne', () => {
  const at = { x: 0, y: 0 };
  const base = findCreatureById('cultiste')!;
  const petit = [{ id: 'petit' }];
  const grande = [{ id: 'taille', arg: 'Grande' }];
  it('créature : Talent Petit sans Trait Taille → petite', () => {
    expect(creatureToCombatant({ ...base, traits: [], talents: petit }, 'e1', at).size).toBe('petite');
  });
  it('créature : un Trait Taille explicite prime sur le Talent', () => {
    expect(creatureToCombatant({ ...base, traits: grande, talents: petit }, 'e1', at).size).toBe('grande');
  });
  it('créature : ni Trait ni Talent de Taille → moyenne', () => {
    expect(creatureToCombatant({ ...base, traits: [], talents: [] }, 'e1', at).size).toBe('moyenne');
  });
  it('statbloc : Talent Petit sans Trait Taille → petite ; Trait Taille prime ; ni l’un ni l’autre → moyenne', () => {
    const sb = { type: 'statblock' as const, label: 'X', char: {} };
    expect(statblockToCombatant({ ...sb, talents: petit }, 'e1', at).size).toBe('petite');
    expect(statblockToCombatant({ ...sb, talents: petit, traits: grande }, 'e1', at).size).toBe('grande');
    expect(statblockToCombatant(sb, 'e1', at).size).toBe('moyenne');
  });
  it('entité posée : la même Taille que le combattant (`entitySize`)', () => {
    expect(entitySize({ statblock: { type: 'statblock', label: 'X', char: {}, talents: petit } })).toBe('petite');
    expect(entitySize({ statblock: { type: 'statblock', label: 'X', char: {}, talents: petit, traits: grande } })).toBe('grande');
  });
});

// LDB 85 l.37-39 (#1463).
describe('statbloc d’éditeur — l’Armure du Trait fait les PA du combattant, comme une créature', () => {
  it('Trait Armure 5 → 5 PA à chaque localisation', () => {
    const c = statblockToCombatant({ type: 'statblock', label: 'Dragon des ténèbres', char: {}, traits: [{ id: 'armure', value: 5 }] }, 'e1', { x: 0, y: 0 });
    expect(Object.values(c.armour)).toEqual([5, 5, 5, 5, 5, 5]);
  });
});

// LDB 10 l.109.
describe('spawn — Béni : les Bénédictions du culte au spawn, comme à la création d’un héros', () => {
  const at = { x: 0, y: 0 };
  const base = findCreatureById('cultiste')!;
  it('créature et statbloc portant Béni (Ulric) → les Bénédictions d’Ulric', () => {
    const attendues = blessingsOf('ulric');
    expect(attendues.length).toBeGreaterThan(0);
    expect(creatureToCombatant({ ...base, talents: [{ id: 'beni', spec: 'ulric' }], spells: [] }, 'e1', at).spells).toEqual(expect.arrayContaining(attendues));
    expect(statblockToCombatant({ type: 'statblock', label: 'X', char: {}, talents: [{ id: 'beni', spec: 'ulric' }] }, 'e1', at).spells).toEqual(expect.arrayContaining(attendues));
  });
  it('opposé : sans Béni, aucune Bénédiction octroyée', () => {
    expect(creatureToCombatant({ ...base, talents: [], spells: [] }, 'e1', at).spells).toBeUndefined();
    expect(statblockToCombatant({ type: 'statblock', label: 'X', char: {} }, 'e1', at).spells).toBeUndefined();
  });
});

describe('PNJ de campagne — compétences/talents/sorts de la donnée (Eusapia Balacañon, MSR Compagnon p.48)', () => {
  const at = { x: 0, y: 0 };
  const eusapia = findCreatureById('eusapia-balacanon')!;

  it('est dans creatures.json (livres de campagne admis au bestiaire)', () => {
    expect(eusapia).toBeTruthy();
    expect(eusapia.source.book).toBe('mort-sur-le-reik-compagnon');
  });

  it('compétences au format livre → avances dérivées (Test FINAL = Caractéristique + avances, LDB 09)', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    const langue = c.skills.find((s) => s.id === 'langue' && s.spec === 'magick')!;
    expect(langue.advances).toBe(63 - 48); // « Langue (Magick) 63 », Int 48
    expect(c.characteristics.intelligence + langue.advances).toBe(63);
    const foc = c.skills.find((s) => s.id === 'focalisation' && s.spec === 'bete')!; // id domaine, AFFICHE « Ghur »
    expect(c.characteristics['force-mentale'] + foc.advances).toBe(68); // « Focalisation (Ghur) 68 », FM 53
  });

  it('talents portés (Magie des Arcanes (Bête), Magie mineure…) et 12 sorts de la donnée', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    // spec = id domaine `bete` ; Magie des Arcanes AFFICHE le Lore (« Bête ») — la donnée « Ghur » (un Vent,
    // pas un Lore d'Arcane) était une faute d'auteur, résolue en `bete` par le résolveur Vent→id.
    expect(c.talents.map((t) => talentConcrete(t))).toContain('Magie des Arcanes (Bête)');
    expect(c.talents.map((t) => talentConcrete(t))).toContain('Magie mineure');
    expect(c.spells).toHaveLength(12);
    expect(c.spells).toContain('flechette'); // runtime = id de sort
  });

  it('incante par la voie NORMALE (Langue (Magick) 63, sans le Trait Lanceur de Sorts)', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    expect(knowsCastingSkill(c, { id: 'langue', spec: 'magick' })).toBe(true);
    expect(castingValue(c, incantationArcane())).toBe(63);
  });

  it('arme du trait : « Arme (Bâton de combat) +7 » → arme tenue', () => {
    const c = creatureToCombatant(eusapia, 'e1', at);
    expect(c.weapons[0]).toMatchObject({ label: 'Bâton de combat', damage: { plusBF: false, flat: 7 } });
  });

  it('statbloc personnalisé : skills/talents portés par CustomStatblock (mêmes règles)', () => {
    const c = statblockToCombatant(
      { type: 'statblock', label: 'Sorcier custom', char: { intelligence: 48, 'force-mentale': 53 }, skills: [{ id: 'langue', spec: 'magick', value: 63 }, { id: 'esquive', value: 48 }], talents: [{ id: 'menacant' }] },
      'e1', at,
    );
    expect(c.skills.find((s) => s.id === 'langue')!.advances).toBe(15);
    expect(c.talents[0]).toEqual({ talentId: 'menacant', times: 1 });
  });

  it('skillsFromBook : ref structurée (id + value) → SkillInstance ; id inconnu du catalogue → ignoré', () => {
    const chars = { 'capacite-de-combat': 45 } as any;
    const [cc] = skillsFromBook([{ id: 'corps-a-corps', spec: 'bagarre', value: 50 }], chars, 'spec:t');
    expect(cc).toMatchObject({ id: 'corps-a-corps', characteristic: 'capacite-de-combat', advances: 5 });
    expect(skillsFromBook([{ id: 'competence-inexistante', value: 50 }], chars, 'spec:t')).toEqual([]); // rien d'inventé
  });

  // #614 — un PNJ/bête custom (`LivingRef.custom`) porte la MÊME overlay de spawn qu'une créature du bestiaire.
  it('statblockToCombatant : extras.charsRolled REMPLACE le profil saisi ; deux projections = mêmes stats', () => {
    const sb = { label: 'Bête custom', char: { M: 4, 'capacite-de-combat': 30, force: 30, endurance: 30 } } as any;
    const rolled = { ...sb.char, force: 41, endurance: 37 } as any;
    for (const k of CHAR_KEYS) if (typeof rolled[k] !== 'number') rolled[k] = 0;
    const a = statblockToCombatant(sb, 'p1', at, undefined, { charsRolled: rolled });
    const b = statblockToCombatant(sb, 'p2', at, undefined, { charsRolled: rolled });
    expect(a.characteristics).toEqual(b.characteristics);
    expect(a.characteristics.force).toBe(41);
    expect(a.wounds.max).toBe(b.wounds.max);
  });

  it('statblockToCombatant : extras.learnedTraits rejoint les traits du statbloc', () => {
    const sb = { label: 'Bête custom', char: { M: 4 } } as any;
    const c = statblockToCombatant(sb, 'p1', at, undefined, { learnedTraits: ['dresse-monture'] });
    expect(c.traits?.some((t) => t.id === 'dresse-monture')).toBe(true);
  });
});

/** L'apparence ÉDITÉE d'un ennemi (sexe, carrière…) doit survivre au spawn comme override
 *  BRUT (`appearanceOverride`, #187), jamais résolue au spawn. */
describe('spawnEnemy — transport de l’apparence/carrière éditée vers le Combatant (parité explo↔combat)', () => {
  const at = { x: 0, y: 0 };

  it('sexe édité → porté BRUT par Combatant.appearanceOverride', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'e1', at, { appearance: { sex: 'F' } });
    expect(c.appearanceOverride).toMatchObject({ sex: 'F' });
    expect(c.appearance).toBeUndefined(); // rien de résolu au spawn
  });

  it('tenue éditée → portée par Combatant.career', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'e1', at, { appearance: { tenue: 'soldat' } });
    expect(c.career).toBe('soldat');
  });

  it('sans aucun override → appearanceOverride reste indéfini (rendu dérivé du nom inchangé)', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'e1', at);
    expect(c.appearanceOverride).toBeUndefined();
  });

  it('override PARTIEL (sexe seul) → seul le sexe édité est porté (#1882 T1)', () => {
    expect(spawnEnemy({ ref: 'mutant' }, 'e1', at, { appearance: { sex: 'F' } }).appearanceOverride).toEqual({ sex: 'F' });
  });
});

describe('spawnEnemy — engin du sous-type armes-de-siege (#210)', () => {
  const at = { x: 0, y: 0 };

  it('belier-ade2 : engin inerte, sans espèce dérivée de sa référence', () => {
    const c = spawnEnemy({ engin: 'belier-ade2' }, 'ram1', at);
    expect(c.species).toBeUndefined();
    expect(c.bodyShape).toBe('engin');
    expect(c.inert).toBe(true);
  });

  it('belier-ade2 : empreinte 2 recopiée sur le Combatant (`footprintN`, ADE II 8 l.239/258)', () => {
    const c = spawnEnemy({ engin: 'belier-ade2' }, 'ram2', at);
    expect(c.footprint).toBe(2);
  });

  it('baliste (sans `siegeFootprint` en donnée) : empreinte ABSENTE — `footprintN` retombe à 1 (non-régression)', () => {
    const c = spawnEnemy({ engin: 'baliste' }, 'bal1', at);
    expect(c.species).toBeUndefined();
    expect(c.footprint).toBeUndefined();
  });
});

describe('PNJ de carrière : la fiche d’une entité portée à son parcours (EDO 11 l.17-21 ; #773)', () => {
  const sansPreset = () => undefined;
  const langstrasse: SceneEntity = { id: 'langstrasse', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' }, carrieres: { medecin: 3 } };

  it('l’humain de base porté Doktor (Médecin 3) : Statut Argent 5 et les possessions de l’exemple (EDO 11 l.27, l.33-35)', () => {
    const c = ficheDEntite(langstrasse, sansPreset);
    expect(actorStatus(c)).toEqual({ tier: 'argent', standing: 5 });
    expect(c.items?.map((i) => i.trappingId)).toEqual(['bandages', 'potion-de-guerison', 'livre-medecine', 'licence-de-guilde', 'outils-professionnels-medecin', 'atelier', 'bourse']);
    expect(c.wounds.max).toBe(13);
    expect(c.porteurDeFiche).toEqual({ ref: 'humain', parcours: { carrieres: { medecin: 3 } } });
  });

  it('l’arme de dotation choisie est tenue et fait céder le Trait Arme ; l’armure de dotation est portée', () => {
    const soldat: SceneEntity = { id: 'soldat', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' }, carrieres: { soldat: 2 }, dotationsDeCarriere: { [adresseDeCreation.dotation([3])]: 'hallebarde' } };
    const c = ficheDEntite(soldat, sansPreset);
    expect(c.weapons.map((w) => w.label)).toContain('Hallebarde');
    expect(c.traits?.some((t) => t.id === 'arme')).toBe(false);
    expect(c.armour.corps).toBeGreaterThan(0);
  });

  it('un objet d’inventaire porté par l’auteur ôte la dotation qu’il chevauche', () => {
    const c = ficheDEntite({ id: 'garde', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' }, carrieres: { soldat: 1 }, inventaire: { plastron: true } }, sansPreset);
    expect(c.items?.filter((i) => i.trappingId === 'plastron-de-cuir' || i.trappingId === 'plastron').map((i) => [i.uid, i.equipped])).toEqual([['garde-dotation-1', false], ['garde-objet-plastron', true]]);
  });

  it('le schéma refuse un parcours sans profil du Bestiaire, avec une tenue d’auteur, ou à un Niveau absent', () => {
    expect(sceneEntitySchema.safeParse(langstrasse).success).toBe(true);
    const faute = (ent: object) => sceneEntitySchema.safeParse({ ...langstrasse, ...ent }).error?.issues.map((i) => i.message);
    expect(faute({ creature: undefined, statblock: { type: 'statblock', label: 'X', char: {} } })).toEqual([expect.stringMatching(/Bestiaire/)]);
    expect(faute({ appearance: { tenue: 'medecin' } })).toEqual([expect.stringMatching(/tenue/)]);
    expect(faute({ carrieres: { medecin: 5 } })).toEqual([expect.stringMatching(/Niveau 5/)]);
    expect(faute({ carrieres: undefined, talentsDeCarriere: { medecin: [{ id: 'chirurgie' }] } })).toEqual([expect.stringMatching(/sans carrière/)]);
  });
});

describe('L’argent des PNJ : les dés du Statut, sans Test, dans la Bourse (EDO 11 l.42-46 ; #3712)', () => {
  const sansPreset = () => undefined;
  const doktor = (id: string): SceneEntity => ({ id, kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' }, carrieres: { medecin: 3 } });

  it('le PNJ de carrière porte une Bourse de 5d10 pistoles d’argent (Argent 5, EDO 11 l.46), la même pour un même id', () => {
    const argent = (id: string) => toBrass(bourseOf(ficheDEntite(doktor(id), sansPreset)));
    const pistoles = argent('langstrasse') / 12;
    expect(Number.isInteger(pistoles), 'des pistoles entières').toBe(true);
    expect(pistoles).toBeGreaterThanOrEqual(5);
    expect(pistoles).toBeLessThanOrEqual(50);
    expect(argent('langstrasse')).toBe(argent('langstrasse'));
    expect(new Set(['a', 'b', 'c', 'd', 'e'].map(argent)).size, 'cinq ids, au moins deux bourses différentes').toBeGreaterThan(1);
  });

  it('un PNJ sans carrière n’a pas de Statut : il n’en tire aucune', () => {
    expect(ficheDEntite({ id: 'badaud', kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' } }, sansPreset).items ?? []).toEqual([]);
  });
});

describe('PNJ anonyme : nom, âge, taille, yeux et cheveux tirés à la graine de son id (LDB 05 l.701-768 ; #3712)', () => {
  const sansPreset = () => undefined;
  const humain = (id: string, ent: Partial<SceneEntity> = {}): SceneEntity => ({ id, kind: 'personnage', pos: { x: 0, y: 0 }, creature: { id: 'humain' }, ...ent });
  const pool = (race: string) => names.find((n) => n.id === race)!;

  it('le personnage sans nom d’auteur porte un nom de sa race, le même pour un même id, un autre pour un autre id', () => {
    const nom = nomDEntite(humain('garde-1'), sansPreset)!;
    expect(pool('humain').maleFirstNames).toContain(nom.split(' ')[0]);
    expect(nomDEntite(humain('garde-1'), sansPreset)).toBe(nom);
    expect(nomDEntite(humain('garde-2'), sansPreset)).not.toBe(nom);
    expect(ficheDEntite(humain('garde-1'), sansPreset).label, 'la fiche porte le nom de l’entité').toBe(nom);
  });

  it('le nom suit le sexe et l’espèce que l’auteur pose', () => {
    expect(pool('humain').femaleFirstNames).toContain(nomDEntite(humain('villageoise', { appearance: { sex: 'F' } }), sansPreset)!.split(' ')[0]);
    const nain = nomDEntite(humain('client', { creature: { id: 'nain' }, appearance: { species: 'nains' } }), sansPreset)!;
    expect(pool('nain').maleFirstNames).toContain(nain.split(' ')[0]);
    expect(pool('nain').lastNameSuffixes!.M.some((x) => nain.endsWith(x)), 'patronyme nain, LDB 05 l.627-633').toBe(true);
  });

  it('le sexe que pose l’auteur fait le nom, le corps et le libellé de Carrière (#3724)', () => {
    const villageoise = ficheDEntite(humain('villageoise', { appearance: { sex: 'F' } }), sansPreset);
    expect(pool('humain').femaleFirstNames).toContain(villageoise.label.split(' ')[0]);
    expect(porteeDuCombattant(villageoise)?.sex).toBe('F');
    expect(careerLabelFor({ ...villageoise, career: 'artisan' })).toBe(findCareerById('artisan')!.labelF);
    expect(porteeDuCombattant(ficheDEntite(humain('garde-1'), sansPreset))?.sex, 'sans sexe posé : M, #3253').toBe('M');
  });

  it('son âge, sa taille, ses yeux et ses cheveux sont tirés sur les tables de sa race, les mêmes pour un même id', () => {
    const { details } = ficheDEntite(humain('garde-1'), sansPreset);
    expect(details?.age).toBeGreaterThanOrEqual(16); // 15 + 1d10, LDB 05 l.711
    expect(details?.age).toBeLessThanOrEqual(25);
    expect(details?.height).toBeGreaterThanOrEqual(150); // 145 + 5d10 cm, LDB 05 l.724
    expect(details?.height).toBeLessThanOrEqual(195);
    expect(details?.eyes).toBeTruthy();
    expect(details?.hair).toBeTruthy();
    expect(ficheDEntite(humain('garde-1'), sansPreset).details).toEqual(details);
  });

  it('ce que l’auteur pose prime : son nom, un statbloc, un individu nommé du bestiaire', () => {
    const nomme = ficheDEntite(humain('garde', { label: 'Garde du Bourg' }), sansPreset);
    expect([nomme.label, nomme.details]).toEqual(['Garde du Bourg', undefined]);
    expect(nomDEntite(humain('eusapia', { creature: { id: 'eusapia-balacanon' } }), sansPreset)).toBe(findCreatureById('eusapia-balacanon')!.label);
    expect(nomDEntite(humain('timonier', { creature: undefined, statblock: { type: 'statblock', label: 'Timonier', char: {} } }), sansPreset)).toBe('Timonier');
    expect(nomDEntite(humain('loup', { creature: { id: 'loup' } }), sansPreset), 'une créature sans race garde le nom de sa fiche').toBe(findCreatureById('loup')!.label);
  });

  it('une troupe (#3704) donne des noms et des visages différents sans rien régler', () => {
    const scene = emptyScene('troupe', 8, 8);
    const garde = humain('garde', { pos: { x: 3, y: 3 } });
    const { scene: posee, ids } = poserUneTroupe({ ...scene, entities: [garde] }, garde, 5);
    const copies = posee.entities.filter((e) => ids.includes(e.id));
    expect(new Set([garde, ...copies].map((e) => nomDEntite(e, sansPreset))).size).toBe(6);
    expect(new Set([garde, ...copies].map((e) => JSON.stringify(ficheDEntite(e, sansPreset).details))).size).toBeGreaterThan(1);
  });
});

describe('les sorts d’un PNJ au spawn : choisis par l’auteur, complétés aux quotas du livre (#3715)', () => {
  const sansPreset = () => undefined;
  const at = { x: 0, y: 0 };
  const famille = (id: string) => findSpellById(id)!.family;

  it('un PNJ du Bestiaire à Invocation sans liste imprimée : un Miracle de son culte, avec ses Bénédictions (frère Bengt)', () => {
    const c = spawnEnemy({ ref: 'frere-bengt' }, 'bengt', at);
    const miracles = (c.spells ?? []).filter((id) => famille(id) === 'invocation');
    expect(miracles).toHaveLength(1);
    expect(miraclesOf('ulric')).toContain(miracles[0]);
    expect(c.spells).toEqual(expect.arrayContaining(blessingsOf('ulric')));
  });

  it('un PNJ du Bestiaire à Magie des Arcanes et Magie mineure : les sorts choisis, et les Sorts mineurs du quota tirés (Yanni Weber)', () => {
    const c = spawnEnemy({ ref: 'yanni-weber' }, 'yanni', at, { spells: ['la-lance-d-ambre'] });
    expect(c.spells?.[0]).toBe('la-lance-d-ambre');
    expect(c.spells?.slice(1).map(famille)).toEqual(Array(pettySpellQuotaFor(c)).fill('mineure'));
  });

  it('un PNJ de carrière : Magie mineure prise au Niveau 1 donne ses Sorts mineurs, Magie des Arcanes aucun (Pyromancien 2)', () => {
    const c = ficheDEntite({ id: 'pyro', kind: 'personnage', pos: at, creature: { id: 'humain' }, carrieres: { pyromancien: 2 }, talentsDeCarriere: { pyromancien: [{ id: 'magie-mineure' }, { id: 'magie-des-arcanes', spec: 'feu' }] } }, sansPreset);
    expect(c.spells?.map(famille)).toEqual(Array(pettySpellQuotaFor(c)).fill('mineure'));
  });

  it('un PNJ de carrière : Invocation prise au Niveau 2 donne un Miracle du culte (Prêtre de Myrmidia 2)', () => {
    const c = ficheDEntite({ id: 'pretre', kind: 'personnage', pos: at, creature: { id: 'humain' }, carrieres: { 'pretre-de-myrmidia': 2 }, talentsDeCarriere: { 'pretre-de-myrmidia': [{ id: 'beni', spec: 'myrmidia' }, { id: 'invocation', spec: 'myrmidia' }] } }, sansPreset);
    expect((c.spells ?? []).filter((id) => famille(id) === 'invocation').every((id) => miraclesOf('myrmidia').includes(id))).toBe(true);
    expect((c.spells ?? []).filter((id) => famille(id) === 'invocation')).toHaveLength(1);
  });

  it('une liste imprimée fait foi : ni complétée, ni remplacée par un choix d’auteur (Eusapia)', () => {
    expect(spawnEnemy({ ref: 'eusapia-balacanon' }, 'eusapia', at, { spells: ['choc'] }).spells).toEqual(findCreatureById('eusapia-balacanon')!.spells);
  });
});
