/**
 * Le champ `windModifiers` (`schemas/defs/domains.ts`) est conçu sur les HUIT rubriques de Vent des
 * Vents de Magie, pas sur la seule Hysh : les sept autres Vents sont curés par leurs lots respectifs
 * et doivent entrer TELS QUELS, sans nouvelle forme de schéma. Ce module le prouve trois fois :
 *  1. les sept rubriques restantes PARSENT contre le schéma réel ;
 *  2. chaque `desc` transcrite ici est retrouvée VERBATIM dans le span du folio déclaré du Source
 *     (`auditFolio`, même mécanique que `book-source-integrity.test.ts`) — le folio est LU, pas deviné.
 *  3. tout Vent DÉJÀ curé dans `domains.json` porte EXACTEMENT la rubrique transcrite ici.
 * Fixtures SYNTHÉTIQUES contre le VRAI corpus, patron déjà établi par `secondary-ref-integrity.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { schema } from './schemas/defs/domains';
import { findDomainById } from './index';
import { auditFolio } from '../../scripts/guards/lib/folioIntegrity.mjs';

const BOOK = 'vents-de-la-magie';

/** VDM 05 l.42 (Chamon, folio 67). */
const CHAMON_EQUATEUR =
  "Ainsi, les Personnages qui voyagent en direction de l'équateur subissent un malus de −1 DR aux Tests de Focalisation (*Chamon*).";
/** VDM 05 l.44. */
const CHAMON_METAUX =
  "Dans les endroits où l'on trouve des métaux en grande quantité (comme les mines des régions riches en gisements, les salles du trésor, les navires à vapeur des nains…), les Personnages reçoivent un bonus de +1 DR aux Tests de Focalisation (*Chamon*).";
/** VDM 06 l.36 (Ghyran, folio 79). */
const GHYRAN_EAU =
  "Les Tests de Focalisation (*Ghyran*) ont un bonus de +1 DR là où l'eau est abondante (un ruisseau ne sera pas suffisant, contrairement aux fleuves, lacs et océans), mais subissent un malus de −1 DR dans les milieux secs.";
/** VDM 06 l.38. */
const GHYRAN_SAISONS =
  "Les Tests de Focalisation (*Ghyran*) bénéficient de +1 DR pendant les mois de Sommerzeit et de Vorgeheim, mais subissent un malus de −1 DR durant ceux de Ulriczeit et Vorhexen.";
/** VDM 07 l.48 (Azyr, folio 91). */
const AZYR_HAUTEUR =
  "Les lanceurs de sorts qui se servent du Domaine des Cieux obtiennent un bonus de +1 DR aux Tests de Focalisation lorsqu'ils se trouvent dans des tours ou sur des collines élevées. S'ils sont au sommet de hautes montagnes ou à bord d'un appareil en plein vol, ce bonus passe à +2 DR.";
/** VDM 08 l.40 (Ulgu, folio 103). */
const ULGU_METEO =
  "Les Tests de Focalisation (*Ulgu*) bénéficient de +1 DR lorsque le temps est suffisamment orageux ou brumeux. Ils subissent un malus de −1 DR les jours ensoleillés ou lorsqu'une brise légère balaye les nuages.";
/** VDM 09 l.42 (Shyish, folio 115). */
const SHYISH_MORT =
  "Les Tests de Focalisation (*Shyish*) bénéficient de +1 DR aux endroits où de nombreux corps sont enterrés et là où des massacres ont eu lieu. Dans les zones épargnées par la violence et la mort, les Tests de Focalisation (*Shyish*) ont une pénalité de −1 DR.";
/** VDM 10 l.42 (Aqshy, folio 127). */
const AQSHY_FEU =
  "Les sorciers Flamboyants gagnent +1 DR aux Tests de Focalisation (*Aqshy*) lorsqu'ils sont suffisamment proches de feux comme des feux de joie ou des bâtiments en flammes. S'ils sont à proximité d'un volcan actif ou d'une ville en proie aux flammes, ce bonus passe à +2 DR.";
/** VDM 11 l.42 (Ghur, folio 139). */
const GHUR_SAUVAGE =
  "*Ghur* n'occupe pas facilement les environnements urbains, les Tests de Focalisation (*Ghur*) subissent donc −1 DR dans les villes et −2 DR dans les cités. Le Vent d'Ambre est plus facile à percevoir dans les régions sauvages du Vieux Monde où les Tests de Focalisation (*Ghur*) ont un bonus de +1 DR en pleine nature. Dans les régions vraiment reculées où de nombreuses bêtes chassent ou se rassemblent, il est de +2 DR.";
/** VDM 11 l.44. */
const GHUR_MIDDENHEIM =
  "La cité de Middenheim est une exception notable puisqu'une puissante Source de *Ghur* émane des profondeurs du rocher du Fauschlag. Les Tests de Focalisation (*Ghur*) qui y sont effectués ont un bonus de +2 DR.";

const foc = ['focalisation'] as const;
const mod = (dr: number, when: string[], page: number, desc: string) => ({
  tests: [...foc],
  dr,
  when,
  source: { book: BOOK, page },
  desc,
});

/** `source` d'ancrage du Domaine, LUE dans `domains.json` — jamais un folio inventé : la fabrique
 *  exige désormais une provenance par entrée, et ces 7 fixtures rejouent des Domaines RÉELS. */
const sourceReelle = (id: string) => findDomainById(id)?.source;

/** Les 7 Vents restants, tels qu'ils devront être curés par leurs lots. */
const SEPT_VENTS = [
  {
    id: 'metal',
    type: 'domains',
    source: sourceReelle('metal'),
    label: 'Métal',
    windModifiers: [
      mod(-1, ['voyage-vers-equateur'], 67, CHAMON_EQUATEUR),
      mod(1, ['metaux-abondants'], 67, CHAMON_METAUX),
    ],
  },
  {
    id: 'vie',
    type: 'domains',
    source: sourceReelle('vie'),
    label: 'Vie',
    windModifiers: [
      mod(1, ['eau-abondante'], 79, GHYRAN_EAU),
      mod(-1, ['milieu-sec'], 79, GHYRAN_EAU),
      mod(1, ['mois-sommerzeit', 'mois-vorgeheim'], 79, GHYRAN_SAISONS),
      mod(-1, ['mois-ulriczeit', 'mois-vorhexen'], 79, GHYRAN_SAISONS),
    ],
  },
  {
    id: 'cieux',
    type: 'domains',
    source: sourceReelle('cieux'),
    label: 'Cieux',
    windModifiers: [
      mod(1, ['tour', 'colline-elevee'], 91, AZYR_HAUTEUR),
      mod(2, ['sommet-de-montagne', 'en-vol'], 91, AZYR_HAUTEUR),
    ],
  },
  {
    id: 'ombres',
    type: 'domains',
    source: sourceReelle('ombres'),
    label: 'Ombres',
    windModifiers: [
      mod(1, ['temps-orageux', 'temps-brumeux'], 103, ULGU_METEO),
      mod(-1, ['temps-ensoleille', 'brise-legere'], 103, ULGU_METEO),
    ],
  },
  {
    id: 'mort',
    type: 'domains',
    source: sourceReelle('mort'),
    label: 'Mort',
    windModifiers: [
      mod(1, ['charnier', 'lieu-de-massacre'], 115, SHYISH_MORT),
      mod(-1, ['lieu-sans-mort'], 115, SHYISH_MORT),
    ],
  },
  {
    id: 'feu',
    type: 'domains',
    source: sourceReelle('feu'),
    label: 'Feu',
    windModifiers: [
      mod(1, ['feu-proche'], 127, AQSHY_FEU),
      mod(2, ['volcan-actif', 'ville-en-flammes'], 127, AQSHY_FEU),
    ],
  },
  {
    id: 'bete',
    type: 'domains',
    source: sourceReelle('bete'),
    label: 'Bête',
    windModifiers: [
      mod(-1, ['ville'], 139, GHUR_SAUVAGE),
      mod(-2, ['cite'], 139, GHUR_SAUVAGE),
      mod(1, ['pleine-nature'], 139, GHUR_SAUVAGE),
      mod(2, ['region-reculee'], 139, GHUR_SAUVAGE),
      mod(2, ['middenheim'], 139, GHUR_MIDDENHEIM),
    ],
  },
];

describe('windModifiers — le champ accueille les HUIT Vents sans modification du schéma (#729)', () => {
  it('les 7 rubriques restantes parsent contre le schéma réel de domains.json', () => {
    const r = schema.safeParse(SEPT_VENTS);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
  });

  it('les 7 rubriques hors Hysh portent 7 ids de Domaine distincts', () => {
    expect(new Set(SEPT_VENTS.map((d) => d.id)).size).toBe(7);
  });

  it('les Vents DÉJÀ curés dans domains.json portent EXACTEMENT la rubrique transcrite ici', () => {
    const cures = SEPT_VENTS.filter((v) => findDomainById(v.id)?.windModifiers);
    expect(cures.map((v) => v.id)).toEqual(['metal', 'vie', 'cieux', 'ombres', 'mort', 'feu', 'bete']);
    for (const v of cures) {
      expect(findDomainById(v.id)?.windModifiers).toEqual(v.windModifiers);
    }
  });

  for (const [nom, page, desc] of [
    ['Chamon — équateur', 67, CHAMON_EQUATEUR],
    ['Chamon — métaux', 67, CHAMON_METAUX],
    ['Ghyran — eau', 79, GHYRAN_EAU],
    ['Ghyran — saisons', 79, GHYRAN_SAISONS],
    ['Azyr — hauteur', 91, AZYR_HAUTEUR],
    ['Ulgu — météo', 103, ULGU_METEO],
    ['Shyish — mort', 115, SHYISH_MORT],
    ['Aqshy — feu', 127, AQSHY_FEU],
    ['Ghur — sauvage', 139, GHUR_SAUVAGE],
    ['Ghur — Middenheim', 139, GHUR_MIDDENHEIM],
  ] as [string, number, string][]) {
    it(`${nom} : desc verbatim retrouvée dans le span du folio ${page}`, () => {
      expect(auditFolio({ book: BOOK, page, desc }).verdict).toBe('folio-ok');
    });
  }
});
