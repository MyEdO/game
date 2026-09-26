# Atlas des données — `src/data/*.json` (base app-owned)

> ⚠️ Fichier GÉNÉRÉ par `node scripts/docs/build-donnees.mjs` (`npm run docs:donnees`) — NE PAS ÉDITER À LA MAIN.
> Source éditoriale (rangement par rubrique, description, règle d'or, pièges d'homonymes) :
> `src/data/donnees.manifest.json`. La liste des fichiers, leur nombre d'entrées et la présence d'un
> schéma sont CALCULÉS de l'arbre réel — jamais périmés : re-générer après tout ajout/retrait de
> `src/data/*.json`.

> Réf VIVANTE. `src/data/*.json` est la **SOURCE app-owned** (commitée, éditable au Compendium). Cet
> atlas répond à trois questions AVANT d'ajouter/curer une donnée : **où vit chaque concept**, **quelles
> conventions de champs**, **qu'est-ce qui existe déjà**. Procédure pas-à-pas : `docs/ajouter-une-donnee.md`
> (skill `ajouter-une-donnee`). Complétude verrouillée par `src/data/data-atlas-complete.test.ts` (tout
> fichier doit être cartographié ici) ; chemins vérifiés par `npm run docs:check`.

**Périmètre mesuré et angles morts** — la carte §A vient du manifeste ÉDITORIAL
`src/data/donnees.manifest.json` (rangement par rubrique, description, homonymes) : rien de tout cela
ne se devine de l'arbre, un jugement humain reste nécessaire. Ce que ce générateur CALCULE et
réfute au besoin : (1) bijection stricte manifeste ⇄ `124` fichiers réels de
`src/data/*.json` (un `.json` neuf non cartographié, ou une entrée de manifeste pointant sur un
fichier disparu, casse la génération) ; (2) nombre d'entrées par fichier (comptage `Array.isArray`,
`objet à sous-catalogues` sinon — angle mort assumé : cette étiquette ne dit RIEN du contenu réel
d'un objet à sous-catalogues, juste qu'il n'est pas un tableau plat) ; (3) couverture du contrat de
schéma zod (`124/124`, cf. §E-bis) ; (4) présence effective sur disque de
chaque fichier cité par un cas d'homonyme de §D. Angle mort déclaré : les DESCRIPTIONS de rubrique,
de fichier et d'homonyme restent du texte manuscrit du manifeste — ce générateur ne les vérifie PAS
contre le contenu réel des `.json` (une description qui ment sur ce que porte un fichier ne casse
pas la génération) ; seule la complétude de la CARTE (quel fichier existe, où il est rangé) est
garantie, pas la justesse de sa glose.

La colonne **Exposition** de §A est DÉRIVÉE des `exposition` déclarées par les defs
(`document(type, famille, champs, meta, exposition)` → `src/data/schemas/exposition-derivee.ts`,
dumpée par `scripts/docs/lib/dump-exposition.mts`) : clés de catégorie Codex exposées, route
d'édition (`dataset` / `objet single|record` / `niché` / aucune), ou EXEMPTION motivée
(`24` fichier(s) exempt(s) sur `124`). Aucune de ces valeurs n'est écrite ici :
un def qui change d'exposition change cette colonne au prochain `npm run docs:donnees`.

## §A — Carte : où va chaque donnée

**Règle d'or** : Une table que le livre range sous « **Machines de guerre / véhicules / navires** » n'est JAMAIS un *trapping* (équipement porté). Elle va dans le fichier de son sous-système (`mass-battle.json`, `vehicles.json`, `naval-traits.json`…). Corollaire : un même nom peut désigner plusieurs concepts distincts dans plusieurs fichiers — voir §D (pièges d'homonymes).

### Personnage — fiche & progression
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `characteristics.json` | Caractéristiques (CC, CT, F… + méta) (19 entrée(s)) | `characteristics` — dataset `characteristics` |
| `skills.json` | Compétences (+ `specs` de spécialisation) (48 entrée(s)) | `skills` — dataset `skills` |
| `talents.json` | Talents (187 entrée(s)) | `talents` — dataset `talents` |
| `traits.json` | Traits (créature ET joueur ; `capabilities`/`passive`/`effects`) (132 entrée(s)) | `traits` · `psychologie` — dataset `traits` |
| `careers.json` | Carrières (108 entrée(s)) | `careers` — dataset `careers` |
| `careerLevels.json` | Les 4 niveaux de chaque carrière (compétences/talents/possessions gagnés) (432 entrée(s)) | `careerLevels` — dataset `careerLevels` |
| `progression-schemas.derived.json` | GÉNÉRÉ (`python scripts/data/gen-progression-schemas.py`) — le schéma de progression (marque → Caractéristique, par niveau) LU dans les PDF de `Source/` : vérité dérivée contre laquelle `scripts/guards/lib/progressionSchemas.mjs` confronte le `characteristics` de `careerLevels.json`. Ne pas éditer à la main. (objet à sous-catalogues) | exempt (vocabulaire-app-interne) — aucune (artefact GÉNÉRÉ : il se réécrit par `scripts/data/gen-progression-schemas.py`, jamais à l’atelier) |
| `classes.json` | Classes (regroupements de carrières) (9 entrée(s)) | `classes` — dataset `classes` |
| `species.json` | Espèces jouables + variantes régionales (27 entrée(s)) | `races` — dataset `species` |
| `speciesRace.json` | Mapping espèce → race de rig (`default` + `rules`) (objet à sous-catalogues) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `groups.json` | Groupes de races/familles (clé des `specs` de compétence/talent) (38 entrée(s)) | `groups` — dataset `groups` |
| `advancementCosts.json` | Coût d'XP par palier (caractéristique/compétence) (15 entrée(s)) | `advancementCosts` — dataset `advancementCosts` |
| `pregens.json` | Personnages prétirés (8 entrée(s)) | `pregens` — dataset `pregens` |
| `names.json` | Générateur de noms par espèce (7 entrée(s)) | `names` — dataset `names` |
| `details.json` | Détails physiques aléatoires (âge, taille, textes) (objet à sous-catalogues) | `details` — objet single |
| `eyes.json` · `hairs.json` | Couleurs d'yeux / de cheveux (tirage) (10 entrée(s) · 10 entrée(s)) | `eyes` — dataset `eyes` ; `hairs` — dataset `hairs` |
| `axes.json` | Axes de forces/faiblesses (#409, mécanique MAISON) — socle de base + exemples de scénario, `derivation` en ids de `skills.json`/`talents.json` ; moteur `src/engine/axes.ts` (9 entrée(s)) | `axes` — dataset `axes` |

### Magie & religion
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `spells.json` | Sorts, bénédictions, miracles (`effects`) (576 entrée(s)) | `spells` — dataset `spells` |
| `domains.json` | Domaines de magie (Vents) (20 entrée(s)) | `domains` — dataset `domains` |
| `gods.json` | Dieux (bénédictions/miracles rattachés) (41 entrée(s)) | `gods` — dataset `gods` |
| `miscast.json` | Tables d'Incident magique — 5 documents : Imparfaites Mineures/Majeures (LDB), leurs révisions VDM, Colère des dieux (5 entrée(s)) | `miscastMinor` · `miscastMajor` · `miscastWrath` — niché (`miscastMinor` · `miscastMajor` · `miscastWrath`) |
| `breath-types.json` | Types de Souffle (feu, froid, corrosif…) (6 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `vents-tourbillonnants.json` | Table d10 de force des Vents (option `vents-tourbillonnants`, LDB 46 l.179-190) (objet à sous-catalogues) | `ventsTourbillonnants` — niché (`ventsTourbillonnants`) |
| `arcane-phenomena.json` | Magie ENVIRONNEMENTALE (VDM 14, folios 189-199) : paliers de Saturation, Effets de Saturation par Vent, phénomènes arcaniques (lignes de force, pierres gardiennes, Grand Vortex, nexus, appuis arcaniques, Tempête de Magie, Corruption), tables de Corruption chaotique/nécromantique et de Flux magique — option `magic-vdm-environnementale` (objet à sous-catalogues) | `arcanePhenomena` — objet single |
| `surincantation.json` | TABLEAU DE SURINCANTATION (VDM 02 l.207-215, folio 23) : palier de DR dépensés sur une colonne → Cible additionnelle, Dégât en plus, Portée/ZdE/Durée multipliées — lu par `src/engine/overcast.ts` sous l'option `magic-vdm-incantation` (objet à sous-catalogues) | `surincantation` — niché (`surincantation`) |

### Combat & résolution
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `actions.json` | Registre des ACTIONS de combat (id stable → libellé, icône, coût, règle Codex, surface, gate/candidates/run) (55 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (registre de routage édité au fichier — absent de `CodexEdit.CATEGORY_DATASET`) |
| `qualities.json` | Atouts/défauts d'arme & armure (`belier`, `siege`… = la QUALITÉ, pas l'arme) (59 entrée(s)) | `qualities` — dataset `qualities` |
| `qualityTypes.json` · `qualitySubtypes.json` | atout/defaut · arme/armure/objet (2 entrée(s) · 3 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) ; exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `weaponGroups.json` | Groupes d'armes (Base, Escrime, Parade…) (38 entrée(s)) | `weaponGroups` — dataset `weaponGroups` |
| `maneuvers.json` | Manœuvres (attaques spéciales : morsure, souffle…) (20 entrée(s)) | `maneuvers` — dataset `maneuvers` |
| `criticals.json` | Blessures critiques par localisation — 8 documents-tables, un par jeu × Localisation (base · variante *Aux Armes*) (8 entrée(s)) | `criticalsTete` · `criticalsBras` · `criticalsCorps` · `criticalsJambe` · `aaCriticalsTete` · `aaCriticalsBras` · `aaCriticalsCorps` · `aaCriticalsJambe` — niché (`criticalsTete` · `criticalsBras` · `criticalsCorps` · `criticalsJambe` · `aaCriticalsTete` · `aaCriticalsBras` · `aaCriticalsCorps` · `aaCriticalsJambe`) |
| `localisation.json` | Tables de localisation d100 (`personnage`/`navire`/`navire-fluvial`) (objet à sous-catalogues) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `tables.json` | Tables d'effets `[min,max] → GameOp[]` référencées par l'op `rollTable` (`tableId`) — Tableau des aspects démoniaques (Allure démoniaque, EDOC 13) par Domaine du Chaos (21 entrée(s)) | `effectTables` — aucune (exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier) |
| `grapple.json` | Lutte / empoignade (objet à sous-catalogues) | `grapple` — objet single |
| `regles.json` | Procédures / options de jeu au texte VERBATIM (Sombre Pacte, modes d'attaque/défense, Empoignade, Focalisation étendue, Ragot au marché…) — routées en tooltip `CodexRef` (catégorie Codex `regles`), jamais une paraphrase de règle (#392) (86 entrée(s)) | `regles` — aucune (exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier) |
| `reglesOptionnelles.json` | Registre des RÈGLES OPTIONNELLES (« règles maison ») : id STABLE (clé de surcharge, de persistance et de `variants[].when.rule`), libellé/aide/groupe d'affichage, forme du contrôle auto-rendu (`flag`/`param`/`mode`), défaut et bornes, action de jeu attachée — lu par `src/engine/policy.ts` (`rule(id)`), rendu par le panneau in-game (87 entrée(s)) | `reglesOptionnelles` — dataset `reglesOptionnelles` |
| `damage-types.json` | Types de dégâts (poison, feu, électrique) (4 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `sizes.json` · `encumbranceTiers.json` | Barèmes par Taille (modif. au tir · Enc à bord · côté d'empreinte) · paliers d'Encombrement (objet à sous-catalogues · 4 entrée(s)) | `sizes` — objet single ; `encumbranceTiers` — dataset `encumbranceTiers` |
| `etats.json` | États / Conditions (À terre, Aveuglé…) (21 entrée(s)) | `etats` — dataset `etats` |
| `psychology.json` | États psychologiques (Peur, Terreur, Frénésie…) (9 entrée(s)) | `psychologies` — dataset `psychologies` |
| `structures.json` · `structure-criticals.json` | Structures/portes (cibles de siège) · leurs critiques (24 entrée(s) · objet à sous-catalogues) | `structures` — dataset `structures` ; `structureCriticals` — niché (`structureCriticals`) |
| `artillery-misfire.json` | Incidents de Tir d'Artillerie par Salve (AA 10 l.270-277) — arme d'équipe à Atout Salve qui subit un Incident de tir (objet à sous-catalogues) | `artilleryMisfire` — niché (`artilleryMisfire`) |
| `mass-battle.json` | **ATTENTION — Objet à sous-catalogues** (`powerEstimate`, `mightModifiers`, **`warMachines`** ← le Bélier de siège ICI, `structures`, `hazards`) : bataille de masse (objet à sous-catalogues) | `massBattlePowerEstimate` · `massBattleMightModifiers` · `massBattleWarMachines` · `massBattleStructures` · `massBattleHazards` — niché (`massBattlePowerEstimate` · `massBattleMightModifiers` · `massBattleWarMachines` · `massBattleStructures` · `massBattleHazards`) |

### Santé — blessures, maladies, corruption
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `traumas.json` | Traumatismes / séquelles (`ops`) (29 entrée(s)) | `traumas` — dataset `traumas` |
| `maladies.json` · `symptoms.json` | Maladies · leurs symptômes (18 entrée(s) · 18 entrée(s)) | `maladies` — dataset `maladies` ; `symptoms` — dataset `symptoms` |
| `mutations.json` · `mutationTables.json` | Mutations du Chaos · tables d100 de mutation (116 entrée(s) · 17 entrée(s)) | `mutations` — dataset `mutations` ; `mutationTables` — dataset `mutationTables` |
| `water-exposure.json` | Exposition à l'eau (noyade, maladies) (objet à sous-catalogues) | `waterExposure` — objet single |
| `obsessions.json` · `drunkenness.json` | Obsessions (table) · ivresse (table) (objet à sous-catalogues · objet à sous-catalogues) | `obsessions` — niché (`obsessions`) ; `drunkenness` — niché (`drunkenness`) |
| `night-stakes.json` | Enjeu VERBATIM par `kind` d'étape de la cascade de nuit (#331) — ce que l'échec coûte, lu par `nightStakeRef` (`src/data/index.ts`, appelé par `src/state/restFlow.ts`) (15 entrée(s)) | `nightStakes` — dataset `nightStakes` |
| `voyage-stakes.json` | Enjeu par `kind` d'étape de cascade de VOYAGE (#1117) — GABARIT de descripteur mécanique dont les trous `{nom}` reçoivent les valeurs calculées du flux, lu par `voyageStake` (`src/data/index.ts`) (42 entrée(s)) | `voyageStakes` — aucune (exposé au Codex en LECTURE seule — aucune clé de `CodexEdit.CATEGORY_DATASET` ne le route vers un formulaire d’atelier) |
| `flow-stakes.json` | Enjeu d'un JET DE MODALE MONO (#1117), keyé par l'id de jet `{flow, phase}` — descripteur mécanique + foyer de règle (entité porteuse) ou catégorie de l'entrée jouée, lu par `flowStakeRef`/`resolveStake` (`src/data/index.ts`) (34 entrée(s)) | `flowStakes` — aucune (exposé en LECTURE seule au Codex (catégorie `flowStakes`) — absent de `CodexEdit.CATEGORY_DATASET`) |
| `combat-stakes.json` | Enjeu d'une étape de cascade de COMBAT (#1117), keyé par le `kind` de son applier — descripteur mécanique + foyer de règle (entité porteuse) ou catégorie de l'entrée jouée, lu par `combatStakeRef`/`resolveStake` (`src/data/index.ts`) (37 entrée(s)) | `combatStakes` — aucune (exposé en LECTURE seule au Codex (catégorie `combatStakes`) — absent de `CodexEdit.CATEGORY_DATASET`) |

### Objets & équipement
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `trappings.json` | **Équipement PORTÉ** : armes, armures, objets tenus/portés. **ATTENTION — PAS** les machines de guerre. (441 entrée(s)) | `trappings` · `siegeEngines` — dataset `trappings` |
| `disponibilite.json` | Tables numériques de « Faire son marché » (LDB 59) : `dispoPct` (% de Disponibilité par taille de colonie) + `barterRatios` (RATIOS DE TROC) — consommées par `src/engine/disponibilite.ts` (`DISPO_PCT`/`BARTER_RATIOS`) (objet à sous-catalogues) | `disponibilite` — objet single |

### Bestiaire
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `creatures.json` | Bestiaire / PNJ (statblocs : `char`, `traits`, `skills`, `spells`, `trappings`…) (493 entrée(s)) | `creatures` — dataset `creatures` |

### Monde, voyage terrestre & temps
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `locations.json` | Lieux / régions (hiérarchie `parent`) (55 entrée(s)) | `locations` — dataset `locations` |
| `weather.json` | Saisons / météo terrestre (objet à sous-catalogues) | `weather` · `weatherConditions` — niché (`weather` · `weatherConditions`) |
| `calendarMonths.json` · `calendarWeekdays.json` · `calendarIntercalary.json` · `calendarPhases.json` | Calendrier impérial (12 entrée(s) · 8 entrée(s) · 6 entrée(s) · 7 entrée(s)) | `calendarMonths` — dataset `calendarMonths` ; `calendarWeekdays` — dataset `calendarWeekdays` ; `calendarIntercalary` — dataset `calendarIntercalary` ; `calendarPhases` — dataset `calendarPhases` |
| `stars.json` · `astrology.json` | Signes astraux · Demeures astrologiques (23 entrée(s) · 5 entrée(s)) | `stars` — dataset `stars` ; `celestialHouses` — dataset `celestialHouses` |
| `montures.json` · `incidents-monture.json` | Montures · incidents de monture (objet à sous-catalogues · objet à sous-catalogues) | `montures` — niché (`montures`) ; `incidentsMonture` — niché (`incidentsMonture`) |
| `vehicles.json` | Véhicules (diligence, barge, **navires** — porte des réfs de `naval-traits` par id) (31 entrée(s)) | `vehicles` — dataset `vehicles` |
| `problemes-vehicule.json` · `driving-mishap.json` | Pannes de véhicule · maladresse de conduite (objet à sous-catalogues · objet à sous-catalogues) | `problemesVehicule` — niché (`problemesVehicule`) ; `drivingMishap` — niché (`drivingMishap`) |
| `land-cargo.json` | Cargaison terrestre (commerce) (objet à sous-catalogues) | `landCargo` — niché (`landCargo`) |
| `reseau-routier.json` | Réseau routier impérial (EDOC 3 & 6) : classes de route du décret de 2453 et leurs largeurs, auberges relais et espacement des étapes, compagnies de diligences nommées, postes de péage (tarif par jambe, espacement) et effectifs de patrouille — données de CALIBRATION d'une `MapRoute` (`inns`/`prices`/`speed`), aucune extension du vocabulaire de route (15 entrée(s)) | exempt (dette, #684) — aucune (aucune catégorie du Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `tavernGames.json` | Jeux de taverne (13 entrée(s)) | `tavernGames` — dataset `tavernGames` |
| `merchants.json` | Archétypes de marchand (#2) — catalogue par familles `category.types`/`subTypes`, Disponibilité/Statut/`unitKinds` (bêtes/véhicules vendus, dérivés de `creatures`/`vehicles` à facette `purchase`) ; aucun archétype en dur dans le code, `MERCHANTS`/`MERCHANT_ARCHETYPES` (`state/merchants/index.ts`) réexportent ce registre (6 entrée(s)) | exempt (dette, #747) — aucune (aucune catégorie du Codex ne l’édite — le stock se règle en Scène, l’archétype reste app-owned) |
| `merchantFamilies.json` | Familles de PRÉSENTATION du stock marchand (onglets `ui/MerchantPanel.tsx`) — ordre d'affichage, règle de classement `match` (unit/shield/categorie/fallback) et `columns` de stats à afficher, résolues contre le registre fixe `MERCHANT_COL_RENDERERS` (7 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |

### Naval & fluvial (*Mer des Griffes* · *Mort sur le Reik*)
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `naval-traits.json` | **ATTENTION — Tableau mixte** (`kind`: trait/amelioration) des Traits & Améliorations de navire — le **Bélier de proue** (`ram`) ICI (27 entrée(s)) | `navalTraits` — dataset `navalTraits` |
| `naval-ports.json` | Index des ports de la Mer des Griffes (MDG 15 l.439-506) — catalogue par id, consommé PAR RÉFÉRENCE (`MapPlace.port.ref`) depuis la carte du monde (39 entrée(s)) | `navalPorts` — dataset `navalPorts` |
| `lieux-services.json` | Vocabulaire des SERVICES de lieu EXTENSIBLES (#343 — auberge/temple/forgeron/guilde…) au-delà du port/marché, consommé PAR RÉFÉRENCE (`MapPlace.services[].kind`) et résolu par `placeServices` — id/label/icône de routage du hub de lieu, app-owned (7 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `naval-progression.json` | Progression navale (modes/vitesse) (objet à sous-catalogues) | `navalProgression` — niché (`navalProgression`) |
| `ship-construction.json` · `ship-criticals.json` | Construction de navire · critiques de navire (objet à sous-catalogues · objet à sous-catalogues) | `shipHullSizes` · `shipSpeedTraits` · `shipConstructionTraits` — niché (`shipHullSizes` · `shipSpeedTraits` · `shipConstructionTraits`) ; `shipCriticalsCargaison` · `shipCriticalsGreement` · `shipCriticalsCoque` · `shipCriticalsAvirons` · `shipCriticalsEquipements` — niché (`shipCriticalsCargaison` · `shipCriticalsGreement` · `shipCriticalsCoque` · `shipCriticalsAvirons` · `shipCriticalsEquipements`) |
| `crew-roles.json` · `crew-morale.json` · `crew-test-types.json` · `ship-stations.json` | Rôles d'équipage · moral · types de Test d'équipage · stations à bord (9 entrée(s) · objet à sous-catalogues · objet à sous-catalogues · 5 entrée(s)) | `crewRoles` — dataset `crewRoles` ; `crewMoraleFactors` · `crewMoraleBands` — niché (`crewMoraleFactors` · `crewMoraleBands`) ; `crewTestTypes` — niché (`crewTestTypes`) ; `shipStations` — dataset `shipStations` |
| `sea-navigation.json` · `sea-perils.json` · `sea-events.json` · `sea-weather.json` · `sea-cargo.json` | Navigation · périls · événements · météo · cargaison maritimes (objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues) | `seaNavigation` — objet single ; `seaPerils` — objet single ; `seaManannFactors` · `seaBoardEvents` · `seaPortEvents` — niché (`seaManannFactors` · `seaBoardEvents` · `seaPortEvents`) ; `seaWeather` — objet single ; `seaCargo` — niché (`seaCargo`) |
| `sea-shanties.json` | Chants de marins (`crewOps`) (7 entrée(s)) | `seaShanties` — dataset `seaShanties` |
| `steam-breakdown.json` | Pannes de navire à vapeur (6 entrée(s)) | `steamBreakdowns` — dataset `steamBreakdowns` |
| `river-navigation.json` · `river-perils.json` · `river-criticals.json` | Navigation · périls · critiques fluviaux (objet à sous-catalogues · objet à sous-catalogues · objet à sous-catalogues) | `riverNavigation` — objet single ; `riverPerils` — niché (`riverPerils`) ; `riverCriticalsGreement` · `riverCriticalsAvirons` · `riverCriticalsGouvernail` · `riverCriticalsCoque` · `riverCriticalsSuperstructure` — niché (`riverCriticalsGreement` · `riverCriticalsAvirons` · `riverCriticalsGouvernail` · `riverCriticalsCoque` · `riverCriticalsSuperstructure`) |

### Contenu de campagne / interlude / rencontres
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `activities.json` | Activités d'interlude / entre-aventures (63 entrée(s)) | `activities` — dataset `activities` |
| `interludeEvents.json` | Événements d'interlude (fourchettes d100) (31 entrée(s)) | `interludeEvents` — dataset `interludeEvents` |
| `rencontres-edoc.json` | Rencontres EDOC (tables) (objet à sous-catalogues) | `rencontresPositives` · `rencontresFortuites` · `rencontresDangereuses` — niché (`rencontresPositives` · `rencontresFortuites` · `rencontresDangereuses`) |
| `peripeties.json` · `oups.json` | Péripéties de voyage · « Oups ! » (fourchettes) (10 entrée(s) · 8 entrée(s)) | `peripeties` — dataset `peripeties` ; `oups` — dataset `oups` |

Le **bloc `narratif`** d'un paquet de campagne schema 3 (`NarratifBlock`, `src/state/campaignNarratif.ts`, #765) est EMBARQUÉ dans le JSON du projet, jamais dans `src/data` global : ses `narratif.objets` réutilisent le schéma `TrappingData` global (`src/data/index.ts`), et ses `presetsPnj.base` RÉFÉRENCENT une créature globale par id (`findCreatureById`) — jamais une copie.

### Rendu / apparence / décor (NON-règles)
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `raceAppearance.json` | Apparence par race (gabarit, palette, tenue) — rig (21 entrée(s)) | `raceAppearance` — dataset `raceAppearance` |
| `structureAppearance.json` | Apparence de structure (murs, portes) (18 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (presets de rendu édités au fichier — absent de `CodexEdit.CATEGORY_DATASET`) |
| `props.json` | Props de décor (leurs matières vivent dans `materials.json`) (124 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (édité à la PALETTE de décor de l’éditeur de carte, jamais par une catégorie du Codex) |
| `decorPalette.json` | Palette de couleurs de décor (objet à sous-catalogues) | exempt (vocabulaire-app-interne) — aucune (palette d'art éditée au fichier (aucun écran d'atelier ne l'expose)) |
| `teintesJeu.json` | TEINTES DE JEU du terrain — surbrillances tactiques (portées, zones, bandes de tir, anneaux de cible, halos, télégraphes) et identité d'unité (anneaux réservés, équipes, une couleur par héros), `id → #rrggbb` groupé par préfixe ; servi aux peintres par `src/gameIso/highlightTints.ts` et `src/gameIso/teamColors.ts` (objet à sous-catalogues) | exempt (vocabulaire-app-interne) — aucune (palette de rendu éditée au fichier (aucun écran d'atelier ne l'expose)) |
| `materials.json` | LES matières du monde — un document, le domaine (`prop` décor volumique · `roof` toiture · `relief`) porté par l'entrée (16 entrée(s)) | `materials` — dataset `materials` |
| `terrains.json` | LES terrains de la grille — un document où la RÈGLE (`walkable`, `priority`, `opaque`, `built`) et le RENDU (`swatch`, `stops`, `detail`, `overlayProp`, `solidHeightM`) vivent dans la MÊME entrée ; lu par la façade `src/state/terrain` (25 entrée(s)) | `terrains` — dataset `terrains` |
| `semences-de-scene.json` | LES semences d'une scène NEUVE (#1716) — ambiance, mètres par case, éclairage, sol de départ, matières de relief et toiture par défaut ; objet unique lu par `emptyScene` (`src/state/scene.ts`, dérivées `DEFAULT_RELIEF_DEFAULTS`/`DEFAULT_ROOF_DEFAULTS`/`DEFAULT_TERRAIN`). Les MIGRATIONS de projet ne la lisent PAS : elles reposent la valeur gelée de leur lot (objet à sous-catalogues) | `semencesDeScene` — objet single |
| `defauts-de-compilation.json` | LES défauts du COMPILATEUR de scène (#1716) — ce que `buildScene` pose quand une section d'un `MapSpec` laisse le terrain implicite : sol du chemin de ronde et masse d'une `cells` d'enceinte (`src/state/mapSpec.ts`), tuile de pont d'une scène de bord (`buildBoardingScene`, `src/state/seaVoyageFlow.ts`). Objet unique, distinct des SEMENCES (créer une scène) — compiler une déclaration déjà écrite (objet à sous-catalogues) | `defautsDeCompilation` — objet single |
| `buildings.json` | LES types de bâtiment — empreinte offerte à la pose, couverture par défaut des nappes de toit, ornements d'identité posés en billboard ; lu par la façade `src/state/buildings.ts` (7 entrée(s)) | `buildings` — dataset `buildings` |
| `ambiance.json` · `lightLevels.json` · `lightTones.json` | Ambiance lumineuse (`iso`/`pov`) · niveaux de lumière · TONS de lumière (#1245 : apparence d'une source ponctuelle — couleur, part d'intensité, vacillement ; référencés par `tone`, défaut `flamme`) (objet à sous-catalogues · 5 entrée(s) · 4 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) ; exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) ; exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `renduMonte.json` | Réglage MAISON du rendu du couple MONTÉ (#1128) — `harnaisParDefaut` : id du set d'équipement (registre `src/gameIso/rig/quadruped/harnais/`) apposé à une monture PORTÉE dont le record ne déclare pas de `appearance.harnais` (LDB 08 l.557), lu par `DEFAUT_HARNAIS_MONTE` (objet à sous-catalogues) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |

### Méta
| Fichier | Contient | Exposition (Codex — édition) |
|---|---|---|
| `books.json` | **Registre des livres sources** — le champ `abr` est l'abréviation CANONIQUE (voir §B) (30 entrée(s)) | `books` — dataset `books` |
| `primitives.manifest.json` · `systemes.manifest.json` | Manifestes TOOLING (#298, vocabulaire app-interne, pas RAW) — sources de `docs/systemes.md` (`npm run docs:systemes`, `scripts/docs/build-systemes.mjs`) (101 entrée(s) · 16 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) ; exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `raw.manifest.json` | Manifeste éditorial du champ Implémente de l'Atlas RAW (généré par `scripts/raw/build-implemente.mjs`, #487) : par topic, ticket de dette ou raison de blocage — la SEULE surface écrite à la main du champ (12 entrée(s)) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |
| `donnees.manifest.json` | Manifeste éditorial de cet atlas (#903, rangement par rubrique, description, règle d'or, pièges d'homonymes) — source de `docs/donnees.md` (`npm run docs:donnees`, `scripts/docs/build-donnees.mjs`) (objet à sous-catalogues) | exempt (vocabulaire-app-interne) — aucune (aucune catégorie Codex ne l’expose, donc aucun formulaire d’atelier ne l’édite) |

## §B — Conventions de champs (à respecter à l'ajout)

- **`type`** = le **nom de base du dataset** (`peripeties.json` → `"type": "peripeties"`), en **2ᵉ clé
  de chaque entrée**, juste après `id`. Ce n'est pas de la décoration : c'est le littéral que la
  fabrique `document()` pose et VÉRIFIE au parse (§E-bis) — une entrée dont le `type` ment est
  REFUSÉE. Il ne se recopie pas d'un dataset voisin : il se lit sur le nom du fichier.
- **`source.book`** = l'`id` STABLE d'un livre de `src/data/books.json` (slug neutre, ex.
  `livre-de-base`, `archives-de-l-empire-2`, `mer-des-griffes`) — **jamais** l'abréviation d'affichage ni
  le libellé. Relation **id-pure** (i18n-safe) : `books.json` est la source de vérité, **enforced** par
  `src/data/book-source-integrity.test.ts` (tout `source.book` ∈ ids de livres). L'affichage résout
  id→`abr` via `bookAbr` (choke-point `registry.ts` `src()`). Pour un ajout : copier l'`id` d'une entrée
  voisine du même livre (`grep '"book"' <fichier>`), ou le lire dans `books.json`. Contenu fan
  communautaire = livre `frenchy-bzh`.
- **`source.page`** = la **page IMPRIMÉE du livre** (le folio), comme la donnée existante (ex. LDB « À
  Enroulement » = folio 297, AA « Cimeterre » = folio 90 — sa `desc`, règle 5 ; la ligne de stats
  du Cimeterre, folio 91, va en `alsoIn`, cf. plus bas). Pour l'obtenir : trouve ton contenu dans le
  `.md` du livre (`docs/sources-vf.md` → dossier `Source/`), puis lis le **`data-folio="N"`** de l'ancre
  `<span id="page-… data-folio="N">` la plus proche AU-DESSUS de ton contenu — **`N` = la valeur de
  `source.page`**. ⚠ Le NUMÉRO du span-id seul (`page-89`) est l'**index PDF**, PAS le folio (c'est le
  piège de #148) — toujours lire `data-folio`. **Tous les livres de règles autorisés** ont `data-folio`
  baké et les ancres nues (sans folio) retirées — étiquetés (LDB, ADE I/II, EDOC, Middenheim, NADJ, ACE,
  PDT) comme scans (AA, ZI, MDG, EDO, MSR, MSRC) ; le `00 - Index.md` de chaque livre liste ses chapitres
  avec leur folio de début.
  **Enforced** (#536) par `src/data/book-source-integrity.test.ts`, volet « intégrité du folio », par DEUX
  voies : (A) **hors-livre** — le folio dépasse le dernier folio ATTESTÉ du livre (`bookMaxFolio` : dernier
  marqueur `data-folio` et dernière page citée par `00 - Index.md`), réfutation qui se passe de la `desc`
  ; (B) **encadrement** — la prose de l'entrée étant verbatim (règle 5), elle LOCALISE l'entrée dans le `Source/`
  du livre déclaré, et l'encadrement `data-folio` de l'occurrence réfute le folio qui ment. La garde consomme la
  prose sous SES DEUX porteurs (#1389) : la `desc` inline, ou le texte que `materialiser` (`scripts/source/resoudre.mjs`)
  résout d'une `descRef` — une famille qui ADRESSE sa prose reste donc mesurée. Défauts fondateurs :
  `redoutable` (ZI) déclarait `page: 11` pour un texte en folio 134 ; `activities.json:duel` déclarait
  `page: 223` dans un ADE II qui compte 98 pages. Mécanique : `scripts/guards/lib/folioIntegrity.mjs` ;
  rapport de solde (donne le folio RÉEL) : `node scripts/data/audit-folios.mjs`.
  ⚠ **Ce que la garde NE voit PAS** — elle ne réfute que ce qu'elle PROUVE et se tait sur le reste : une part des
  entrées citées échappe à TOUT verdict, de la desc comme du titre (prose reformulée donc introuvable, prose trop
  courte pour localiser, chapitre sans marqueur, livre sans extraction FR) — les deux cardinaux se LISENT au run
  (`node scripts/data/audit-folios.mjs`, lignes « Entrées citées scannées » et « irrésolues ») et ne sont pas écrits
  ici : ils dépendent du `Source/`, qu'un doc dérivé de la DONNÉE n'a pas à prendre dans son empreinte. Une entrée
  neuve à desc NON verbatim et à folio faux mais PLAUSIBLE passe encore : seule la règle 5 la rattrape. Le
  stock n'est donc pas « les défauts du dépôt », c'est « les défauts que ces deux voies prouvent ».
  Si une desc se retrouve sur PLUSIEURS folios (définition ET récapitulatif d'annexe), cite la **DÉFINITION** ;
  le rapport les signale (rubrique « À ARBITRER ») car la garde ne les départage pas.
  **Mode CLIQUET** : le stock des 108 entrées déjà fausses est gelé dans `scripts/guards/lib/folioRatchetStock.mjs`
  et ne peut que DÉCROÎTRE — toute entrée NEUVE au folio réfuté échoue la CI, toute clé soldée qui y traîne
  aussi, et sa TAILLE est plafonnée par la garde (`FOLIO_RATCHET_MAX`) pour qu'« ajouter une ligne au stock »
  ne soit jamais le chemin le plus court. `node scripts/data/audit-folios.mjs --stock` re-rend le stock et
  REFUSE de l'agrandir : l'outil ne sait que solder.
- **`alsoIn?: SecondaryRef[]`** (#563, doctrine user 2026-07-17 : « jamais 2 talents différents ») —
  un même Talent/Trait/Qualité/objet **réimprimé** dans un AUTRE livre (ou un autre folio du même
  livre) reste **UNE entrée** : l'ANCRE (`source`, scalaire, porte la `desc`, règle 5, STRUCTURELLE —
  jamais un tableau positionnel) + `alsoIn` porte les emplacements SECONDAIRES, chacun une paire
  `(book, page)` pleine + un `quote?` authoré (auto-attestation verbatim, pour le cas où le `label`
  n'apparaît pas tel quel au folio déclaré — ex. une TABLE imprime un nom différent). Accessors SOURCE
  UNIQUE : `allLocations(entry)`/`sourceBooks(entry)` (`src/data/sourceRefs.ts`) — aucun futur lecteur
  n'inline `alsoIn`. **Enforced** par `src/data/secondary-ref-integrity.test.ts` : chaque `alsoIn[i]`
  doit être **auto-attesté** (le `label` du porteur OU son `quote` retrouvé dans le SPAN du folio
  déclaré — charge de la preuve sur l'auteur, jamais une réfutation par absence). Champ posé sur
  `traits.json`/`qualities.json`/`trappings.json`/`spells.json`/`naval-traits.json`
  (`traits.ts`/`qualities.ts`/`trappings.ts`/`spells.ts`/`naval-traits.ts`). Exemple réel — le
  Cimeterre (AA) a sa `desc` en prose folio 90 et sa ligne de stats (tableau des armes) folio 91,
  où le `label` seul ne suffirait pas à distinguer la ligne dans le span sans un `quote` :
  ```json
  {
    "id": "cimeterre",
    "label": "Cimeterre",
    "source": { "book": "aux-armes", "page": 90 },
    "alsoIn": [{ "book": "aux-armes", "page": 91, "quote": "Cimeterre" }]
  }
  ```
  (Lot 2, #563 : 15 entrées migrées — republications identiques et scissions prose/ligne-de-stats.)
- **`variants?: Variant[]`** (#563/#564) — variante RÉGLÉE d'une entrée sous une **règle optionnelle**
  du registre `OPTIONAL_RULES` (`src/engine/policy.ts:88`, lue par `rule(id)`) : `when.rule` DOIT être
  un id du registre (jamais un label, gate fantôme sinon — **enforced** par
  `src/data/variants-integrity.test.ts`), `when.equals` défaut `true` ; `desc`/`source` PROPRES
  portent la règle 5 **par variante** (le walk `citedEntriesOf` de `folioIntegrity.mjs` la découvre
  déjà, structurellement identique à une entrée) ; `combat` réutilise `CombatFeature` tel quel.
  Résolution : `effectiveEntry(entry)` (`src/engine/variants.ts`) — PRIMITIVE UNIQUE, applique la
  première variante active (`activeVariant`) en REPLACE par champ DÉCLARÉ au premier niveau, sinon
  rend la forme LDB de base. Une variante ne peut republier QUE les champs que son dataset **résout**
  effectivement (liste blanche `VARIANT_RESOLVED_FIELDS` de la def, passée à `variantOf` — schéma
  `strictObject`, donc tout autre champ est rejeté au parse ; **enforced** aussi côté donnée par
  `src/data/variants-integrity.test.ts`) — `talents.json` résout quatre champs, UNE CITATION PAR LIGNE,
  chacune à côté du SYMBOLE qu'elle porte (lignes MESURÉES à la génération, `citeLigne`) :

  - `desc`/`source` — Codex, `effectiveEntry`, `src/ui/compendium/registry.ts:1496`
  - `test` — `talentTestSLBonus`, `src/engine/magic.ts:359`
  - `max` — `talentMaxById`, `src/engine/careerSlots.ts:326`
  - `combat` — `featuresOf`, `src/engine/combatFeatures/dispatch.ts:52`
  - `combat` — `castingKindOf`, `src/engine/combatFeatures/dispatch.ts:18`

  `traits.json` ne résout, lui, que deux champs :

  - `desc`/`source` — Codex, `effectiveEntry`, `src/ui/compendium/registry.ts:633`

  `passive` et `effects` en sont EXCLUS — le moteur les lit sur
  l'entrée brute (`src/engine/talentEffects.ts`, `src/engine/traits/dispatch.ts`) ; un champ n'entre
  dans la liste qu'une fois son consommateur routé par `effectiveEntry`. `careers`/`skills`/`spells`
  n'admettent aucune variante (aucun consommateur `effectiveEntry`). Champ posé sur `talents.json` —
  11 talents d'Aux Armes Annexe III.
- **`desc`** et tout champ de prose (effet, règles) = **copié/collé VERBATIM** de la source, en **Markdown**
  (`**gras**`, `*ital*`, listes `-`), jamais en HTML, jamais reformulé (règle stricte 5 ; garde
  `src/data/no-html-in-prose.test.ts`).
- **Formes de champ** = copiées des entrées voisines (`damage:{plusBF,flat}`, `qualities:[{id}]`,
  `passive: GameOp[]`…). Toute logique est keyée par **id stable** ; le `label` est de l'affichage.
- **Forme du fichier** : la plupart sont des tableaux plats d'entrées `{id,label,…}`, mais certains sont des
  **objets à sous-catalogues** (`mass-battle.json`, `sea-*.json`, `criticals.json`…) ou des **tables d100
  par fourchette** — lire la structure existante avant d'ajouter (cf. §A).
- **Canonicalisation** : après édition manuelle, le fichier doit être **byte-identique** au round-trip de
  `serializeDataset` (`src/data/serialize.ts`), verrouillé par `src/data/serialize.test.ts` (2 espaces,
  **aucun** newline final). L'éditeur Codex l'applique à la sauvegarde ; en édition manuelle, ne **jamais**
  reformater à la main ni via un `JSON.stringify` maison — passer par `serializeDataset`.

## §C — CHECK-FIRST (avant tout ajout — anti-doublon)

Le concept existe peut-être **déjà**, dans un AUTRE sous-système (incident #148 : le Bélier vit dans 6
fichiers). Avant d'ajouter :

```
grep -rniE '<id-candidat>|<label>|<concept>' src/data/*.json
```

Si l'élément (ou un synonyme) existe → NE PAS dupliquer : l'étendre là où il vit, ou re-scoper la tâche.
Puis choisir le fichier via §A. En cas d'ambiguïté, lire 2-3 entrées voisines des fichiers candidats.

## §D — Pièges d'homonymes (un mot ≠ un concept)

Les lookups sont **scopés par catalogue** (`findQualityById`/`findSpellById`/…), donc des homonymes coexistent LÉGITIMEMENT. `src/data/id-collisions.test.ts` verrouille l'ensemble connu (`KNOWN_CROSS`). Cas travaillé — **« Bélier »** = 6 concepts DISTINCTS :

| Fichier | Ce que « Bélier » y est |
|---|---|
| `qualities.json` | Qualité d'arme brise-porte (ADE II) — lue par `capabilities.ram` (dégâts aux portes) |
| `mass-battle.json` | Machine de guerre de siège (crew 6, Siège) |
| `naval-traits.json` | Amélioration « Bélier de proue » (`ram{ic,ap}`, MDG) — lue par `belierRam`, collision navale |
| `spells.json` | Sort « Bélier » |
| `vehicles.json` | **Référence** par id au trait naval (pas une redéfinition) |
| `creatures.json` | Réfs de qualité/manœuvre sur des créatures |

Deux mécaniques « ram » homonymes (brise-porte ADE II ↔ collision MDG) sont du **code séparé, sourcé, testé** — pas un doublon. Un nom partagé n'autorise JAMAIS à fusionner ni à dupliquer : vérifier le CONCEPT (§C), pas le mot.

## §E-bis — Contrat de schéma (`src/data/schemas/`)

Chaque document authoré valide contre un schéma zod **STRICT**, sur les **DEUX racines** de
documents : `src/data` (catalogues de jeu, **124/124** datasets sous contrat, décompte
CALCULÉ des defs présentes dans `src/data/schemas/defs/`) et `src/scenes` (projets de campagne
`*-projet.json`, defs dans `src/data/schemas/defs-scenes/`).

**La fabrique `document()` est LE chemin** (`src/data/schemas/grammaire/document.ts`) : un def ne
compose plus son schéma à la main, il DÉCLARE son document et reçoit un **handle FERMÉ** (le schéma
sort scellé — `.extend`/`.shape` n'existent ni au type ni au runtime ; la composition se fait dans la
fabrique, une fois, ou pas du tout).

```ts
// src/data/schemas/defs/peripeties.ts — la forme réelle d'un def simple
export const file = 'peripeties.json';
export const famille = 'entite';

const doc = document(
  'peripeties',                                 // type = 2ᵉ clé de chaque entrée (§B)
  famille,
  {                                             // champs — la charge utile PROPRE au type
    roll: z.number(),
    kind: z.enum(['reposant', 'narratif', 'ereintant', 'attaque']),
  },
  {                                             // meta — libellé FR par champ, exigé pour CHAQUE clé
    roll: { label: 'Face du dé', hint: 'Valeur du d10 qui déclenche cette Péripétie' },
    kind: { label: 'Nature de la Péripétie', hint: 'Ce que le moteur sait jouer sans rien inventer' },
  },
  {                                             // exposition — Codex + éditeur
    codex: { keys: ['peripeties'] },
    edit: { dataset: 'peripeties' },
  },
  { exiges: ['desc'] },                         // options
);

export const schema = doc.schema;
export const meta = doc.meta;
```

**Signature** : `document(type, famille, champs, meta, exposition, options?)`.

**Les 3 familles** — l'emballage du FICHIER est posé par la fabrique, un def n'écrit plus jamais son
`z.array` :

- `entite` — le dataset est un **TABLEAU d'entrées** (le cas courant : catalogues de jeu, et les
  fichiers qui portent plusieurs documents-tables).
- `config` — l'**ENTRÉE seule** : le document forme à lui seul le fichier.
- `record` — **enveloppe + `entries`** (`options.valeurRecord`, clé par `options.cleRecord`) ; en
  famille `record` l'ENTRÉE *est* le document.

**L'enveloppe** est posée par la fabrique, jamais redéclarée par un def — une clé d'enveloppe présente
dans `champs` est une erreur de TYPE *et* d'exécution, qui la nomme. `id`, `type` et `label` sont
requis ; `labelF`, `desc`, `descRef`, `icon`, `alsoIn` et `variants` optionnels ; la **provenance** est
`source` ∨ `maison`. Leurs libellés FR appartiennent à la fabrique (`LIBELLES_ENVELOPPE`), pas aux defs.

**Provenance** — un raffinement PRÉ-sceau refuse l'entrée qui n'a NI `source` NI `maison` (`maison` =
la RAISON en clair d'un arbitrage, une CHAÎNE, jamais un drapeau). Les types dont la provenance n'est
pas exigible (vocabulaires d'app, documents dont la source vit en profondeur) sont listés dans
`SANS_PROVENANCE_EXIGEE` (`src/data/schemas/grammaire/sans-livre.ts`, union de `SANS_LIVRE` et
`SOURCE_EN_PROFONDEUR`), seule table consultée par `exigeSource`.

**`options`** :

- `exiges` — clés d'ENVELOPPE que CE document rend requises ET non vides. `id`/`type`/`label` ne le sont
  pas (la fabrique les pose déjà requises), `variants` non plus (la fabrique le compose depuis
  `options.variantes`), ni `descRef` : l'exigence de PROSE se dit `exiges: ['desc']` et se satisfait par
  l'un OU l'autre porteur (`desc` inline, `descRef` adressée) — jamais sur un porteur.
- `idDocument` — schéma de l'id quand le catalogue est FERMÉ (patron `characteristics`) ; un schéma qui
  admettrait la chaîne vide est refusé à la déclaration.
- `variantes` — champs qu'une variante réglée republie (`variantOf`) ; un document sans `variantes`
  n'admet aucun `variants`.
- `affinerEntree` / `affinerDataset` — raffinements PRÉ-sceau, sur l'entrée ou sur le dataset emballé.
- `cleRecord` / `valeurRecord` — clé et valeur de `entries` en famille `record` (EXIGÉES par elle,
  REFUSÉES hors d'elle, en nommant le document).
- `rangee` — schéma d'une RANGÉE : la fabrique pose alors `entries` sur l'entrée, avec sa méta FR
  (`META_CHARGE`). Admissible dans toute famille — la charge est orthogonale à l'emballage.
- `deDeTirage` — le document porte un DÉ de tirage : la fabrique pose `die` (requis, méta FR comprise).
  Exige `rangee` ; un def à rangées ne redéclare NI `entries` NI `die` dans ses `champs`.

**Les 4 exports plats du contrat `gen`** : tout def qui appelle `document(` exporte `file`, `schema`,
`famille` et `meta` **À PLAT**. Le générateur de registre est TEXTUEL (lecture par regex, jamais un
import) — la sanction diffère donc PAR EXPORT, et une seule est silencieuse :

- `file` non conforme au filtre `scripts/gen-registry.mjs:370` (`^export const file = '`, guillemet
  SIMPLE littéral) : le def est **ÉCARTÉ du registre, en silence** — double quote, `: string` annoté,
  littéral gabarit et `= doc.file` compilent tous et sortent pourtant du registre. Seul cet export
  décide de l'appartenance au registre.
- `meta` non plat : le def **RESTE au registre** et perd son entrée `meta` (invisible de `presents()`,
  `scripts/gen-registry.mjs:382`) — l'atelier retombe sur la clé technique, sans qu'aucun gate rougisse.
- `schema`/`famille` destructurés (`export const { schema } = doc`) **COMPILERAIENT** : la
  destructuration crée un vrai nom importable. La garde n'y protège pas la compilation mais la
  CONVENTION — forme plate unique, lisible par un codemod.

Garde : `defsSansExportsPlats`, dans `src/ui/compendium/libelles-de-champs.test.tsx` (« convention
d'export lue par le générateur de registre »), dont le bras `file` rend le verdict DU GEN forme par forme.

**Méta d'édition** — chaque clé de `champs` exige sa `MetaChamp` (`{ label }` au minimum), et toute
méta sans champ correspondant est refusée. C'est le canal registre → atelier (`metaPourFichier`,
`src/data/schemas/validate.ts`) : les gardes de libellés et le CLIQUET de couverture vivent dans
`src/ui/compendium/libelles-de-champs.test.tsx` — les CHIFFRES y sont, jamais recopiés ici.

**Registres GÉNÉRÉS** — `_registry.generated.ts`, `_registry-scenes.generated.ts` et
`_ids.generated.ts`, par `node scripts/gen-registry.mjs` (`npm run gen`). Ne JAMAIS éditer à la main.
`DEFS_DE_DOCUMENT` (`src/data/schemas/validate.ts`) est l'union des deux registres.

Un def de `src/data/schemas/defs-scenes/` suit la même fabrique ; son `file` est le **chemin RELATIF à
`src/scenes`** (`arene/arene-projet.json`), jamais un basename, et les quatre defs de projet partagent
le même `projetSchema` (`src/data/schemas/defs-scenes/projet.ts`), composé des formes de scène
(`scene.ts`), de carte du monde (`worldmap.ts`) et du bloc narratif (`narratif.ts`).

**Deux portes, une vérité** (`src/data/schemas/validate.ts`) :

- `validateDataset(file, value)` — porte par **FICHIER**, pour qui connaît le nom du document. Un
  fichier NON registré est une **erreur nommée**, jamais un laissez-passer.
- `validateDocument(schema, value)` — porte par **SCHÉMA**, pour un seam SANS nom de fichier :
  `parseProject` (`src/state/worldMap.ts`) sert du JSON committé, du localStorage ET de l'import
  utilisateur. C'est là que le projet est validé — forme ET sémantiques (FK `activeAxes`, invariants
  du bloc narratif, FK intra-document `entity.presetId`, forme de `meta`).

**Portes qui font respecter le contrat :**

- `src/data/schemas/grammaire/grammaire.test.ts` — le contrat de la FABRIQUE : enveloppe, emballage
  par famille, sceau, variantes, verrous paramétrés, et le mesureur des contrats d'enveloppe requis
  qui justifie `exiges`. Les comptes vivent LÀ, à la mesure — jamais recopiés dans une doc.
- `src/data/schema-contract.test.ts` (CI/`npm test`) : (a) chaque document des deux racines valide
  son JSON réel, (b) EXHAUSTIVITÉ (tout document est registré ou dans `PENDING`), (c) CLIQUET
  (`PENDING` ne peut pas contenir un fichier déjà schématisé). `PENDING` est **vide** : tout nouveau
  document naît AVEC son def, jamais en PENDING transitoire.
- `scripts/guards/validate-data.mts` (pre-commit, `scripts/git-hooks/pre-commit.mjs`) : sur les
  `.json` STAGÉS, reparse et revalide contre `DEFS_DE_DOCUMENT` — les DEUX registres, `src/data`
  et `src/scenes` (Node/tsx, hors Vitest). **STRICT** : un document authoré des deux racines SANS
  schéma au registre est une ERREUR nommée ; un chemin hors des deux racines n'est pas de sa
  juridiction (compté à part, jamais jugé).

**Formes RÉELLES par dataset** (comparer une référence, une valeur, une enveloppe d'un document à
l'autre) : `docs/structures-donnees.md`, GÉNÉRÉ (`npm run docs:structures`).

**Geste « ajouter un document »** : créer le `.json` **et** son def (`schemas/defs/<nom>.ts` pour
`src/data`, `schemas/defs-scenes/<nom>.ts` pour `src/scenes`) — appel à `document()` plus les 4
exports plats — dans le même commit, puis `npm run gen` : sinon la garde EXHAUSTIVITÉ échoue
(orphelin ni registré ni PENDING).

## §E-ter — Les deux espaces de clés « race » (species ⇄ rig)

Deux conventions de nommage de race coexistent, **par dessein**, DÉCOUPLÉES :

- **espace « données de personnage »** (`species.refChar`/`species.refCareer`, ex. `Haut Elfe`, `Elfe
  Sylvain`) — clé de `names.json`, `careers.json`, `eyes.json`, `hairs.json`, `details.json`.
- **espace « rig »** (id d'apparence, sûr pour nom de fichier, ex. `Haut-Elfe`, `Elfe sylvain`) — id
  de `raceAppearance.json` et des defs de `src/gameIso/rig/`.

`speciesRace.json` (consommé via `baseSpeciesOf`) est le **pont UNIQUE** species→rig — 5 des 7 races
jouables sont identiques d'un espace à l'autre, seuls les elfes divergent par tiret/casse ; ce
découplage est **intentionnel** (unifier les deux espaces casserait l'un des deux clans, chacun avec
ses dizaines de fichiers). Garde : `src/data/names-species-keyspaces.test.ts` — échoue si `names.json`
dérive hors de l'espace `refChar`, si le pont species→rig cesse d'être 1:1, ou si une clé d'un espace
se met à ressembler à une clé de l'autre sans être le couple ponté sanctionné.

## §F — À COLLER DANS UN BRIEF D'AGENT « DONNÉE »

> Tu vas ajouter/curer une entrée dans `src/data/*.json`. Discipline OBLIGATOIRE :
> 1. **CHECK-FIRST** : `grep -rniE '<id>|<label>|<concept>' src/data/*.json`. Le concept vit peut-être
>    déjà dans un autre sous-système (ex. #148 : le Bélier est dans 6 fichiers). S'il existe → ne duplique
>    pas, étends-le ou re-scope.
> 2. **Bon fichier** via `docs/donnees.md` §A. Une « machine de guerre / véhicule / navire » n'est pas un
>    `trappings`. Si c'est un **sort / une créature / un effet mécanique / une icône / un livre** → utilise
>    le skill de domaine dédié (`ajouter-un-sort`/`creer-une-creature`/`ajouter-une-mecanique`/…).
> 3. **Chaque champ = Source RAW ⊕ voisins** : lis le **tableau ET son en-tête** au `Source/` (FR only ;
>    ne confonds pas une colonne « Équipe » avec « Encombrement »). `book` = `abr` de `books.json` ;
>    `page` = vraie page ; `desc` = verbatim Markdown ; formes copiées des voisins.
> 4. **Zéro invention, zéro inflexion RAW silencieuse** : un champ introuvable → omission assumée ; une
>    mécanique RAW non modélisable → **issue au gabarit #101+** ou valeur `maison` taguée, JAMAIS « hors
>    scope ».
> 5. **Vérifie** : canonicaliser via `serializeDataset`, puis `npm test` + `npm run typecheck` verts ;
>    recette navigateur si l'élément est visible au Codex/éditeur.
<!-- sources-empreinte: ab5676a98350383e722775ba238fded0d20abdd8 (378 fichiers, 2 dossiers) corps: 25b93010df54f99f717dee55c0ba3ff0fe2c6884 -->
