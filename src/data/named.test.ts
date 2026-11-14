import { describe, it, expect } from 'vitest';
import { isNamed, creatures, findCreatureById, type CreatureData } from './index';
import { idDeFixture } from './idDeFixture.testkit';

/** Fabrique un `CreatureData` synthétique minimal — seul `named` est lu par `isNamed`,
 *  le reste est rempli avec des valeurs neutres puis surchargé par `over`. */
const creature = (over: Partial<CreatureData>): CreatureData =>
  ({
    id: idDeFixture('creature', 'x'), type: 'creatures', label: 'X', title: null, folder: null, char: {},
    traits: [], optionals: [], skills: [], talents: [], trappings: [], spells: [],
    source: { book: 'LDB', page: 0 }, appearance: { species: 'humains-reiklander' },
    ...over,
  });

describe('isNamed — source UNIQUE de la nommé-ité (jamais via `title`)', () => {
  it('`named: true` → true', () => {
    expect(isNamed(creature({ named: true }))).toBe(true);
  });
  it('`named: false` → false', () => {
    expect(isNamed(creature({ named: false }))).toBe(false);
  });
  it('champ `named` absent → false (générique par défaut)', () => {
    expect(isNamed(creature({}))).toBe(false);
  });
});

/** Garde de DONNÉE : les individus nommés validés contre le RAW (desc verbatim singulier = individu)
 *  portent `named:true`, et rien d'autre. Les ex-« douteux » (sous-espèces/templates ZI décrits au
 *  PLURIEL) restent génériques — régression à garder si on retouche le backfill. */
describe('creatures.json — backfill `named`', () => {
  const NAMED_IDS = [
    'bella-la-noire', 'pol-dankels', 'eusapia-balacanon',
    'slenderthigh-whiptongue', 'fr-hough-mournbreath',
    'isrogdal-lempresse', 'ugrik-legaree', 'nazzaalta-affabule', 'artur-piedmarteau',
    'l-ombre-du-fleuve', 'raukos', 'le-vieux-dos-de-pus', 'brise-krag',
    'caledair-la-faux-de-feu', 'l-abominable-halagrundsor', 'jetsam-la-gelee-intelligente',
    'le-dechiqueteur-de-cadavres', 'la-bete-de-l-oblast', 'il-potente-granchio',
    'le-fantasma', 'prototype-du-clan-skryre', 'babrakkos',
    'gnawretch-skrray', 'kanker-flett', 'maitre-moulder-skree',
    'wolfgard-hohmann', 'wereburga-krotpreffer', 'moritz-valgeir',
    'stefan-hochen', 'marta-gerbenshreiber', 'grain-d-achillee',
    'wulfric-tore', 'waldtraud-blass', 'ritta', 'wulfrum-viert', 'emmille-munzstatter',
    'yanni-weber', 'johen', 'frere-bengt', 'grand-vizir-bhar', 'hugo-vallonvert',
    'alfric-demi-nez-brisenclume', 'agna-lottrisdottir', 'helmut-beckenbauer',
    'walpurga-wurklich', 'andrea-bruhn', 'jacopo-schmidt', 'traudl-bauer',
    'beate-moser', 'le-vieil-otto', 'brigitte-schleigel',
    'gerdon-salzwed', 'hasso-schroeter', 'kat-sperber', 'theresia-kleist',
    // MDG 16 (+ ch.7) : individus uniques du bestiaire marin — le Gargantuan (« il n'existe qu'un seul
    // Gargantuan »), Triton (demi-dieu unique) et les capitaines nommés.
    'gargantuan', 'triton', 'jaego-roth', 'long-drong-silver', 'wulfrik', 'vrisk-gratte-le-fer', 'olg-blodsalt',
    // VDM 15 : les deux Scribes Bleus de Tzeentch, démons uniques et nommés (« Les deux démons ont
    // pour tâche de recueillir tous les sorts qui existent », folio 212).
    'p-tarix-celui-qui-ecrit', 'xirat-p-celui-qui-lit',
  ];
  const GENERIC_IDS = [
    'brochet-du-stir', 'heomreth-hibou-geant', 'peau-de-loup', 'tregara',
    'experience-unique-du-clan-moulder', 'mangeuse-d-hommes-de-la-drakwald-araignee-geante',
  ];

  it('les nommés validés portent named:true (ids résolus)', () => {
    const bad = NAMED_IDS.filter((id) => { const c = findCreatureById(id); return !c || !isNamed(c); });
    expect(bad).toEqual([]);
  });
  it('AUCUN nommé hors liste validée (zéro générique flaggé)', () => {
    const extra = creatures.filter(isNamed).map((c) => c.id).filter((id) => !NAMED_IDS.includes(id));
    expect(extra).toEqual([]);
  });
  it('les ex-douteux (sous-espèces/templates au pluriel) restent génériques', () => {
    const bad = GENERIC_IDS.filter((id) => { const c = findCreatureById(id); return !c || isNamed(c); });
    expect(bad).toEqual([]);
  });
});
