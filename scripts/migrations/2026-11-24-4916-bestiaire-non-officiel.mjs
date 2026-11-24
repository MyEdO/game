/**
 * Migration #4916 — le *Bestiaire non officiel* (Le Ratier Bretonnien, v2.03) devient un livre de la base commune :
 * ses créatures entrent au bestiaire, jouables en combat, chacune citée à sa page, et ses Traits propres au catalogue,
 * par leur texte, sans mécanique. laurent, 2026-11-24 : « C est un énorme défaut du jeu de ne pas accepter le bestiaire
 * fan de fonctionner » ; « Pas grave pour le moment si les traits manquant ne font rien. On peut faire ça plus tard ».
 * Fiche `user-arbitrage-bestiaire-non-officiel`.
 *
 * ENTRÉES DE CONVERSION : les fiches de l'Atelier des PNJ (PR #3633, `outils/atelier-pnj/entrees/`), aux ids du dépôt,
 * `src: ['bno', page]` — `scripts/migrations/entrees/2026-11-24-4916-pnj-bno.json` (107 profils) et
 * `scripts/migrations/entrees/2026-11-24-4916-traits-bno.json` (36 Traits, texte et page). Les valeurs que la fiche de
 * l'Atelier a perdues se relèvent à la VO (fiche `user-doctrine-vo-fournit-la-donnee-mecanique-absente-de-la-vf`,
 * `ARMURES_IMPRIMEES`).
 *
 * GESTES, tous joués une seule fois (NO-OP dès que `books.json` porte le livre ou qu'un statbloc le cite) :
 *  1. `books.json` : le livre `bestiaire-non-officiel`, sans `dir` (aucune extraction VF : les entrées se citent par page) ;
 *  2. `traits.json` : un Trait par Trait propre du livre, `desc` verbatim de l'Atelier, sans mécanique ; id par libellé,
 *     suffixé `-bno` sur collision avec un id d'un catalogue croisé (`CATALOGUES_CROISES`) ;
 *  3. `planDeBestiaire.json` : les espèces d'apparence que le plan n'a pas (`ESPECES_NEUVES`) ;
 *  4. `creatures.json` : un statbloc par profil —
 *     - id par libellé, suffixé `-bno` sur collision avec un id d'un catalogue croisé ; `folder` = section du livre ; `appearance.species` et
 *       `grantGroups` par `PROFILS` ;
 *     - Traits : `arg` libellé → id du registre par `ARG_DE_TRAIT` (`null` : le Trait entre sans `arg`) ; Taille
 *       facultative imprimée en fourchette → une Taille facultative par catégorie de la fourchette ; Trait propre →
 *       son id au catalogue ;
 *     - Armure : Trait Armure, `matiere` par `MATIERE_D_ARMURE` ; Points par Localisation par `ARMURES_IMPRIMEES` ;
 *     - Armes : Trait Arme ou À distance, `arg` = id de la possession au catalogue dont c'est le libellé, sinon le
 *       libellé imprimé, `natural` pour une arme du corps (`ARMES_DU_CORPS`) ; « ×N » → `count` ;
 *     - Compétences : une spécialisation imprimée sur une Compétence sans spécialisation est une condition d'emploi :
 *       la Compétence entre sans elle, à sa plus basse valeur imprimée ; une Compétence spécialisable entre en `choix`.
 *
 * ENTRÉES : écrites — `src/data/books.json`, `traits.json`, `planDeBestiaire.json`, `creatures.json` ; lues —
 * `groups.json`, les catalogues croisés (`CATALOGUES_CROISES`, dont `trappings.json`, `skills.json`, `talents.json`), et
 * les deux entrées de conversion ci-dessus.
 * FAIL-FAST — avant toute écriture, sortie 1 : document hors `serializeDataset`, id produit déjà pris, réf (Trait,
 * Compétence, Talent, espèce, Groupe) absente de son catalogue, profil sans ligne `PROFILS`, `arg` sans traitement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';
import { slugId } from '../../src/data/slug.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = (rel) => path.join(ROOT, 'src/data', rel);
const ENTREE_PROFILS = path.join(ROOT, 'scripts/migrations/entrees/2026-11-24-4916-pnj-bno.json');
const ENTREE_TRAITS = path.join(ROOT, 'scripts/migrations/entrees/2026-11-24-4916-traits-bno.json');

const LIVRE = 'bestiaire-non-officiel';
const SUFFIXE = 'bno';
const ENTREE_DU_LIVRE = { id: LIVRE, type: 'books', label: 'Bestiaire non officiel', abbr: 'BNO', language: 'VF', folder: 'Contenu fan' };
const source = (page) => ({ book: LIVRE, page });

/** Espèces d'apparence absentes du plan : leur corps, à la famille de générateur de leurs voisins, leur race de rendu,
 *  ou le motif de l'omission. */
const A_TRANCHER = 'forme propre au livre, sans voisin au plan : son corps se tranche sur planche';
const ESPECES_NEUVES = [
  { id: 'troglodyte', label: 'Troglodyte', corps: 'troglodyte', famille: 'theropode', echelle: 1.2 },
  { id: 'molosse-a-sang-froid', label: 'Molosse à sang froid', corps: 'molosse-a-sang-froid', famille: 'quadrupede', echelle: 0.9 },
  { id: 'culchan', label: 'Culchan', omis: A_TRANCHER },
  { id: 'grenouille', label: 'Grenouille', corps: 'grenouille', famille: 'quadrupede', echelle: 0.5 },
  { id: 'homme-lezard', label: 'Homme-lézard', race: { id: 'humain' }, echelle: 1 },
  { id: 'skink', label: 'Skink', race: { id: 'humain' }, echelle: 0.8 },
  { id: 'kroxigor', label: 'Kroxigor', race: { id: 'ogre' }, echelle: 1.1 },
  { id: 'slann', label: 'Slann', omis: A_TRANCHER },
  { id: 'salamandre', label: 'Salamandre', corps: 'salamandre', famille: 'quadrupede', echelle: 1 },
  { id: 'terradon', label: 'Terradon', corps: 'terradon', famille: 'quadrupede-aile', echelle: 1.1 },
  { id: 'horreur-de-la-couvee', label: 'Horreur de la couvée', omis: A_TRANCHER },
  { id: 'abomination-de-malefosse', label: 'Abomination de Malefosse', omis: A_TRANCHER },
  { id: 'mere-rat', label: 'Mère-rat', omis: A_TRANCHER },
  { id: 'chauve-souris', label: 'Chauve-souris', corps: 'chauve-souris', famille: 'oiseau', echelle: 0.5 },
  { id: 'ronce-de-sang', label: 'Ronce de sang', omis: A_TRANCHER },
  { id: 'doppelganger', label: 'Doppelganger', race: { id: 'humain' }, echelle: 1 },
  { id: 'tortue-dragon', label: 'Tortue dragon', corps: 'tortue-dragon', famille: 'quadrupede', echelle: 1.2 },
  { id: 'elementaire', label: 'Élémentaire', omis: A_TRANCHER },
  { id: 'scarabee-geant', label: 'Scarabée géant', corps: 'scarabee', famille: 'arthropode-a-pinces', echelle: 0.9 },
  { id: 'scorpion-geant', label: 'Scorpion géant', corps: 'scorpion', famille: 'arthropode-a-pinces', echelle: 1 },
  { id: 'harpie', label: 'Harpie', race: { id: 'humain' }, echelle: 0.9 },
  { id: 'palourde-des-sables', label: 'Palourde des sables', omis: A_TRANCHER },
  { id: 'renard', label: 'Renard', corps: 'renard', famille: 'quadrupede', echelle: 0.6 },
  { id: 'loutre', label: 'Loutre', corps: 'loutre', famille: 'quadrupede', echelle: 0.5 },
  { id: 'lapin', label: 'Lapin', corps: 'lapin', famille: 'quadrupede', echelle: 0.45 },
  { id: 'ecureuil', label: 'Écureuil', corps: 'ecureuil', famille: 'quadrupede', echelle: 0.4 },
  { id: 'hermine', label: 'Hermine', corps: 'hermine', famille: 'quadrupede', echelle: 0.45 },
  { id: 'nuee', label: 'Nuée', omis: A_TRANCHER },
  { id: 'homme-arbre', label: 'Homme-arbre', race: { id: 'humain' }, echelle: 1.4 },
  { id: 'zoat', label: 'Zoat', omis: A_TRANCHER },
  { id: 'juggernaute', label: 'Juggernaute', corps: 'juggernaute', famille: 'quadrupede', echelle: 1.2 },
  { id: 'bete-de-nurgle', label: 'Bête de Nurgle', omis: A_TRANCHER },
  { id: 'disque-de-tzeentch', label: 'Disque de Tzeentch', omis: A_TRANCHER },
  { id: 'bete-de-slaanesh', label: 'Bête de Slaanesh', omis: A_TRANCHER },
  { id: 'hurleur-de-tzeentch', label: 'Hurleur de Tzeentch', omis: A_TRANCHER },
  { id: 'monture-de-slaanesh', label: 'Monture de Slaanesh', omis: A_TRANCHER },
  { id: 'armure-animee', label: 'Armure animée', race: { id: 'humain' }, echelle: 1 },
  { id: 'ambull', label: 'Ambull', omis: A_TRANCHER },
  { id: 'charogneur', label: 'Charogneur', omis: A_TRANCHER },
  { id: 'taureau-centaure', label: 'Taureau centaure', omis: A_TRANCHER },
  { id: 'corail-des-cavernes', label: 'Corail des cavernes', omis: A_TRANCHER },
  { id: 'centigor', label: 'Centigor', omis: A_TRANCHER },
  { id: 'crocodile', label: 'Crocodile', corps: 'crocodile', famille: 'quadrupede', echelle: 1 },
  { id: 'dragon-ogre', label: 'Dragon ogre', omis: A_TRANCHER },
  { id: 'gargouille', label: 'Gargouille', race: { id: 'humain' }, echelle: 0.7 },
  { id: 'geckomandre', label: 'Geckomandre', corps: 'geckomandre', famille: 'quadrupede', echelle: 0.9 },
  { id: 'castor-geant', label: 'Castor géant', corps: 'castor', famille: 'quadrupede', echelle: 0.9 },
  { id: 'escargot-geant', label: 'Escargot géant', corps: 'escargot', famille: 'sans-membres', echelle: 1 },
  { id: 'grignoteur', label: 'Grignoteur', omis: A_TRANCHER },
  { id: 'ostrix', label: 'Ostrix', race: { id: 'humain' }, echelle: 1 },
  { id: 'monstre-de-la-pourriture', label: 'Monstre de la pourriture', omis: A_TRANCHER },
  { id: 'gardien-runique', label: 'Gardien runique', omis: A_TRANCHER },
  { id: 'serpent-de-mer', label: 'Serpent de mer', corps: 'serpent-de-mer', famille: 'sans-membres', echelle: 1.3 },
  { id: 'requin', label: 'Requin', corps: 'requin', famille: 'poisson', echelle: 1.2 },
  { id: 'farfadet', label: 'Farfadet', race: { id: 'humain' }, echelle: 0.4 },
];

/** Profil (id de l'Atelier) → espèce d'apparence (`e`) et Groupes déclarés (`g`), ceux des voisins officiels. */
const BETE = ['bete'];
const MONSTRE = ['bete', 'monstres'];
const PREDATEUR = ['bete', 'predateur'];
const SKAVEN = ['skaven'];
const MORT = ['mort-vivant'];
const DEMON = ['demon'];
const PROFILS = {
  'bno-12-coatl': { e: 'serpent', g: [...MONSTRE, 'serpent'] },
  'bno-12-troglodytes': { e: 'troglodyte', g: MONSTRE },
  'bno-12-molosses-a-sang-froid': { e: 'molosse-a-sang-froid', g: PREDATEUR },
  'bno-12-culchans': { e: 'culchan', g: BETE },
  'bno-12-grenouilles-geantes': { e: 'grenouille', g: BETE },
  'bno-13-jaguars': { e: 'chat-sauvage', g: PREDATEUR },
  'bno-13-kroxigor': { e: 'kroxigor', g: BETE },
  'bno-13-tigres-a-dents-de-sabre': { e: 'chat-sauvage', g: PREDATEUR },
  'bno-13-salamandres': { e: 'salamandre', g: MONSTRE },
  'bno-13-saurus': { e: 'homme-lezard', g: BETE },
  'bno-13-skinks': { e: 'skink', g: BETE },
  'bno-14-cameleons': { e: 'skink', g: BETE },
  'bno-14-slann': { e: 'slann', g: BETE },
  'bno-14-terradons': { e: 'terradon', g: MONSTRE },
  'bno-15-horreur-de-la-couvee': { e: 'horreur-de-la-couvee', g: [...SKAVEN, 'monstres'] },
  'bno-16-abominations-de-malefosse': { e: 'abomination-de-malefosse', g: [...SKAVEN, 'monstres'] },
  'bno-16-pretres-de-la-peste': { e: 'skaven', g: [...SKAVEN, 'nurgle'] },
  'bno-17-meres-rats': { e: 'mere-rat', g: SKAVEN },
  'bno-17-tirailleurs': { e: 'skaven', g: SKAVEN },
  'bno-17-demon-mutant-de-choc': { e: 'rat-ogre', g: [...SKAVEN, 'monstres'] },
  'bno-18-seigneurs-de-guerre': { e: 'skaven', g: SKAVEN },
  'bno-19-chauves-souris-ordinaire': { e: 'chauve-souris', g: BETE },
  'bno-19-chauve-souris-geantes': { e: 'chauve-souris', g: BETE },
  'bno-19-ronce-de-sang': { e: 'ronce-de-sang', g: ['monstres'] },
  'bno-20-vivaneau-carnivore': { e: 'brochet-du-stir', g: PREDATEUR },
  'bno-20-chats-domestiques': { e: 'chat-sauvage', g: [...BETE, 'animaux-domestiques'] },
  'bno-21-doppelgangers': { e: 'doppelganger', g: ['monstres'] },
  'bno-21-tortues-dragon': { e: 'tortue-dragon', g: MONSTRE },
  'bno-21-elementaire-monstrueuse': { e: 'elementaire', g: [] },
  'bno-21-elementaire-enorme': { e: 'elementaire', g: [] },
  'bno-21-elementaire-grande': { e: 'elementaire', g: [] },
  'bno-22-elementaire-moyenne': { e: 'elementaire', g: [] },
  'bno-22-elementaire-petite': { e: 'elementaire', g: [] },
  'bno-22-scarabees-geants': { e: 'scarabee-geant', g: BETE },
  'bno-23-scorpions-geants': { e: 'scorpion-geant', g: PREDATEUR },
  'bno-23-harpies': { e: 'harpie', g: ['monstres'] },
  'bno-23-bison': { e: 'boeuf', g: BETE },
  'bno-24-vers-vegetaux': { e: 'vers', g: ['monstres'] },
  'bno-24-hommes-lezards': { e: 'homme-lezard', g: BETE },
  'bno-24-momies': { e: 'zombie', g: MORT },
  'bno-24-hiboux-ordinaire': { e: 'heomreth-hibou-geant', g: BETE },
  'bno-24-hiboux-geants': { e: 'heomreth-hibou-geant', g: BETE },
  'bno-25-palourde-des-sables': { e: 'palourde-des-sables', g: MONSTRE },
  'bno-25-aigle': { e: 'grand-aigle', g: PREDATEUR },
  'bno-25-renard': { e: 'renard', g: PREDATEUR },
  'bno-25-grenouille': { e: 'grenouille', g: BETE },
  'bno-25-faucon': { e: 'faucon-des-montagnes-grises', g: PREDATEUR },
  'bno-25-loutre': { e: 'loutre', g: BETE },
  'bno-25-lapin': { e: 'lapin', g: BETE },
  'bno-26-corneille': { e: 'volee-de-noctecorbes', g: BETE },
  'bno-26-ecureuil': { e: 'ecureuil', g: BETE },
  'bno-26-hermine': { e: 'hermine', g: PREDATEUR },
  'bno-26-nuees': { e: 'nuee', g: BETE },
  'bno-27-homme-arbre': { e: 'homme-arbre', g: ['monstres'] },
  'bno-27-licornes': { e: 'cheval', g: MONSTRE },
  'bno-28-zoats': { e: 'zoat', g: ['monstres'] },
  'bno-29-chien-du-chaos': { e: 'chien', g: DEMON },
  'bno-29-coursiers-demoniaques': { e: 'cheval', g: DEMON },
  'bno-29-diablotins': { e: 'demon', g: DEMON },
  'bno-30-betes-de-nurgle': { e: 'bete-de-nurgle', g: [...DEMON, 'nurgle'] },
  'bno-31-disques-de-tzeentch': { e: 'disque-de-tzeentch', g: [...DEMON, 'tzeentch'] },
  'bno-31-betes-de-slaanesh': { e: 'bete-de-slaanesh', g: [...DEMON, 'slaanesh'] },
  'bno-31-chiens-de-khorne': { e: 'chien', g: [...DEMON, 'khorne'] },
  'bno-31-juggernautes-de-khorne': { e: 'juggernaute', g: [...DEMON, 'khorne'] },
  'bno-32-hurleurs-de-tzeentch': { e: 'hurleur-de-tzeentch', g: [...DEMON, 'tzeentch'] },
  'bno-32-monture-de-slaanesh': { e: 'monture-de-slaanesh', g: [...DEMON, 'slaanesh'] },
  'bno-32-demons-mineurs-profil-generique': { e: 'demon', g: DEMON },
  'bno-33-les-horreurs-du-soufre': { e: 'horreur-bleue', g: [...DEMON, 'tzeentch'] },
  'bno-34-fiddlespasm-axehacker-khorne': { e: 'demon', g: [...DEMON, 'khorne'] },
  'bno-34-fleexgore-glutwarp-tzeentch': { e: 'demon', g: [...DEMON, 'tzeentch'] },
  'bno-34-demons-majeurs-profil-generique': { e: 'demon', g: DEMON },
  'bno-35-verminarque-du-rat-cornu': { e: 'rat-ogre', g: [...DEMON, 'skaven'] },
  'bno-36-baalrukhs': { e: 'demon', g: DEMON },
  'bno-36-mabrothrax': { e: 'demon', g: DEMON },
  'bno-36-mardaggs': { e: 'demon', g: DEMON },
  'bno-36-viydaggs': { e: 'demon', g: DEMON },
  'bno-37-acolytes-kairic': { e: 'humain', g: ['cultiste', 'humain', 'tzeentch'] },
  'bno-37-tzaangors': { e: 'gor', g: ['homme-bete', 'tzeentch'] },
  'bno-38-armure-animee': { e: 'armure-animee', g: ['monstres'] },
  'bno-38-ambull': { e: 'ambull', g: MONSTRE },
  'bno-38-gorilles': { e: 'singe', g: BETE },
  'bno-38-charogneur': { e: 'charogneur', g: MONSTRE },
  'bno-38-taureaux-centaures': { e: 'taureau-centaure', g: ['monstres'] },
  'bno-39-corail-des-cavernes': { e: 'corail-des-cavernes', g: MONSTRE },
  'bno-39-centigors': { e: 'centigor', g: ['homme-bete'] },
  'bno-39-crocodiles': { e: 'crocodile', g: PREDATEUR },
  'bno-39-dryades': { e: 'choses-du-bois-mort', g: ['monstres'] },
  'bno-39-dragon-ogres': { e: 'dragon-ogre', g: ['monstres'] },
  'bno-40-gargouilles': { e: 'gargouille', g: ['monstres'] },
  'bno-40-geckomandre': { e: 'geckomandre', g: MONSTRE },
  'bno-40-castors-geants': { e: 'castor-geant', g: BETE },
  'bno-40-crabes-geants': { e: 'il-potente-granchio', g: MONSTRE },
  'bno-40-escargots-geants': { e: 'escargot-geant', g: MONSTRE },
  'bno-41-vers-lanternes': { e: 'vers', g: MONSTRE },
  'bno-42-grignoteurs': { e: 'grignoteur', g: BETE },
  'bno-42-cauchemars': { e: 'cheval', g: MORT },
  'bno-42-ostrix': { e: 'ostrix', g: ['monstres'] },
  'bno-43-crabe-prometheen': { e: 'il-potente-granchio', g: MONSTRE },
  'bno-43-monstres-de-la-pourriture': { e: 'monstre-de-la-pourriture', g: MONSTRE },
  'bno-43-gardiens-runiques': { e: 'gardien-runique', g: ['monstres'] },
  'bno-43-serpents-de-mer': { e: 'serpent-de-mer', g: [...MONSTRE, 'serpent'] },
  'bno-44-requins': { e: 'requin', g: PREDATEUR },
  'bno-44-farfadets': { e: 'farfadet', g: ['monstres'] },
  'bno-44-zombie-fongique': { e: 'zombie', g: MORT },
  'bno-45-treekin': { e: 'homme-arbre', g: ['monstres'] },
  'bno-45-vautours': { e: 'charognard', g: BETE },
  'bno-45-dragons-zombies': { e: 'dragon', g: MORT },
};
/** Espèces dont les statblocs suivent les règles de Personnage, comme leurs voisins officiels. */
const ESPECES_PERSONNAGES = new Set(['humain']);

/** `arg` de Trait imprimé (`id:libellé`) → id de son registre ; `null` : le Trait entre sans `arg` (le libellé ne
 *  désigne aucune entrée du registre, ou le Trait n'en porte pas). */
const ARG_DE_TRAIT = {
  'vision-nocturne:10': null, 'vision-nocturne:20': null, 'vision-nocturne:30': null, 'vision-nocturne:50': null,
  'infravision:sonar': null, 'infravision:Sonar': null,
  'endurant:1-5': null, 'endurant:2': null, 'endurant:3': null,
  'constricteur:Morsure': null, 'affame:Métal': null, 'nuee:Volée': null,
  'maladie:Choix': 'au choix',
  'maladie:Pourriture du sang': null, 'maladie:Pourriture du tombeau': null, 'maladie:Pourriture de Nurgle': null,
  'maladie:T .Fongus': null,
  'immunite:Chute': null, 'immunite:corruption': null, 'immunite:maladie': null,
  'effraye:Chiens': null, 'animosite:Chiens': null, 'prejuge:Empire': null,
  'haine:Non-Skaven': null, 'haine:Aventuriers': null,
  'souffle:Vapeur': null, 'souffle:Pestilence': null,
  'mutation:télépathie': null,
  'tentacules:×1d5': null, 'tentacules:×1d10': null,
};
/** `arg` de Trait imprimé qui compte des attaques (« ×N ») → `count`. */
const COMPTE = /^×(\d+)\s*(.*)$/;
/** Arme imprimée qui est une partie du corps : `natural` (`traitsDevantLEquipement`, `src/engine/creatureEquip.ts`). */
const ARMES_DU_CORPS = new Set(['morsure', 'griffes', 'griffe', 'cornes', 'corne', 'poing', 'branches', 'langue', 'queue', 'dents a macher']);
/** Libellé d'armure imprimé → matière (LDB 63 l.97) ; absent : sans matière. */
const MATIERE_D_ARMURE = {
  'Écailles': 'peau', 'Écaille': 'peau', Fourrure: 'peau', peau: 'peau', Peaux: 'peau', Plumes: 'peau', Coquille: 'peau',
  coquille: 'peau', 'écorce': 'peau', 'Écorce': 'peau', Exosquelette: 'peau', Carapace: 'peau', Cuir: 'leather',
  'Acier, Bouclier': 'metal', 'Acier, Grand bouclier': 'metal', 'Acier seulement & Arme à deux mains': 'metal',
};
const LOCS = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
const parLoc = (autres, zones) => Object.fromEntries(LOCS.map((l) => [l, zones[l] ?? autres]));
/** Points d'Armure par Localisation, par libellé imprimé : « Tête/Corps seulement » (BNO p.20) ; « corps, autre »
 *  (Zoat : Body 3, Other 1, Unofficial Bestiary 2.0 l.1427) ; « Écailles ; Tête » (Geckomandre : Scales 1; Head 2,
 *  Unofficial Bestiary 2.0 l.1962) ; « Corps » (BNO p.39). */
const ARMURES_IMPRIMEES = {
  'Tête/Corps seulement': (v) => ({ parLocalisation: parLoc(0, { tete: v, corps: v }), matiere: 'peau' }),
  'corps, autre': () => ({ parLocalisation: parLoc(1, { corps: 3 }), matiere: 'peau' }),
  'Écailles ; Tête': () => ({ parLocalisation: parLoc(1, { tete: 2 }), matiere: 'peau' }),
  Corps: (v) => ({ parLocalisation: parLoc(0, { corps: v }) }),
};
/** Libellés d'armure qui ne nomment que ce qui la compose, sans matière commune. */
const ARMURES_SANS_MATIERE = new Set(['Maille d’ossements', 'Bouclier', 'Acier et Peaux', 'Aura']);
const CATALOGUES_CROISES = ['traits.json', 'talents.json', 'qualities.json', 'maneuvers.json', 'spells.json', 'trappings.json',
  'skills.json', 'creatures.json', 'props.json', 'vehicles.json', 'regles.json', 'characteristics.json', 'cargoes.json'];
const TAILLES = ['minuscule', 'tresPetite', 'petite', 'moyenne', 'grande', 'enorme', 'monstrueuse'];
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
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
const sansVide = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined));

const books = charger('books.json');
const creatures = charger('creatures.json');
if (books.some((b) => b.id === LIVRE) || creatures.some((c) => c.source?.book === LIVRE)) {
  console.log(`#4916 — le livre ${LIVRE} est au registre ou cité au bestiaire : rien à écrire.`);
  process.exit(0);
}

const profils = JSON.parse(fs.readFileSync(ENTREE_PROFILS, 'utf8'));
const traitsDuLivre = JSON.parse(fs.readFileSync(ENTREE_TRAITS, 'utf8')).traits;
const traits = charger('traits.json');
const plan = charger('planDeBestiaire.json');
const groupes = new Set(lire('groups.json').map((g) => g.id));
const skills = new Map(lire('skills.json').map((s) => [s.id, s]));
const talents = new Set(lire('talents.json').map((t) => t.id));
const armeParLibelle = new Map(lire('trappings.json').filter((t) => t.categorie === 'melee' || t.categorie === 'distance').map((t) => [norm(t.label), t.id]));

// 1. Le livre.
books.push(ENTREE_DU_LIVRE);

/** Les ids des catalogues dont les lookups se croisent (`src/data/id-collisions.test.ts`) : un id neuf qui en
 *  reprend un prend le suffixe du livre. */
const idsPris = new Set(CATALOGUES_CROISES.flatMap((rel) => lire(rel).map((x) => x.id)));
const idNeuf = (label) => (idsPris.has(slugId(label)) ? `${slugId(label)}-${SUFFIXE}` : slugId(label));

// 2. Les Traits propres.
const idsDeTrait = new Set(traits.map((t) => t.id));
const traitDuLivre = new Map();
for (const [atelier, { l, d, o }] of Object.entries(traitsDuLivre)) {
  const id = idNeuf(l);
  if (idsPris.has(id)) fautes.push(`Trait ${atelier} : id ${id} déjà pris`);
  idsPris.add(id);
  idsDeTrait.add(id);
  traitDuLivre.set(atelier, id);
  traits.push({ id, type: 'traits', label: l, desc: d, source: source(o[1]) });
}

// 3. Les espèces d'apparence.
for (const e of ESPECES_NEUVES) {
  if (plan.some((x) => x.id === e.id)) fautes.push(`planDeBestiaire : ${e.id} déjà présent`);
  const { id, label, ...corps } = e;
  plan.push({ id, type: 'planDeBestiaire', label, ...corps });
}
const especes = new Set(plan.map((x) => x.id));

// 4. Les statblocs.
const refMorte = (atelier, quoi) => fautes.push(`${atelier} : ${quoi} absent de son catalogue`);
const clesVues = new Set();

function arme(p, id, value, arg, range) {
  const pose = { id, value };
  if (arg == null) return sansVide({ ...pose, range });
  const compte = COMPTE.exec(arg);
  const libelle = compte ? compte[2] : arg;
  const count = compte ? Number(compte[1]) : undefined;
  if (!libelle) return sansVide({ ...pose, count, range });
  const catalogue = armeParLibelle.get(norm(libelle));
  if (catalogue) return sansVide({ ...pose, arg: catalogue, count, range });
  return sansVide({ ...pose, arg: libelle, count, range, natural: ARMES_DU_CORPS.has(norm(libelle)) || undefined });
}

function armure(p, value, arg) {
  if (value == null) return null;
  if (arg == null) return { id: 'armure', value };
  if (arg in ARMURES_IMPRIMEES) return { id: 'armure', ...ARMURES_IMPRIMEES[arg](value) };
  if (arg in MATIERE_D_ARMURE) return { id: 'armure', value, matiere: MATIERE_D_ARMURE[arg] };
  if (ARMURES_SANS_MATIERE.has(arg)) return { id: 'armure', value };
  fautes.push(`${p.id} : armure « ${arg} » sans traitement`);
  return null;
}

/** Une Taille imprimée en fourchette (« Petite - Enorme ») : ses catégories, de la première à la dernière. */
function fourchetteDeTaille(arg) {
  const bornes = norm(arg).split(/\s*-\s*|\s*,\s*|\s+a\s+/).map((b) => b.replace(/^moyen$/, 'moyenne').replace(/^monstrueux$/, 'monstrueuse'));
  const rangs = bornes.map((b) => TAILLES.indexOf(b));
  if (rangs.length !== 2 || rangs.some((r) => r < 0)) return null;
  return TAILLES.slice(rangs[0], rangs[1] + 1);
}

function trait(p, [id, value, arg, range]) {
  if (id === 'arme' || id === 'a-distance') return [arme(p, id, value, arg, range)];
  if (id === 'armure') return [armure(p, value, arg)].filter(Boolean);
  if (id.startsWith('bno-')) return [{ id: traitDuLivre.get(id) }];
  if (!idsDeTrait.has(id)) { refMorte(p.id, `Trait ${id}`); return []; }
  if (id === 'taille' && arg != null && !TAILLES.includes(arg)) {
    const tailles = fourchetteDeTaille(arg);
    if (!tailles) { fautes.push(`${p.id} : Taille « ${arg} » sans traitement`); return []; }
    return tailles.map((t) => ({ id, arg: t }));
  }
  const cle = `${id}:${arg}`;
  if (cle in ARG_DE_TRAIT) clesVues.add(cle);
  const a = arg != null && cle in ARG_DE_TRAIT ? ARG_DE_TRAIT[cle] : arg;
  const tentacules = id === 'tentacules' && a != null ? COMPTE.exec(a) : null;
  if (tentacules) return [sansVide({ id, value, count: Number(tentacules[1]) })];
  return [sansVide({ id, value: value === 0 ? undefined : value, arg: a, range })];
}

const neufs = [];
for (const p of profils) {
  const profil = PROFILS[p.id];
  if (!profil) { fautes.push(`${p.id} : aucune ligne PROFILS`); continue; }
  if (!especes.has(profil.e)) fautes.push(`${p.id} : espèce ${profil.e} absente du plan`);
  for (const g of profil.g) if (!groupes.has(g)) refMorte(p.id, `Groupe ${g}`);
  const id = idNeuf(p.l);
  if (idsPris.has(id)) fautes.push(`${p.id} : id ${id} déjà pris`);
  idsPris.add(id);

  const poses = p.tr.flatMap((t) => trait(p, t));
  // Une Taille facultative déjà portée par le profil n'est pas une option.
  const facultatifs = p.op.flatMap((t) => trait(p, t))
    .filter((t) => !(t.id === 'taille' && poses.some((u) => u.id === 'taille' && u.arg === t.arg)));

  const parCompetence = new Map();
  for (const [sk, , value] of p.sk) {
    const def = skills.get(sk);
    if (!def) { refMorte(p.id, `Compétence ${sk}`); continue; }
    const specialisable = (def.specs?.length ?? 0) > 0 || def.specsSource !== undefined;
    const pose = specialisable ? { id: sk, choix: true, value } : { id: sk, value };
    const avant = parCompetence.get(sk);
    if (!avant || avant.value > value) parCompetence.set(sk, pose);
  }
  const talentsPoses = [];
  for (const [ta, spec, times] of p.ta) {
    if (!talents.has(ta)) { refMorte(p.id, `Talent ${ta}`); continue; }
    talentsPoses.push(sansVide({ id: ta, spec, times: times != null && times > 1 ? times : undefined }));
  }
  if (p.it.length) fautes.push(`${p.id} : possessions sans traitement`);

  neufs.push({
    id, type: 'creatures', label: p.l, title: p.t || null, folder: p.f,
    char: Object.fromEntries([['M', p.ch[0]], ...CARACS.map((k, i) => [k, p.ch[i + 1]]), ['B', p.ch[11]]]),
    traits: poses, optionals: facultatifs,
    skills: [...parCompetence.values()], talents: talentsPoses, trappings: [], spells: [],
    source: source(p.src[1]),
    appearance: { species: profil.e },
    ...sansVide({
      followsCharacterRules: ESPECES_PERSONNAGES.has(profil.e) ? true : undefined,
      grantGroups: profil.g.length ? profil.g : undefined,
    }),
  });
}
for (const cle of Object.keys(ARG_DE_TRAIT)) if (!clesVues.has(cle)) fautes.push(`ARG_DE_TRAIT : ${cle} ne désigne aucun Trait imprimé`);
for (const atelier of Object.keys(PROFILS)) if (!profils.some((p) => p.id === atelier)) fautes.push(`PROFILS : ${atelier} n'est pas un profil`);

if (fautes.length) {
  console.error(`#4916 — rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}
creatures.push(...neufs);
for (const [rel, { doc, avant }] of docs) {
  const apres = serializeDataset(doc);
  if (apres !== avant) fs.writeFileSync(DATA(rel), apres);
}
console.log(`#4916 — ${neufs.length} statbloc(s), ${traitDuLivre.size} Trait(s), ${ESPECES_NEUVES.length} espèce(s).`);
