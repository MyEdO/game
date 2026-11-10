/**
 * Documents SANS LIVRE (#1466 L1a, étendu #1467 L1b V-Src) — liste NOMINATIVE datée des types de
 * document qui n'ont AUCUN livre : configuration de rendu, manifestes d’outillage, vocabulaire des actes,
 * index d’app des livres, artefacts générés dont la provenance est portée par bande, catalogues
 * d’application. Aucun sourçage n’y est dû. À ne pas confondre avec `SOURCE_EN_PROFONDEUR` (même
 * ci-dessous) : ceux-là ONT un livre, cité par sous-entrée, et ce sont deux régimes distincts.
 * Partout ailleurs la provenance est REQUISE, sous la forme `source` OU `maison` (refine de fabrique,
 * `document.ts`) : un document de jeu sans folio n'est pas interdit, il doit DIRE pourquoi.
 *
 * `actions.json` est le vocabulaire des actes du moteur (certaines de ses entrées citent malgré tout un
 * folio, d'où une source optionnelle et non interdite).
 *
 * Clé = `type` du document, égal au nom de base de son dataset. Aucune entrée ne s'ajoute sans sa
 * raison mesurée.
 */
export const SANS_LIVRE_DEFINITIF: Readonly<Record<string, string>> = {
  ambiance: 'configuration de rendu — ambiances lumineuses/sonores de scène, aucun folio ne les imprime',
  decorPalette: 'configuration de rendu — palette de teintes du décor, valeurs d’art',
  lightLevels: 'configuration de rendu — paliers d’éclairage du monde volumique',
  lightTones: 'configuration de rendu — teintes de lumière du monde volumique',
  rendus: 'configuration de rendu — visuels et sons des coups et des incantations, aucun folio ne les imprime',
  props:
    'catalogue des placeables de décor — le DOCUMENT est de l’art (volume, libellé, empreinte, et la solidité physique de l’objet : aucune table ne chiffre qu’un tonneau bloque le passage). Trois de ses CHAMPS sont des règles et ne sont pas couverts par cette exemption : `light` (éclairage, LDB 74 l.43/56/58), `cover` et `opaque` (couvert, LDB 14 l.72/81/86) — les entrées qui en portent un exigent `source` OU `maison` À L’ENTRÉE, par `affinerEntree` de `schemas/defs/props.ts`, et chacune porte son `maison`',
  raceAppearance: 'configuration de rendu — apparences par race, art maison',
  planDeBestiaire: 'configuration de rendu — le corps 3D et l’échelle d’art de chaque espèce, art maison',
  gabarits: 'configuration de rendu — carrures (facteurs du squelette de référence), art maison',
  'garde-robe': 'configuration de rendu — clés des éléments 3D portés sur le corps (têtes, coiffures, emplacements, pièces et ensembles d’habit), et les emblèmes posés sur leurs surfaces, art maison',
  materials:
    'configuration de rendu — LES matières du monde (décor volumique, toiture, relief : couleur, réponse à la lumière, recettes de détail de surface) ; aucun folio n’imprime une teinte de surface',
  apparences:
    'configuration de rendu — LE catalogue des apparences d’objet (formes et leurs variantes : id, libellé, étiquettes de naissance) ; aucun folio n’imprime à quoi ressemble un objet',
  structureAppearance: 'configuration de rendu — apparences de structures bâties',
  buildings:
    'catalogue des TYPES DE BÂTIMENT — le DOCUMENT est de l’art (empreinte offerte à la pose, matière de couverture, ornements d’identité posés en billboard) ; aucun folio n’imprime de catalogue de bâtiments. Chaque entrée EXIGE `maison` (`exiges` de `schemas/defs/buildings.ts`) : ce qu’un bâtiment vaut en cases et sous quelle couverture est un arbitrage, et il se dit à l’entrée',
  terrains:
    'catalogue des SOLS de la grille — le DOCUMENT est de l’art (teinte, rampe de dégradé, recette de surface, décor posé) ; aucun folio n’imprime de catalogue de sols. Quatre de ses CHAMPS sont des règles et ne sont pas couverts par cette exemption : `walkable`, `priority`, `opaque` et `built` — chaque entrée les porte et EXIGE `maison` (`exiges` de `schemas/defs/terrains.ts`)',
  teintesJeu: 'configuration de rendu — palette de teintes de l’interface de jeu',
  'semences-de-scene':
    'configuration d’AUTHORING (#1716) — les DÉFAUTS d’une scène NEUVE (`emptyScene`, `noyau/monde/scene.ts`) : échelle de case, ambiance, éclairage, sol de départ, matières de relief, toiture, façade de départ, et les libellés d’un lieu neuf (`noyau/worldMapEdit.ts`) d’une carte du monde neuve (`noyau/worldMap.ts`) et d’un statbloc personnalisé d’une fiche sans nom (`data/valeursNeuves.ts`). Aucun folio n’imprime le défaut d’un éditeur de scène. Le document EST son entrée (famille `config`) et EXIGE `maison` à sa racine (`exiges` de `schemas/defs/semences-de-scene.ts`) : ce qu’une scène neuve reçoit est un arbitrage, et il se dit là',
  'defauts-de-compilation':
    'configuration d’AUTHORING (#1716) — les DÉFAUTS du COMPILATEUR de scène (`noyau/mapSpec.ts`) : sol du chemin de ronde et masse d’une `cells` d’enceinte, tuile de pont d’une scène de bord. Aucun folio n’imprime ce qu’un compilateur de carte pose à la place d’un auteur muet. Le document EST son entrée (famille `config`) et EXIGE `maison` à sa racine (`exiges` de `schemas/defs/defauts-de-compilation.ts`), même régime que `semences-de-scene`',
  'donnees.manifest': 'manifeste d’outillage — rubriques de la carte des données, décrit le dépôt',
  'primitives.manifest': 'manifeste d’outillage — primitives partagées, décrit le dépôt',
  'raw.manifest': 'manifeste d’outillage — dette/blocage par id de topic ou de fiche RAW, décrit le dépôt',
  'systemes.manifest': 'manifeste d’outillage — systèmes du jeu, décrit le dépôt',
  actions: 'vocabulaire des actes du moteur — une action porte un folio quand une règle la nomme, jamais par construction',
  books: 'index d’app des livres eux-mêmes — un livre ne se cite pas lui-même',
  'progression-schemas.derived':
    'artefact GÉNÉRÉ par scripts/data/gen-progression-schemas.py — la provenance est PORTÉE PAR CHAQUE BANDE (book, page = folio imprimé, page PDF, ordonnée), relevée sur la page ; une source racine recopierait à la main ce que le générateur mesure',
  // Catalogues d'application : l'objet décrit est le dépôt ou son contenu, pas une règle. Décision
  // utilisateur du 2026-11-04 : « Oui, sans livre définitif ».
  groups:
    'index d’app des groupes cibles ({id,label}) — tags de regroupement/rencontre, pas une notion RAW nommée ; les espèces sourcées vivent dans species.json',
  names:
    'listes de PRÉNOMS et noms d’authoring par race — aucune mécanique mesurable, aucune règle à sourcer',
  speciesRace:
    'espèce d’apparence par défaut de l’authoring — câblage d’application, pas une donnée RAW',
  merchants:
    'catalogue d’app (archétypes de marchand : taux de rachat, familles vendues, agglo par défaut) ; les VALEURS de règle vivent sourcées à leur foyer (`engine/disponibilite.ts`, `bargain.ts`) ; `resaleRate` reprend la revente de LDB 59 l.54, `bargainSkill` est chiffré par entrée sans `maison` (LDB 59 l.54 laisse le Marchandage au MJ), inventaire #1463',
  merchantFamilies:
    'catalogue d’app — familles de PRÉSENTATION du stock marchand (onglets/colonnes du panneau du marchand), mise en page, aucune valeur mécanique',
  'lieux-services':
    'catalogue d’app — id/label/icône de routage d’écran (hub de lieu) ; port et marché portent leur propre schéma sourcé',
  calendarPhases:
    'découpage horaire d’app (7 phases Aube→Nuit : minute de départ + icône, moteur de lumière/vision) — le Calendrier Impérial RAW vit dans calendarMonths/calendarWeekdays (EDO Annexe 3, folio 149-150, 12/12 et 8/8 sourcés) ; aucune table de phases n’y est imprimée',
};

/**
 * Documents dont la provenance est CITÉE EN PROFONDEUR (#1467 L1b V-Src) — régime DISTINCT de
 * `SANS_LIVRE_DEFINITIF` : ceux-ci ONT un livre, plusieurs même, mais pas à la RACINE. Chaque sous-entrée
 * porte son `source: {book,page}` ; la racine, elle, ne doit JAMAIS en porter — `auditDataset`
 * (`scripts/guards/lib/citationCoverage.mjs:83`) rend `{total:1, cited:1}` dès qu'une racine cite,
 * ce qui ferait sortir ses sous-entrées du dénominateur de la garde de couverture. Verrouillé par
 * `src/data/source-racine-aveugle.test.ts`.
 *
 * La fabrique les exempte comme `SANS_LIVRE_DEFINITIF` (même effet : aucune provenance exigée à l'entrée de
 * racine), mais le MOTIF n'est pas le même et les deux listes ne se soldent pas ensemble — d'où deux
 * constantes.
 */
export const SOURCE_EN_PROFONDEUR: Readonly<Record<string, string>> = {
  'sea-weather': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'sea-events': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'sea-navigation': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'sea-perils': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'sea-cargo': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'land-cargo': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'river-perils': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  weather: 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'mass-battle': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'arcane-phenomena': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'ship-construction': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'crew-test-types': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  disponibilite: 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
  'naval-progression': 'racine nue, citations par sous-entrée — une source racine rendrait le dataset aveugle',
};

/** UNION des deux régimes d'exemption — ce que la fabrique ET le cliquet consultent. */
export const SANS_PROVENANCE_EXIGEE: Readonly<Record<string, string>> = { ...SANS_LIVRE_DEFINITIF, ...SOURCE_EN_PROFONDEUR };

/** Une PROVENANCE (`source` ou `maison`) est-elle exigée par la fabrique pour ce type de document ? */
export function exigeSource(type: string): boolean {
  return !(type in SANS_PROVENANCE_EXIGEE);
}
