# Codex — couche relationnelle (références inverses, index, auto-liage)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-codex-relations.mjs` (`npm run docs:codex-relations`) — NE PAS ÉDITER À LA MAIN.

**Périmètre mesuré / angles morts** — sont LUS aux fichiers réels : les 34 appels
`addReverse(...)` de `src/ui/compendium/relations.ts` (catégorie référante, catégorie cible, titre FR de section,
`fichier:ligne`), l'API publique du même module (AST + 1re phrase de JSDoc), le littéral
`CODEX_SPECS` de `src/ui/compendium/registry.ts` (131 catégories, leurs groupes et sous-groupes
`cluster`), et l'`exposition` DÉCLARÉE par les 124 defs de `src/data/schemas/defs/`
(dumpée par `scripts/docs/lib/dump-exposition.mts`), les cas NOMMÉS par `src/data/schemas/exposition-contrats.test.ts`, les fonctions
exportées de `src/ui/compendium/describe.ts` et `src/ui/compendium/humanize.ts`, et le compte d'épigraphes de Carrière dumpé par
`scripts/docs/lib/dump-epigraphes.mts` (le plugin `exergues` de `<Prose>` monté sur les `careers`
réelles — aucune re-implémentation de la détection ici). **Angles morts** : la catégorie RÉFÉRANTE
est lue au `const by` en portée ou au littéral inline — une arête posée autrement (helper, boucle
sur une variable calculée) casserait le script plutôt que de mentir, mais aucune n'existe
aujourd'hui ; le CONTENU réel de chaque relation (combien de créatures portent tel trait) dépend de
la donnée à l'exécution et n'est pas compté ici ; l'auto-liage de prose (`tokenizeLinks`) est
LOCALE-SCOPED et son index se construit au runtime — seules ses portes sont documentées ; les deux
principes et le mode d'emploi « Étendre » sont de l'ÉDITORIAL fixé dans le script.

Le Codex (`src/ui/compendium/`) dérive TOUT du JSON `src/data` (aucune scène/règle en dur).
Au-delà des faits-clés et des références AVANT (déjà projetées par `src/ui/compendium/registry.ts`), la richesse
vient d'une **couche relationnelle** : `src/ui/compendium/relations.ts`.

## Deux principes (non négociables)

1. **Data-driven** — la sémantique vit dans le JSON ; `relations.ts` ne fait qu'**inverser** des
   références DÉJÀ structurées. Aucune regex, aucune table en dur.
2. **Multilingue (possibilité)** — toute relation est **id-based** (clé STABLE), jamais un libellé.
   Les `label` portés par les `Referrer` ne servent qu'à l'affichage (= `CodexItem.label`, résolu
   par `codexLookup`). Seule brique langue-dépendante : l'**auto-liage** de prose, *locale-scoped*
   (matcher dérivé des libellés de la locale active), jamais une chaîne FR en dur.

## D'où viennent les entrées — l'exposition est DÉCLARÉE au def

Un document ne « rentre » pas au Codex par une table tenue à part : son **exposition** est un
argument de la fabrique `document()` (`src/data/schemas/grammaire/document.ts`, cf.
`docs/donnees.md`), au même titre que ses champs :

- `codex` — soit `{ keys: [...] }`, les clés de catégorie sous lesquelles le joueur trouve le
  document, soit `{ exempt: { kind, raison, ticket? } }` : une exemption MOTIVÉE. La fabrique
  refuse un `codex` sans clés ni exemption motivée.
- `edit` — ce que l'ÉDITEUR édite : `{ dataset }`, `{ object: 'single' | 'record' }`,
  `{ niche: { categories } }` (les clés Codex du document routées comme datasets, chacune éditant
  UN champ tableau — le fichier parent est réécrit au save), ou `{ none: raison }`. La fabrique
  refuse les quatre absents.

Les ROUTES D'ÉDITION du Codex sont DÉRIVÉES de ces déclarations (#1472) :
`src/data/schemas/exposition-derivee.ts` construit `CATEGORY_DATASET_DERIVE` et
`OBJECT_CATEGORY_DERIVE` depuis `SCHEMA_DEFS`, et `src/ui/compendium/CodexEdit.tsx` les consomme
telles quelles — plus aucune table à la main. La source lue à l'EXÉCUTION pour l'INDEX du Codex
reste `CODEX_SPECS` (`src/ui/compendium/registry.ts`, dont `CODEX` est la projection). Les deux sont tenus égaux
par `src/data/schemas/exposition-contrats.test.ts`, dont voici les cas, tels que la garde les nomme :

- **exposition Codex — contrats de la dérivation (#1472)**
  - (a) ancre filesystem : chaque src/data/\*.json est déclaré par un def, et chaque def pointe un fichier présent
  - (b) égalité bidirectionnelle : les clés du registre Codex vivant ≡ les clés déclarées par les defs
  - (b bis) chaque clé déclarée porte des items — aucune catégorie vide (mapping périmé)
  - (c) exempt ∧ exposé = ROUGE : aucune catégorie du Codex n’est servie par un document exempté
  - (d) cliquet dette : chaque exempt.kind === "dette" est nommé ici avec son ticket, et la liste ne porte rien de mort
  - (e) routes ⊆ bindings : chaque dataset routé existe dans ARRAYS / OBJECTS (overrides.ts)
- **deriveExposition — refus fail-fast sur defs synthétiques (#1472)**
  - dérive normalement un jeu de defs conforme (témoin VERT du même harnais)
  - (i) dataset à PLUSIEURS clés dont aucune n’égale le dataset : REFUS nominatif
  - (ii) dataset-OBJET à 0 ou 2 clés Codex : REFUS nominatif
  - (iii) COLLISION de route : deux documents revendiquant la même clé sont NOMMÉS, jamais écrasés en silence
  - (iii bis) COLLISION de FICHIER : deux documents éditant le MÊME dataset sous des clés Codex DIFFÉRENTES sont NOMMÉS
  - (iv) def SANS `exposition` : REFUS nominatif (aucun document ne se déclare muet)

Un document neuf se pose donc en DEUX endroits du MÊME commit : son `exposition` au def, sa
catégorie dans `CODEX_SPECS`.

Sur 124 defs, 24 sont EXEMPTS d'exposition Codex :

- `dette` — 2 fichier(s)
- `vocabulaire-app-interne` — 22 fichier(s)

### Index INVERSE — catégorie Codex → document qui la déclare

131 clés de catégorie sont déclarées par les defs. La colonne « Route d'édition »
est celle du document porteur, telle que `document()` la déclare.

| Clé de catégorie | Libellé (`CODEX_SPECS`) | Déclarée par | Route d'édition |
|---|---|---|---|
| `aaCriticalsBras` | Critiques — Bras (approche alternative) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `aaCriticalsCorps` | Critiques — Corps (approche alternative) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `aaCriticalsJambe` | Critiques — Jambe (approche alternative) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `aaCriticalsTete` | Critiques — Tête (approche alternative) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `activities` | Activités | `src/data/activities.json` | dataset `activities` |
| `advancementCosts` | Coût des Augmentations | `src/data/advancementCosts.json` | dataset `advancementCosts` |
| `arcanePhenomena` | Magie environnementale | `src/data/arcane-phenomena.json` | objet `single` |
| `artilleryMisfire` | Incidents de Tir par Salve | `src/data/artillery-misfire.json` | niché (1 catégorie(s)) |
| `axes` | Axes de forces | `src/data/axes.json` | dataset `axes` |
| `books` | Livres | `src/data/books.json` | dataset `books` |
| `buildings` | Bâtiments | `src/data/buildings.json` | dataset `buildings` |
| `calendarIntercalary` | Calendrier — Jours intercalaires | `src/data/calendarIntercalary.json` | dataset `calendarIntercalary` |
| `calendarMonths` | Calendrier — Mois | `src/data/calendarMonths.json` | dataset `calendarMonths` |
| `calendarPhases` | Calendrier — Phases du jour | `src/data/calendarPhases.json` | dataset `calendarPhases` |
| `calendarWeekdays` | Calendrier — Jours de la semaine | `src/data/calendarWeekdays.json` | dataset `calendarWeekdays` |
| `careerLevels` | Niveaux de carrière | `src/data/careerLevels.json` | dataset `careerLevels` |
| `careers` | Carrières | `src/data/careers.json` | dataset `careers` |
| `celestialHouses` | Demeures astrologiques | `src/data/astrology.json` | dataset `celestialHouses` |
| `characteristics` | Caractéristiques | `src/data/characteristics.json` | dataset `characteristics` |
| `classes` | Classes | `src/data/classes.json` | dataset `classes` |
| `combatStakes` | Enjeux — cascade de combat | `src/data/combat-stakes.json` | aucune |
| `creatures` | Créatures | `src/data/creatures.json` | dataset `creatures` |
| `crewMoraleBands` | Moral d’équipage — Effets | `src/data/crew-morale.json` | niché (2 catégorie(s)) |
| `crewMoraleFactors` | Moral d’équipage — Facteurs | `src/data/crew-morale.json` | niché (2 catégorie(s)) |
| `crewRoles` | Rôles d’équipage | `src/data/crew-roles.json` | dataset `crewRoles` |
| `crewTestTypes` | Tests d’équipage (types) | `src/data/crew-test-types.json` | niché (1 catégorie(s)) |
| `criticalsBras` | Critiques — Bras (Traumatisme) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `criticalsCorps` | Critiques — Corps (Traumatisme) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `criticalsJambe` | Critiques — Jambe (Traumatisme) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `criticalsTete` | Critiques — Tête (Traumatisme) | `src/data/criticals.json` | niché (8 catégorie(s)) |
| `defautsDeCompilation` | Défauts de compilation | `src/data/defauts-de-compilation.json` | objet `single` |
| `details` | Détails de création | `src/data/details.json` | objet `single` |
| `disponibilite` | Disponibilité & Troc | `src/data/disponibilite.json` | objet `single` |
| `domains` | Domaines | `src/data/domains.json` | dataset `domains` |
| `drivingMishap` | Accidents de Conduite d’attelage | `src/data/driving-mishap.json` | niché (1 catégorie(s)) |
| `drunkenness` | Ivresse (Tableau) | `src/data/drunkenness.json` | niché (1 catégorie(s)) |
| `effectTables` | Tables d’effets | `src/data/tables.json` | aucune |
| `encumbranceTiers` | Surchargé — Paliers d’Encombrement | `src/data/encumbranceTiers.json` | dataset `encumbranceTiers` |
| `etats` | États | `src/data/etats.json` | dataset `etats` |
| `eyes` | Couleur des yeux | `src/data/eyes.json` | dataset `eyes` |
| `flowStakes` | Enjeux — modales de jet | `src/data/flow-stakes.json` | aucune |
| `gods` | Dieux | `src/data/gods.json` | dataset `gods` |
| `grapple` | Empoignade — mécanique | `src/data/grapple.json` | objet `single` |
| `groups` | Groupes (Cible) | `src/data/groups.json` | dataset `groups` |
| `hairs` | Couleur des cheveux | `src/data/hairs.json` | dataset `hairs` |
| `incidentsMonture` | Incidents de monte | `src/data/incidents-monture.json` | niché (1 catégorie(s)) |
| `interludeEvents` | Entre deux aventures | `src/data/interludeEvents.json` | dataset `interludeEvents` |
| `landCargo` | Cargaison terrestre | `src/data/land-cargo.json` | niché (1 catégorie(s)) |
| `locations` | Lieux | `src/data/locations.json` | dataset `locations` |
| `maladies` | Maladies | `src/data/maladies.json` | dataset `maladies` |
| `maneuvers` | Manœuvres | `src/data/maneuvers.json` | dataset `maneuvers` |
| `massBattleHazards` | Bataille de masse — Aléas de bataille | `src/data/mass-battle.json` | niché (5 catégorie(s)) |
| `massBattleMightModifiers` | Bataille de masse — Modificateurs de Puissance | `src/data/mass-battle.json` | niché (5 catégorie(s)) |
| `massBattlePowerEstimate` | Bataille de masse — Estimation de Puissance | `src/data/mass-battle.json` | niché (5 catégorie(s)) |
| `massBattleStructures` | Bataille de masse — Structures | `src/data/mass-battle.json` | niché (5 catégorie(s)) |
| `massBattleWarMachines` | Bataille de masse — Machines de guerre | `src/data/mass-battle.json` | niché (5 catégorie(s)) |
| `materials` | Matières | `src/data/materials.json` | dataset `materials` |
| `miscastMajor` | Incantations Imparfaites — Majeures | `src/data/miscast.json` | niché (3 catégorie(s)) |
| `miscastMinor` | Incantations Imparfaites — Mineures | `src/data/miscast.json` | niché (3 catégorie(s)) |
| `miscastWrath` | Colère des dieux | `src/data/miscast.json` | niché (3 catégorie(s)) |
| `montures` | Montures (profils de voyage) | `src/data/montures.json` | niché (1 catégorie(s)) |
| `mutationTables` | Tables de Corruption | `src/data/mutationTables.json` | dataset `mutationTables` |
| `mutations` | Mutations | `src/data/mutations.json` | dataset `mutations` |
| `names` | Banque de noms | `src/data/names.json` | dataset `names` |
| `navalPorts` | Ports (Index de la Mer des Griffes) | `src/data/naval-ports.json` | dataset `navalPorts` |
| `navalProgression` | Progression de navire (DR de Navigation → Mouvement) | `src/data/naval-progression.json` | niché (1 catégorie(s)) |
| `navalTraits` | Traits & améliorations navales | `src/data/naval-traits.json` | dataset `navalTraits` |
| `nightStakes` | Enjeux — cascade de repos | `src/data/night-stakes.json` | dataset `nightStakes` |
| `obsessions` | Obsessions (table) | `src/data/obsessions.json` | niché (1 catégorie(s)) |
| `oups` | Oups ! | `src/data/oups.json` | dataset `oups` |
| `peripeties` | Péripéties de voyage | `src/data/peripeties.json` | dataset `peripeties` |
| `pregens` | Pré-tirés | `src/data/pregens.json` | dataset `pregens` |
| `problemesVehicule` | Problèmes de véhicule | `src/data/problemes-vehicule.json` | niché (1 catégorie(s)) |
| `psychologie` | Psychologie | `src/data/traits.json` | dataset `traits` |
| `psychologies` | États psychologiques | `src/data/psychology.json` | dataset `psychologies` |
| `qualities` | Qualités | `src/data/qualities.json` | dataset `qualities` |
| `raceAppearance` | Apparences (rig) | `src/data/raceAppearance.json` | dataset `raceAppearance` |
| `races` | Races | `src/data/species.json` | dataset `species` |
| `regles` | Règles de jeu | `src/data/regles.json` | aucune |
| `reglesOptionnelles` | Règles optionnelles | `src/data/reglesOptionnelles.json` | dataset `reglesOptionnelles` |
| `rencontresDangereuses` | Rencontres — Dangereuses | `src/data/rencontres-edoc.json` | niché (3 catégorie(s)) |
| `rencontresFortuites` | Rencontres — Fortuites | `src/data/rencontres-edoc.json` | niché (3 catégorie(s)) |
| `rencontresPositives` | Rencontres — Positives | `src/data/rencontres-edoc.json` | niché (3 catégorie(s)) |
| `riverCriticalsAvirons` | Critiques fluviaux — Rames | `src/data/river-criticals.json` | niché (5 catégorie(s)) |
| `riverCriticalsCoque` | Critiques fluviaux — Coque | `src/data/river-criticals.json` | niché (5 catégorie(s)) |
| `riverCriticalsGouvernail` | Critiques fluviaux — Gouvernail | `src/data/river-criticals.json` | niché (5 catégorie(s)) |
| `riverCriticalsGreement` | Critiques fluviaux — Gréement | `src/data/river-criticals.json` | niché (5 catégorie(s)) |
| `riverCriticalsSuperstructure` | Critiques fluviaux — Superstructure | `src/data/river-criticals.json` | niché (5 catégorie(s)) |
| `riverNavigation` | Navigation fluviale (Vent, Chavirage, Échouage) | `src/data/river-navigation.json` | objet `single` |
| `riverPerils` | Périls fluviaux | `src/data/river-perils.json` | niché (1 catégorie(s)) |
| `seaBoardEvents` | Événements de bord (mer) | `src/data/sea-events.json` | niché (3 catégorie(s)) |
| `seaCargo` | Cargaison maritime | `src/data/sea-cargo.json` | niché (1 catégorie(s)) |
| `seaManannFactors` | Humeur de Manann — Facteurs | `src/data/sea-events.json` | niché (3 catégorie(s)) |
| `seaNavigation` | Navigation maritime (Progression, Salissures, Orientation, Phares, Poursuite…) | `src/data/sea-navigation.json` | objet `single` |
| `seaPerils` | Périls en mer (Échouage, Icebergs, Détroits, Tourbillons) | `src/data/sea-perils.json` | objet `single` |
| `seaPortEvents` | Événements de port (mer) | `src/data/sea-events.json` | niché (3 catégorie(s)) |
| `seaShanties` | Chants de marins | `src/data/sea-shanties.json` | dataset `seaShanties` |
| `seaWeather` | Météo de la Mer des Griffes | `src/data/sea-weather.json` | objet `single` |
| `semencesDeScene` | Semences de scène | `src/data/semences-de-scene.json` | objet `single` |
| `shipConstructionTraits` | Traits de construction (navire) | `src/data/ship-construction.json` | niché (3 catégorie(s)) |
| `shipCriticalsAvirons` | Critiques de navire — Avirons | `src/data/ship-criticals.json` | niché (5 catégorie(s)) |
| `shipCriticalsCargaison` | Critiques de navire — Cargaison | `src/data/ship-criticals.json` | niché (5 catégorie(s)) |
| `shipCriticalsCoque` | Critiques de navire — Coque | `src/data/ship-criticals.json` | niché (5 catégorie(s)) |
| `shipCriticalsEquipements` | Critiques de navire — Équipements | `src/data/ship-criticals.json` | niché (5 catégorie(s)) |
| `shipCriticalsGreement` | Critiques de navire — Gréement | `src/data/ship-criticals.json` | niché (5 catégorie(s)) |
| `shipHullSizes` | Gabarits de coque (Construction navale) | `src/data/ship-construction.json` | niché (3 catégorie(s)) |
| `shipSpeedTraits` | Traits de vitesse (Construction navale) | `src/data/ship-construction.json` | niché (3 catégorie(s)) |
| `shipStations` | Stations à bord | `src/data/ship-stations.json` | dataset `shipStations` |
| `siegeEngines` | Engins de siège | `src/data/trappings.json` | dataset `trappings` |
| `sizes` | Tailles — barres par catégorie | `src/data/sizes.json` | objet `single` |
| `skills` | Compétences | `src/data/skills.json` | dataset `skills` |
| `spells` | Sorts | `src/data/spells.json` | dataset `spells` |
| `stars` | Étoiles | `src/data/stars.json` | dataset `stars` |
| `steamBreakdowns` | Pannes de navire à vapeur | `src/data/steam-breakdown.json` | dataset `steamBreakdowns` |
| `structureCriticals` | Critiques de structure | `src/data/structure-criticals.json` | niché (1 catégorie(s)) |
| `structures` | Structures (siège) | `src/data/structures.json` | dataset `structures` |
| `surincantation` | Tableau de Surincantation (VDM) | `src/data/surincantation.json` | niché (1 catégorie(s)) |
| `symptoms` | Symptômes | `src/data/symptoms.json` | dataset `symptoms` |
| `talents` | Talents | `src/data/talents.json` | dataset `talents` |
| `tavernGames` | Jeux de taverne | `src/data/tavernGames.json` | dataset `tavernGames` |
| `terrains` | Terrains | `src/data/terrains.json` | dataset `terrains` |
| `traits` | Traits | `src/data/traits.json` | dataset `traits` |
| `trappings` | Possessions | `src/data/trappings.json` | dataset `trappings` |
| `traumas` | Traumatismes (séquelles) | `src/data/traumas.json` | dataset `traumas` |
| `vehicles` | Véhicules | `src/data/vehicles.json` | dataset `vehicles` |
| `ventsTourbillonnants` | Vents Tourbillonnants | `src/data/vents-tourbillonnants.json` | niché (1 catégorie(s)) |
| `voyageStakes` | Enjeux — cascade de voyage | `src/data/voyage-stakes.json` | aucune |
| `waterExposure` | Exposition à l’eau (maladies hydriques) | `src/data/water-exposure.json` | objet `single` |
| `weaponGroups` | Groupes d’objet | `src/data/weaponGroups.json` | dataset `weaponGroups` |
| `weather` | Météo de voyage | `src/data/weather.json` | niché (2 catégorie(s)) |
| `weatherConditions` | Conditions météo | `src/data/weather.json` | niché (2 catégorie(s)) |

## `relations.ts` — les arêtes inverses

Construites UNE fois par version du Codex, en inversant les références de `src/data`. Chaque
ligne = une arête `addReverse(cible, id, référant, titre?)` réellement présente dans le module.

| Référant (source de la ref AVANT) | Cible (fiche qui reçoit la section inverse) | Titre de section | Site |
|---|---|---|---|
| Carrières (`careers`) | Caractéristiques (`characteristics`) | « Carrières (avancée) » | `src/ui/compendium/relations.ts:137` |
| Carrières (`careers`) | Classes (`classes`) | « Carrières de la classe » | `src/ui/compendium/relations.ts:128` |
| Carrières (`careers`) | Compétences (`skills`) | « Carrières (par rang) » | `src/ui/compendium/relations.ts:135` |
| Carrières (`careers`) | Talents (`talents`) | « Carrières (par rang) » | `src/ui/compendium/relations.ts:136` |
| Carrières (`careers`) | Possessions (`trappings`) | « Carrières (par rang) » | `src/ui/compendium/relations.ts:138` |
| Classes (`classes`) | Possessions (`trappings`) | « Possession de classe » | `src/ui/compendium/relations.ts:177` |
| Créatures (`creatures`) | Compétences (`skills`) | — (titre de repli) | `src/ui/compendium/relations.ts:161` |
| Créatures (`creatures`) | Sorts (`spells`) | « Créatures la lançant » | `src/ui/compendium/relations.ts:163` |
| Créatures (`creatures`) | Talents (`talents`) | — (titre de repli) | `src/ui/compendium/relations.ts:162` |
| Créatures (`creatures`) | Traits (`traits`) | « Créatures ayant ce trait » | `src/ui/compendium/relations.ts:157` `src/ui/compendium/relations.ts:160` |
| Créatures (`creatures`) | Possessions (`trappings`) | « Créatures la possédant » | `src/ui/compendium/relations.ts:164` |
| Domaines (`domains`) | États (`etats`) | « Domaines l’infligeant » | `src/ui/compendium/relations.ts:208` |
| Dieux (`gods`) | Sorts (`spells`) | « Cultes (Bénédictions / Miracles) » | `src/ui/compendium/relations.ts:198` `src/ui/compendium/relations.ts:199` `src/ui/compendium/relations.ts:200` |
| Lieux (`locations`) | Lieux (`locations`) | « Sous-lieux » | `src/ui/compendium/relations.ts:213` |
| Tables de Corruption (`mutationTables`) | Mutations (`mutations`) | « Tables de Corruption la tirant » | `src/ui/compendium/relations.ts:211` |
| Mutations (`mutations`) | Traits (`traits`) | « Mutations conférant ce trait » | `src/ui/compendium/relations.ts:189` |
| Qualités (`qualities`) | États (`etats`) | « Qualités d’arme l’infligeant » | `src/ui/compendium/relations.ts:206` |
| Races (`races`) | Carrières (`careers`) | « Races y accédant » | `src/ui/compendium/relations.ts:124` |
| Races (`races`) | Compétences (`skills`) | — (titre de repli) | `src/ui/compendium/relations.ts:121` |
| Races (`races`) | Talents (`talents`) | — (titre de repli) | `src/ui/compendium/relations.ts:122` |
| Compétences (`skills`) | Caractéristiques (`characteristics`) | « Compétences liées » | `src/ui/compendium/relations.ts:142` |
| Sorts (`spells`) | Domaines (`domains`) | « Sorts du domaine » | `src/ui/compendium/relations.ts:193` |
| Sorts (`spells`) | États (`etats`) | « Sorts l’infligeant » | `src/ui/compendium/relations.ts:204` |
| Talents (`talents`) | Caractéristiques (`characteristics`) | « Talents (bonus de départ) » | `src/ui/compendium/relations.ts:150` |
| Talents (`talents`) | États (`etats`) | « Talents l’infligeant » | `src/ui/compendium/relations.ts:207` |
| Talents (`talents`) | Compétences (`skills`) | « Talents le conférant » | `src/ui/compendium/relations.ts:148` |
| Talents (`talents`) | Talents (`talents`) | « Talents le conférant » | `src/ui/compendium/relations.ts:149` |
| Traits (`traits`) | États (`etats`) | « Traits l’infligeant » | `src/ui/compendium/relations.ts:205` |
| Traits (`traits`) | Manœuvres (`maneuvers`) | « Traits l’accordant » | `src/ui/compendium/relations.ts:183` |
| Possessions (`trappings`) | Qualités (`qualities`) | « Équipements ayant cette qualité » | `src/ui/compendium/relations.ts:170` |
| Possessions (`trappings`) | Groupes d’objet (`weaponGroups`) | « Objets du groupe » | `src/ui/compendium/relations.ts:171` |

## `relations.ts` — API publique

Le JSDoc est rapporté en ENTIER : le contrat d'une couture relationnelle tient dans ses restrictions
(hors liens vers soi, hors noms propres, texte brut seulement, match par id de livre).

| Export | Nature | Site | Contrat (JSDoc) |
|---|---|---|---|
| `Referrer` | interface | `src/ui/compendium/relations.ts:36` | Un référant (entité QUI pointe vers la cible) — ouvrable au Codex via (category, id). |
| `ReverseGroup` | interface | `src/ui/compendium/relations.ts:47` | Un groupe de référants de MÊME catégorie (rendu en UNE section inverse). |
| `reverseGroups` | function | `src/ui/compendium/relations.ts:239` | Références INVERSES d'une entité (category, id) — GROUPÉES par catégorie de référant, dédupliquées (un même référant à plusieurs rangs fusionne ses détails), triées (ordre stable puis alpha). Vide si l'entité n'est référencée nulle part. Source unique des sections « inverses » du Codex. |
| `bookContents` | function | `src/ui/compendium/relations.ts:296` | Contenu d'un livre, GROUPÉ par catégorie (« par type ») — pour la fiche Livre. Les entités portent leur livre dans `source.book` = l'`id` STABLE du livre (jamais un libellé) ; on matche par cet id (relation id-pure, i18n-safe). Trié par catégorie (`orderOf`) puis alpha. |
| `labelIndex` | function | `src/ui/compendium/relations.ts:327` | — |
| `LinkToken` | type | `src/ui/compendium/relations.ts:472` | Un fragment de prose tokenisé : texte brut, OU une mention d'entité à lier (category+id+label) — `spec` porte la spécialisation LIBRE absorbée entre parenthèses (« Art (Écriture)» → spec `Écriture`), non validée contre les données (précédent GAS permissif assumé) ; `text` reste le VERBATIM affiché (libellé + parenthèse comprise). |
| `tokenizeLinks` | function | `src/ui/compendium/relations.ts:502` | Tokenise une prose en alternant texte brut et mentions d'entité à LIER (auto-liage du Codex, façon `dev.html`). PUR & locale-scoped (matcher dérivé des libellés de la locale active, jamais une chaîne FR en dur → multilingue de principe). Écarte les liens vers SOI et les libellés inconnus/courts — la comparaison est 100 % id-based (`selfId` si l'appelant le connaît, sinon résolu depuis `selfLabel` via `idByLabelCached`, repli des appelants non encore migrés). `selfCategory` (catégorie de la fiche affichante) tranche les homonymes en priorité — cf. `resolveLink`/`PRIORITY_CAT_ORDER`. Seul le vocabulaire de RÈGLES est lié. |

`bookContents` est projeté DANS le `build` (paresseux) de la catégorie Livres
(`src/ui/compendium/registry.ts:1800`) : il ne lit que l'identité STATIQUE des catégories, jamais leurs
items — aucun cycle de projection.

## Barre de catégories — sous-groupes repliables (`cluster`)

Les familles touffues affichaient une *avalanche* de pastilles à plat. Chaque `CodexCategory` porte
un champ optionnel `cluster` (libellé FR du sous-groupe) : `clustersIn(group)` éclate les
catégories en pastilles **à plat** (sans `cluster`) + **sous-groupes repliables** (`CodexCluster`,
un par `cluster`, ordre de déclaration préservé). `src/ui/compendium/CompendiumScreen.tsx` rend
chaque cluster comme un `<details>` de la primitive `.fold`, **fermé par défaut**, ouvert
automatiquement si la catégorie active y vit. Les pastilles restent des `<button>`.

| Groupe | Catégories | À plat | Sous-groupes |
|---|---|---|---|
| Personnage | 6 | 6 | — |
| Compétences | 3 | 3 | — |
| Équipement | 8 | 5 | *Mer & rivière* (3) |
| Effets | 30 | 12 | *Blessures critiques* (8), *Critiques de navire* (5), *Critiques fluviaux* (5) |
| Magie | 8 | 8 | — |
| Monde | 21 | 21 | — |
| Tables | 55 | 18 | *Création de personnage* (7), *Voyage terrestre* (6), *Mer & rivière* (9), *Calendrier* (4), *Bataille de masse* (5), *Rencontres* (3), *Équipage & navire* (3) |

Regrouper une catégorie = poser `cluster: '…'` sur son littéral dans `CODEX_SPECS`, rien d'autre.

## Étendre

- **Nouvelle relation inverse** : ajouter l'arête dans `src/ui/compendium/relations.ts` (`addReverse(targetCat, id, by)`),
  un titre dans `REVERSE_TITLE` si besoin, et `...reverseSections(cat, id)` dans la catégorie du registre.
- **Nouveau champ de fiche** : enrichir l'`item` dans `src/ui/compendium/registry.ts` (méta `fact(...)` ou section via les
  helpers de `src/ui/compendium/describe.ts` : `passiveSection`, `careerGrantSection`, `effectsSection`, `capabilitySection`, `spellFlowSection`).
- **Exergue de fiche** : PRÉSENTATION, jamais un champ. La `desc` reste ENTIÈRE et UNE ; c'est le plugin
  `exergues` de `<Prose>` (`src/ui/Prose.tsx`), activé par la DONNÉE de catégorie
  (`CodexCategory.exergues`, `careers`), qui rend en `.prose-exergue` (matière `ParchmentCard`)
  TOUT couple citation `« … »` + attribution (tiret), À SA PLACE dans le corps — convention
  typographique OBSERVÉE dans les sources : 105 des 108 carrières
  curées en portent au moins un (176 couples au total ; folios 10–154 de 7 livres :
  `livre-de-base`, `archives-de-l-empire-2`, `archives-de-l-empire-1`, `middenheim`, `aux-armes`, `mer-des-griffes`, `vents-de-la-magie`). Une catégorie SANS la donnée (`species` et ses
  « Points de vue ») garde ses citations en paragraphes : aucun `if (category === …)` au rendu.
- **Riders / effets / formules de sort en clair** : les sections rendent d'abord la phrase JOUEUR
  (`src/ui/compendium/humanize.ts` — switchs EXHAUSTIFS, zéro id brut : `humanizeFormula`, `deFormule`, `humanizeQuantite`, `humanizeCondition`, `humanizePerSL`, `coutAvantageTexte`, `flowMuet`, `replieCausesPersistantes`, `humanizeResolveWindow`, `humanizeOp`, `humanizeFlow`, `humanizeFlowSentence`, `humanizeCastBonus`),
  la forme technique d'atelier restant dépliée dans un bloc « Détail technique » (primitive `.fold`).
- **Édition** : tout reste éditable au Compendium (DEV) ; les VIEWS ne sont pas éditables
  (`isEditableCategory=false`) — éditer la source.

## Gardes

- `npx vitest run src/ui/compendium/relations.test.ts`
- `npx vitest run src/ui/compendium/registry.test.ts`
- `npx vitest run src/ui/compendium/humanize.test.ts`
- `npx vitest run src/data/schemas/exposition-contrats.test.ts`
- `npx vitest run src/data/serialize.test.ts`
<!-- sources-empreinte: 6eef2e21073e8844187fcbb98c3cad2292c3c1d4 (770 fichiers, 0 dossiers) corps: c7389c0c0f236a4c391641cb9e57806e78b0cdf0 -->
