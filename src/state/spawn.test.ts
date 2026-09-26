import { describe, it, expect } from 'vitest';
import { weaponFromTrait, creatureToCombatant, statblockToCombatant, skillsFromBook, spawnEnemy } from './spawn';
import { enemyRigProfile } from '../gameIso/rig/enemyProfile';
import { teintesTirees } from '../gameIso/rig/parts/tirageIndividuel';
import { raceById } from '../gameIso/rig/races';
import { weaponFamily } from '../gameIso/rig/parts/equipment';
import { findCreature, findCreatureById, talentConcrete } from '../data';
import { CHAR_KEYS } from '../engine/types';
import { knowsCastingSkill, castingValue } from '../engine/magic';

/** Traits d'arme FR vérifiés dans L'ennemi dans l'Ombre ch.2 (Knud Cratinx & co). */
describe('weaponFromTrait — armement des monstres dans les Traits (FR)', () => {
  it('Arme +7 (sans type) → mêlée générique', () => {
    expect(weaponFromTrait({ id: 'arme', value: 7 })).toMatchObject({ label: 'Arme', type: 'melee', damage: { plusBF: false, flat: 7 } });
  });
  it('Arme (Épée) +7 → arme tenue « Épée »', () => {
    const w = weaponFromTrait({ id: 'arme', value: 7, arg: 'Épée' })!;
    expect(w).toMatchObject({ label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 7 } });
    expect(weaponFamily(w)).toBe('epee'); // le rig tient une épée
  });
  it('Arme (Dague) +4 → dague', () => {
    expect(weaponFamily(weaponFromTrait({ id: 'arme', value: 4, arg: 'dague' })!)).toBe('dague');
  });
  it('À distance (Arbalète) +9 (60) → arbalète à distance, portée 60', () => {
    const w = weaponFromTrait({ id: 'a-distance', value: 9, arg: 'arbalete', range: 60 })!;
    expect(w).toMatchObject({ label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60 });
    expect(weaponFamily(w)).toBe('arbalete');
  });
  it('À distance +8 (50) (sans type) → distance générique', () => {
    expect(weaponFromTrait({ id: 'a-distance', value: 8, range: 50 })).toMatchObject({ type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 50 });
  });
  it('Arme (griffes) marquée natural (donnée) → attaque NATURELLE, aucune arme dessinée', () => {
    // La détection naturelle vit dans la DONNÉE (flag `natural`), pas dans une regex au runtime →
    // le trait porte `natural: true`.
    const w = weaponFromTrait({ id: 'arme', arg: 'griffes', natural: true })!;
    expect(w.type).toBe('melee');
    expect(w.natural).toBe(true);
    expect(weaponFamily(w)).toBe(''); // pas d'arme tenue
  });
  it('Morsure +9 → attaque naturelle (pas d’arme tenue)', () => {
    const w = weaponFromTrait({ id: 'morsure', value: 9 })!;
    expect(w).toMatchObject({ label: 'Morsure', type: 'melee', damage: { plusBF: false, flat: 9 } });
    expect(weaponFamily(w)).toBe('');
  });
  it('un trait non-arme → null', () => {
    expect(weaponFromTrait({ id: 'corruption', arg: 'Mineure' })).toBeNull();
    expect(weaponFromTrait({ id: 'mutation', arg: 'Écailles épineuses' })).toBeNull();
  });
  it('« 8 Tentacules +9 » (Pieuvre) → UNE arme naturelle Tentacules +9 (pas d’« Arme +BF »)', () => {
    const w = weaponFromTrait({ id: 'tentacules', count: 8, value: 9 })!;
    expect(w).toMatchObject({ label: 'Tentacules', type: 'melee', damage: { plusBF: false, flat: 9 } });
    expect(weaponFamily(w)).toBe(''); // attaque naturelle : rien en main
  });
});

describe('spawnEnemy — arme d’AUTHORING (weapon:) vs arme de TRAIT : pas de doublon (#145 / #126)', () => {
  it('statbloc À distance (arbalète) + weapon:"arbalete" (trappingId) → UNE seule arme à distance, avec Recharge', () => {
    // Régression #145 : l'arme de RENDU (weaponFromId, sans reload) était PRÉPENDÉE devant celle du
    // Trait (avec Recharge), et l'IA prenait la 1re → Recharge ennemie (#126) inerte. `weapon:` ne doit
    // plus s'ajouter quand un Trait produit déjà une arme du même type. `weapon:` = trappingId (#258).
    const sb = { label: 'Tireur', char: { M: 4, 'capacite-de-combat': 36, 'capacite-de-tir': 43, force: 39, endurance: 32, B: 12 }, traits: [
      { id: 'a-distance', value: 9, arg: 'arbalete', range: 60 }, { id: 'arme', value: 7, arg: 'arme-simple' },
    ] } as any;
    const c = spawnEnemy({ statblock: sb }, 'e-tireur', { x: 0, y: 0 }, { weapon: 'arbalete' });
    const ranged = c.weapons.filter((w) => w.type === 'ranged');
    expect(ranged).toHaveLength(1); // aucun doublon rendu/jeu
    expect(ranged[0].reload).toBeGreaterThan(0); // arme de JEU : Recharge dérivée de l'arbalète (LDB 62 l.333) → l'IA suit son cycle (#126)
  });
});

describe('creatureToCombatant — fidélité du profil du bestiaire (LDB 76/78)', () => {
  const at = { x: 0, y: 0 };

  it('« – » du livre = caractéristique INEXISTANTE → 0, pas 30 (Loup : CT –)', () => {
    const c = creatureToCombatant(findCreature('Loup')!, 'e1', at);
    expect(c.characteristics['capacite-de-tir']).toBe(0);
  });

  it('Pieuvre des tourbières : arme Tentacules +9 dérivée du trait compté', () => {
    const c = creatureToCombatant(findCreature('Pieuvre des tourbières')!, 'e1', at);
    expect(c.weapons[0]).toMatchObject({ label: 'Tentacules', damage: { plusBF: false, flat: 9 } });
  });

  it('traits FACULTATIFS (LDB 76) fusionnés : Armure, psychologie ciblée, arme à distance', () => {
    const c = creatureToCombatant(findCreature('Loup')!, 'e1', at, {
      optionals: [{ id: 'haine', arg: 'Sigmarites' }, { id: 'a-distance', value: 8, range: 50 }],
    });
    expect(c.traits).toContainEqual({ id: 'haine', arg: 'Sigmarites' }); // traits STRUCTURÉS au spawn (de-POC)
    expect(c.weapons.some((w) => w.type === 'ranged' && w.damage && 'flat' in w.damage && !w.damage.plusBF && w.damage.flat === 8)).toBe(true);
    expect(c.psychTraits?.some((p) => p.type === 'haine')).toBe(true);
  });

  it('Taille facultative PRIME et applique « Utiliser les Tailles » (±10 F/E, ∓5 Ag) + PB par formule', () => {
    const wolf = findCreature('Loup')!; // Taille de base : Moyenne (aucun trait), F 35 E 35
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

  it('sorts d’auteur posés sur le Combattant (la donnée bestiaire n’en liste pas)', () => {
    const c = creatureToCombatant(findCreature('Mutant')!, 'e1', at, { spells: ['flechette'] });
    expect(c.spells).toEqual(['flechette']); // SpawnExtras.spells = ids de sort (runtime)
  });

  describe('Caractéristiques aléatoires (LDB 77 l.108 : « soustrayez -10 et ajoutez 2d10 »)', () => {
    const mutant = findCreature('Mutant')!;
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
      const p = creatureToCombatant(findCreature('Pieuvre des tourbières')!, 'enemy-0', at, { randomChars: true });
      expect(p.characteristics.intelligence).toBeGreaterThanOrEqual(1);
      expect(p.characteristics.intelligence).toBeLessThanOrEqual(10);
      expect(p.characteristics['capacite-de-tir']).toBe(0); // inexistante : pas tirée
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
    const mutant = findCreature('Mutant')!;
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
      const c = creatureToCombatant(findCreature('Loup')!, 'e1', at, { learnedTraits: ['dresse-monture'] });
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

describe('PNJ de campagne — compétences/talents/sorts de la donnée (Eusapia Balacañon, MSR Compagnon p.48)', () => {
  const at = { x: 0, y: 0 };
  const eusapia = findCreature('Eusapia Balacañon')!;

  it('est dans creatures.json (livres de campagne admis au bestiaire)', () => {
    expect(eusapia).toBeTruthy();
    expect(eusapia.source.book).toBe('mort-sur-le-reik');
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
    expect(knowsCastingSkill(c, 'langue', 'magick')).toBe(true);
    expect(castingValue(c, 'langue', 'magick')).toBe(63);
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

/** L'apparence ÉDITÉE d'un ennemi (seed re-tiré, sexe, carrière…) doit survivre au spawn comme override
 *  BRUT (`appearanceOverride`) : le rig la fige PARESSEUSEMENT au rendu (#187), plus au spawn/state. */
describe('spawnEnemy — transport de l’apparence/carrière éditée vers le Combatant (parité explo↔combat)', () => {
  const at = { x: 0, y: 0 };

  it('seed + sexe + carrure édités → portés BRUTS par Combatant.appearanceOverride', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'e1', at, { appearance: { seed: 12345, sex: 'F', build: 0.7 } });
    expect(c.appearanceOverride).toMatchObject({ seed: 12345, sex: 'F', build: 0.7 });
    expect(c.appearance).toBeUndefined(); // rien de figé dans state — la résolution rig est différée
  });

  it('tenue éditée → portée par Combatant.career', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'e1', at, { appearance: { tenue: 'Soldat' } });
    expect(c.career).toBe('Soldat');
  });

  it('sans aucun override → appearanceOverride reste indéfini (rendu dérivé du nom inchangé)', () => {
    const c = spawnEnemy({ ref: 'mutant' }, 'e1', at);
    expect(c.appearanceOverride).toBeUndefined();
  });

  it('override PARTIEL (seed seul) → enemyRigProfile dérive la palette non éditée du seed édité (#1882 T1)', () => {
    const seeded = enemyRigProfile(spawnEnemy({ ref: 'mutant' }, 'e1', at, { appearance: { seed: 999 } }))!;
    expect(seeded.appearance.seed).toBe(999);
    // Palette NON éditée : tirage individuel par le seed édité (record `mutant` sans palette authorée).
    expect(seeded.appearance.parts).toBeUndefined();
    expect(seeded.appearance.colors).toEqual(teintesTirees(999, raceById('humain').tirageIndividuel!));
  });
});

describe('spawnEnemy — branche engin de siège (`ref` à `siegeRig`, #210)', () => {
  const at = { x: 0, y: 0 };

  it('belier-ade2 : espèce DÉRIVÉE = `belier` (art propre, plus le recyclage de baliste)', () => {
    const c = spawnEnemy({ ref: 'belier-ade2' }, 'ram1', at);
    expect(c.species).toBe('belier');
    expect(c.bodyShape).toBe('engin');
    expect(c.inert).toBe(true);
  });

  it('belier-ade2 : empreinte 2 recopiée sur le Combatant (`footprintN`, ADE II 8 l.239/258)', () => {
    const c = spawnEnemy({ ref: 'belier-ade2' }, 'ram2', at);
    expect(c.footprint).toBe(2);
  });

  it('baliste (sans `siegeFootprint` en donnée) : empreinte ABSENTE — `footprintN` retombe à 1 (non-régression)', () => {
    const c = spawnEnemy({ ref: 'baliste' }, 'bal1', at);
    expect(c.species).toBe('baliste');
    expect(c.footprint).toBeUndefined();
  });
});

describe('creatureToCombatant — Groupes d’appartenance DÉCLARÉS par l’entrée du bestiaire (#1318 E4/C4)', () => {
  it('un démon de Nurgle spawné porte le Groupe de son dieu (`CreatureData.grantGroups`) EN PLUS de « demon »', () => {
    const c = creatureToCombatant(findCreatureById('nurglings')!, 'nurg1', { x: 0, y: 0 });
    expect(c.groups).toContain('demon'); // catégorie dérivée du folder
    expect(c.groups).toContain('nurgle'); // déclaré sur l'entrée — le spawn le CÂBLE
  });

  it('une créature SANS déclaration ne gagne aucun Groupe de dieu (contre-épreuve)', () => {
    const c = creatureToCombatant(findCreatureById('zombie')!, 'zomb1', { x: 0, y: 0 });
    expect(c.groups).not.toContain('nurgle');
  });
});
