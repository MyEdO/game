import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import { createHash } from 'node:crypto';
import { CODEX, depuisEnveloppe } from './registry';
import { books } from '../../data';

/**
 * Gel de FORME du Codex + cliquet de PROVENANCE (#1467 L1b V-CODEX).
 *
 * Le registre projette une catégorie par entrée des tables ci-dessous (`CLES` les gèle une à une —
 * un compte recopié dans cette prose se périme au premier lot, il l'était déjà). À V-CODEX,
 * l'adoption du défaut d'enveloppe (`depuisEnveloppe`) ne changeait RIEN à l'écran ; à T3 (#1472)
 * elle SURFACE ce que la donnée portait déjà, chaque delta étant déclaré au compte dans `T3_DELTAS`.
 * Cinq mesures, aucune n'étant un dump des items :
 *
 *  1. CLÉS — le gel STRICT : pour chaque catégorie, le hash de `<id>|<clés triées>` ITEM PAR ITEM.
 *     Aucune valeur n'est filtrée : une clé posée à `undefined`/`null` compte comme présente. C'est
 *     la seule mesure qui voit un item perdre ou gagner une clé.
 *  2. FORME — l'UNION des clés par catégorie, à but de DIAGNOSTIC lisible. Elle ne voit PAS un item
 *     isolé qui gagne une clé que ses voisins portent déjà : c'est (1) qui l'attrape.
 *  3. T3_DELTAS — le COMBIEN : par catégorie, le nombre d'items exposant `desc`/`source`, plus la
 *     TAILLE de la table. (1) et (2) voient les clés, pas la population qui les porte.
 *  4. CANAL UNIQUE — la provenance passe par `source`, jamais par un fait de `meta` intitulé
 *     « Source » : le canal en double se lit à l'écran, aucune mesure de forme ne l'attrape.
 *     Son second volet gèle la VALEUR : tout `source.book` projeté est une ABRÉVIATION du
 *     catalogue `books`, jamais l'id brut qu'un site oubliant `src()` laisserait passer.
 *  5. PROVENANCE — pour chaque entrée de `src/data/*.json` portant `source` ou `desc`, l'item Codex
 *     de MÊME id doit les porter aussi. Le mapping dataset→catégorie est DÉDUIT (inclusion des ids),
 *     jamais une table à maintenir ; son ANGLE MORT (les tableaux qu'aucune catégorie ne couvre
 *     ENTIÈREMENT) est lui-même gelé, cf. `PARTIELS`/`ORPHELINS`.
 *
 * Régénérer les baselines : mesurer `CODEX` avec le même calcul que `clesDe`/`formeDe`/le corps du
 * test de provenance, et recopier les tables ci-dessous. Un écart NON VOULU se lit catégorie par
 * catégorie ; un écart VOULU (lot T3) se re-gèle avec sa raison dans le message de commit.
 */

const DATA_DIR = fileURLToPath(new URL('../../data/', import.meta.url));
/** Les datasets de `src/data`, listés UNE fois — deux faits ci-dessous les relisent tous. */
const DATASETS = listerDossier(DATA_DIR).filter((x) => x.endsWith('.json'));

/**
 * sha256 (16 hex) de `<id>|<clés triées>` par item, jointes par \n — gel STRICT clé par clé.
 *
 * #1690 (correctifs du lot 3) : `depuisEnveloppe` projette désormais `maison` — l'arbitrage d'une
 * entrée qu'aucun folio n'imprime, jusque-là présent en donnée et muet à l'écran. 15 catégories
 * gagnent la clé sur 102 items (talents 9, axes 9, trappings 2, etats 1, symptoms 1, creatures 1,
 * traits 3, activities 8, structures 2, terrains 25, crewRoles 7, navalTraits 3, traumas 2,
 * criticalsJambe 1, reglesOptionnelles 28) : empreintes CLES et FORME recalées à la MESURE ; après le
 * rebase sur a6c963419 (train #1612 du tronc : Mendier), `effectTables` porte à son tour un `maison`
 * de premier rang → 16 catégories, empreintes de `activities`/`reglesOptionnelles`/`effectTables` mesurées.
 * `axes` y entre par une correction : sa projection était écrite à la main (`{ id, label, desc }`)
 * et court-circuitait le défaut d'enveloppe — l'invariant du bas de fichier l'a dénoncée.
 *
 * #1693 : un item dont l'`appearance` est un FRAGMENT porté projette `previewPorteur` — l'espèce du
 * porteur sur lequel il se prévisualise, déclarée par la catégorie (`porteurDApercu`). La clé ne se pose
 * QUE sur un item à fragment : `mutations` la gagne (FORME et CLES recalées à la MESURE), `traits` et
 * `psychologie` (même projection `traitItem`, à qui chaque catégorie passe SA clé) ne portent aucune
 * `appearance` en donnée — aucun de leurs items ne gagne la clé, CLES et FORME les gèlent sans elle.
 */
const CLES: Record<string, string> = {
  "arcanePhenomena": '68318e5ed9e81981',
  "advancementCosts": '3fca5e9752e2dfab',
  "disponibilite": '5bf0efe0e06d3102',
  "sizes": '0a5b3b9c8f918a21',
  "drivingMishap": '92fe6cc379b80542',
  "drunkenness": '66aa24947d6ad160',
  "encumbranceTiers": '065c74037364ee01',
  "riverNavigation": '34c199b39cb4cf6a',
  "grapple": '56b4ee72800485aa',
  "miscastMinor": '3dc24773d14f1b94',
  "miscastMajor": '416a3aa0219e8f4e',
  "miscastWrath": '3da49a322927f1e7',
  "nightStakes": '54a15ad6883f8c31',
  "voyageStakes": '9ce6e042bf3b10d8',
  "flowStakes": '5991b421e4d718b4',
  "combatStakes": 'db6c17396c10c31b',
  "races": '0728d04812275962',
  "careers": '482f179346c5e761',
  "characteristics": '532e47bfff4a9328',
  "classes": '67fd1dcccf18c04c',
  "stars": '4603d87c66f77bb2',
  "skills": '7938829857c61067',
  "talents": 'ea025260f80f752b',
  "axes": '30e5605961af8d47',
  "trappings": '711648dd06d431df',
  "siegeEngines": 'a7d8202fa83a7827',
  "weaponGroups": 'cf4eb9c47b2e73f0',
  "qualities": '61b2f19869aadceb',
  "etats": '7e64eca6c569f24e',
  "maladies": '25e48bb168ea15e0',
  "symptoms": 'f903df541e9b7ff5',
  "mutations": 'bd3a933e0e43e9fd',
  // #1686 lot 3a-2 : la catégorie « Matières » ouvre (16 items, 3 groupes titrés par le libellé de
  // valeur du discriminant `domain`) — elle QUITTE du même geste la liste des orphelins ci-dessous.
  // Le retrait de la matière `plafond` (relief, 0 émetteur — 4c052ca9a) enlève un item à la catégorie :
  // l'empreinte porte la LISTE des ids, elle est recalée à la MESURE (15 items).
  "materials": '1767440daa0f9208',
  "mutationTables": '0d6e17a2d2e12dca',
  // #1612 : la table MAISON `mendier-ennuis` entre au dataset, et sa rangée de gardes porte l'AMENDE
  // (op `money` à `Formula`, rendue par `opRows` comme toute autre op de rangée).
  "effectTables": 'd20de6db72702b5d',
  "maneuvers": '30d7e463b2575792',
  "psychologie": '2287ac1af26a59cb',
  "domains": '4e7ed40a32f916d6',
  "spells": '81267fd5d0e86a78',
  "gods": 'd49beaef5ebba230',
  "ventsTourbillonnants": '9a979156867c5f47',
  // +1 : Chien de trait, EDOC 07 folio 22, #673.
  "creatures": '55ac5c9b9846e8ec',
  "traits": '8931be750818442f',
  "locations": '53ca311b61c2a3f1',
  "books": 'be0011b301362125',
  "careerLevels": '6f86fed09e1f4a98',
  "eyes": 'd51e8a821203257f',
  "hairs": 'f2f80b790111b030',
  "calendarMonths": 'c4cec6a132a2bdb7',
  "calendarIntercalary": '804a8d45d962e7d1',
  "calendarWeekdays": '3eecf2c30bb67099',
  "calendarPhases": '283caef56b8e1f4f',
  "weather": '72364e50cea97c29',
  "weatherConditions": '71dd66544ecbcbe1',
  "raceAppearance": '90eb8b747119d31f',
  "pregens": 'e33b6fca9b473190',
  "oups": 'ad42edcb2ed4c50f',
  "interludeEvents": '8c753b6a35cf9665',
  "peripeties": 'baa2fbf2541f7bd8',
  // #1612 : l'Activité Mendier entre au dataset, et la section « Issues par Degrés de Réussite » REND
  // désormais les ops de chaque bande (primitive `opRows` — chips codex-liées + `rollTable` expansé)
  // là où elle n'en imprimait que le COMPTE (« N op(s) sur le Personnage »).
  "activities": 'a872f5a4c467d4d7',
  "massBattlePowerEstimate": '82674e9e4786f386',
  "massBattleMightModifiers": '8b5e85f5fa1f537a',
  "massBattleWarMachines": 'b77e9b7bc67a8d5b',
  "massBattleStructures": 'c285c8dec9f7b877',
  "massBattleHazards": 'e58c05b6a89d14d1',
  "details": '1d94d0c95e00ff48',
  "names": '8ab7649e0daf9e50',
  // #1688 : `taille` + `maison` exigés sur les 24 structures (mesuré en donnée : `maison` 2 → 24,
  // `taille` 0 → 24). La clé projetée qui bouge est `maison`, désormais portée par TOUS les items —
  // `taille` entre par `meta`/`sections`, d'où une FORME inchangée. Empreinte recalée à la MESURE.
  "structures": 'de0741d264020293',
  "terrains": 'e542c259ce8b1e79',
  // #1715 : les 7 types de bâtiment quittent le code pour `buildings.json` et entrent au Codex —
  // empreinte MESURÉE, chaque item portant son `maison` (aucun folio n'imprime de catalogue de bâtiments).
  "buildings": '90fe536489e3927b',
  "vehicles": 'dcc320ad1f8760a1',
  "celestialHouses": '0507cb49e07e8336',
  "groups": '72ed4fd1de352fae',
  "psychologies": 'a85f35c0a34172ef',
  "seaShanties": '2bf96225710afb8c',
  "crewRoles": '3d3b869cae4ba90e',
  "crewTestTypes": '9ecd7be284174851',
  // Empreinte recalculée (#1657 B3-2b-a) : le Trait naval `cale` entre au catalogue (MSRC 07 l.94
  // gate le Critique de Superstructure dessus ; MSRC 10 l.90 le dit du navire marchand).
  "navalTraits": '895d6c4f58df9a3e',
  // NEUF (#1657 B3-2b-a) : catalogue FERMÉ des 5 présences à bord que les livres nomment.
  "shipStations": '4fd49982faa44987',
  "traumas": '3c0c6175299715b2',
  "criticalsTete": '2f3e4405abc1be31',
  "criticalsBras": '2888f3a0f39b49c1',
  "criticalsCorps": 'cf02a7f4d323f141',
  "criticalsJambe": '21835c6fa04f0a56',
  "aaCriticalsTete": '18319705d4737a23',
  "aaCriticalsBras": '59d82c2f7781002b',
  "aaCriticalsCorps": '2ac41e2426b49db6',
  "aaCriticalsJambe": 'd3a85697179f2d46',
  "incidentsMonture": '245d13bec4d29c6b',
  "problemesVehicule": 'be08717e5cb4e005',
  "rencontresPositives": '005516ea5d3b70fd',
  "rencontresFortuites": '7b04e3f65ef2ea8d',
  "rencontresDangereuses": '0446e754073bdbbe',
  "shipCriticalsCargaison": '31dffdc825bb5aac',
  "shipCriticalsGreement": 'b3cb30a563bfd78d',
  "shipCriticalsCoque": '50423b525fae7d8c',
  "shipCriticalsAvirons": 'ac4815f65c3877aa',
  "shipCriticalsEquipements": 'd0041160c877c84f',
  "riverCriticalsGreement": '61d1e2547e056ad7',
  "riverCriticalsAvirons": '69f70586f60d36d4',
  "riverCriticalsGouvernail": 'f6fb5f2042e0aa4d',
  "riverCriticalsCoque": 'df77f1ed19fe476c',
  "riverCriticalsSuperstructure": '764a4347e01ffe06',
  "seaManannFactors": '15fa1d9ae623dc94',
  "seaBoardEvents": 'afb87b2336226c2d',
  "seaPortEvents": '09ed8dec3c9e98e0',
  "waterExposure": 'e4ceeca1e943d0cd',
  "navalPorts": '73b923d02e3c9d73',
  "navalProgression": '2291cebbdc91ae10',
  "shipHullSizes": 'f527a8d6b518ea36',
  "shipSpeedTraits": 'cf53c1c384e11f8f',
  "shipConstructionTraits": '364e4dec54ddf769',
  "seaNavigation": '83821f8854de4594',
  "seaPerils": '71176a2d80f34467',
  "seaWeather": '1c4ce48945ff48e0',
  "montures": '753bb5df6cb62fd3',
  "tavernGames": '8abef4f4ee68acfc',
  "obsessions": '335a5d95e4a39469',
  // #1599 : +`maladie-conscience-determination-minutes` (LDB 20 l.170, durée maison).
  // #1612 : +5 règles `param` de l'Activité Mendier (heures par journée, discours, apparence, chance
  // d'être surpris, amende des gardes) — LDB 09 l.97/l.99 n'en chiffre aucune.
  "reglesOptionnelles": '80f7173eecab7256',
  "surincantation": '561218369ab9cdfd',
  "structureCriticals": '84e0df29c1ae4e21',
  "artilleryMisfire": 'aa3ad3238b5356f8',
  "landCargo": '283fcb2118d143fa',
  "seaCargo": '7bb115dc3fd7550a',
  "riverPerils": 'cb3eb25215968d32',
  "crewMoraleFactors": '91a12d65f9274e14',
  "crewMoraleBands": '817ce48b209e1729',
  "steamBreakdowns": '0241598713ede3cd',
  "regles": 'b26d715609ca1d9a',
};

/** Union des clés PRÉSENTES par catégorie (diagnostic lisible — un item isolé qui gagne une clé que
 *  ses voisins portent déjà lui échappe : c'est `CLES` qui l'attrape). */
const FORME: Record<string, string> = {
  "arcanePhenomena": 'desc group id label meta sections source sub',
  "advancementCosts": 'id label meta source sub',
  "disponibilite": 'id label sections source',
  "sizes": 'id label sections',
  "drivingMishap": 'desc id label meta sub',
  "drunkenness": 'desc id label meta sections sub',
  "encumbranceTiers": 'id label meta source',
  "riverNavigation": 'id label meta sections source',
  "grapple": 'id label sections source',
  "miscastMinor": 'id label meta sections source sub',
  "miscastMajor": 'id label meta sections source sub',
  "miscastWrath": 'id label meta sections source sub',
  "nightStakes": 'desc id label source',
  "voyageStakes": 'desc id label source',
  "flowStakes": 'desc id label source sub',
  "combatStakes": 'desc id label source sub',
  "races": 'appearance desc group id label meta source tabs',
  "careers": 'desc exergue group id label meta source sub tabs',
  "characteristics": 'desc id label meta sections source sub',
  "classes": 'desc id label sections source',
  "stars": 'desc id label meta sections source sub',
  "skills": 'desc id label meta sections source sub',
  "talents": 'desc id label maison meta sections source',
  "axes": 'desc id label maison meta sections',
  "trappings": 'desc id label maison meta sections source sub',
  "siegeEngines": 'appearance desc id label meta previewRef sections source sub',
  "weaponGroups": 'id label sections source sub',
  "qualities": 'desc id label sections source sub',
  "etats": 'desc id label maison sections source',
  "maladies": 'desc id label meta sections source sub',
  "symptoms": 'desc id label maison sections source',
  "mutations": 'appearance desc group id label previewPorteur sections source sub',
  "materials": 'group id label meta sub',
  "mutationTables": 'id label sections source sub',
  "effectTables": 'id label maison sections source sub',
  "maneuvers": 'desc id label meta sections source sub',
  "psychologie": 'appearance desc group id label meta sections source sub',
  "domains": 'desc id label meta sections source',
  "spells": 'desc id label meta sections source sub',
  "gods": 'desc id label sections source sub',
  "ventsTourbillonnants": 'id label meta sub',
  "creatures": 'appearance desc group id label maison meta previewRef sections source statblock sub',
  "traits": 'appearance desc id label maison meta sections source sub',
  "locations": 'desc group id label sections source sub',
  "books": 'desc group id label sections sub',
  "careerLevels": 'group id label sections source sub',
  "eyes": 'id label sections source sub',
  "hairs": 'id label sections source sub',
  "calendarMonths": 'id label source sub',
  "calendarIntercalary": 'id label source sub',
  "calendarWeekdays": 'id label source',
  "calendarPhases": 'id label sub',
  "weather": 'id label source sub',
  "weatherConditions": 'desc id label meta source',
  "raceAppearance": 'appearance id label meta sub',
  "pregens": 'id label meta sections sub',
  "oups": 'id label meta source sub',
  "interludeEvents": 'desc id label source sub',
  "peripeties": 'desc id label source sub',
  "activities": 'desc id label maison meta sections source sub',
  "massBattlePowerEstimate": 'desc id label meta source',
  "massBattleMightModifiers": 'desc id label meta source',
  "massBattleWarMachines": 'id label meta source',
  "massBattleStructures": 'id label meta source',
  "massBattleHazards": 'desc id label source sub',
  "details": 'id label sections',
  "names": 'id label sections sub',
  "structures": 'desc id label maison meta sections source sub',
  "terrains": 'id label maison meta sections',
  "buildings": 'id label maison meta',
  "vehicles": 'desc id label meta source',
  "celestialHouses": 'desc id label source sub',
  "groups": 'id label',
  "psychologies": 'desc id label sections source',
  "seaShanties": 'desc id label meta sections source',
  "crewRoles": 'desc id label maison sections source',
  "crewTestTypes": 'id label meta sections source',
  "navalTraits": 'desc id label maison sections source sub',
  "shipStations": 'desc id label meta source',
  "traumas": 'desc id label maison sections source sub',
  "criticalsTete": 'desc id label meta sections source sub',
  "criticalsBras": 'desc id label meta sections source sub',
  "criticalsCorps": 'desc id label meta sections source sub',
  "criticalsJambe": 'desc id label maison meta sections source sub',
  "aaCriticalsTete": 'desc id label meta sections source sub',
  "aaCriticalsBras": 'desc id label meta sections source sub',
  "aaCriticalsCorps": 'desc id label meta sections source sub',
  "aaCriticalsJambe": 'desc id label meta sections source sub',
  "incidentsMonture": 'desc id label meta sections sub',
  "problemesVehicule": 'desc id label meta sections sub',
  "rencontresPositives": 'desc id label meta sections sub',
  "rencontresFortuites": 'desc id label meta sections sub',
  "rencontresDangereuses": 'desc id label meta sections sub',
  "shipCriticalsCargaison": 'desc id label meta sections sub',
  "shipCriticalsGreement": 'desc id label meta sections sub',
  "shipCriticalsCoque": 'desc id label meta sections sub',
  "shipCriticalsAvirons": 'desc id label meta sections sub',
  "shipCriticalsEquipements": 'desc id label meta sections sub',
  "riverCriticalsGreement": 'desc id label meta sections sub',
  "riverCriticalsAvirons": 'desc id label meta sections sub',
  "riverCriticalsGouvernail": 'desc id label meta sections sub',
  "riverCriticalsCoque": 'desc id label meta sections sub',
  "riverCriticalsSuperstructure": 'desc id label meta sections sub',
  "seaManannFactors": 'id label meta source',
  "seaBoardEvents": 'desc id label source sub',
  "seaPortEvents": 'desc id label source sub',
  "waterExposure": 'desc id label meta sections source',
  "navalPorts": 'desc group id label meta sections source',
  "navalProgression": 'desc id label source sub',
  "shipHullSizes": 'id label meta sections source',
  "shipSpeedTraits": 'id label meta source',
  "shipConstructionTraits": 'id label meta source',
  "seaNavigation": 'id label sections source',
  "seaPerils": 'desc id label sections source',
  "seaWeather": 'id label meta sections source',
  "montures": 'id label meta sections',
  "tavernGames": 'desc id label meta source',
  "obsessions": 'id label sub',
  "reglesOptionnelles": 'desc id label maison meta source sub',
  "surincantation": 'id label meta source sub',
  "structureCriticals": 'desc id label meta sub',
  "artilleryMisfire": 'desc id label meta sub',
  "landCargo": 'id label meta source',
  "seaCargo": 'id label source',
  "riverPerils": 'id label source sub',
  "crewMoraleFactors": 'desc id label source',
  "crewMoraleBands": 'desc id label meta source sub',
  "steamBreakdowns": 'desc id label meta source sub',
  "regles": 'desc id label source',
};

/** #1472 T3 — LISTE NOMINATIVE DES DELTAS, gelée au compte. Chaque catégorie ci-dessous a adopté
 *  `depuisEnveloppe` : la valeur = le nombre d'items qui PORTENT le champ à l'écran aujourd'hui,
 *  le commentaire = le delta APPORTÉ par T3 (`+n` gagné, `-champ +n` : n items dont la clé posée à
 *  `undefined` devient ABSENTE — invisible au rendu). Une catégorie qui adopte le défaut SANS
 *  entrer ici fait rougir `CLES` ; un compte qui bouge fait rougir ce test-ci, nominativement. */
const T3_DELTAS: Record<string, Record<string, number>> = {
  "arcanePhenomena": { desc: 33, source: 41 }, // 41 items — T3 : source +8
  "weaponGroups": { source: 38 }, // 38 items — T3 : source +38
  "maladies": { desc: 18, source: 18 }, // 18 items — T3 : desc +16, source +16 ; +2 au trio #674/#672 (Pneumonie, Rhume commun — EDOC 08 folio 33)
  "mutationTables": { source: 17 }, // 17 items — T3 : source +17
  "gods": { desc: 40, source: 41 }, // 41 items — T3 : -desc +1
  "careerLevels": { source: 432 }, // 432 items — T3 : source +432
  "eyes": { source: 10 }, // 10 items — T3 : source +10
  "hairs": { source: 10 }, // 10 items — T3 : source +10
  "calendarMonths": { source: 12 }, // 12 items — T3 : source +12
  "calendarIntercalary": { source: 6 }, // 6 items — T3 : source +6
  "calendarWeekdays": { source: 8 }, // 8 items — T3 : source +8
  "weather": { source: 4 }, // 4 items — T3 : source +4
  "oups": { source: 8 }, // 8 items — T3 : source +8
  "interludeEvents": { desc: 31, source: 31 }, // 31 items — T3 : source +31
  "peripeties": { desc: 10, source: 10 }, // 10 items — T3 : source +10
  "massBattlePowerEstimate": { desc: 5, source: 5 }, // 5 items — T3 : source +5
  "massBattleMightModifiers": { desc: 9, source: 9 }, // 9 items — T3 : source +9
  "massBattleWarMachines": { source: 10 }, // 10 items — T3 : source +10
  "massBattleStructures": { source: 5 }, // 5 items — T3 : source +5
  "massBattleHazards": { desc: 10, source: 10 }, // 10 items — T3 : source +10
  "structures": { desc: 19, source: 24 }, // 24 items — T3 : -desc +5, source +24
  "crewRoles": { desc: 9, source: 2 }, // 9 items — T3 : source +2
  "crewTestTypes": { source: 10 }, // 10 items — T3 : source +10
  "traumas": { desc: 29, source: 29 }, // 29 items — T3 : source +29
  "criticalsTete": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "criticalsBras": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "criticalsCorps": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "criticalsJambe": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "aaCriticalsTete": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "aaCriticalsBras": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "aaCriticalsCorps": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "aaCriticalsJambe": { desc: 20, source: 20 }, // 20 items — T3 : source +20
  "seaManannFactors": { source: 26 }, // 26 items — T3 : source +26
  "seaBoardEvents": { desc: 40, source: 40 }, // 40 items — T3 : source +40
  "seaPortEvents": { desc: 18, source: 18 }, // 18 items — T3 : source +18
  // 82 items (81 + la fenêtre de conscience par Détermination, #1599) — T3 : source +54.
  // #1612 : 82 → 87 items, `source` INCHANGÉ à 54 — les 5 règles `param` de l'Activité Mendier sont
  // MAISON : `LDB 09 l.97/l.99` ne chiffre aucune de leurs valeurs (partition XOR de
  // `regles-optionnelles-partition.test.ts`), leur folio se lit dans `ref` et n'ancre rien.
  "reglesOptionnelles": { desc: 87, source: 54 },
  "landCargo": { source: 7 }, // 7 items — T3 : source +7
  "seaCargo": { source: 11 }, // 11 items — T3 : source +11
  "riverPerils": { source: 4 }, // 4 items — T3 : source +4
  "crewMoraleFactors": { desc: 28, source: 28 }, // 28 items — T3 : source +28
  "crewMoraleBands": { desc: 4, source: 4 }, // 4 items — T3 : desc +4, source +4
  "steamBreakdowns": { desc: 6, source: 6 }, // 6 items — T3 : source +6
};
/** Cliquet POSITIF DÉCROISSANT : catégories dont ≥1 item DÉFAUSSE une `source`/`desc` que la donnée
 *  porte. VIDÉ par #1472 T3 (39 catégories → 0) : sur les 115 tableaux appariés, plus AUCUN item ne
 *  tait ce que sa donnée porte. Le gel à vide est l'assertion : une projection qui redroppe un champ
 *  repeuple cette table et rougit, nominativement. Ne JAMAIS y réinscrire une catégorie. */
const MUETS: Record<string, number> = {};

/** ANGLE MORT du mapping déduit : tableaux qu'une catégorie couvre PARTIELLEMENT (ids en commun,
 *  mais pas tous) — ils sortent du cliquet de provenance. Gelé : un dataset qui cesse d'être
 *  couvert en entier atterrit ici et rougit, au lieu de disparaître du filet en silence. */
const PARTIELS: string[] = [
  "actions.json#0 (55)",
  "breath-types.json#0 (6)",
  "damage-types.json#0 (4)",
  "land-cargo.json#0 (9)",
  "lightLevels.json#0 (5)",
  "lightTones.json#0 (4)",
  "merchantFamilies.json#0 (7)",
  "merchants.json#0 (6)",
  // +4 décors de bâtiment #1624 (cheminee, enseigne, clocheton, applique-murale) puis +1 banc #1644
  // (le seul décor de l'Opéra qui n'avait AUCUNE entrée de donnée) — MÊME angle mort source/desc que
  // les 78 existants : le catalogue de décor est app-owned, aucune page ne le source.
  // Puis 83→123 : #1680 ligne 14, BIJECTION art ⇄ donnée (les 40 defs d'art sans entrée reçoivent la
  // leur) — même angle mort, même cause.
  "props.json#0 (123)",
  "qualitySubtypes.json#0 (3)",
  "river-navigation.json#0 (5)",
  "sea-cargo.json#0 (13)",
  "sea-perils.json#0 (4)",
  "sea-perils.json#1 (3)",
  "sea-perils.json#2 (5)",
  "sea-weather.json#3 (6)",
  "structureAppearance.json#0 (18)",
  "systemes.manifest.json#0 (16)",
  "water-exposure.json#0 (12)",
];

/** Tableaux identifiés qu'AUCUNE catégorie ne touche (manifestes d'outillage, vocabulaires de
 *  rendu, tables nichées exposées autrement). Gelé au même titre que `PARTIELS`. */
const ORPHELINS: string[] = [
  // Les 8 DOCUMENTS-tables de `criticals.json` (#1657 B2a) — même angle mort que `miscast.json#0` :
  // ce que le Codex expose, ce sont leurs RANGÉES (8 catégories, 160 items), jamais le document
  // porteur. Un document sans item Codex propre n'est donc pas un manque, c'est la charge qui compte.
  "criticals.json#0 (8)",
  "donnees.manifest.json#0 (11)",
  "lieux-services.json#0 (7)",
  "miscast.json#0 (5)",
  // 30 → 62 (#1728) : les entrées de la table CLAUDE.md sont portées au manifeste (primitives
  // EXISTANTES) — manifeste d'outillage, aucune catégorie Codex ne l'expose ; la charge du document
  // orphelin suit sa mesure.
  "primitives.manifest.json#0 (62)",
  "qualityTypes.json#0 (2)",
  // +1 dette « Colère des dieux » #1653, +1 dette « sabre Taillade » #1661 — entrées de manifeste sans
  // catégorie Codex (même angle mort : dette de règle, jamais une fiche).
  "raw.manifest.json#0 (11)",
  "reseau-routier.json#0 (15)",
  "river-navigation.json#1 (3)",
  "sea-cargo.json#1 (3)",
  "sea-events.json#3 (5)",
  "sea-navigation.json#0 (5)",
  "sea-weather.json#0 (4)",
  "sea-weather.json#1 (5)",
  "sea-weather.json#2 (4)",
  // La table « Tomber du gréement » (#1657 B3-2b-c, MDG 13 l.684) : un document-table de PLUS, même
  // angle mort que `criticals.json#0` — ce que le Codex expose, ce sont les RANGÉES de Critiques qui
  // s'y réfèrent (l'op `fall` de leur échec), jamais la table de hauteurs elle-même.
  "ship-criticals.json#0 (1)",
];

const clesDe = (items: readonly object[]): string =>
  createHash('sha256').update(items.map((i) => `${(i as { id: string }).id}|${Object.keys(i).sort().join(',')}`).join('\n')).digest('hex').slice(0, 16);

function formeDe(items: readonly object[]): string {
  const k = new Set<string>();
  for (const i of items) for (const key of Object.keys(i)) k.add(key);
  return [...k].sort().join(' ');
}

/** Tableaux d'entrées IDENTIFIÉES nichés dans un JSON de donnée (un fichier peut en porter plusieurs). */
function tableauxIdentifies(v: unknown, out: Record<string, unknown>[][] = []): Record<string, unknown>[][] {
  if (Array.isArray(v)) {
    if (v.length && v.every((x) => x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')) out.push(v as Record<string, unknown>[]);
    return out;
  }
  if (v && typeof v === 'object') for (const x of Object.values(v)) tableauxIdentifies(x, out);
  return out;
}

describe('Codex — défaut d’enveloppe (#1467 L1b)', () => {
  it('les CLÉS de chaque item sont celles gelées (aucune clé n’apparaît ni ne disparaît, valeur comprise)', () => {
    const mesure: Record<string, string> = {};
    for (const c of CODEX) mesure[c.key] = clesDe(c.items);
    expect(mesure).toEqual(CLES);
  });

  it('la FORME de chaque catégorie est celle gelée', () => {
    const mesure: Record<string, string> = {};
    for (const c of CODEX) mesure[c.key] = formeDe(c.items);
    expect(mesure).toEqual(FORME);
  });

  it('#1472 T3 : chaque catégorie qui expose desc/source le fait pour le NOMBRE d’items déclaré', () => {
    const mesure: Record<string, Record<string, number>> = {};
    for (const c of CODEX) {
      const n: Record<string, number> = {};
      for (const k of ['desc', 'source'] as const) {
        const compte = c.items.filter((i) => k in i).length;
        if (compte) n[k] = compte;
      }
      if (T3_DELTAS[c.key]) mesure[c.key] = n;
    }
    expect(mesure).toEqual(T3_DELTAS);
    // La TAILLE est gelée à part : une catégorie retirée de la table sortirait sinon du filtre en silence.
    expect(Object.keys(T3_DELTAS)).toHaveLength(42);
  });

  it('la PROVENANCE a UN seul canal : `source`, jamais un fait de méta intitulé « Source »', () => {
    const doublons = CODEX.flatMap((c) =>
      c.items.flatMap((i) => (i.meta ?? []).filter((f) => /^sources?$/i.test(f.label.trim())).map((f) => `${c.key}/${i.id}: ${f.label}`)),
    );
    expect(doublons).toEqual([]);
  });

  it('la VALEUR de `source.book` est une ABRÉVIATION du catalogue, jamais l’id brut du livre', () => {
    const abreviations = new Set(books.map((b) => b.abbr));
    const bruts = CODEX.flatMap((c) =>
      c.items
        .filter((i) => i.source && !abreviations.has(i.source.book))
        .map((i) => `${c.key}/${i.id}: book=${i.source!.book}`),
    );
    expect(bruts).toEqual([]);
  });

  it('PROVENANCE : un item dont la donnée porte source/desc les porte au Codex — et l’angle mort du mapping est gelé', () => {
    const muets: Record<string, number> = {};
    const apparies: string[] = [];
    const partiels: string[] = [];
    const orphelins: string[] = [];
    for (const f of DATASETS) {
      for (const [n, arr] of tableauxIdentifies(JSON.parse(readFileSync(DATA_DIR + f, 'utf8'))).entries()) {
        const ids = arr.map((e) => e.id as string);
        let etat: 'total' | 'partiel' | 'orphelin' = 'orphelin';
        for (const c of CODEX) {
          const byId = new Map(c.items.map((i) => [i.id, i]));
          const couverts = ids.filter((id) => byId.has(id)).length;
          if (couverts === 0) continue;
          if (couverts < ids.length) { if (etat === 'orphelin') etat = 'partiel'; continue; }
          etat = 'total';
          let m = 0;
          for (const e of arr) {
            const item = byId.get(e.id as string)!;
            const porteSource = !!(e.source && typeof e.source === 'object');
            const porteDesc = typeof e.desc === 'string' && e.desc.length > 0;
            if ((porteSource && !item.source) || (porteDesc && !item.desc)) m++;
          }
          if (m) muets[c.key] = Math.max(muets[c.key] ?? 0, m);
        }
        (etat === 'total' ? apparies : etat === 'partiel' ? partiels : orphelins).push(`${f}#${n} (${ids.length})`);
      }
    }
    expect(muets).toEqual(MUETS);
    expect(partiels).toEqual(PARTIELS);
    expect(orphelins).toEqual(ORPHELINS);
    // 107 → 108 : la catégorie `shipStations` apparie son dataset (#1657 B3-2b-a).
    // 108 → 109 : la catégorie `materials` apparie `materials.json` (#1686 lot 3a-2).
    // 109 → 110 : la catégorie `terrains` apparie `terrains.json` — les 25 sols quittent `PARTIELS` (#1690 lot 3).
    // 110 → 111 : la catégorie `buildings` apparie `buildings.json` — les 7 types de bâtiment naissent
    // en donnée et au Codex dans le MÊME lot (#1715), sans passer par `PARTIELS`.
    expect(apparies.length).toBe(111);
  });
});

describe('depuisEnveloppe — le défaut lui-même', () => {
  const enveloppe = { id: 'x', label: 'X', desc: 'prose', source: { book: 'livre-de-base', page: 42 } };

  it('la source passe par src() : ABRÉVIATION du livre, jamais son id', () => {
    expect(depuisEnveloppe(enveloppe).source).toEqual({ book: 'LDB', page: 42 });
  });

  it('les extras l’emportent sur le défaut (le renommage reste visible au site)', () => {
    expect(depuisEnveloppe(enveloppe, { desc: 'enjeu', label: 'Autre' })).toMatchObject({ desc: 'enjeu', label: 'Autre' });
  });

  it('desc ET source absentes restent ABSENTES — ni chaîne vide, ni null', () => {
    const item = depuisEnveloppe({ id: 'x', label: 'X' });
    expect(Object.keys(item)).toEqual(['id', 'label']);
  });

  it('`maison` est projetée telle quelle quand la donnée la porte, et sa CLÉ reste absente sinon', () => {
    const raison = 'aucun folio n’imprime de catalogue de sols';
    expect(depuisEnveloppe({ ...enveloppe, maison: raison }).maison).toBe(raison);
    expect(Object.keys(depuisEnveloppe({ id: 'x', label: 'X' }))).not.toContain('maison');
  });

  it('la donnée RÉELLE arrive à l’item : toute entrée de `src/data/*.json` portant `maison` le porte au Codex', () => {
    // INVARIANT, pas un cardinal : le défaut d’enveloppe ne prouve rien seul — c’est le PASSAGE par
    // les catégories qui compte. Même déduction du mapping que le test de PROVENANCE ci-dessus
    // (inclusion des ids), donc aucune table à tenir ; une catégorie qui perdrait la projection se
    // dénoncerait ici avec le NOM de l’entrée muette.
    const muets: string[] = [];
    for (const f of DATASETS) {
      for (const arr of tableauxIdentifies(JSON.parse(readFileSync(DATA_DIR + f, 'utf8')))) {
        const porteuses = arr.filter((e) => typeof e.maison === 'string' && e.maison.length > 0);
        if (!porteuses.length) continue;
        for (const c of CODEX) {
          const byId = new Map(c.items.map((i) => [i.id, i]));
          if (arr.some((e) => !byId.has(e.id as string))) continue; // couverture PARTIELLE : hors mapping
          for (const e of porteuses) if (byId.get(e.id as string)!.maison !== e.maison) muets.push(`${c.key}/${e.id}`);
        }
      }
    }
    expect(muets).toEqual([]);
  });
});
