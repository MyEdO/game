import { describe, it, expect, vi } from 'vitest';
import { classifyEnemy, enemyRigProfile, entityRigProfile } from './enemyProfile';
import { combatantOverlays } from './parts/combatantVisuals';
import { creatures } from '../../data';
import { setDataset } from '../../data/overrides';
import { mutationById } from '../../data/mutations';
import { raceById, DEFAULT_RACE_ID } from './races';
import { bipedDef } from './creatures';
import { baseSpeciesOf } from './skeletons';
import { resolveParts } from './parts/resolve';
import { pickView } from './parts/types';
import { CLAWFOOT, MAIN_GRIFFUE } from './parts/bodies/extremites';
import { armourPart } from './parts/equipment';
import { spawnEnemy } from '../../state/spawn';
import { hairstylesForSex } from './parts/hairstyles';
import { COIFFURE_HORS_POOL } from './parts/cosmetic';
import { resetDiagOnce, withDiagSubject } from './devDiag';
import { resolveRig } from './composeRig';
import { bonesToSvg } from './renderBones';
import type { Combatant, Weapon, ItemInstance, ArmourPoints } from '../../engine/types';

const noArmour: ArmourPoints = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function mkEnemy(name: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'e1',
    label: name,
    kind: 'enemy',
    characteristics: {} as Combatant['characteristics'],
    wounds: { current: 10, max: 10 },
    advantage: 0,
    conditions: [],
    weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] } as Weapon],
    armour: { ...noArmour },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  } as Combatant;
}

describe('classifyEnemy (cosmétique : humanoïde peau-humaine → rig, sinon créature)', () => {
  it('IDs de créatures humanoïdes (record → espèce bipède) → rig', () => {
    // Résolution PAR ID : le record porte son espèce explicite → def bipède. Couvre peaux-humaines,
    // peaux-vertes, hommes-bêtes, morts-vivants humanoïdes, skavens, gros/démons.
    for (const id of [
      'humain', 'nain', 'halfling', 'ogre',
      'orc', 'gobelin', 'snotling', 'squelette', 'zombie', 'goule-de-crypte',
      'gor', 'minotaure', 'troll', 'vampire',
      'skaven', 'guerrier-des-clans', 'rat-ogre',
    ]) {
      expect(classifyEnemy(id), id).toBe('rig');
    }
  });
  it('un NOM générique sans record ni espèce (rôle) → bipède Humain par défaut → rig', () => {
    // Aucune devinette par le nom : un rôle inconnu (sans record/def) tombe sur le bipède Humain (rig).
    for (const n of ['Bandit', 'Cultiste', 'Mutant', "Soldat de l'Empire", 'Rôle inconnu xyz'])
      expect(classifyEnemy(n), n).toBe('rig');
  });
  it('IDs de bêtes / morts-vivants non humanoïdes → créature', () => {
    for (const id of [
      'rat-geant', 'dragon', 'loup', 'ours',
      'araignee-geante', 'spectre', 'bete-des-marais', 'hydre',
    ]) {
      expect(classifyEnemy(id), id).toBe('creature');
    }
  });
});

describe('enemyRigProfile', () => {
  it('null pour une créature non-humanoïde (espèce explicite, comme au spawn)', () => {
    expect(enemyRigProfile(mkEnemy('Rat géant', { species: 'rat-geant' }))).toBeNull();
  });

  it('non-null pour un humanoïde, et reprend les armes du combattant', () => {
    const c = mkEnemy('Bandit');
    const p = enemyRigProfile(c)!;
    expect(p).not.toBeNull();
    expect(p.equip.weapons).toBe(c.weapons);
  });

  it('déterministe : même id ⇒ même apparence', () => {
    const a = enemyRigProfile(mkEnemy('Bandit', { id: 'abc' }))!;
    const b = enemyRigProfile(mkEnemy('Bandit', { id: 'abc' }))!;
    expect(a.appearance).toEqual(b.appearance);
  });

  it('espèce : explicite > record > défaut DÉCLARÉ en donnée (plus de name-match flou)', () => {
    expect(enemyRigProfile(mkEnemy('Truc', { species: 'nain' }))!.appearance.species).toBe('nain'); // explicite gagne
    expect(enemyRigProfile(mkEnemy('Truc', { creatureId: 'cultiste' }))!.appearance.species).toBe('humain'); // espèce du record
    expect(enemyRigProfile(mkEnemy('Cultiste'))!.appearance.species).toBe(DEFAULT_RACE_ID); // ni espèce ni record → défaut déclaré
  });

  it('espèce EXPLICITE (donnée) → tête monstrueuse portée par la Race (rendu data-driven)', () => {
    // De-POC P5/5d : l'espèce vient de la DONNÉE (record/combattant) → species pilote race.head
    // (tête monstrueuse via composeRig). Le nom est purement contextuel.
    const cases: [string, string, string | undefined][] = [
      ['Orc noir', 'orc', 'orc'],
      ['Gobelin de la nuit', 'gobelin', 'gobelin'],
      ['Snotling', 'snotling', 'gobelin'],
      ['Gor sauvage', 'gor', 'caprin'], // def dédié → race Homme-bête (tête caprine)
      ['Ungor fourrageur', 'ungor', 'caprin'],
      ['Minotaure', 'minotaure', 'taureau'],
      ['Squelette guerrier', 'squelette', 'crane'],
      ['Zombie', 'zombie', 'pourri'],
      ['Goule de crypte', 'goule', 'goule'],
      ['Troll de pierre', 'troll', 'troll'],
      ['Sanguinaire de Khorne', 'demon', 'demon'],
      ['Vampire', 'vampire', undefined], // humain pâle → pas de tête monstrueuse
    ];
    for (const [name, species, tete] of cases) {
      const p = enemyRigProfile(mkEnemy(name, { species }))!;
      expect(p.appearance.species, name).toBe(species);
      // Résolution de race du RENDU : le def peut imposer sa race (Gor → Homme-bête).
      const race = raceById(bipedDef(p.appearance.species)?.race ?? baseSpeciesOf(p.appearance.species));
      expect(race.head, name).toBe(tete);
    }
  });

  it('tenue DATA-DRIVEN : carrière explicite du combattant (plus d’inférence du nom)', () => {
    // La tenue vient de la DONNÉE — la carrière du combattant (alimentée par `appearance.tenue`
    // au spawn, cf. spawnEnemy), PAS d'une regex sur le nom (POC ROLE_CAREERS retiré, 47ec0b6).
    expect(enemyRigProfile(mkEnemy('Cultiste', { career: 'flagellant' }))!.tenue).toBe('flagellant');
    expect(enemyRigProfile(mkEnemy('Voyou', { career: 'voleur' }))!.tenue).toBe('voleur');
    // Sans donnée de tenue, un humanoïde retombe sur le défaut HABILLÉ de sa race (Humain → bourgeois,
    // pas « nu ») : le nom « Flagellant » ne suffit plus à inférer la tenue Flagellant.
    expect(enemyRigProfile(mkEnemy('Flagellant'))!.tenue).toBe('bourgeois');
  });

  it('armure de statblock SANS armurePortee → PA mécaniques PURS, AUCUN item d’art synthétisé (#774)', () => {
    // Un combattant SANS creatureId (donc sans record → armurePortee toujours absent) : les PA restent
    // lisibles côté mécanique (`c.armour`) mais ne produisent plus AUCUN item d'armure côté rendu —
    // ni torse, ni tête, ni bras/jambes (aucune garde partielle façon zones-dérivées seulement, #736).
    const c = mkEnemy('Soldat', { armour: { ...noArmour, corps: 4, tete: 2 } });
    const p = enemyRigProfile(c)!;
    expect(p.equip.armour).toEqual([]);
  });

  it('Sanguinaire de Khorne (bestiaire, NON opté) — aucun art d’armure du tout, griffes/Nu de l’espèce préservés (régression : peau dure comme l’airain qui chaussait plaques/soleret/gantelet griffus, LDB 85 l.38-39)', () => {
    // Le record `sanguinaire-de-khorne` ne porte PAS `appearance.armurePortee` (peau dure = mécanique
    // pure, pas un harnois) → `synthArmour` ne fabrique plus rien, même pour torse/tête (#774 supersède
    // #736 : avant, seules les zones DÉRIVÉES pied/main/cou étaient exemptées).
    const c = mkEnemy('Sanguinaire de Khorne', {
      creatureId: 'sanguinaire-de-khorne',
      species: 'demon',
      armour: { ...noArmour, corps: 5, tete: 5, brasG: 5, brasD: 5, jambeG: 5, jambeD: 5 },
    });
    const p = enemyRigProfile(c)!;
    expect(p.equip.armour).toEqual([]);

    const race = raceById(bipedDef('demon')?.race ?? baseSpeciesOf('demon'));
    const extremites = bipedDef('demon')?.perso?.extremites ?? race.extremites ?? 'lisses';
    expect(extremites).toBe('griffues'); // race Démon = griffue (garde de classe #736 Lot 1)

    const parts = resolveParts('demon', 'M', p.tenue, p.equip, {}, 1, 'front', extremites);
    expect(parts.pied!.svg).toBe(pickView(CLAWFOOT, 'front')); // Nu griffu, PAS le soleret d'acier
    expect(parts.main!.svg).toBe(pickView(MAIN_GRIFFUE, 'front')); // Nu griffu, PAS le gantelet d'acier
  });

  it('Capitaine du Guet (bestiaire, OPTÉ armurePortee) — art d’armure PLEIN, zones dérivées comprises (gantelets/soleret/gorgerin)', () => {
    // `capitaine-du-guet` porte `appearance.armurePortee: true` (curation #774) + trait Armure(8) →
    // matériau inféré `plaque` (PA≥4) : l'armure synthétisée rend son art SUR TOUTES les zones,
    // dérivées comprises — mieux que l'ancien régime #736 qui les exemptait systématiquement.
    const c = mkEnemy('Capitaine du Guet', {
      creatureId: 'capitaine-du-guet',
      armour: { ...noArmour, corps: 8, tete: 8, brasG: 8, brasD: 8, jambeG: 8, jambeD: 8 },
    });
    const p = enemyRigProfile(c)!;
    expect(p.equip.armour.some((i) => (i.locs ?? []).includes('corps'))).toBe(true);
    expect(p.equip.armour.some((i) => (i.locs ?? []).includes('tete'))).toBe(true);
    const bras = p.equip.armour.find((i) => (i.locs ?? []).includes('brasG'));
    const jambes = p.equip.armour.find((i) => (i.locs ?? []).includes('jambeG'));
    expect(bras).toBeTruthy();
    expect(jambes).toBeTruthy();
    // Zones DÉRIVÉES (main←bras, pied←jambes) : art PLEIN, pas de repli Nu.
    expect(armourPart(bras!, 'main')).not.toBeNull();
    expect(armourPart(jambes!, 'pied')).not.toBeNull();
  });

  it('parité #181/#182 EN COMBAT : entité à statbloc SANS record honore SON armurePortee (override d’authoring), pas seulement en explo', () => {
    // Bug corrigé : `spawn.ts` ne portait `armurePortee` dans `appearanceOverride` QUE si un autre champ
    // (species/monster/couleurs…) était aussi renseigné — une entité SANS record, armurePortee SEUL,
    // n'attachait donc AUCUN override → `enemyRigProfile` ne lisait que `cd?.armurePortee` (toujours
    // undefined, pas de record) → armure invisible en combat alors que visible en explo (`entityRigProfile`,
    // qui lit déjà `opts.armurePortee`). Symétrique désormais : `ov?.armurePortee ?? cd?.armurePortee`.
    const c = spawnEnemy({ statblock: { type: 'statblock', label: 'Soudard sans record', char: { B: 10 }, armour: 5 } }, 'sans-record-1', { x: 0, y: 0 }, {
      appearance: { armurePortee: true },
    });
    expect(enemyRigProfile(c)!.equip.armour.length).toBeGreaterThan(0);
  });

  it('parité #181/#182 EN COMBAT : override d’entité (armurePortee: false) PRIME sur le record curé (true)', () => {
    // Cas inverse : `capitaine-du-guet` est curé `armurePortee: true` au bestiaire, mais une entité
    // d'auteur peut désactiver EXPLICITEMENT le rendu de son armure de statblock (override prime).
    const c = spawnEnemy({ ref: 'capitaine-du-guet' }, 'capitaine-desarme-1', { x: 0, y: 0 }, {
      appearance: { armurePortee: false },
    });
    expect(enemyRigProfile(c)!.equip.armour).toEqual([]);
  });

  it('utilise l’inventaire du combattant s’il en a un', () => {
    const item: ItemInstance = {
      uid: 'a1', label: 'Brigandine', kind: 'armor', qualities: [], pa: 2,
      locs: ['corps'], enc: 1, equipped: true,
    };
    const c = mkEnemy('Bandit', { items: [item], armour: { ...noArmour, corps: 9 } });
    const p = enemyRigProfile(c)!;
    expect(p.equip.armour).toContain(item); // l'inventaire prime sur la synthèse
  });

  it('mutation visuelle = DONNÉE (c.mutations), plus jamais le nom (POC isMutant retiré)', () => {
    // enemyRigProfile ne fabrique plus AUCUN calque depuis le nom : un combattant nommé « Mutant »
    // SANS mutations dans sa donnée n'a pas de calque (le profil ne porte aucun champ overlays).
    expect(enemyRigProfile(mkEnemy('Mutant'))).not.toHaveProperty('overlays');
    // Le visuel de mutation vient des mutations RÉELLES du combattant (combatantOverlays), résolu PAR ID :
    const mute = mkEnemy('Humain', { mutations: [mutationById('cornes-asymetriques')!] });
    expect(combatantOverlays(mute).some((o) => o.svg.includes('data-mut="cornes-asymetriques"'))).toBe(true);
    // Sans mutation dans la donnée → aucun calque (Guerrier du Chaos tient son identité de sa RACE).
    expect(combatantOverlays(mkEnemy('Guerrier du Chaos')).length).toBe(0);
    expect(combatantOverlays(mkEnemy('Bandit')).length).toBe(0);
  });
});

describe('entityRigProfile (entité de scène, ambiance hors combat)', () => {
  it('humanoïde → profil sans équipement de combat (et plus d’overlays dérivés du nom)', () => {
    const p = entityRigProfile('Mutant', 42)!;
    expect(p).not.toBeNull();
    expect(p.equip.weapons).toEqual([]);
    // Le profil ne porte plus de calques dérivés du nom (POC isMutant retiré) : l'ambiance mutée
    // déclare ses parts dans sa donnée d'apparence (monster), pas via une regex.
    expect(p).not.toHaveProperty('overlays');
  });
  it('villageois (id de record) → espèce du record ; tenue portée en DONNÉE (plus d’inférence du nom)', () => {
    const p = entityRigProfile('villageois', 1)!;
    expect(p.appearance.species).toBe('humain');
    expect(p.tenue).toBe('villageois'); // tenue DÉCLARÉE par le record ; elle ne se déduit plus du nom (POC retiré)
    // L'ambiance porte sa tenue via `appearance.tenue` (tokenBodyKind → opts.tenue) — honorée telle quelle (id).
    expect(entityRigProfile('villageois', 1, { tenue: 'mendiant' })!.tenue).toBe('mendiant');
    // Une réf qui n'est PAS un id de record (un LIBELLE) ne résout AUCUNE espèce → défaut déclaré en donnée.
    const inconnue = entityRigProfile('Villageois', 1)!;
    expect(inconnue.appearance.species).toBe(DEFAULT_RACE_ID);
    expect(inconnue.tenue).toBe('bourgeois'); // sans record : défaut HABILLÉ de la race par défaut
  });
  it('non-humanoïde (id de record) → null (garde le sprite créature)', () => {
    expect(entityRigProfile('rat-geant', 1)).toBeNull();
  });
  it('déterministe sur le seed', () => {
    expect(entityRigProfile('Mutant', 7)!.appearance).toEqual(entityRigProfile('Mutant', 7)!.appearance);
  });

  it('équipement de combat AFFICHÉ en explo (parité avec le combat) : armes + armure dérivées du profil (opt-in armurePortee, #774)', () => {
    // Entité SANS record de bestiaire (statbloc d'éditeur) : l'armure de statblock ne rend son art
    // QUE si l'authoring la déclare portée (`opts.armurePortee`, override, ex. `ent.appearance.armurePortee`).
    const p = entityRigProfile('Soldat', 1, { traits: [{ id: 'arme', value: 7, arg: 'Hache' }] as never, armour: 2, armurePortee: true })!;
    expect(p.equip.weapons.some((w) => /hache/i.test(w.label))).toBe(true); // arme EXPLICITE tenue en main
    expect(p.equip.armour.length).toBeGreaterThan(0);                       // armure dessinée (PA → pièces)
  });

  it('sans armurePortee (défaut), l’armure de statblock reste mécanique pure côté explo aussi', () => {
    const p = entityRigProfile('Soldat', 1, { traits: [{ id: 'arme', value: 7, arg: 'Hache' }] as never, armour: 2 })!;
    expect(p.equip.armour).toEqual([]);
  });

  it('entité SANS arme/armure (villageois, ambiance) → mains libres préservées', () => {
    const p = entityRigProfile('Soldat', 1, { traits: [] as never })!;
    expect(p.equip.weapons).toEqual([]); // pas de repli « Arme » générique (qui serait dessiné en épée)
    expect(p.equip.armour).toEqual([]);
  });

  it('repli record GATÉ par l’enrôlement : enrôlée (combattante) → équipée ; ambiance → mains libres', () => {
    // Sans statbloc, l'équipement par défaut ne vient du record QUE si l'entité est ENRÔLÉE (membre d'une
    // rencontre) — parité avec le spawn `creatureToCombatant`. Non enrôlée = ambiance = mains libres,
    // même si le record porte un trait « Arme »/« Armure » (un villageois ne dégaine pas pour décorer).
    // Cible : un id de créature rig dont le record produit une arme une fois enrôlé (découvert au runtime).
    const target = creatures.find((c) => {
      if (classifyEnemy(c.id) !== 'rig') return false;
      const enrolled = entityRigProfile(c.id, 1, { enrolled: true });
      return !!enrolled && enrolled.equip.weapons.length > 0;
    });
    expect(target, 'au moins une créature rig armée par son record').toBeTruthy();
    const id = target!.id;
    expect(entityRigProfile(id, 1, { enrolled: true })!.equip.weapons.length).toBeGreaterThan(0); // enrôlée → kit
    expect(entityRigProfile(id, 1)!.equip.weapons).toEqual([]); // ambiance (défaut non enrôlée) → mains libres
    expect(entityRigProfile(id, 1)!.equip.armour).toEqual([]);
  });
});

/** Sexe et coiffure posés par deux couches différentes (`rigAppearance`) : `coiffureRetombee` (#1897). */
describe('coiffure du record, sexe de l’entité — la coiffure retombe', () => {
  it('coiffure F au record + `sex: M` sur l’entité → coiffure par défaut de l’espèce et du sexe rendus, jamais la chevelure d’erreur', () => {
    const avant = [...creatures];
    const rendu = (p: NonNullable<ReturnType<typeof entityRigProfile>>) => bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, 'front', []));
    const attendu = rendu(entityRigProfile('villageois', 1, { sex: 'M' })!);
    setDataset('creatures', creatures.map((c) => (c.id === 'villageois'
      ? { ...c, appearance: { ...c.appearance!, sex: 'F' as const, hairstyle: 'queue-de-cheval-haute-f' } }
      : c)));
    try {
      expect(entityRigProfile('villageois', 1)!.appearance).toMatchObject({ sex: 'F', hairstyle: 'queue-de-cheval-haute-f' });
      const p = entityRigProfile('villageois', 1, { sex: 'M' })!;
      expect(p.appearance.sex).toBe('M');
      expect(p.appearance.hairstyle).toBeUndefined();
      expect(rendu(p)).not.toContain(COIFFURE_HORS_POOL);
      expect(rendu(p)).toBe(attendu);
      // La contradiction posée par UNE couche reste une faute de donnée VISIBLE (le schéma la nomme).
      expect(rendu(entityRigProfile('villageois', 1, { sex: 'M', hairstyle: 'queue-de-cheval-haute-f' })!)).toContain(COIFFURE_HORS_POOL);
    } finally {
      setDataset('creatures', avant);
    }
  });
  it('le retrait se DIT : un avertissement console nomme le sujet, la coiffure retirée et le sexe posé au-dessus', () => {
    const avant = [...creatures];
    setDataset('creatures', creatures.map((c) => (c.id === 'villageois'
      ? { ...c, appearance: { ...c.appearance!, sex: 'F' as const, hairstyle: 'queue-de-cheval-haute-f' } }
      : c)));
    resetDiagOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      withDiagSubject('scene-x/pnj-1', () => entityRigProfile('villageois', 1, { sex: 'M' }));
      expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([
        "[rig] « scene-x/pnj-1 » : coiffure « queue-de-cheval-haute-f » (sexe : Féminin) retirée au rendu — une couche d'apparence plus haute pose le sexe Masculin.",
      ]);
      warn.mockClear();
      withDiagSubject('scene-x/pnj-2', () => entityRigProfile('villageois', 1));
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      resetDiagOnce();
      setDataset('creatures', avant);
    }
  });
});

/** L'override d'apparence du combattant (`spawnEnemy`) porte TOUTE l'apparence d'auteur posée — pas une
 *  liste de champs tenue à la main : un PNJ dont la seule surcharge est une coiffure la garde en combat. */
describe('spawnEnemy — une coiffure seule traverse jusqu’au rendu du combattant', () => {
  it('coiffure imposée seule : le profil de combat la porte et le rig change', () => {
    const sansCoiffure = spawnEnemy({ ref: 'mutant' }, 'pnj-coiffe', { x: 0, y: 0 });
    const avant = enemyRigProfile(sansCoiffure)!;
    const coiffure = hairstylesForSex(avant.appearance.sex)[1].id;
    const coiffe = spawnEnemy({ ref: 'mutant' }, 'pnj-coiffe', { x: 0, y: 0 }, { appearance: { hairstyle: coiffure } });
    const apres = enemyRigProfile(coiffe)!;
    expect(apres.appearance.hairstyle).toBe(coiffure);
    const rendu = (p: typeof apres) => bonesToSvg(resolveRig(p.appearance, p.equip, {}, p.tenue, 'front', []));
    expect(rendu(apres)).not.toBe(rendu(avant));
  });
});
