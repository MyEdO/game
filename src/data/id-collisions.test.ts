/**
 * Garde-fou d'INTÉGRITÉ des identifiants de données.
 *
 * (1) Unicité INTRA-catégorie : deux entrées de la même catalogue ne peuvent pas partager un id
 *     (un dup intra = vrai bug — les lookups par id deviennent ambigus). Couvre les tableaux
 *     EXPORTÉS (donc base + frenchy concaténés pour traits/spells).
 *
 * (2) Collisions INTER-catégorie : un même id peut exister dans deux catalogues distincts. Les
 *     lookups étant SCOPÉS par catégorie (`findTraitById`/`findTalentById`/`findManeuverById`/…),
 *     ces collisions sont inoffensives à l'exécution, MAIS sources de confusion. On VERROUILLE
 *     l'ensemble connu/voulu PAR PAIRE (id → catalogues) : toute NOUVELLE collision accidentelle, ou
 *     un id connu qui gagne un catalogue, casse ce test → décision consciente (renommer, ou déclarer).
 *     Familles documentées :
 *       • trait↔manœuvre : un trait de créature confère une manœuvre de même id (`grantsManeuvers`)
 *         — arme, cornes, morsure, tentacules, etreinte-glaciale, frisson-paralysant,
 *           hurlement-de-la-bete-indomptable, hurlement-fantomatique, langue-prehensile,
 *           regard-petrifiant, vomissement.
 *       • trait↔talent : homonymes distincts (créature vs joueur) — beni, frenesie, haine,
 *           resistance-a-la-magie, vision-nocturne.
 *       • trait↔qualité : homonymes (créature vs qualité d'arme/armure) — infecte, magique, rapide, taille.
 *       • trait↔sort : un trait de créature porte le nom d'un sort/effet homonyme — nuee, perturbant,
 *           protection, regeneration, sang-corrosif, souffle, vol, mauvais-oeil (le Trait de l'œil
 *           cyclopéen fimir, VDM 15 folio 217, vs le Sort du Domaine de la Sorcellerie homonyme, LDB 49 l.64).
 *       • qualité↔sort : maudit (l'Atout d'objet porté par tout objet maudit, VDM 12 folio 170, vs le
 *           Sort du Domaine des Cieux homonyme, LDB 48 l.187).
 *       • sort↔possession : un sort et l'objet homonyme (Bouclier le sort vs le bouclier) — bouclier,
 *           broyeur-d-os, carreau, flechette, silence (l'arme de corps à corps « Silence » ZI folio 115 vs
 *           le Sort d'Arcane homonyme, VDM 02 folio 27).
 *       • divers : effrayant (sort↔talent), pistolet (qualité↔possession), resistance (compétence↔talent),
 *           belier (qualité de siège « Bélier » ADE II 8 ↔ sort homonyme « Bélier »), filet (trapping
 *           « Filet » ZI 2 l.174 ↔ qualité « Filet » ZI 2 l.176 — l'arme PORTE la qualité qui pose son Empêtré),
 *           poudre-impregnee-d-aqshy (trapping ↔ qualité, AA 08 l.544 — la munition PORTE la qualité
 *           qui pose son seuil de Maladresse élargi {8,9}, même patron que `filet`).
 *       • créature↔trapping : une créature existe aussi comme trapping ORDINAIRE (objet de sac, hors
 *           bestiaire possédable) — poulet, singe, vers.
 *       • créature↔trait : une créature confère à ses combattants un trait de même id — ogre (PERMANENT).
 *       • décor↔véhicule : un DÉCOR (`props.json`) homonyme d'un VÉHICULE (`vehicles.json`) — chaise (meuble
 *           vs chaise à porteurs EDOC 07 l.192) ; charrette et barque, doublons d'hôte soldés par #2170
 *           (le véhicule posé remplace le décor), `barque` étant aussi du groupe Barque de #2174.
 *       • décor↔trapping : un DÉCOR homonyme d'une POSSESSION ordinaire (le sac PORTE l'objet, la scène
 *           POSE le décor — deux entités, même mot) — rocher, tonneau, marmite, tente, bourse (la
 *           Bourse de sac, LDB folio 301, vs la bourse POSÉE au sol — #1680 ligne 14).
 *       • décor↔qualité : siege — la qualité d'arme « Siège » (ADE II folio 89) vs le FAUTEUIL d'opéra
 *           (`src/gameIso/catalog/decor/defs/siege.ts`, #1680 ligne 14). Même patron que `belier`,
 *           déjà listé : le vocabulaire de siège (au sens militaire) et le mobilier partagent le mot.
 *       • décor↔trait : toile — le Trait de créature « Toile » (LDB folio 343, pose l'État Empêtré)
 *           vs la TOILE d'araignée posée en décor (#1680 ligne 14) : le trait la TISSE, le décor la montre.
 */
import { describe, it, expect } from 'vitest';
import { traits, talents, qualities, maneuvers, spells, trappings, skills, creatures, props, vehicles, structures } from './index';

const CATEGORIES: Record<string, { id: string }[]> = { traits, talents, qualities, maneuvers, spells, trappings, skills, creatures, props, vehicles, structures };

/** PAIRES VOULUES : id partagé → ses catalogues, triés (cf. familles documentées ci-dessus). */
const KNOWN_CROSS: Record<string, readonly string[]> = {
  arme: ['maneuvers', 'traits'],
  barque: ['props', 'vehicles'],
  belier: ['qualities', 'spells'],
  beni: ['talents', 'traits'],
  bouclier: ['spells', 'trappings'],
  bourse: ['props', 'trappings'],
  'broyeur-d-os': ['spells', 'trappings'],
  carreau: ['spells', 'trappings'],
  chaise: ['props', 'vehicles'],
  charrette: ['props', 'vehicles'],
  cornes: ['maneuvers', 'traits'],
  effrayant: ['spells', 'talents'],
  'etreinte-glaciale': ['maneuvers', 'traits'],
  filet: ['qualities', 'trappings'],
  flechette: ['spells', 'trappings'],
  frenesie: ['talents', 'traits'],
  'frisson-paralysant': ['maneuvers', 'traits'],
  haine: ['talents', 'traits'],
  'hurlement-de-la-bete-indomptable': ['maneuvers', 'traits'],
  'hurlement-fantomatique': ['maneuvers', 'traits'],
  infecte: ['qualities', 'traits'],
  'langue-prehensile': ['maneuvers', 'traits'],
  magique: ['qualities', 'traits'],
  marmite: ['props', 'trappings'],
  maudit: ['qualities', 'spells'],
  'mauvais-oeil': ['spells', 'traits'],
  morsure: ['maneuvers', 'traits'],
  nuee: ['spells', 'traits'],
  ogre: ['creatures', 'traits'],
  perturbant: ['spells', 'traits'],
  pistolet: ['qualities', 'trappings'],
  'poudre-impregnee-d-aqshy': ['qualities', 'trappings'],
  poulet: ['creatures', 'trappings'],
  protection: ['spells', 'traits'],
  rapide: ['qualities', 'traits'],
  'regard-petrifiant': ['maneuvers', 'traits'],
  regeneration: ['spells', 'traits'],
  resistance: ['skills', 'talents'],
  'resistance-a-la-magie': ['talents', 'traits'],
  rocher: ['props', 'trappings'],
  'sang-corrosif': ['spells', 'traits'],
  siege: ['props', 'qualities'],
  silence: ['spells', 'trappings'],
  singe: ['creatures', 'trappings'],
  souffle: ['spells', 'traits'],
  taille: ['qualities', 'traits'],
  tente: ['props', 'trappings'],
  tentacules: ['maneuvers', 'traits'],
  toile: ['props', 'traits'],
  tonneau: ['props', 'trappings'],
  vers: ['creatures', 'trappings'],
  'vision-nocturne': ['talents', 'traits'],
  vol: ['spells', 'traits'],
  vomissement: ['maneuvers', 'traits'],
};

describe('intégrité des ids de données', () => {
  for (const [name, arr] of Object.entries(CATEGORIES)) {
    it(`${name} : aucun id dupliqué intra-catégorie`, () => {
      const ids = arr.map((x) => x.id);
      const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
      expect(dups).toEqual([]);
    });
  }

  it("collisions inter-catégorie = exactement les paires documentées (toute nouvelle collision échoue)", () => {
    const where = new Map<string, Set<string>>();
    for (const [name, arr] of Object.entries(CATEGORIES)) {
      for (const id of new Set(arr.map((x) => x.id))) {
        (where.get(id) ?? where.set(id, new Set()).get(id)!).add(name);
      }
    }
    const cross = Object.fromEntries([...where].filter(([, cats]) => cats.size > 1).map(([id, cats]) => [id, [...cats].sort()]));
    expect(cross).toEqual(KNOWN_CROSS);
  });
});
