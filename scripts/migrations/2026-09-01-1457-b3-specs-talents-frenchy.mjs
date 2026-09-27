/**
 * Migration #1457 (B3) — les spécs de Talent portées par les créatures de `frenchy-bzh` rejoignent
 * le catalogue PAR LEUR ID. Dernier lot de la vague : après B2 (livres officiels, 82→73), les 73
 * clés restantes sont toutes frenchy.
 *
 * Le livre est une traduction FAN qui nomme les Talents à SA façon : son Annexe C (frenchy.bzh 82,
 * colonnes « Traduction Personnelle | Traduction Officielle | Nom VO ») donne la table de passage —
 * « Arpenteur (Environnement à Préciser) | Bon Marcheur | _Strider (Terrain)_ » (l.15), « Étiquette
 * (Groupe à Préciser) | Savoir-Vivre | _Etiquette (Social Group)_ » (l.88), « Intrépide (Type
 * d'Ennemis à Préciser) | Sans Peur | _Fearless (Enemy)_ » (l.122), « Maître Artisan (Artisanat à
 * Préciser) | Travailleur Qualifié | _Master Tradesman (Trade)_ » (l.140). Chaque spéc est donc
 * relevée à SA ligne de statbloc, sous le nom frenchy du Talent.
 *
 * Trois gestes, chacun adossé à la ligne du statbloc lue au `Source/` :
 *  - `ENTREES_NEUVES` : le groupe/terrain est IMPRIMÉ et ABSENT du catalogue → entrée
 *    `{id,label,source,pool:false}`. Les listes de spécialisation du LDB sont OUVERTES — « Les
 *    spécialisations courantes INCLUENT : Littoral, Déserts, Marécages, Rocailleux, Toundra, Régions
 *    boisées » (LDB 10 l.117), « Voici QUELQUES EXEMPLES de groupes que vous pouvez haïr » (l.548),
 *    « Les ennemis courants COMPRENNENT » (l.1051), « Voici DES EXEMPLES de groupes sociaux »
 *    (l.1071) : une valeur imprimée par un autre livre s'AJOUTE, elle ne se rabat pas sur un voisin
 *    de la liste d'exemples. `pool: false` : leur seul consommateur est un statbloc (#1342 L3).
 *    `page` = folio du pied de page (« N sur 630 ») qui gouverne la ligne ; l'extraction frenchy n'a
 *    pas d'ancre `data-folio`, ces folios sont hors de portée de `folio-line-align`.
 *  - `DECISIONS` : par VALEUR imprimée → id de catalogue, avec les porteurs NOMMÉS. Trois classes :
 *    (a) l'id vient d'être créé ci-dessus ; (b) le catalogue porte DÉJÀ le concept sous une autre
 *    graphie et les DEUX impressions sont citées (patron B2) ; (c) le MÊME statbloc porte la
 *    Compétence sœur déjà migrée le 2026-08-23 (`2026-08-23-specs-frenchy-vers-catalogue.mjs`) —
 *    la spéc du Talent suit l'id de la Compétence, sans quoi le même concept aurait deux ids.
 *  - `SENTINELLES` : la ligne imprime un EMPLACEMENT, pas une spéc — le porteur prend la sentinelle
 *    « au choix », seule forme d'emplacement que `talentRefSchema` accepte
 *    (`schemas/grammaire/reference.ts` : `{id, spec?, times?}`, sans régime `choix`).
 *
 * DEUX DOUBLONS DE CONCEPT dans le MÊME livre, soldés en UNE entrée (l'ancre est la PREMIÈRE
 * impression dans l'ordre du livre), la description du livre faisant foi :
 *  - « Étiquette (Armée) » (13 l.128 f.30) et « Étiquette (Militaires) » (19 l.105 f.64) portent la
 *    MÊME description, mot pour mot : « Bonus +N DR pour les Tests de Charme et Ragots réussis avec
 *    les soldats et les militaires ». Une entrée `armee` ; les 4 porteurs « Militaires » la visent.
 *  - « Étiquette (Cultes) » (22 l.163 f.77 : « … avec les autres religieux ») et « Étiquette
 *    (Religieux) » (26 l.688 f.150 : « … avec les prêtres et les religieux ») nomment le même
 *    groupe social ; aucun statbloc ne porte les deux. Une entrée `cultes`.
 *  La SECONDE impression entre en `alsoIn` de l'entrée (`specEntrySchema`), `quote` VERBATIM
 *  attesté au folio par `auditSecondaryRef` (`scripts/guards/lib/folioIntegrity.mjs`). Le doublon de
 *  casse (« Skavens » 53 l.109 / « skavens » 55 l.158) n'est, lui, qu'une seule impression.
 *
 * RÉSIDU ASSUMÉ (5 clés laissées au stock, motif au stock) : « Arpenteur (Plaine_OU_Forêt) » ×2 et
 * « Arpenteur (Forêt_ou_Plaine) » ×3 impriment un CHOIX BORNÉ entre deux terrains (« Bonus +N DR
 * pour les Tests d'Athlétisme réussis dans l'environnement choisi »). La forme canonique du dépôt
 * pour ce cas est `choix: [ids]` (L2 #1548) ; `talentRefSchema` n'a pas ce régime, concept LOTÉ L3
 * #1463 (`schemas/defs-scenes/narratif.ts` l.127-133). La sentinelle libre « au choix » perdrait la
 * BORNE imprimée : rien n'est écrit ici plutôt que de dégrader le RAW.
 *
 * ENTRÉES : `src/data/talents.json` (catalogues de spécs, écrit), `src/data/creatures.json` (les 68
 * porteurs, écrit) et `src/data/traits.json` (LU seulement : il porte les 2 spécs octroyées par
 * `grantTalent` que `ENTREES_HORS_FRENCHY` crée). Marche des `talents[]` : `scripts/data/lib/skillSpecWalk.mjs`
 * (`walkSkillRefs`), la MÊME que la garde `src/data/refs-migrated.test.ts`.
 *
 * IDEMPOTENT : rejouée, elle n'écrit rien (chaque porteur est reconnu à l'arrivée). FAIL-FAST :
 * arrêt en 1 si un catalogue manque, si un id neuf entre en collision, si un porteur est absent, ou
 * s'il n'est NI au départ NI à l'arrivée — l'arbre n'est écrit qu'après la mesure complète.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkSkillRefs } from '../data/lib/skillSpecWalk.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = path.join(ROOT, 'src/data');
const BOOK = 'frenchy-bzh';
const src = (page, note) => ({ book: BOOK, page, note });
/** Emplacement SECONDAIRE (`secondarySourceRefSchema`) : `quote` = l'impression VERBATIM au folio. */
const secondaire = (page, note, quote) => ({ book: BOOK, page, note, quote });

/** Entrées de catalogue à créer, par id de Talent. Toutes statbloc-only → `pool: false`. */
const ENTREES_NEUVES = {
  'savoir-vivre': [
    // « Étiquette (Armée) » — Sergent du Guet, frenchy.bzh 13 l.128, folio 30 ; seconde impression
    // « Étiquette (Militaires) », frenchy.bzh 19 l.105, folio 64.
    { id: 'armee', label: 'Armée', source: src(30, 'frenchy.bzh 13 l.128'),
      alsoIn: [secondaire(64, 'frenchy.bzh 19 l.105', 'Étiquette (Militaires)')], pool: false },
    // « Étiquette (Lettrés) » — Juge, frenchy.bzh 18 l.32, folio 58.
    { id: 'lettres', label: 'Lettrés', source: src(58, 'frenchy.bzh 18 l.32'), pool: false },
    // « Étiquette (Cultes) » — Religieuse de Shallya, frenchy.bzh 22 l.163, folio 77 ; seconde
    // impression « Étiquette (Religieux) », frenchy.bzh 26 l.688, folio 150.
    { id: 'cultes', label: 'Cultes', source: src(77, 'frenchy.bzh 22 l.163'),
      alsoIn: [secondaire(150, 'frenchy.bzh 26 l.688', 'Étiquette (Religieux)')], pool: false },
    // « Étiquette (Skavens) » — Kapo, frenchy.bzh 53 l.109, folio 339.
    { id: 'skavens', label: 'Skavens', source: src(339, 'frenchy.bzh 53 l.109'), pool: false },
  ],
  'bon-marcheur': [
    // « Arpenteur (Forêt) » — Maistre Herboriste, frenchy.bzh 26 l.335, folio 138.
    { id: 'foret', label: 'Forêt', source: src(138, 'frenchy.bzh 26 l.335'), pool: false },
    // « Arpenteur (Marais) » — Riverain, frenchy.bzh 26 l.239, folio 134.
    { id: 'marais', label: 'Marais', source: src(134, 'frenchy.bzh 26 l.239'), pool: false },
  ],
  'sans-peur': [
    // « Intrépide (Bandits) » — Capitaine des Patrouilleurs Ruraux, frenchy.bzh 15 l.181, folio 44.
    { id: 'bandits', label: 'Bandits', source: src(44, 'frenchy.bzh 15 l.181'), pool: false },
    // « Intrépide VS Bêtes Sauvages » — Traqueur Impitoyable, frenchy.bzh 36 l.156, folio 196.
    { id: 'betes-sauvages', label: 'Bêtes Sauvages', source: src(196, 'frenchy.bzh 36 l.156'), pool: false },
    // « Intrépide (Nains) » — Chef d'Escadron, frenchy.bzh 55 l.223, folio 356.
    { id: 'nains', label: 'Nains', source: src(356, 'frenchy.bzh 55 l.223'), pool: false },
    // « Intrépide (Naufrageurs & Pirates Fluviaux) » — Capitaine des Patrouilleurs Fluviaux,
    // frenchy.bzh 16 l.185, folio 51 (pied de page rendu « sur  51 630 » par l'extraction).
    { id: 'naufrageurs-et-pirates-fluviaux', label: 'Naufrageurs & Pirates Fluviaux', source: src(51, 'frenchy.bzh 16 l.185'), pool: false },
    // « Intrépide VS Patrouilleurs » — Seigneur Brigand, frenchy.bzh 28 l.145, folio 168.
    { id: 'patrouilleurs', label: 'Patrouilleurs', source: src(168, 'frenchy.bzh 28 l.145'), pool: false },
  ],
  haine: [
    // « Haine (Ennemis de Sigmar) » — Prêtre de Sigmar, frenchy.bzh 22 l.526, folio 89.
    { id: 'ennemis-de-sigmar', label: 'Ennemis de Sigmar', source: src(89, 'frenchy.bzh 22 l.526'), pool: false },
    // « Haine (Ennemis d'Ulric) » — Prêtre d'Ulric, frenchy.bzh 22 l.608, folio 92.
    { id: 'ennemis-d-ulric', label: 'Ennemis d’Ulric', source: src(92, 'frenchy.bzh 22 l.608'), pool: false },
  ],
  savant: [
    // « Savant (Local) » — Vénérable, frenchy.bzh 25 l.142, folio 126 : « Bonus +3 DR pour les Tests
    // réussis de Savoir (Local) ». `savant` est le Talent d'une COMPÉTENCE Savoir (LDB 10 l.1059
    // « Savant (Savoir) », Tests « Savoir (Savoir choisi) ») : l'id est celui de `skills.json ›
    // savoir.specs[] › local`, déjà au catalogue de la Compétence. Le catalogue du Talent est une
    // COPIE de celui de la Compétence (mutualisation lotée #1598) : l'entrée y est dupliquée faute
    // de `specsSource` vers une Compétence, jamais un id concurrent.
    { id: 'local', label: 'Local', source: src(126, 'frenchy.bzh 25 l.142'), pool: false },
  ],
};

/**
 * MÊME GESTE, hors frenchy — les 2 spécs de `savoir-vivre` qu'un TRAIT octroie (`grantTalent`) et
 * que le catalogue ne portait pas. L'ANGLE MORT est énoncé par la garde (#1646) : la marche des
 * `talents[]` ne visite que `creatures`/`careerLevels`/`species`, donc une spéc posée par un autre
 * champ (`traits.json#passive[].spec`) lui échappe. Les deux sont IMPRIMÉES par un livre officiel,
 * dans la desc VERBATIM du Trait porteur. `pool: false` : aucune ligne joueur ne les demande — le
 * Talent arrive par l'op du Trait, jamais par une Augmentation (`LDB 09 l.40`).
 */
const ENTREES_HORS_FRENCHY = {
  'savoir-vivre': [
    // EDOC 13 l.524 (folio 83, Marque de Tzeentch) : « Cette créature gagne le Talent Savoir-vivre
    // (Disciples de Tzeentch) ». Porteur : `traits.json › marque-de-tzeentch.passive[]`.
    { id: 'disciples-de-tzeentch', label: 'Disciples de Tzeentch', source: { book: 'ennemi-dans-l-ombre-compagnon', page: 83, note: 'EDOC 13 l.524' }, pool: false },
    // MDG 07 l.250 (folio 56, Marque de Khorne) : « Elle gagne le Talent Savoir-vivre (Suivants de
    // Khorne) ». Porteur : `traits.json › marque-de-khorne.passive[]`.
    { id: 'suivants-de-khorne', label: 'Suivants de Khorne', source: { book: 'mer-des-griffes', page: 56, note: 'MDG 07 l.250' }, pool: false },
  ],
};

/**
 * Décisions PAR VALEUR imprimée. `imprime` = la valeur STOCKÉE aujourd'hui (celle que la garde
 * nomme), `vers` = l'id de catalogue, `cite` = ce qui porte la décision, `porteurs` = la liste
 * EXHAUSTIVE des créatures concernées (cardinal vérifié).
 */
const DECISIONS = [
  // ── savoir-vivre (30 porteurs) ───────────────────────────────────────────────────────────────
  { talent: 'savoir-vivre', imprime: 'Armée', vers: 'armee',
    cite: 'frenchy.bzh 13 l.128 f.30 « Étiquette (Armée) »',
    porteurs: ['sergent-du-guet', 'capitaine-du-guet'] },
  { talent: 'savoir-vivre', imprime: 'Militaires', vers: 'armee',
    cite: 'frenchy.bzh 19 l.105 f.64 « Étiquette (Militaires) … avec les soldats et les militaires » ⇄ 13 l.128 f.30, MÊME description',
    porteurs: ['sergent-patrouilleurs-ruraux', 'capitaine-patrouilleurs-ruraux', 'sous-officier', 'officier'] },
  { talent: 'savoir-vivre', imprime: 'Lettrés', vers: 'lettres',
    cite: 'frenchy.bzh 18 l.32 f.58 « Étiquette (Lettrés) »',
    porteurs: ['juge', 'haut-juge', 'batonnier', 'maistre-apothicaire', 'erudit-de-renom'] },
  { talent: 'savoir-vivre', imprime: 'Cultes', vers: 'cultes',
    cite: 'frenchy.bzh 22 l.163 f.77 « Étiquette (Cultes) … avec les autres religieux »',
    porteurs: ['religieuse-de-shallya', 'pretresse-de-shallya', 'moine-de-sigmar', 'pretre-de-sigmar',
      'moine-d-ulric', 'pretre-d-ulric', 'religieuse-de-verena', 'pretresse-de-verena'] },
  { talent: 'savoir-vivre', imprime: 'Religieux', vers: 'cultes',
    cite: 'frenchy.bzh 26 l.688 f.150 « Étiquette (Religieux) … avec les prêtres et les religieux » ⇄ 22 l.163 f.77',
    porteurs: ['haut-druide-de-la-foi-antique', 'religieuse-de-rhya', 'grande-pretresse-de-rhya', 'moine-de-taal'] },
  { talent: 'savoir-vivre', imprime: 'Skavens', vers: 'skavens',
    cite: 'frenchy.bzh 53 l.109 f.339 « Étiquette (Skavens) »',
    porteurs: ['kapo', 'garde-chiourme', 'chef-de-portee', 'chef-de-clan'] },
  { talent: 'savoir-vivre', imprime: 'skavens', vers: 'skavens',
    cite: 'frenchy.bzh 55 l.158 f.354 « Étiquette (skavens) » — même mot, autre casse que 53 l.109',
    porteurs: ['chef-de-section', 'chef-d-escadron', 'architechnomage'] },

  // ── bon-marcheur (16 porteurs migrés ; 5 en résidu, cf. en-tête) ─────────────────────────────
  { talent: 'bon-marcheur', imprime: 'Forêt', vers: 'foret',
    cite: 'frenchy.bzh 26 l.335 f.138, 36 l.43 f.193, 38 l.56 f.208, 40 l.75 f.220, 43 l.180 f.233 « Arpenteur (Forêt) »',
    porteurs: ['maistre-herboriste', 'jeune-loup', 'loup-adulte', 'chef-de-meute', 'traqueur-impitoyable',
      'jeune-sanglier', 'sanglier-adulte', 'sanglier-feroce', 'grand-sanglier-ombrageux',
      'jeune-araignee-geante', 'araignee-geante-adulte', 'araignee-geante-impitoyable',
      'chasseresse-des-ombres', 'gor-eclaireur'] },
  { talent: 'bon-marcheur', imprime: 'Marais', vers: 'marais',
    cite: 'frenchy.bzh 26 l.239 f.134 et l.276 f.136 « Arpenteur (Marais) »',
    porteurs: ['riverain', 'riverain-respecte'] },

  // ── sans-peur (10 porteurs) ──────────────────────────────────────────────────────────────────
  { talent: 'sans-peur', imprime: 'Bandits', vers: 'bandits',
    cite: 'frenchy.bzh 15 l.181 f.44 « Intrépide (Bandits) »',
    porteurs: ['capitaine-patrouilleurs-ruraux'] },
  { talent: 'sans-peur', imprime: 'Bêtes Sauvages', vers: 'betes-sauvages',
    cite: 'frenchy.bzh 36 l.156 f.196 et 38 l.168 f.211 « Intrépide VS Bêtes Sauvages »',
    porteurs: ['traqueur-impitoyable', 'grand-sanglier-ombrageux'] },
  { talent: 'sans-peur', imprime: 'Nains', vers: 'nains',
    cite: 'frenchy.bzh 55 l.223 f.356 « Intrépide (Nains) »',
    porteurs: ['chef-d-escadron'] },
  { talent: 'sans-peur', imprime: 'Naufrageurs & Pirates Fluviaux', vers: 'naufrageurs-et-pirates-fluviaux',
    cite: 'frenchy.bzh 16 l.185 f.51 « Intrépide (Naufrageurs & Pirates Fluviaux) »',
    porteurs: ['capitaine-patrouilleurs-fluviaux'] },
  { talent: 'sans-peur', imprime: 'Patrouilleurs', vers: 'patrouilleurs',
    cite: 'frenchy.bzh 28 l.145 f.168 « Intrépide VS Patrouilleurs », 29 l.128 f.172 « Intrépide (Patrouilleurs) »',
    porteurs: ['seigneur-brigand', 'roi-du-trafic'] },
  // « tous ennemis » n'est pas un groupe d'ennemis de plus : c'est l'UNIVERSEL, que le catalogue
  // porte déjà sous `tout` (LDB 08 l.1472, « **Talents :** Frénésie, Maniement de deux armes, Sans
  // peur » — Sans peur SANS spécialisation). Une entrée de plus poserait deux ids pour un concept.
  { talent: 'sans-peur', imprime: 'tous ennemis', vers: 'tout',
    cite: 'frenchy.bzh 44 l.52 f.256 « Intrépide (tous ennemis) … résister à tout type d’ennemis » ⇄ catalogue `tout` (LDB 08 l.1472)',
    porteurs: ['maraudeur-du-chaos', 'maraudeur-du-chaos-chef-de-bande', 'maraudeur-du-chaos-chef-de-guerre'] },

  // ── savant (5 porteurs) ──────────────────────────────────────────────────────────────────────
  { talent: 'savant', imprime: 'Local', vers: 'local',
    cite: 'frenchy.bzh 25 l.142 f.126 et 72 l.155 f.529 « Savant (Local) … Savoir (Local) »',
    porteurs: ['venerable', 'reine-des-cryptes'] },
  // La Compétence sœur du MÊME statbloc, « Savoir (Engingneurie) », a été ramenée à `ingenierie` le
  // 2026-08-23 (REMAP `savoir Engingneurie` → `ingenierie`, LDB 09 l.495 « Ingénierie »).
  { talent: 'savant', imprime: 'Engingneurie', vers: 'ingenierie',
    cite: 'frenchy.bzh 56 l.319 f.367 et 59 l.254 f.403 « Savant (Engingneurie) » ⇄ Compétence « Savoir (Engingneurie) » du même statbloc, migrée vers `ingenierie` (LDB 09 l.495)',
    porteurs: ['architechnomage', 'grand-maitre-des-hybridations'] },
  // Idem : « Savoir (Rivières) » du même statbloc a été ramenée à `voies-fluviales` (MSR 11 l.16).
  { talent: 'savant', imprime: 'Rivières', vers: 'voies-fluviales',
    cite: 'frenchy.bzh 26 l.280 f.136 « Savant (Rivières) … Savoir (Rivière) » ⇄ Compétence « Savoir (Rivières) » du même statbloc, migrée vers `voies-fluviales` (MSR 11 l.16)',
    porteurs: ['riverain-respecte'] },

  // ── haine (2 porteurs) ───────────────────────────────────────────────────────────────────────
  { talent: 'haine', imprime: 'Ennemis de Sigmar', vers: 'ennemis-de-sigmar',
    cite: 'frenchy.bzh 22 l.526 f.89 « Haine (Ennemis de Sigmar) »',
    porteurs: ['pretre-de-sigmar'] },
  { talent: 'haine', imprime: 'Ennemis d’Ulric', vers: 'ennemis-d-ulric',
    cite: 'frenchy.bzh 22 l.608 f.92 « Haine (Ennemis d’Ulric) »',
    porteurs: ['pretre-d-ulric'] },

  // ── Métier : les deux Talents d'artisanat pointent la spéc de la COMPÉTENCE Métier ───────────
  // frenchy « Maître Artisan » = « Travailleur Qualifié » (Annexe C, 82 l.140) ; la Compétence du
  // même statbloc, « Artisanat (Engingneur) », a été ramenée à `ingenieur` le 2026-08-23.
  { talent: 'travailleur-qualifie', imprime: 'Engingneurie', vers: 'ingenieur',
    cite: 'frenchy.bzh 56 l.220 f.364 et l.318 f.367 « Maître Artisan (Engingneurie) » ⇄ Compétence « Artisanat (Engingneur) » (56 l.52), migrée vers `ingenieur`',
    porteurs: ['technomage-experimente', 'architechnomage'] },
  // frenchy « Artisan » = _Craftsman_ (Annexe C, 82 l.16) = `maitre-artisan` au dépôt (LDB 10 l.741
  // « Maître artisan (Métier) », desc « Ajoutez la Compétence Métier associée … »).
  { talent: 'maitre-artisan', imprime: 'Ingénierie', vers: 'ingenieur',
    cite: 'frenchy.bzh 59 l.186 f.401 et l.247 f.403 « Artisan (Engingneur) » ⇄ Compétence « Artisanat (Engingneurie) » (59 l.178), migrée vers `ingenieur`',
    porteurs: ['maitre-des-hybridation', 'grand-maitre-des-hybridations'] },
];

/** La ligne imprime un EMPLACEMENT : le porteur prend la sentinelle du dépôt (`isSentinel`). */
const SENTINELLES = [
  // frenchy.bzh 77 l.79 f.567 : « **Arpenteur** **(Environnement au** **choix)** … dans un
  // environnement donné (désert, marécage, montagne, forêt, plaine…) ».
  { creature: 'vhargulf', talent: 'bon-marcheur', imprime: 'Environnement au choix', cite: 'frenchy.bzh 77 l.79 f.567' },
];
const SENTINELLE = 'au choix';

const lire = (f) => {
  const abs = path.join(DATA, f);
  const brut = fs.readFileSync(abs, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== JSON.stringify(doc, null, 2)) {
    console.error(`FORME NON CANONIQUE — src/data/${f} ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { abs, brut, doc };
};

const ecrire = ({ abs, brut, doc }, quoi) => {
  const out = JSON.stringify(doc, null, 2);
  if (out === brut) { console.log(`${path.basename(abs)} — INCHANGÉ (no-op byte-identique).`); return; }
  if (out.includes('\r')) { console.error(`${abs} : \\r dans le texte réécrit ; AUCUNE écriture.`); process.exit(1); }
  fs.writeFileSync(abs, out, 'utf8');
  console.log(`${path.basename(abs)} — ${quoi}`);
};

// -- Catalogues --------------------------------------------------------------------------------
const talents = lire('talents.json');
const defs = new Map(talents.doc.map((t) => [t.id, t]));
let ajoutees = 0;
let alignees = 0;
const A_CREER = [...Object.entries(ENTREES_NEUVES), ...Object.entries(ENTREES_HORS_FRENCHY)];
for (const [talentId, entrees] of A_CREER) {
  const def = defs.get(talentId);
  if (!def || !Array.isArray(def.specs)) {
    console.error(`« ${talentId} » absent de talents.json, ou sans specs[] inline ; AUCUNE écriture.`);
    process.exit(1);
  }
  for (const e of entrees) {
    const i = def.specs.findIndex((s) => s.id === e.id);
    if (i >= 0) {
      const deja = def.specs[i];
      if (deja.label !== e.label) {
        console.error(`COLLISION d'id ${talentId}/${e.id} : catalogue « ${deja.label} » vs ajout « ${e.label} » ; AUCUNE écriture.`);
        process.exit(1);
      }
      // L'entrée déclarée ici EST l'entrée : la migration l'ALIGNE champ pour champ (une clé posée
      // hors de cette table repartirait au rejeu). Le libellé, lui, verrouille l'identité au-dessus.
      if (JSON.stringify(deja) !== JSON.stringify(e)) { def.specs[i] = { ...e }; alignees++; }
      continue;
    }
    def.specs.push(e);
    ajoutees++;
  }
}

// Les 2 entrées hors frenchy n'ont de sens que si leur PORTEUR les demande : `traits.json` est lu
// (jamais écrit) pour le prouver — une entrée de catalogue sans consommateur serait une invention.
const traits = JSON.parse(fs.readFileSync(path.join(DATA, 'traits.json'), 'utf8'));
const specsDeTrait = new Set();
const walkTrait = (n) => {
  if (Array.isArray(n)) return n.forEach(walkTrait);
  if (!n || typeof n !== 'object') return;
  // Les deux graphies d'une op de Talent : `{ talentId, spec }` (avant #1473) et `{ talent: { id, spec } }`.
  const ref = typeof n.talentId === 'string' ? { id: n.talentId, spec: n.spec } : n.talent;
  if (ref?.id === 'savoir-vivre' && typeof ref.spec === 'string') specsDeTrait.add(ref.spec);
  for (const v of Object.values(n)) walkTrait(v);
};
walkTrait(traits);
for (const e of ENTREES_HORS_FRENCHY['savoir-vivre']) {
  if (specsDeTrait.has(e.id)) continue;
  console.error(`SANS PORTEUR — savoir-vivre/${e.id} n'est demandée par aucun grantTalent de traits.json ; AUCUNE écriture.`);
  process.exit(1);
}

for (const d of DECISIONS) {
  const def = defs.get(d.talent);
  if (!def || !Array.isArray(def.specs)) {
    console.error(`« ${d.talent} » absent de talents.json, ou sans specs[] ; AUCUNE écriture.`);
    process.exit(1);
  }
  if (!def.specs.some((s) => s.id === d.vers)) {
    console.error(`CIBLE ABSENTE — ${d.talent}/${d.vers} (« ${d.imprime} ») ; AUCUNE écriture.`);
    process.exit(1);
  }
}

// -- Porteurs ----------------------------------------------------------------------------------
const creatures = lire('creatures.json');
const parId = new Map(creatures.doc.map((c) => [c.id, c]));
let remappees = 0;
let dejaFaites = 0;

const applique = (creatureId, talentId, de, vers, quoi) => {
  const c = parId.get(creatureId);
  if (!c) { console.error(`PORTEUR ABSENT — creatures/${creatureId} ; AUCUNE écriture.`); process.exit(1); }
  let touche = 0;
  let arrivee = 0;
  // L'ARRIVÉE se teste AVANT le départ : quand la valeur imprimée ne diffère de l'id que par la
  // CASSE (« skavens » → `skavens`), l'ordre inverse rejouerait une réécriture nulle et compterait
  // un remap là où l'état est déjà celui d'arrivée.
  walkSkillRefs(c, (node) => {
    if (node.id !== talentId) return;
    if (node.spec === vers) { arrivee++; return; }
    if (node.spec === de) { node.spec = vers; touche++; }
  }, 'talents');
  if (touche) { remappees += touche; return `  creatures/${creatureId} : ${talentId} « ${de} » → ${quoi}`; }
  if (arrivee) { dejaFaites++; return null; }
  console.error(`ÉTAT INATTENDU — creatures/${creatureId} ne porte NI ${talentId}/« ${de} » NI ${talentId}/« ${vers} » ; AUCUNE écriture.`);
  process.exit(1);
};

const journal = [];
let porteursAttendus = 0;
for (const d of DECISIONS) {
  porteursAttendus += d.porteurs.length;
  for (const creatureId of d.porteurs) {
    const l = applique(creatureId, d.talent, d.imprime, d.vers, `${d.vers}   [${d.cite}]`);
    if (l) journal.push(l);
  }
}
for (const s of SENTINELLES) {
  porteursAttendus++;
  const l = applique(s.creature, s.talent, s.imprime, SENTINELLE, `sentinelle « ${SENTINELLE} »   [${s.cite}]`);
  if (l) journal.push(l);
}

// Écriture APRÈS la mesure complète des deux documents : un arrêt fail-fast laisse l'arbre intact.
ecrire(talents, `${ajoutees} entrée(s) ajoutée(s) aux catalogues de spécs, ${alignees} réalignée(s).`);
ecrire(creatures, `${remappees} spéc(s) de Talent ramenée(s) à leur id.`);
for (const l of journal) console.log(l);
console.log(`Catalogue : +${ajoutees} · porteurs remappés : ${remappees} · déjà à l'arrivée : ${dejaFaites} / ${porteursAttendus}`);
