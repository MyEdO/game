import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { shipHasNavalTrait, navalTraitLevel, navalTraitsDe, hullNavalTraits, vesselNavalTraits, navalPassiveOps, navalMoveMod, navalMoveMult, navalSkillTestDR, navalTestTypeDR, navalNavTestMod, navalNavTestDR, hullArmourBonus, belierRam, navalDeckCover, couvertDuPoste } from './navalTraits';
import { resolveCollision } from './collision';
import { installCost } from './shipBuild';
import navalTraitsData from '../data/naval-traits.json';
import { findVehicleById, findNavalTrait, findCrewTestTypeById } from '../data';
import type { Combatant } from './types';

/** Forme LUE du catalogue naval par ce fichier : la référence de Compétence d'une op y est EMBOÎTÉE. */
type NavalEntree = { id: string; passive?: { op: string; skill?: { id: string }; bonus?: number }[] };

/**
 * EFFETS des Traits & Améliorations de navire (MDG 12) — DATA-DRIVEN : les valeurs vivent dans le catalogue
 * `naval-traits.json` (éditable au Codex), `navalTraits.ts` ne fait que les LIRE et les exposer là où une brique
 * EXISTANTE les consomme (collision pour le Bélier, pont pour le Sabord, manœuvre/spawn pour Lissage/Blindage).
 * On ne RÉ-applique pas Renforcé/Solide (déjà bakés dans les colonnes E/B des navires nommés → pas de `passive`).
 * Les Traits/Améliorations sont des RÉFS par id (`NavalTraitRef = { id, value? }`), JAMAIS des libellés.
 */
describe('shipHasNavalTrait / navalTraitLevel — réfs par id (NavalTraitRef)', () => {
  it('reconnaît un Trait présent par son id ; l’Indice vient de `value`', () => {
    const patrouille = findVehicleById('bateau-de-patrouille')!.ship!.traits; // [{belier},{renforce,2},{solide,2}]
    expect(shipHasNavalTrait(patrouille, 'belier')).toBe(true);
    expect(shipHasNavalTrait(patrouille, 'renforce')).toBe(true);
    expect(shipHasNavalTrait(patrouille, 'solide')).toBe(true);
    expect(navalTraitLevel(patrouille, 'renforce')).toBe(2); // value:2
    expect(navalTraitLevel(patrouille, 'belier')).toBe(1); // value absent → Indice 1
  });
  it('Trait absent / liste vide / undefined → false (pas de faux positif)', () => {
    expect(shipHasNavalTrait(findVehicleById('cogue')!.ship!.traits, 'belier')).toBe(false); // cogue : peu-maniable, robuste
    expect(shipHasNavalTrait([], 'belier')).toBe(false);
    expect(shipHasNavalTrait(undefined, 'belier')).toBe(false);
  });
  it('navalTraitLevel : `value` explicite, défaut 1 si absent, 0 si le Trait n’est pas là', () => {
    expect(navalTraitLevel([{ id: 'peu-maniable' }, { id: 'robuste' }], 'peu-maniable')).toBe(1); // value absent → 1
    expect(navalTraitLevel([{ id: 'renforce', value: 2 }, { id: 'solide', value: 2 }], 'renforce')).toBe(2);
    expect(navalTraitLevel([{ id: 'renforce', value: 2 }], 'solide')).toBe(0); // absent
    expect(navalTraitLevel(undefined, 'peu-maniable')).toBe(0);
  });
});

describe('navalPassiveOps — effets en GameOp (langue unique), répétés ×Indice (Trait ranked)', () => {
  it('aplatit le `passive` du catalogue : Lissage → moveMod ; Peu maniable → 2× skillDRBonus (Ramer/Voile)', () => {
    expect(navalPassiveOps([{ id: 'lissage' }])).toEqual([{ op: 'moveMod', mod: 1 }]);
    expect(navalPassiveOps([{ id: 'peu-maniable' }])).toEqual([
      { op: 'skillDRBonus', skill: { id: 'ramer' }, bonus: -1 },
      { op: 'skillDRBonus', skill: { id: 'voile' }, bonus: -1 },
    ]);
    // ranked → le bloc `passive` est répété par `value` (« Peu maniable 3 » = 3× les deux ops).
    expect(navalPassiveOps([{ id: 'peu-maniable', value: 3 }])).toHaveLength(6);
    expect(navalPassiveOps([{ id: 'robuste' }])).toEqual([{ op: 'skillDRBonus', testType: { id: 'affaler' }, bonus: 2 }]);
    expect(navalPassiveOps(undefined)).toEqual([]);
  });
});

describe('navalMoveMod — Lissage → M, op moveMod (MDG 12 l.293)', () => {
  it('Lissage → +1 ; sans Lissage → 0', () => {
    expect(navalMoveMod([{ id: 'lissage' }])).toBe(1);
    expect(navalMoveMod([{ id: 'belier' }, { id: 'sabord' }])).toBe(0);
    expect(navalMoveMod(undefined)).toBe(0);
  });
});

describe('navalSkillTestDR — Peu maniable → DR de Voile/Ramer, op skillDRBonus (MDG 12 l.173)', () => {
  it('−1 DR/niveau aux Tests de Voile ET de Ramer ; autre compétence ou Trait → 0', () => {
    expect(navalSkillTestDR([{ id: 'peu-maniable' }], 'voile')).toBe(-1);
    expect(navalSkillTestDR([{ id: 'peu-maniable' }], 'ramer')).toBe(-1);
    expect(navalSkillTestDR([{ id: 'peu-maniable', value: 3 }], 'voile')).toBe(-3); // × Indice (value)
    expect(navalSkillTestDR([{ id: 'peu-maniable' }], 'navigation')).toBe(0); // ne touche pas les autres compétences
    expect(navalSkillTestDR([{ id: 'robuste' }], 'voile')).toBe(0);
    expect(navalSkillTestDR(undefined, 'voile')).toBe(0);
  });
});

describe('navalSkillTestDR — non-régression sur le catalogue entier (#221, 20 entrées)', () => {
  it.each(
    (navalTraitsData as NavalEntree[])
      .filter((e) => e.passive?.some((op) => op.op === 'skillDRBonus' && op.skill))
      .map((e) => e.id),
  )('%s : DR par compétence inchangé, indépendant de `testType`', (id) => {
    const entry = (navalTraitsData as NavalEntree[]).find((e) => e.id === id)!;
    for (const op of entry.passive!.filter((o) => o.op === 'skillDRBonus' && o.skill)) {
      expect(navalSkillTestDR([{ id }], op.skill!.id)).toBe(op.bonus);
    }
  });
  it('une op `testType` SANS `skill` (Proue-idole de Stromfels) ne matche JAMAIS `navalSkillTestDR`', () => {
    expect(navalSkillTestDR([{ id: 'proue-idole-de-stromfels' }], 'voile')).toBe(0);
    expect(navalSkillTestDR([{ id: 'proue-idole-de-stromfels' }], 'ramer')).toBe(0);
  });
});

describe('navalTestTypeDR — Proue-idole de Stromfels & vocabulaire `testType` (#221)', () => {
  it('matche le TYPE de Test d’équipage visé, agnostique de la compétence tenue par le représentant', () => {
    expect(navalTestTypeDR([{ id: 'proue-idole-de-stromfels' }], 'progression-poursuite')).toBe(1);
  });
  it('un autre type de Test d’équipage → 0 (pas de fuite hors cible)', () => {
    expect(navalTestTypeDR([{ id: 'proue-idole-de-stromfels' }], 'manoeuvre')).toBe(0);
    expect(navalTestTypeDR([{ id: 'proue-idole-de-stromfels' }], 'progression')).toBe(0);
  });
  it('une op `skill` SANS `testType` (Peu maniable) ne matche JAMAIS `navalTestTypeDR`', () => {
    expect(navalTestTypeDR([{ id: 'peu-maniable' }], 'manoeuvre')).toBe(0);
  });
  it('catalogue vide / trait absent → 0', () => {
    expect(navalTestTypeDR(undefined, 'progression-poursuite')).toBe(0);
    expect(navalTestTypeDR([{ id: 'belier' }], 'progression-poursuite')).toBe(0);
  });
  it('cumule à travers PLUSIEURS traits ciblant le même type (même sommation que le ranked de `navalPassiveOps`, l.44)', () => {
    expect(navalTestTypeDR([{ id: 'proue-idole-de-stromfels' }, { id: 'proue-idole-de-stromfels' }], 'progression-poursuite')).toBe(2);
  });
  // #1011 — Robuste (MDG 12 folio 97) : « Un navire Robuste reçoit +2 DR sur ses Tests d'équipage
  // d'Affaler les voiles (voir page 123) ». MÊME canal `testType` que la Proue-idole : le DR entre par
  // `navalTestTypeDR` dans le `flatDR` du Test d'équipage (`buildVoyageCrewStep`, `openCrewTestPending`).
  it('Robuste → +2 DR sur le SEUL type « Affaler les voiles », qui existe au catalogue', () => {
    expect(navalTestTypeDR([{ id: 'robuste' }], 'affaler')).toBe(2);
    expect(findCrewTestTypeById('affaler')).toBeDefined();
  });
  it('Robuste ne fuit sur AUCUN autre type de Test d’équipage', () => {
    for (const other of ['progression', 'progression-poursuite', 'manoeuvre', 'perception', 'orientation', 'batterie']) {
      expect(navalTestTypeDR([{ id: 'robuste' }], other)).toBe(0);
    }
  });
});

describe('Proue-idole de Stromfels (#221) — résout au catalogue, entrée maison sourcée MDG 11 (culte)', () => {
  it('id trouvable, type de Test d’équipage visé existant dans crew-test-types.json', () => {
    const trait = findNavalTrait('proue-idole-de-stromfels');
    expect(trait).toBeDefined();
    expect(trait!.kind).toBe('amelioration');
    expect(trait!.maison).toBeTruthy();
    const op = trait!.passive![0];
    const testTypeId = op.op === 'skillDRBonus' ? op.testType?.id : undefined;
    expect(testTypeId).toBe('progression-poursuite');
    expect(findCrewTestTypeById(testTypeId!)).toBeDefined();
  });
});

describe('hullArmourBonus — Blindage → PA de coque, op `ap` (MÊME op qu’une mutation ; MDG 12 l.234/236)', () => {
  it('Fer → 2 PA, Bronze → 1 PA (sommés depuis le `passive`) ; hors catalogue → 0', () => {
    expect(hullArmourBonus([{ id: 'blindage-fer' }])).toBe(2);
    expect(hullArmourBonus([{ id: 'blindage-bronze' }])).toBe(1);
    expect(hullArmourBonus([{ id: 'blindage' }])).toBe(0); // pas d'entrée générique : le matériau (bronze/fer) est requis
    expect(hullArmourBonus([{ id: 'lissage' }, { id: 'sabord' }])).toBe(0); // pas de Blindage
    expect(hullArmourBonus(undefined)).toBe(0);
  });
});

describe('belierRam — bonus de collision lu en DONNÉE (MDG 12 l.221)', () => {
  it('Bélier → { ic: 5, ap: 5 } depuis le catalogue ; absent → { 0, 0 }', () => {
    expect(belierRam([{ id: 'belier' }])).toEqual({ ic: 5, ap: 5 });
    expect(belierRam([{ id: 'lissage' }])).toEqual({ ic: 0, ap: 0 });
    expect(belierRam(undefined)).toEqual({ ic: 0, ap: 0 });
  });
});

describe('Bélier dans la collision — valeurs data-driven (MDG 12 l.221)', () => {
  const belier = belierRam([{ id: 'belier' }]); // { ic: 5, ap: 5 } depuis naval-traits.json

  it('éperonner de sa proue → +ic à l’IC du causeur (la victime encaisse +5) + ap PA frontaux au causeur', () => {
    const victim = { ic: 3, m: 3 };
    const sansBelier = resolveCollision({ ic: 5, m: 4 }, victim, { ramProue: true });
    const avecBelier = resolveCollision({ ic: 5, m: 4, belier }, victim, { ramProue: true });
    expect(avecBelier.victim.damage).toBe(sansBelier.victim.damage + 5); // +ic à l'IC du causeur
    expect(avecBelier.victim.damage).toBe(14); // 5 (IC) + 5 (Bélier) + 4 (M du causeur)
    expect(avecBelier.causer.damage).toBe(sansBelier.causer.damage); // 3 (IC victime) + 4 (M) = 7
    expect(avecBelier.causer.armorBonus).toBe(5); // ap PA frontaux
  });

  it('sans frapper de la proue (ni ramProue ni frontal) → le Bélier ne joue pas', () => {
    const r = resolveCollision({ ic: 5, m: 4, belier }, { ic: 3, m: 3 }, {});
    expect(r.victim.damage).toBe(9); // 5 + 4, sans bonus de Bélier
    expect(r.causer.armorBonus).toBe(0);
  });

  it('collision frontale → la proue de la victime encaisse aussi : son Bélier lui donne ap PA', () => {
    const r = resolveCollision({ ic: 5, m: 4 }, { ic: 3, m: 3, belier }, { frontal: true });
    expect(r.victim.armorBonus).toBe(5); // victime à Bélier, frappée de face
    expect(r.causer.armorBonus).toBe(0); // causeur sans Bélier
    expect(r.victim.damage).toBe(5 + 7); // M frontal = M total des deux (l.462) → 4 + 3 = 7
  });
});

describe('Améliorations MSRC 12 (Personnalisation) — MÊME canal que MDG, entrées PROPRES au MSRC', () => {
  it('Bouteur → moveMod −1 sur le canal navalMoveMod (MSRC 12 : « réduit la vitesse de Mouvement de –1 »)', () => {
    expect(navalMoveMod([{ id: 'bouteur' }])).toBe(-1);
    // combiné à Lissage (+1) : les moveMod se somment sur le canal unique.
    expect(navalMoveMod([{ id: 'bouteur' }, { id: 'lissage' }])).toBe(0);
  });
  it('Bouteur → +20 au Test de Navigation pour diriger (MSRC 12 l.66) ; converti +2 DR d’équipage', () => {
    expect(navalNavTestMod([{ id: 'bouteur' }])).toBe(20);
    expect(navalNavTestDR([{ id: 'bouteur' }])).toBe(2); // ÷10 (LDB : 10 pts = 1 DR)
  });
  it('Gréement de course → −10 au Test de Navigation (MSRC 12 l.140) ; converti −1 DR d’équipage', () => {
    expect(navalNavTestMod([{ id: 'greement-de-course' }])).toBe(-10);
    expect(navalNavTestDR([{ id: 'greement-de-course' }])).toBe(-1);
  });
  it('navTestMod : cumul (Bouteur + Gréement = +10 → +1 DR) ; trait sans navTestMod / absent → 0', () => {
    expect(navalNavTestMod([{ id: 'bouteur' }, { id: 'greement-de-course' }])).toBe(10);
    expect(navalNavTestDR([{ id: 'bouteur' }, { id: 'greement-de-course' }])).toBe(1);
    expect(navalNavTestMod([{ id: 'lissage' }, { id: 'sabord' }])).toBe(0);
    expect(navalNavTestDR(undefined)).toBe(0);
  });
  it('Murs blindés → deckCover totale (comme Sabord) sur le canal navalDeckCover', () => {
    expect(navalDeckCover([{ id: 'murs-blindes' }])).toBe('totale');
  });
  it('coût d’installation posé sur des PALIERS DE LONGUEUR (#277 — canal installCost EXISTANT) — pas de duplication d’un chantier', () => {
    // Grande barge (~25 m, bande ouverte) : Bouteur 120 CO / 95 Enc ; Murs blindés 300 CO / 160 Enc (MSRC 12 l.62/64, l.80/82).
    const bouteur = findNavalTrait('bouteur')!.install!;
    const murs = findNavalTrait('murs-blindes')!.install!;
    expect(installCost(bouteur, 25)).toEqual({ gold: 120, enc: 95 });
    expect(installCost(murs, 25)).toEqual({ gold: 300, enc: 160 });
  });
  it('barque (5 m) vs esquif de pêche (10 m) : MÊME `ShipSize` « minuscule », tarifs DIFFÉRENTS (#277, MSRC 12 l.62/64)', () => {
    // Le RAW tarife par TYPE de navire à longueurs explicites, pas par bande de Taille — la Taille aurait
    // confondu les deux (10 m ≤ borne « minuscule » = 10 m, cf. shipSizeOfLength).
    const bouteur = findNavalTrait('bouteur')!.install!;
    expect(installCost(bouteur, 5)).toEqual({ gold: 8, enc: 5 }); // barque
    expect(installCost(bouteur, 10)).toEqual({ gold: 30, enc: 35 }); // esquif de pêche
  });
  it('les 4 paliers RAW des 6 Améliorations MSRC 12 (barque/esquif/moyenne+patrouille/grande barge)', () => {
    const cases: [string, [number, number][]][] = [
      ['safran', [[5, 5], [25, 20], [50, 40], [120, 80]]], // l.54/56
      ['bouteur', [[8, 5], [30, 35], [60, 55], [120, 95]]], // l.62/64
      ['murs-blindes', [[15, 15], [60, 40], [120, 80], [300, 160]]], // l.80/82
      ['plat-bord', [[5, 5], [15, 20], [30, 35], [45, 60]]], // l.107/109
      ['allegement', [[20, -10], [50, -15], [150, -45], [250, -80]]], // l.115/117
      ['greement-de-course', [[8, 5], [30, 15], [60, 25], [120, 50]]], // l.133/135
    ];
    const lengths = [5, 10, 20, 30]; // barque / esquif / barge moyenne / grande barge (bande ouverte)
    for (const [id, tiers] of cases) {
      const install = findNavalTrait(id)!.install!;
      tiers.forEach(([gold, enc], i) => {
        expect(installCost(install, lengths[i])).toEqual({ gold, enc });
      });
    }
  });
});

describe('Sabord/Plat-bord → couvert GRADUÉ des postes (MDG 12 l.362-364, MSRC 12 l.85/111), data-driven', () => {
  /** Coque `cogue` portant les Améliorations `upgrades` (par instance, `hullNavalTraits`). */
  const coque = (upgrades: { id: string }[]): Combatant => ({ id: 'h', creatureId: 'cogue', upgrades }) as unknown as Combatant;

  it('navalDeckCover lit le champ `deckCover` gradué (Sabord → totale ; Plat-bord → moyenne ; autre/absent → none)', () => {
    expect(navalDeckCover([{ id: 'sabord' }])).toBe('totale');
    expect(navalDeckCover([{ id: 'plat-bord' }])).toBe('moyenne');
    expect(navalDeckCover([{ id: 'lissage' }, { id: 'belier' }])).toBe('none');
    expect(navalDeckCover(undefined)).toBe('none');
  });

  it('couvert PARTIEL (Plat-bord, moyenne) distinct du couvert TOTAL (Sabord/Murs, totale) — bonus moindre', () => {
    // MSRC 12 l.111 « couverture moyenne … Difficiles » (−20) ≠ l.85/l.727 « couverture totale … Très Difficile » (−30).
    expect(navalDeckCover([{ id: 'plat-bord' }])).not.toBe(navalDeckCover([{ id: 'sabord' }]));
    // Cumul : le MEILLEUR couvert l'emporte (Plat-bord + Sabord → totale).
    expect(navalDeckCover([{ id: 'plat-bord' }, { id: 'sabord' }])).toBe('totale');
  });

  it('sans Amélioration couvrante : tir depuis le pont, aucun couvert', () => {
    expect(findVehicleById('cogue')!.ship!.traits.some((t) => findNavalTrait(t.id)?.deckCover)).toBe(false);
    expect(couvertDuPoste(coque([]), {})).toBe('none');
  });

  it('Amélioration Sabord : le servant d’un poste est à couvert total', () => {
    expect(couvertDuPoste(coque([{ id: 'sabord' }]), {})).toBe('totale');
  });

  it('Amélioration Plat-bord : couvert moyen ; un poste authoré plus couvert garde le sien', () => {
    expect(couvertDuPoste(coque([{ id: 'plat-bord' }]), {})).toBe('moyenne');
    expect(couvertDuPoste(coque([{ id: 'plat-bord' }]), { cover: 'totale' })).toBe('totale');
  });
});

describe('navalMoveMult — Coque de course → 2×M, op moveScale (MSRC 12 l.27)', () => {
  it('Coque de course → facteur 2/1 ; sans multiplicateur → neutre 1/1', () => {
    expect(navalMoveMult([{ id: 'coque-de-course' }])).toEqual({ num: 2, den: 1 });
    expect(navalMoveMult([{ id: 'lissage' }, { id: 'sabord' }])).toEqual({ num: 1, den: 1 });
    expect(navalMoveMult(undefined)).toEqual({ num: 1, den: 1 });
  });
  it('le passif de Coque de course est un moveScale (langue unique, PAS un champ ad hoc)', () => {
    expect(navalPassiveOps([{ id: 'coque-de-course' }])).toEqual([{ op: 'moveScale', num: 2, den: 1 }]);
  });
});

describe('Nouvelles Améliorations MSRC 12 — résolvent au catalogue + coût d’installation (canal EXISTANT)', () => {
  it.each(['coque-de-course', 'safran', 'plat-bord', 'allegement', 'greement-de-course', 'fourquines'])(
    '%s : entrée présente, kind amelioration, source MSRC, install chiffré', (id) => {
      const e = findNavalTrait(id)!;
      expect(e).toBeDefined();
      expect(e.kind).toBe('amelioration');
      expect(e.source?.book).toBe('mort-sur-le-reik-compagnon');
      expect(e.install).toBeDefined();
    });
  it('Coque de course : coût per:10m (MSRC « 220 CO pour 10 mètres ») — 20 m de coque → 440 CO, −100 Enc', () => {
    // per:'10m' → ×ceil(20/10)=2 (MSRC 12 l.23/25) ; bande unique (uniforme, aucun palier de longueur).
    expect(installCost(findNavalTrait('coque-de-course')!.install!, 20)).toEqual({ gold: 440, enc: -100 });
  });
  it('Fourquines : coût à l’unité (MSRC « 1 CO la pièce, +1 Enc ») — 3 pièces → 3 CO / 3 Enc', () => {
    expect(installCost(findNavalTrait('fourquines')!.install!, 15, 3)).toEqual({ gold: 3, enc: 3 });
  });
  it('Plat-bord : palier de LONGUEUR (grande barge ~30 m, bande ouverte au-delà de 20 m) → 45 CO / 60 Enc (MSRC 12 l.107/109)', () => {
    expect(installCost(findNavalTrait('plat-bord')!.install!, 30)).toEqual({ gold: 45, enc: 60 });
  });
  it('Allégement : ALLÈGE la coque — weightEnc NÉGATIF (grande barge → −80 Enc, MSRC 12 l.117)', () => {
    expect(installCost(findNavalTrait('allegement')!.install!, 30)).toEqual({ gold: 250, enc: -80 });
  });
});

/**
 * FOYER UNIQUE de la concaténation « Traits du TYPE + Améliorations d'INSTANCE » (MDG 12 l.81/169).
 *
 * Le JSDoc de `navalTraitsDe` AFFIRME que personne ne réécrit ce spread ; cette garde le MESURE, sinon
 * l'affirmation ne serait qu'un commentaire. Les deux porteurs du repo (`Combatant.creatureId` +
 * `upgrades` ; `CampaignVessel.vehicleId` + `upgrades`) se réduisent au MÊME couple, et n'ont qu'un
 * ADAPTATEUR chacun — un 3ᵉ site qui recomposerait la liste à la main perdrait l'ORDRE (le Trait du
 * type prime) sans qu'aucun test métier ne rougisse.
 */
describe('navalTraitsDe — foyer UNIQUE de la concaténation type + instance', () => {
  /** Le spread mesuré : un `...(<x>.traits ?? [])` suivi d'un `...(<y>.upgrades ?? [])`. */
  const RECOMPOSE = /\.\.\.\([^)]*traits\s*\?\?\s*\[\]\)\s*,\s*\.\.\.\([^)]*upgrades\s*\?\?\s*\[\]\)/;

  it('AUCUN site de `src/**` ne recompose la liste hors du foyer', () => {
    const fautifs: string[] = [];
    for (const { rel, text } of readCorpus(['src'], { tests: true })) {
      // Le FOYER (`navalTraits.ts`) et CE fichier sont hors mesure : leur corps EST le motif.
      if (rel.endsWith('/navalTraits.ts') || rel.endsWith('naval-traits.test.ts')) continue;
      text.split('\n').forEach((l, i) => {
        if (RECOMPOSE.test(l)) fautifs.push(`${rel.slice('src/'.length)}:${i + 1}`);
      });
    }
    expect(
      fautifs,
      'site(s) recomposant « Traits du type + Améliorations d’instance » à la main : passer par `hullNavalTraits` ' +
        '(Combatant) ou `vesselNavalTraits` (CampaignVessel) — l’ORDRE des deux listes est porteur (MDG 12 l.81/169).',
    ).toEqual([]);
  });

  it('le détecteur MORD : une recomposition INJECTÉE est vue (sans quoi le vert serait vide)', () => {
    expect(RECOMPOSE.test('  const t = [...(vd?.traits ?? []), ...(hull.upgrades ?? [])];')).toBe(true);
    expect(RECOMPOSE.test('  const t = hullNavalTraits(hull);')).toBe(false);
  });

  it('les deux ADAPTATEURS rendent la MÊME liste pour le même couple, dans l’ordre type → instance', () => {
    const upgrades = [{ id: 'blindage-fer' }];
    const hull = { creatureId: 'barge-fluviale', upgrades } as unknown as Parameters<typeof hullNavalTraits>[0];
    const attendu = [...findVehicleById('barge-fluviale')!.ship!.traits, ...upgrades];
    expect(hullNavalTraits(hull)).toEqual(attendu);
    expect(vesselNavalTraits({ vehicleId: 'barge-fluviale', upgrades })).toEqual(attendu);
    expect(navalTraitsDe('barge-fluviale', upgrades)).toEqual(attendu);
    // Porteur inconnu / absent : liste vide, jamais une exception.
    expect(navalTraitsDe(undefined, undefined)).toEqual([]);
    expect(vesselNavalTraits(null)).toEqual([]);
  });
});
