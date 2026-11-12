/**
 * Migration #3656 — les profils du *Guide fan v4.5* de Frenchy (« Habitants & Créatures du Vieux-Monde »)
 * entrent au bestiaire, jouables en combat comme les profils officiels, chacun cité à sa page.
 * Clément, 2026-11-07 : « Je veux donc profiter de cette expérience pour réintégrer les profils de Frenchy,
 * vu que lui a réussi, corriger les bugs qu'il a detecté dans notre application, et aussi voir d'autres
 * trucs que lui a intégré et qui aurait du sens dans notre jeu ». Fiche `user-arbitrage-bestiaire-frenchy`.
 *
 * ENTRÉE DE CONVERSION : `scripts/migrations/entrees/2026-11-08-3656-pnj-guide.json`, la sortie de l'Atelier
 * des PNJ (PR #3633) : 290 profils aux ids du dépôt, `src: ['guide-fan', page]`. Les valeurs imprimées que
 * l'Atelier ne porte pas (Dégâts d'arme, Points d'Armure) sont relevées à l'ancienne extraction du guide
 * (`31b6c588b^`, retirée par #3015) dans `DEGATS_IMPRIMES` et `ARMURES_IMPRIMEES` ; le multiplicateur
 * imprimé des grandes Tailles (« (DR + Dé Unités + 12) x 2 ») est celui du Trait Taille, l'Indice est le nombre.
 *
 * GESTES, tous joués une seule fois (NO-OP dès que `books.json` porte le livre ou qu'un statbloc le cite) :
 *  1. `books.json` : le livre `guide-frenchy`, sans `dir` (aucune extraction : les profils se citent par page) ;
 *  2. `planDeBestiaire.json` : les espèces d'apparence que le plan n'a pas (`ESPECES_NEUVES`) ;
 *  3. `groups.json` : les Groupes que nomme une spécialisation imprimée et que le registre n'a pas ;
 *  4. `skills.json`, `talents.json` : les spécialisations imprimées absentes du catalogue (`SPECS_NEUVES`,
 *     `TALENT_SPECS_NEUVES`), hors pool ;
 *  5. `creatures.json` : un statbloc par profil —
 *     - id nu par libellé ; suffixé du livre (`-hcvm`) sur collision avec un id du bestiaire, de la famille du
 *       guide entre homonymes du guide (ou de sa section, ou de son niveau : le premier qui les distingue) ; un
 *       profil réimprimé à l'identique devient un emplacement secondaire (`alsoIn`) du premier ;
 *     - `folder` = famille du guide ; `appearance.species` par `ESPECE_DE_FAMILLE` / `ESPECE_DU_PROFIL` ;
 *       `grantGroups` par `GROUPES_DE_FAMILLE` / `GROUPES_DE_SECTION` ;
 *     - Compétences : libellé → id du catalogue ou de `SPEC_DE_COMPETENCE`, liste « A ou B » → `choix` borné ;
 *       « au choix » ou spécialisation non imprimée : Compétence de combat → le Groupe des armes du profil que
 *       ses autres spécialisations ne couvrent pas (`spec` s'il est seul, `choix` borné sinon), toute autre
 *       Compétence spécialisable → `choix` ; aucune Compétence nue ;
 *     - Talents : spécialisation libellé → id du catalogue ou de `SPEC_DE_TALENT` ; « au choix » → Talent sans
 *       spécialisation ;
 *     - Traits : `arg` libellé → id par `ARG_DE_TRAIT` ; Traits propres au guide (`guide-*`) écartés ; les
 *       attaques imprimées que l'Atelier n'a pas relevées s'ajoutent (`ATTAQUES_OMISES`) ;
 *     - Armure : Points d'Armure des pièces portées (catalogue) et du Trait Armure, à chaque Localisation,
 *       ou ceux du guide (`ARMURES_IMPRIMEES` : PA imprimés, moins 2 × l'Indice du Bouclier, divisés par deux,
 *       HCVM p.536) ; matière des pièces (LDB 63 l.97) ;
 *     - Armes : une par arme imprimée — Trait Arme (mêlée) ou À distance (Indice, portée), `arg` = id de la
 *       possession au catalogue (`ARME_IMPRIMEE` reprend celles que l'Atelier a mal reconnues), sinon son
 *       libellé ; Indice = BF + Dégâts de l'arme, ou le Dégât imprimé (`DEGATS_IMPRIMES`), qui fait foi ; une
 *       machine de siège (HCVM p.437, servants) n'est ni une arme ni une possession du profil ;
 *     - Sorts : ids du catalogue, relus contre la table imprimée de chaque lanceur (`SORTS_RELUS`), et le sort
 *       VF relié par `SORT_DU_GUIDE` (Tremblement, MSRC 17 l.284) ; les autres restent hors des profils
 *       (second chantier).
 *
 * ENTRÉES : écrites — `src/data/books.json`, `planDeBestiaire.json`, `groups.json`, `skills.json`,
 * `talents.json`, `creatures.json` ; lues — `traits.json`, `trappings.json`, `weaponGroups.json`,
 * `spells.json`, et l'entrée de conversion ci-dessus.
 * FAIL-FAST — avant toute écriture, sortie 1 : document hors `serializeDataset`, id produit déjà pris, réf
 * (Compétence, Talent, Trait, possession, sort, espèce, Groupe) absente de son catalogue, famille sans espèce,
 * relevé imprimé qui ne désigne aucune arme ni aucun profil.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { slugId } from '../../src/data/slug.ts';
import { tableTotale } from '../../src/lib/tableTotale.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = (rel) => path.join(ROOT, 'src/data', rel);
const ENTREE = path.join(ROOT, 'scripts/migrations/entrees/2026-11-08-3656-pnj-guide.json');

const LIVRE = 'guide-frenchy';
const ENTREE_DU_LIVRE = { id: LIVRE, type: 'books', label: 'Habitants & Créatures du Vieux-Monde', abbr: 'HCVM', language: 'VF', folder: 'Contenu fan' };
const source = (page) => ({ book: LIVRE, page });

/** Espèces d'apparence absentes du plan : leur corps, à la famille de générateur de leurs voisins (le Charognard
 *  vole, à bec et serres, HCVM p.559 ; l'Incendiaire flotte sans jambes, HCVM p.317), ou le motif de l'omission. */
const ESPECES_NEUVES = [
  { id: 'incendiaire-de-tzeentch', label: 'Incendiaire de Tzeentch', corps: 'incendiaire', famille: 'sans-jambes', echelle: 1 },
  { id: 'charognard', label: 'Charognard', corps: 'charognard', famille: 'oiseau', echelle: 1 },
  { id: 'colosse-necrofex', label: 'Colosse Necrofex', omis: 'assemblage de cadavres invoqué (HCVM p.561) : aucune forme commune' },
];
/** Groupes que nomme une spécialisation de Haine du guide. */
const GROUPES_NEUFS = [
  { id: 'ennemis-de-sigmar', type: 'groups', label: 'Ennemis de Sigmar', source: source(89) },
  { id: 'ennemis-d-ulric', type: 'groups', label: 'Ennemis d’Ulric', source: source(92) },
];
/** Spécialisations imprimées absentes du catalogue, par Compétence puis Talent : [libellé, page de première
 *  impression] ; id = `slugId(libellé)`, statblocs seuls (hors pool). */
const SPECS_NEUVES = {
  musicien: [['Flûte', 321], ['Tambourin', 321]],
  savoir: [['Ranald', 116], ['Rivières', 171], ['Chemins', 171], ['Maladies', 383], ['Magie peaux-verte', 450], ['Siège', 468]],
  divertissement: [['Plaidoirie', 59], ['Anecdotes militaires', 62], ['Urbain', 102], ['Séduction', 285], ['Grimaces & mimes', 321],
    ['Fanfaron', 435], ['Gazouillis', 458], ['Cérémonie', 470]],
  metier: [['Reliure', 94], ['Enluminure', 94]],
  'signes-secrets': [['Rebouteux', 139]],
  representation: [['Victimisation', 343], ['Danse tribale', 441]],
  dressage: [['Rats', 398]],
};
const TALENT_SPECS_NEUVES = {
  savant: [['Local', 125]],
  'savoir-vivre': [['Skavens', 339]],
  'bon-marcheur': [['Plaine', 184]],
};

/** Famille du guide → espèce d'apparence (`planDeBestiaire.json`) ; un profil humain (`rc`) hors de cette table
 *  est humain. */
const ESPECE_DE_FAMILLE = {
  Chiens: 'chien', Chevaux: 'cheval', Loups: 'loup', Ours: 'ours', Sangliers: 'sanglier', 'Rats Géants': 'rat-geant',
  'Araignées Géantes': 'araignee-geante', 'Ungors, Gors & Bestigors': 'gor', 'Guerriers du Chaos': 'guerrier-du-chaos',
  'Démons du Chaos': 'furie-du-chaos', 'Démons de Khorne': 'demon', 'Démons de Slaanesh': 'demonette-de-slaanesh',
  'Démons de Nurgle': 'demon', 'Démons de Tzeentch': 'demon', 'Esclaves Skavens': 'skaven', 'Membre de Clans Mineurs': 'skaven',
  'Vermines de Choc': 'vermine-de-choc', 'Clan Skryre': 'skaven', 'Clan Eshin': 'skaven', 'Clan Pestilens': 'skaven',
  'Clan Moulder': 'skaven', 'Rat Ogre': 'rat-ogre', 'Prophète Gris': 'skaven', Gobelins: 'gobelin', Snotlings: 'snotling',
  Orcs: 'orc', Trolls: 'troll', Squigs: 'squig-des-cavernes', Goules: 'goule', Zombies: 'zombie', Squelettes: 'squelette',
  'Fantômes & Spectres': 'fantome', 'Créatures d’Outre-Tombe': 'cheval', Vampires: 'vampire',
};
/** Profil (id de l'Atelier) dont l'espèce n'est pas celle de sa famille. */
const ESPECE_DU_PROFIL = {
  'guide-230-jeune-ungor': 'ungor', 'guide-231-ungor-adulte': 'ungor',
  'guide-236-bestigor-combattant': 'homme-bete', 'guide-240-bestigor-chef-de-harde': 'homme-bete', 'guide-244-bestigor-chef-de-guerre': 'homme-bete',
  'guide-246-shaman-gor': 'chamane-brey', 'guide-248-patre-de-la-nuit': 'chamane-brey', 'guide-251-bouc-maudit': 'chamane-brey',
  'guide-291-gardien-des-secrets-de-slaanesh': 'demon', 'guide-295-gardien-des-secrets-exalte-de-slaanesh': 'demon',
  'guide-317-incendiaire-de-tzeentch': 'incendiaire-de-tzeentch', 'guide-319-grand-incendiaire-de-tzeentch': 'incendiaire-de-tzeentch',
  'guide-321-horreur-rose-de-tzeentch': 'horreur-rose', 'guide-322-horreur-bleue-de-tzeentch': 'horreur-bleue',
  'guide-548-spectre': 'spectre-middenheim', 'guide-550-banshee': 'banshee', 'guide-553-ombre-vengeresse': 'spectre-middenheim',
  'guide-559-charognard': 'charognard', 'guide-561-colosse-necrofex': 'colosse-necrofex',
  'guide-566-vhargulf': 'chauve-souris-vampire-varghulf',
};
/** Famille du guide → Groupes déclarés (`grantGroups`), ceux des voisins officiels de même espèce ; une famille
 *  humaine hors de cette table déclare `humain`. Les Groupes que visent les Talents du guide (Sans peur
 *  (Criminels), (Bandits), (Naufrageurs & Pirates Fluviaux), (Patrouilleurs)) désignent ses sections. */
const GROUPES_DE_FAMILLE = {
  'Patrouilleurs Ruraux': ['patrouilleurs-routiers', 'humain'], 'Embarcation de Patrouilleurs Fluviaux': ['patrouilleurs-fluviaux', 'humain'],
  'Brigands & Hors-la-Loi': ['hors-la-loi', 'humain'], 'Contrebandiers & Trafiquants': ['hors-la-loi', 'humain'],
  'Naufrageurs & Pirates Fluviaux': ['naufrageurs', 'hors-la-loi', 'humain'], Sorcière: ['sorcieres', 'humain'],
  Chiens: ['bete', 'animaux-domestiques'], Chevaux: ['bete', 'animaux-domestiques'], Loups: ['bete', 'predateur'],
  Ours: ['bete', 'predateur'], Sangliers: ['bete'], 'Rats Géants': ['bete', 'rats'], 'Araignées Géantes': ['bete', 'predateur'],
  'Ungors, Gors & Bestigors': ['homme-bete'], 'Guerriers du Chaos': ['cultiste'], 'Sorcier du Chaos': ['cultiste', 'humain'],
  'Démons du Chaos': ['demon'], 'Démons de Khorne': ['demon', 'khorne'], 'Démons de Slaanesh': ['demon', 'slaanesh'],
  'Démons de Nurgle': ['demon', 'nurgle'], 'Démons de Tzeentch': ['demon', 'tzeentch'],
  'Esclaves Skavens': ['skaven'], 'Membre de Clans Mineurs': ['skaven'], 'Vermines de Choc': ['skaven'], 'Clan Skryre': ['skaven'],
  'Clan Eshin': ['skaven'], 'Clan Pestilens': ['skaven', 'nurgle'], 'Clan Moulder': ['skaven'], 'Rat Ogre': ['skaven'], 'Prophète Gris': ['skaven'],
  Gobelins: ['peau-verte'], Snotlings: ['peau-verte'], Orcs: ['peau-verte'], Trolls: ['bete', 'monstres'], Squigs: ['bete', 'monstres'],
  Goules: ['mort-vivant'], Zombies: ['mort-vivant'], Squelettes: ['mort-vivant'], 'Fantômes & Spectres': ['mort-vivant'],
  'Créatures d’Outre-Tombe': ['mort-vivant'], Vampires: ['mort-vivant'],
};
/** Section du guide → Groupes déclarés par ses familles humaines hors `GROUPES_DE_FAMILLE`. */
const GROUPES_DE_SECTION = { 'Criminalité Urbaine': ['criminel', 'humain'] };
/** Espèces dont les statblocs suivent les règles de Personnage, comme leurs voisins officiels. */
const ESPECES_PERSONNAGES = new Set(['humain', 'guerrier-du-chaos']);

/** Spécialisation de Compétence imprimée (libellé) → spécialisation du catalogue, `choix` (borné, ou `true` : le
 *  catalogue n'a pas toutes celles que le guide offre), ou `null` : la Compétence n'entre pas (« Tir (Toile) »,
 *  « Tir (Souffle) » : ni Groupe d'armes ni spécialisation, l'attaque du Trait se teste sur la Capacité de Tir). */
const SPEC_DE_COMPETENCE = {
  'musicien:Tambour OU Fifre': { choix: ['tambour', 'fifre'] },
  'musicien:Tambour ou Fifre': { choix: ['tambour', 'fifre'] },
  'musicien:Flûte ou Tambourin': { choix: ['flute', 'tambourin'] },
  'musicien:Flûte': { spec: 'flute' },
  'chevaucher:Loup ou Squig': { choix: ['loup', 'squig'] },
  'metier:Armurier OU Forgeron': { choix: ['armurier', 'forgeron'] },
  'savoir:Rivières ou Chemins': { choix: ['rivieres', 'chemins'] },
  // MCLB 02 l.1322
  'savoir:Zone de Patrouille': { spec: 'local' },
  'savoir:Zone Patrouille': { spec: 'local' },
  // LDB 08 l.244
  'savoir:Province d’Exercice': { spec: 'region' },
  // LDB 08 l.1089
  'savoir:Bataille': { spec: 'guerre' },
  // LDB 08 l.1897
  'savoir:Sorcellerie': { spec: 'sorcieres' },
  // HCVM p.268
  'savoir:Divinité': { choix: true },
  // PDT 06 l.405
  'divertissement:Sermons': { spec: 'discours' },
  // LDB 08 l.1407
  'divertissement:Moqueries': { spec: 'raillerie' },
  'divertissement:Insultes': { spec: 'raillerie' },
  'divertissement:Chants de Marins': { spec: 'chant' },
  'metier:Archerie': { spec: 'fabricant-d-arcs' },
  // HCVM p.411 ; trapping canon-ratling
  'projectiles:Mitrailleuse': { spec: 'ingenierie' },
  // HCVM p.415 ; trapping baton-de-combat
  'corps-a-corps:Arme Longue': { spec: 'armes-d-hast' },
  'projectiles:Toile': null,
  'projectiles:Souffle': null,
};
/** Spécialisation de Talent imprimée (libellé) → id ; `null` : le Talent entre sans spécialisation. */
const SPEC_DE_TALENT = {
  'sans-peur:Criminels': 'criminel',
  'sans-peur:Bandits': 'hors-la-loi',
  'sans-peur:Naufrageurs & Pirates Fluviaux': 'naufrageurs',
  'sans-peur:Bêtes': 'bete',
  'haine:Ennemis de Sigmar': 'ennemis-de-sigmar',
  'haine:Ennemis d’Ulric': 'ennemis-d-ulric',
  // « Étiquette (Cultes) » des prêtres, « Étiquette (Religieux) » : LDB 08 l.1295
  'savoir-vivre:cultistes': 'fideles',
  'savoir-vivre:Religieux': 'fideles',
  // Le Domaine de la Ruine (Clan Skryre) n'est au catalogue d'aucun livre autorisé.
  'magie-des-arcanes:Domaine de la Ruine': null,
  // Un Talent ne porte pas d'emplacement à désigner : « A ou B » entre sans spécialisation, comme « au choix ».
  'bon-marcheur:Plaine OU Forêt': null,
  'bon-marcheur:Forêt ou Plaine': null,
};
/** « Sans peur (Patrouilleurs) » : la patrouille que croise chaque profil. */
const SPEC_DU_PROFIL = {
  'guide-167-seigneur-brigand:sans-peur': 'patrouilleurs-routiers',
  'guide-172-roi-du-trafic:sans-peur': 'patrouilleurs-fluviaux',
};
/** `arg` de Trait imprimé (libellé) → id de son registre ; `null` : le Trait entre sans `arg`. */
const ARG_DE_TRAIT = {
  'animosite:Peaux-Vertes': 'peau-verte',
  'haine:cible à définir': null,
  // HCVM p.317 ; LDB 85
  'souffle:Flammes d’AEthyr': 'feu',
};
/** Attaques imprimées que l'Atelier n'a pas relevées, par profil : la Bagarre (Indice imprimé, à mains nues), la
 *  Lance jetée du riverain. */
const bagarre = (value) => [{ id: 'arme', value, arg: 'mains-nues' }];
const ATTAQUES_OMISES = {
  'guide-53-jeune-interrogateur': bagarre(3), 'guide-54-repurgateur': bagarre(3), 'guide-55-inquisiteur': bagarre(3),
  'guide-56-grand-inquisiteur': bagarre(3), 'guide-68-citadin': bagarre(3), 'guide-69-notable': bagarre(3),
  'guide-70-bourgmestre': bagarre(3), 'guide-122-jeune-villageois': bagarre(3), 'guide-123-villageois': bagarre(4),
  'guide-124-ancien': bagarre(5), 'guide-125-venerable': bagarre(6), 'guide-232-jeune-gor': bagarre(4),
  'guide-235-gor-combattant': bagarre(6), 'guide-236-bestigor-combattant': bagarre(7), 'guide-238-gor-chef-de-harde': bagarre(7),
  'guide-240-bestigor-chef-de-harde': bagarre(8), 'guide-242-gor-chef-de-guerre': bagarre(8),
  'guide-244-bestigor-chef-de-guerre': bagarre(9), 'guide-545-fantome': bagarre(4), 'guide-548-spectre': bagarre(5),
  'guide-553-ombre-vengeresse': bagarre(9), 'guide-561-colosse-necrofex': bagarre(9),
  'guide-134-riverain': [{ id: 'a-distance', value: 6, arg: 'Lance', range: 9 }],
  'guide-135-riverain-respecte': [{ id: 'a-distance', value: 6, arg: 'Lance', range: 9 }],
};
/** Arme naturelle imprimée → possession du catalogue qui la porte. */
const ARME_NATURELLE_DU_CATALOGUE = { 'Pieds & Poings': 'mains-nues' };
/** Possession que l'Atelier a reconnue à tort → celle que le guide imprime, par id ou par `profil:id` : le Marteau
 *  de Guerre imprimé à Allonge Moyenne (p.88, 89, 95) et la Lance Courte (p.233) sont des armes simples (LDB 62
 *  l.127), le Filet Lesté imprimé en Tir (p.375-402) est le filet. */
const ARME_IMPRIMEE = {
  'marteau-de-guerre': 'arme-simple',
  'filet-leste': 'filet',
  'guide-233-gor-eclaireur:lance': 'arme-simple',
};
/** Possessions texte de l'Atelier qui ne sont ni des possessions ni des armes (débris de ligne d'arme). */
const TEXTES_ECARTES = new Set(['en dépensant 1 Avantage', 'afin de faciliter au maximum le vol plané…', '57 Crocs']);
/** Possessions texte qui nomment une attaque naturelle. */
const TEXTES_NATURELS = new Set(['Morsures']);
/** Sorts de l'Atelier relus contre la table imprimée du lanceur : « Explosion de Dhar » est l'Explosion de
 *  Corruption seule, « Projectile de Dhar » la Décharge de Corruption (EDOC p.80). */
const DHAR = { retirer: ['explosion'] };
const DHAR_ET_PROJECTILE = { retirer: ['explosion', 'carreau'], ajouter: ['decharge-de-corruption'] };
const SORTS_RELUS = {
  'guide-118-pretre-voleur-de-ranald': { retirer: ['benediction-de-grace'] },
  'guide-146-envouteuse': { ajouter: ['aura-ordinaire'] },
  'guide-251-bouc-maudit': DHAR,
  'guide-268-sorcier-du-chaos': DHAR_ET_PROJECTILE,
  'guide-270-sorcier-du-chaos-terrifiant': DHAR_ET_PROJECTILE,
  'guide-273-sorcier-du-chaos-effroyable': DHAR_ET_PROJECTILE,
  'guide-325-heraut-exalte-de-tzeentch': DHAR,
  'guide-328-seigneur-du-changement-de-tzeentch': DHAR,
  'guide-332-seigneur-du-changement-exalte-de-tzeentch': DHAR,
};
/** Sort du guide (id de l'Atelier) → sort VF du catalogue. */
const SORT_DU_GUIDE = {
  'guide-tremor': 'tremblement',
};
/** Traits d'attaque dont l'Indice peut venir du relevé imprimé. */
const TRAITS_D_ATTAQUE = new Set(['morsure', 'cornes', 'vomissement', 'attaque-caudale']);
/** Compétence de combat → Trait des armes qu'elle manie. */
const TRAIT_DE_COMBAT = { 'corps-a-corps': 'arme', projectiles: 'a-distance' };
/** Spécialisation imprimée d'une Compétence spécialisable qui laisse l'emplacement à désigner (`choix`). */
const SPEC_A_DESIGNER = new Set([null, 'au choix']);

/** Dégâts imprimés, par profil (id de l'Atelier) puis arme (id de possession, libellé d'arme naturelle ou de
 *  possession texte, ou id de Trait d'attaque) : Indice, ou `{ value, range }` d'une arme de tir. */
const DEGATS_IMPRIMES = {
  'guide-35-garde-du-village': { 'arme-simple': 8, lance: 8 },
  'guide-36-chef-de-la-garde-du-village': { 'arme-simple': 11, lance: 11 },
  'guide-37-chef-veteran-de-la-garde-du-village': { bouclier: 10, 'arme-simple': 12 },
  'guide-63-soldat-mercenaire-aguerri': { bouclier: 4 },
  'guide-64-sous-officier': { bouclier: 4 },
  'guide-65-officier': { bouclier: 4 },
  'guide-80-artisan': { 'arme-simple': 7 },
  'guide-81-maistre-artisan': { 'arme-simple': 8 },
  'guide-82-marchand': { 'Nerf de Boeuf': 5 },
  'guide-83-maistre-marchand': { 'Nerf de Boeuf': 5 },
  'guide-106-voyou': { 'coup-de-poing': 7, dague: 7 },
  'guide-107-racketteur': { 'coup-de-poing': 9, dague: 9 },
  'guide-113-voleur-aguerri': { dague: 5 },
  'guide-115-pilleur-de-cryptes': { 'arme-simple': 8 },
  'guide-130-marchand': { 'Nerf de Boeuf': 5 },
  'guide-131-maistre-marchand': { 'Nerf de Boeuf': 5 },
  'guide-132-batelier': { 'Crochet / Grappin': 8 },
  'guide-133-nautonier': { 'Crochet / Grappin': 9 },
  'guide-134-riverain': { filet: 3 },
  'guide-135-riverain-respecte': { filet: 3 },
  'guide-137-herboriste': { 'Faucille': 7 },
  'guide-138-maistre-herboriste': { 'Faucille': 7 },
  'guide-139-rebouteux': { 'Faucille': 7 },
  'guide-141-maitre-des-taillis': { 'Faucille': 7 },
  'guide-149-druide-de-la-foi-antique': { 'Faucille': 7 },
  'guide-150-haut-druide-de-la-foi-antique': { 'Faucille': 7 },
  'guide-152-religieuse-novice-de-rhya': { 'arme-improvisee': 3 },
  'guide-153-religieuse-de-rhya': { 'Faucille': 7 },
  'guide-154-pretresse-de-rhya': { 'Faucille': 7 },
  'guide-155-grande-pretresse-de-rhya': { 'Faucille': 7 },
  'guide-157-moine-novice-de-taal': { 'Épieu': 7 },
  'guide-158-moine-de-taal': { 'Épieu': 7 },
  'guide-216-maitre-des-egouts': { 'Griffures & Morsures': 4 },
  'guide-217-horreur-des-profondeurs': { 'Griffures & Morsures': 8 },
  'guide-219-nuee-d-araignees-infantiles': { Morsures: 3 },
  'guide-220-jeune-araignee-geante': { morsure: 3 },
  'guide-222-araignee-geante-adulte': { morsure: 3 },
  'guide-224-araignee-geante-impitoyable': { morsure: 4 },
  'guide-226-chasseresse-des-ombres': { 'Griffes': 5, morsure: 5 },
  'guide-232-jeune-gor': { cornes: 6 },
  'guide-233-gor-eclaireur': { cornes: 6 },
  'guide-234-gor-chasseur': { cornes: 6, 'arme-simple': 7, arc: 9 },
  'guide-235-gor-combattant': { cornes: 6, filet: 4 },
  'guide-236-bestigor-combattant': { cornes: 6, filet: 4 },
  'guide-238-gor-chef-de-harde': { cornes: 6 },
  'guide-240-bestigor-chef-de-harde': { cornes: 6 },
  'guide-242-gor-chef-de-guerre': { cornes: 6 },
  'guide-244-bestigor-chef-de-guerre': { cornes: 6 },
  'guide-246-shaman-gor': { cornes: 6 },
  'guide-248-patre-de-la-nuit': { cornes: 6 },
  'guide-251-bouc-maudit': { cornes: 6 },
  'guide-259-maraudeur-du-chaos-chef-de-guerre': { 'arme-simple': 9 },
  'guide-262-guerrier-du-chaos': { 'Grand Tranchoir à Deux Mains': 11 },
  'guide-263-guerrier-du-chaos-chef-de-bande': { 'Grand Tranchoir à Deux Mains': 15 },
  'guide-265-guerrier-du-chaos-chef-de-guerre': { 'Grand Tranchoir à Deux Mains': 16 },
  'guide-277-furie-exaltee-du-chaos': { cornes: 7 },
  'guide-280-heraut-exalte-de-khorne': { 'arme-simple': 9 },
  'guide-281-buveur-de-sang-de-khorne': { 'arme-simple': 14, fouet: { value: 10, range: 24 }, cornes: 12 },
  'guide-283-buveur-de-sang-exalte-de-khorne': { 'arme-simple': 16, fouet: { value: 12, range: 24 }, cornes: 14 },
  'guide-291-gardien-des-secrets-de-slaanesh': { 'Pinces': 10 },
  'guide-295-gardien-des-secrets-exalte-de-slaanesh': { 'Pinces': 12 },
  'guide-328-seigneur-du-changement-de-tzeentch': { 'Sceptre Ailé': 10 },
  'guide-332-seigneur-du-changement-exalte-de-tzeentch': { 'Sceptre Ailé': 12 },
  'guide-337-esclave-faible': { 'arme-improvisee': 4 },
  'guide-338-esclave': { 'arme-improvisee': 5 },
  'guide-339-kapo': { 'arme-improvisee': 6 },
  'guide-344-skaven': { 'Griffes & Crocs': 5 },
  'guide-345-chef-de-portee': { 'Griffes & Crocs': 5 },
  'guide-347-chef-de-clan': { 'Griffes & Crocs': 5 },
  'guide-350-jeune-recrue': { hallebarde: 7 },
  'guide-353-chef-de-section': { 'Électro-Hallebarde': 12 },
  'guide-355-chef-d-escadron': { 'Électro-Hallebarde': 13 },
  'guide-358-apprenti-technomage': { 'Mousquet à Malepierre': { value: 8, range: 20 } },
  'guide-360-technomage': { 'Électro-Lame': 8, 'jezail-a-malepierre': 11 },
  'guide-363-technomage-experimente': { 'Électro-Lame': 8, 'jezail-a-malepierre': 11 },
  'guide-366-architechnomage': { 'Électro-Lame': 8, 'jezail-a-malepierre': 11 },
  'guide-372-coureur-d-egouts': { 'Shurikens Skavens': { value: 7, range: 6 } },
  'guide-375-assassin': { 'Griffes de Poing': 6, 'Shurikens Skavens': { value: 7, range: 6 }, filet: { value: 0, range: 3 } },
  'guide-378-maitre-assassin': { 'Griffes de Poing': 6, 'Shurikens Skavens': { value: 7, range: 6 }, filet: { value: 0, range: 3 } },
  'guide-383-jeune-moine-de-la-peste': { 'Encensoir de la Peste': 7 },
  'guide-385-moine-de-la-peste': { 'Encensoir de la Peste': 9 },
  'guide-388-grand-moine-de-la-peste': { 'Encensoir de la Peste': 10 },
  'guide-391-predicateur-de-la-peste': { 'Encensoir de la Peste': 11 },
  'guide-396-jeune-contremaitre': { filet: 3 },
  'guide-398-contremaitre': { filet: 3 },
  'guide-400-maitre-des-hybridation': { filet: 3 },
  'guide-402-grand-maitre-des-hybridations': { filet: 3 },
  'guide-407-rat-ogre-fonctionnel': { 'attaque-caudale': 8 },
  'guide-409-rat-ogre-augmente': { 'attaque-caudale': 9 },
  'guide-411-horreur-du-clan-moulder': { 'canon-ratling': 9, 'attaque-caudale': 9 },
  'guide-427-jeune-gobelin': { 'Projectile Improvisé': { value: 2, range: 6 } },
  'guide-429-gobelin': { 'Pieds & Poings': 3, 'Projectile Improvisé': { value: 3, range: 9 } },
  'guide-433-archer-gobelin': { arc: 9 },
  'guide-441-fanatique-gobelin': { 'Boule & Chaîne': 10 },
  'guide-443-chef-de-clan-gobelin': { arc: 9 },
  'guide-445-chef-de-guerre-gobelin': { arc: 10 },
  'guide-457-nuee-de-snotlings': { 'arme-improvisee': 2 },
  'guide-458-snotling': { 'arme-improvisee': 2, 'Projectile Improvisé': { value: 2, range: 4 } },
  'guide-460-jeune-orc': { 'Projectile Improvisé': { value: 3, range: 9 } },
  'guide-463-archer-orc': { arc: 8 },
  'guide-466-chef-de-clan-orc': { 'Tranchoir': 11 },
  'guide-468-chef-de-guerre-orc': { 'Tranchoir': 12 },
  'guide-483-jeune-troll': { morsure: 8, vomissement: 9 },
  'guide-485-troll': { vomissement: 10 },
  'guide-487-troll-veteran': { rocher: 8, vomissement: 11 },
  'guide-489-grand-troll-sanguinaire': { rocher: 8, vomissement: 12 },
  'guide-492-sorciere-troll-des-marais': { vomissement: 11 },
  'guide-507-squig': { 'Griffures & Morsures': 9 },
  'guide-508-grand-squig': { 'Griffures & Morsures': 11 },
  'guide-510-squig-monstrueux': { 'Griffures & Morsures': 12 },
  'guide-538-squelette-vigoureux': { bouclier: 6, 'arme-simple': 8, arc: 7 },
  'guide-540-chevalier-des-tombes': { zweihander: 15 },
  'guide-548-spectre': { 'Faux': 9 },
  'guide-553-ombre-vengeresse': { 'Faux': 13 },
};
/** Points d'Armure imprimés, moins le Bouclier, divisés par deux (HCVM p.536), là où ils diffèrent des pièces. */
const ARMURES_IMPRIMEES = {
  'guide-29-homme-du-guet': { tete: 3, brasG: 1, brasD: 1, corps: 1, jambeG: 1, jambeD: 1 },
  'guide-30-sergent-du-guet': { tete: 4, brasG: 1, brasD: 1, corps: 4, jambeG: 1, jambeD: 1 },
  'guide-31-capitaine-du-guet': { tete: 6, brasG: 3, brasD: 3, corps: 6, jambeG: 3, jambeD: 3 },
  'guide-34-jeune-recrue-de-la-garde-du-village': { tete: 3, brasG: 0, brasD: 0, corps: 1, jambeG: 0, jambeD: 0 },
  'guide-35-garde-du-village': { tete: 3, brasG: 1, brasD: 1, corps: 1, jambeG: 1, jambeD: 1 },
  'guide-36-chef-de-la-garde-du-village': { tete: 3, brasG: 1, brasD: 1, corps: 1, jambeG: 1, jambeD: 1 },
  'guide-37-chef-veteran-de-la-garde-du-village': 3,
  'guide-41-patrouilleur-rural': { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 },
  'guide-42-sergent': { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 },
  'guide-43-capitaine': { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 },
  'guide-48-sergent': { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 0, jambeD: 0 },
  'guide-50-capitaine': { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 0, jambeD: 0 },
  'guide-89-pretre-de-sigmar': { tete: 0, brasG: 1, brasD: 1, corps: 4, jambeG: 1, jambeD: 1 },
  'guide-95-pretresse-de-verena': { tete: 0, brasG: 1, brasD: 1, corps: 4, jambeG: 1, jambeD: 1 },
  'guide-161-haut-pretre-rodeur-de-taal': { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 1, jambeD: 1 },
  'guide-190-destrier': 4,
  'guide-231-ungor-adulte': { tete: 0, brasG: 0, brasD: 0, corps: 1, jambeG: 0, jambeD: 0 },
  'guide-262-guerrier-du-chaos': 4,
  'guide-263-guerrier-du-chaos-chef-de-bande': 5,
  'guide-265-guerrier-du-chaos-chef-de-guerre': 6,
  'guide-285-daemonette-de-slaanesh': { tete: 0, brasG: 3, brasD: 3, corps: 0, jambeG: 0, jambeD: 0 },
  'guide-286-heraut-de-slaanesh': { tete: 1, brasG: 3, brasD: 3, corps: 1, jambeG: 1, jambeD: 1 },
  'guide-288-heraut-exalte-de-slaanesh': { tete: 2, brasG: 3, brasD: 3, corps: 2, jambeG: 2, jambeD: 2 },
  'guide-345-chef-de-portee': { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 },
  'guide-347-chef-de-clan': { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 },
  'guide-353-chef-de-section': { tete: 7, brasG: 4, brasD: 4, corps: 7, jambeG: 4, jambeD: 4 },
  'guide-437-quadrilleur-gobelin': { tete: 4, brasG: 1, brasD: 1, corps: 4, jambeG: 1, jambeD: 1 },
  'guide-445-chef-de-guerre-gobelin': 6,
  'guide-540-chevalier-des-tombes': 6,
  'guide-557-destrier-squelettique': 4,
};

const LOCS = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
const ZONES = { Tête: ['tete'], Bras: ['brasG', 'brasD'], Corps: ['corps'], Jambes: ['jambeG', 'jambeD'] };
const CARACS = ['capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite', 'intelligence', 'force-mentale', 'sociabilite'];

const fautes = [];
const docs = new Map();
function charger(rel) {
  if (!docs.has(rel)) {
    const texte = fs.readFileSync(DATA(rel), 'utf8');
    const doc = JSON.parse(texte);
    if (serializeDataset(doc) !== texte) fautes.push(`${rel} : formatage hors serializeDataset`);
    docs.set(rel, { doc, avant: texte });
  }
  return docs.get(rel).doc;
}
const lire = (rel) => JSON.parse(fs.readFileSync(DATA(rel), 'utf8'));
/** Libellé normalisé (casse, accents, apostrophes, espaces) : la correspondance libellé → id du catalogue. */
const norm = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

const books = charger('books.json');
const creatures = charger('creatures.json');
if (books.some((b) => b.id === LIVRE) || creatures.some((c) => c.source?.book === LIVRE)) {
  console.log(`#3656 — le livre ${LIVRE} est au registre ou cité au bestiaire : rien à écrire.`);
  process.exit(0);
}

const profils = JSON.parse(fs.readFileSync(ENTREE, 'utf8'));
const plan = charger('planDeBestiaire.json');
const groups = charger('groups.json');
const skills = charger('skills.json');
const talents = charger('talents.json');
const traits = lire('traits.json');
const trappings = new Map(lire('trappings.json').map((t) => [t.id, t]));
const trappingParLibelle = new Map([...trappings.values()].map((t) => [t.label, t.id]));
const matiereDuGroupe = new Map(lire('weaponGroups.json').filter((g) => g.kind === 'armour').map((g) => [g.id, g.material]));
const spells = new Set(lire('spells.json').map((s) => s.id));

// 0. Relectures de l'entrée de conversion contre le guide.
for (const [atelier, { retirer = [], ajouter = [] }] of Object.entries(SORTS_RELUS)) {
  const p = profils.find((x) => x.id === atelier);
  if (!p) { fautes.push(`SORTS_RELUS : ${atelier} n'est pas un profil`); continue; }
  for (const s of retirer) if (!p.sp.includes(s)) fautes.push(`SORTS_RELUS ${atelier} : ${s} n'est pas porté`);
  for (const s of ajouter) if (p.sp.includes(s) || !spells.has(s)) fautes.push(`SORTS_RELUS ${atelier} : ${s} déjà porté ou hors catalogue`);
  p.sp = [...p.sp.filter((s) => !retirer.includes(s)), ...ajouter];
}
const DE_SIEGE = 'armes-de-siege';
const enginsDeSiege = new Set([...trappings.values()].filter((t) => t.subType === DE_SIEGE).map((t) => norm(t.label.replace(/\s*\(.*\)$/, ''))));
const substitutions = new Set();
for (const p of profils) {
  p.it = p.it.filter((it) => (it.i ? trappings.get(it.i)?.subType !== DE_SIEGE : !enginsDeSiege.has(norm(it.t))));
  p.it = p.it.map((it) => {
    const cle = it.i && [`${p.id}:${it.i}`, it.i].find((k) => k in ARME_IMPRIMEE);
    if (!cle) return it;
    substitutions.add(cle);
    return { i: ARME_IMPRIMEE[cle] };
  });
}
for (const cle of Object.keys(ARME_IMPRIMEE)) if (!substitutions.has(cle)) fautes.push(`ARME_IMPRIMEE : ${cle} ne désigne aucune possession`);

// 1–4. Registres.
books.push(ENTREE_DU_LIVRE);
for (const e of ESPECES_NEUVES) {
  if (plan.some((x) => x.id === e.id)) fautes.push(`planDeBestiaire : ${e.id} déjà présent`);
  const { id, label, ...corps } = e;
  plan.push({ id, type: 'planDeBestiaire', label, ...corps });
}
for (const g of GROUPES_NEUFS) {
  if (groups.some((x) => x.id === g.id)) fautes.push(`groups : ${g.id} déjà présent`);
  groups.push(g);
}
for (const [doc, table] of [[skills, SPECS_NEUVES], [talents, TALENT_SPECS_NEUVES]]) {
  for (const [porteur, specs] of Object.entries(table)) {
    const def = doc.find((x) => x.id === porteur);
    for (const [label, page] of specs) {
      const id = slugId(label);
      if (def.specs.some((x) => x.id === id || norm(x.label) === norm(label))) fautes.push(`${porteur} : spécialisation ${id} déjà présente`);
      def.specs.push({ id, label, source: source(page), pool: false });
    }
  }
}
const skillsParId = new Map(skills.map((s) => [s.id, s]));
const talentsParId = new Map(talents.map((t) => [t.id, t]));
const traitsParId = new Map(traits.map((t) => [t.id, t]));
const especes = new Set(plan.map((x) => x.id));
const groupes = new Set(groups.map((g) => g.id));
const specialisable = (sk) => (sk.specs?.length ?? 0) > 0 || sk.specsSource !== undefined;
const sansVide = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));
const sansIndefini = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
/** Spécialisation imprimée (id, ou libellé de l'Atelier) → id du catalogue de son porteur ; un porteur à
 *  `specsSource` reçoit déjà l'id de son registre. `undefined` : absente du catalogue. */
const specDuCatalogue = (def, spec) => (def.specsSource ? spec
  : def.specs?.find((x) => x.id === spec || norm(x.label) === norm(spec))?.id);

// 5a. Ids : réimpressions, collisions, homonymes.
const empreinte = (p) => JSON.stringify([p.l, p.fam, p.ch, p.tr, p.op, p.sk, p.ta, p.it, p.sp ?? []]);
const premiers = new Map();
const reimpressions = new Map();
for (const p of profils) {
  const k = empreinte(p);
  if (premiers.has(k)) reimpressions.set(p.id, premiers.get(k));
  else premiers.set(k, p.id);
}
const retenus = profils.filter((p) => !reimpressions.has(p.id));
const idsOfficiels = new Set(creatures.map((c) => c.id));
const ids = new Map();
const parLibelle = new Map();
for (const p of retenus) parLibelle.set(slugId(p.l), [...(parLibelle.get(slugId(p.l)) ?? []), p]);
for (const [id, groupe] of parLibelle) {
  if (groupe.length < 2) { ids.set(groupe[0].id, idsOfficiels.has(id) ? `${id}-hcvm` : id); continue; }
  // Le premier suffixe qui distingue tout le groupe : famille, puis section, puis niveau.
  const suffixe = [(p) => p.fam, (p) => p.f, (p) => p.t].find((s) => new Set(groupe.map((p) => slugId(s(p)))).size === groupe.length);
  if (!suffixe) { fautes.push(`homonymes ${id} : aucun suffixe ne les distingue`); continue; }
  for (const p of groupe) ids.set(p.id, `${id}-${slugId(suffixe(p))}`);
}
const pris = new Set();
for (const [atelier, id] of ids) {
  if (idsOfficiels.has(id) || pris.has(id)) fautes.push(`${atelier} : id ${id} déjà pris`);
  pris.add(id);
}

// 5b. Armement.
function armure(p) {
  const pa = tableTotale(LOCS, () => 0);
  const matieres = [];
  const naturelle = p.tr.find((t) => t[0] === 'armure');
  if (naturelle) { for (const l of LOCS) pa[l] += naturelle[1]; matieres.push({ matiere: 'peau', locs: LOCS, pa: naturelle[1] }); }
  for (const it of p.it) {
    const piece = it.i && trappings.get(it.i);
    if (!piece || piece.categorie !== 'armor') continue;
    const locs = piece.loc.split(',').flatMap((z) => ZONES[z.trim()] ?? []);
    for (const l of locs) pa[l] += piece.pa;
    matieres.push({ matiere: matiereDuGroupe.get(piece.subType), locs, pa: piece.pa });
  }
  const imprimee = ARMURES_IMPRIMEES[p.id];
  const final = imprimee === undefined ? pa : typeof imprimee === 'number' ? tableTotale(LOCS, () => imprimee) : imprimee;
  if (LOCS.every((l) => final[l] === 0)) return null;
  // LDB 63 l.97 ; docs/raw/4e/combat.md « Parenthèse de l'Armure dans les profils »
  const metal = (l) => matieres.filter((m) => m.matiere === 'metal' && m.locs.includes(l)).reduce((n, m) => n + m.pa, 0);
  const matiere = matieres.length && matieres.every((m) => m.matiere === matieres[0].matiere) ? matieres[0].matiere
    : matieres.length && LOCS.every((l) => metal(l) >= final[l]) ? 'metal' : undefined;
  const uniforme = LOCS.every((l) => final[l] === final.tete);
  return sansVide({ id: 'armure', ...(uniforme ? { value: final.tete } : { parLocalisation: final }), matiere });
}

function armes(p, relevesVus) {
  const BF = Math.floor((p.ch[3] ?? 0) / 10);
  const releves = DEGATS_IMPRIMES[p.id] ?? {};
  const releve = (cle) => { if (cle in releves) { relevesVus.add(`${p.id}:${cle}`); return releves[cle]; } return undefined; };
  const indice = (r) => (r && typeof r === 'object' ? r.value : r);
  const out = [];
  for (const t of p.tr) {
    if (t[0] !== 'arme') continue;
    const r = releve(t[2]);
    const catalogue = ARME_NATURELLE_DU_CATALOGUE[t[2]];
    out.push(catalogue ? sansVide({ id: 'arme', value: indice(r) ?? t[1], arg: catalogue }) : sansVide({ id: 'arme', value: indice(r) ?? t[1], arg: t[2], natural: true }));
  }
  for (const it of p.it) {
    if (it.t !== undefined) {
      const r = releve(it.t);
      if (r === undefined) continue;
      if (typeof r === 'object' && r.range !== undefined) out.push(sansVide({ id: 'a-distance', value: r.value, arg: it.t, range: r.range }));
      else out.push(sansVide({ id: 'arme', value: indice(r), arg: it.t, ...(TEXTES_NATURELS.has(it.t) ? { natural: true } : {}) }));
      continue;
    }
    const arme = trappings.get(it.i);
    if (!arme || (arme.categorie !== 'melee' && arme.categorie !== 'distance')) continue;
    const r = releve(it.i);
    const calcul = arme.damage.plusBF ? BF + arme.damage.flat : arme.damage.flat;
    if (arme.categorie === 'melee') { out.push({ id: 'arme', value: indice(r) ?? calcul, arg: it.i }); continue; }
    const portee = typeof arme.range === 'number' ? arme.range : arme.range.bf * BF;
    out.push({ id: 'a-distance', value: indice(r) ?? calcul, arg: it.i, range: (typeof r === 'object' ? r.range : undefined) ?? portee });
  }
  return out;
}

// 5c. Statblocs.
const relevesVus = new Set();
const sortsLaisses = [];
const traitsEcartes = [];
const competencesEcartees = [];
const neufs = [];
const refMorte = (atelier, quoi) => fautes.push(`${atelier} : ${quoi} absent de son catalogue`);
for (const p of retenus) {
  const espece = ESPECE_DU_PROFIL[p.id] ?? ESPECE_DE_FAMILLE[p.fam] ?? (p.rc === 'humain' ? 'humain' : undefined);
  if (!especes.has(espece)) fautes.push(`${p.id} : espèce ${espece} absente du plan`);
  const grantGroups = GROUPES_DE_FAMILLE[p.fam] ?? GROUPES_DE_SECTION[p.f] ?? (p.rc === 'humain' ? ['humain'] : undefined);
  if (!grantGroups) fautes.push(`${p.id} : famille ${p.fam} sans Groupes`);
  for (const g of grantGroups ?? []) if (!groupes.has(g)) refMorte(p.id, `Groupe ${g}`);

  const traitsPoses = [];
  for (const [id, value, arg, range, count] of p.tr) {
    if (id === 'arme' || id === 'armure') continue;
    if (id.startsWith('guide-')) { traitsEcartes.push(`${p.id} × ${id}`); continue; }
    if (!traitsParId.has(id)) { refMorte(p.id, `Trait ${id}`); continue; }
    const cleArg = `${id}:${arg}`;
    const a = arg != null && cleArg in ARG_DE_TRAIT ? ARG_DE_TRAIT[cleArg] : arg;
    const r = TRAITS_D_ATTAQUE.has(id) ? DEGATS_IMPRIMES[p.id]?.[id] : undefined;
    if (r !== undefined) relevesVus.add(`${p.id}:${id}`);
    traitsPoses.push(sansVide({ id, value: r ?? value, arg: a, range, count }));
  }
  // Un Trait imprimé deux fois, l'une avec son `arg` : la pose sans `arg` est un doublon de lecture.
  const poses = traitsPoses.filter((t) => t.arg !== undefined || t.value !== undefined || !traitsPoses.some((u) => u !== t && u.id === t.id));
  for (const [cle, r] of Object.entries(DEGATS_IMPRIMES[p.id] ?? {})) {
    if (!TRAITS_D_ATTAQUE.has(cle) || poses.some((t) => t.id === cle)) continue;
    relevesVus.add(`${p.id}:${cle}`);
    poses.push({ id: cle, value: r });
  }
  const a = armure(p);
  const armement = [...armes(p, relevesVus), ...(ATTAQUES_OMISES[p.id] ?? [])];

  const competences = [];
  for (const [id, spec, value] of p.sk) {
    const sk = skillsParId.get(id);
    if (!sk) { refMorte(p.id, `Compétence ${id}`); continue; }
    const cle = `${id}:${spec}`;
    if (spec != null && cle in SPEC_DE_COMPETENCE) {
      const m = SPEC_DE_COMPETENCE[cle];
      if (m === null) { competencesEcartees.push(`${p.id} × ${id} (${spec}) ${value}`); continue; }
      if (m.choix === true) { competences.push({ id, choix: true, value }); continue; }
      for (const x of m.choix ?? [m.spec]) if (specDuCatalogue(sk, x) !== x) refMorte(p.id, `spécialisation ${id} (${x})`);
      competences.push(m.spec ? { id, spec: m.spec, value } : { id, choix: m.choix, value });
    } else if (SPEC_A_DESIGNER.has(spec) && specialisable(sk)) competences.push({ id, choix: true, value });
    else if (spec == null) competences.push({ id, value });
    else {
      const s = specDuCatalogue(sk, spec);
      if (s === undefined) refMorte(p.id, `spécialisation ${id} (${spec})`);
      competences.push({ id, spec: s, value });
    }
  }
  // Compétence de combat à désigner : les Groupes des armes du profil que ses autres spécialisations ne couvrent pas.
  for (const c of competences) {
    if (c.choix !== true || !(c.id in TRAIT_DE_COMBAT)) continue;
    const couverts = new Set(competences.filter((x) => x.id === c.id && x.spec).map((x) => x.spec));
    const libres = [...new Set(armement.filter((t) => t.id === TRAIT_DE_COMBAT[c.id]).map((t) => trappings.get(t.arg)?.subType))]
      .filter((g) => g !== undefined && !couverts.has(g));
    if (libres.length === 1) { delete c.choix; c.spec = libres[0]; } else if (libres.length > 1) c.choix = libres;
  }

  const talentsPoses = [];
  for (const [id, spec, times] of p.ta) {
    if (!talentsParId.has(id)) { refMorte(p.id, `Talent ${id}`); continue; }
    const cle = `${id}:${spec}`;
    const imprimee = SPEC_DU_PROFIL[`${p.id}:${id}`] ?? (cle in SPEC_DE_TALENT ? SPEC_DE_TALENT[cle] : spec === 'au choix' || spec === '' ? null : spec);
    const def = talentsParId.get(id);
    const s = imprimee == null ? null : specDuCatalogue(def, imprimee);
    if (s === undefined) refMorte(p.id, `spécialisation ${id} (${imprimee})`);
    if (s != null && def.specsSource === 'groupesDAppartenance' && !groupes.has(s)) refMorte(p.id, `Groupe ${s}`);
    talentsPoses.push(sansVide({ id, spec: s, times: times != null && times > 1 ? times : undefined }));
  }

  const possessions = [];
  for (const it of p.it) {
    if (it.i) { if (!trappings.has(it.i)) refMorte(p.id, `possession ${it.i}`); else possessions.push({ id: it.i }); continue; }
    if (TEXTES_ECARTES.has(it.t) || TEXTES_NATURELS.has(it.t)) continue;
    // Une possession texte qui EST un libellé du catalogue (« Faucille ») s'écrit {id} ; son arme garde le libellé.
    const lie = trappingParLibelle.get(it.t);
    possessions.push(lie ? { id: lie } : { text: it.t });
  }

  const sorts = [];
  for (const s of p.sp ?? []) {
    const id = SORT_DU_GUIDE[s] ?? s;
    if (spells.has(id)) sorts.push(id);
    else if (s.startsWith('guide-')) sortsLaisses.push(`${p.id} × ${s}`);
    else refMorte(p.id, `sort ${s}`);
  }

  const id = ids.get(p.id);
  const alsoIn = [...reimpressions].filter(([, premier]) => premier === p.id).map(([r]) => source(profils.find((x) => x.id === r).src[1]));
  neufs.push(sansIndefini({
    id, type: 'creatures', label: p.l, title: p.t || null, folder: p.fam,
    char: Object.fromEntries([['M', p.ch[0]], ...CARACS.map((k, i) => [k, p.ch[i + 1]]), ['B', p.ch[11]]]),
    traits: [...poses, ...(a ? [a] : []), ...armement],
    optionals: p.op.map(([tid, value, arg, range, count]) => sansVide({ id: tid, value, arg, range, count })),
    skills: competences, talents: talentsPoses, trappings: possessions, spells: sorts,
    source: source(p.src[1]),
    alsoIn: alsoIn.length ? alsoIn : undefined,
    appearance: { species: espece },
    followsCharacterRules: ESPECES_PERSONNAGES.has(espece) ? true : undefined,
    grantGroups,
  }));
}
for (const [atelier, releves] of Object.entries(DEGATS_IMPRIMES)) {
  if (!ids.has(atelier)) { fautes.push(`DEGATS_IMPRIMES : ${atelier} n'est pas un profil retenu`); continue; }
  for (const cle of Object.keys(releves)) if (!relevesVus.has(`${atelier}:${cle}`)) fautes.push(`DEGATS_IMPRIMES ${atelier} : « ${cle} » ne désigne aucune arme`);
}
for (const atelier of Object.keys(ATTAQUES_OMISES)) if (!ids.has(atelier)) fautes.push(`ATTAQUES_OMISES : ${atelier} n'est pas un profil retenu`);
for (const atelier of Object.keys(ARMURES_IMPRIMEES)) if (!ids.has(atelier)) fautes.push(`ARMURES_IMPRIMEES : ${atelier} n'est pas un profil retenu`);

if (fautes.length) {
  console.error(`#3656 — rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}
creatures.push(...neufs);
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(DATA(rel), apres);
}
console.log(`#3656 — ${neufs.length} statbloc(s) (${reimpressions.size} réimpression(s) en emplacement secondaire), ${ESPECES_NEUVES.length} espèce(s), ${GROUPES_NEUFS.length} Groupe(s).`);
if (traitsEcartes.length) console.log(`  Traits propres au guide écartés : ${traitsEcartes.join(', ')}`);
if (competencesEcartees.length) console.log(`  Compétences écartées : ${competencesEcartees.join(', ')}`);
console.log(`  Sorts laissés au second chantier : ${sortsLaisses.length}`);
