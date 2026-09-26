# Rendu C4a — R2 (#1473, #1463), 2026-09-24 — worktree /home/claude/game/.wt-1473-r2c3, base 61fef43d7, NON committé

## git diff --stat
```
 scripts/docs/build-codex-relations.mjs         |   6 +-
 scripts/docs/build-donnees.mjs                 |  10 +-
 scripts/docs/lib/structures-lexique.mts        |  14 +-
 scripts/gen-espaces.mts                        | 136 +++++++------
 scripts/gen-registry.mjs                       |  37 +++-
 scripts/guards/lib/bindingsVifs.mjs            |   2 +-
 src/data/ids-vivants-regime.test.ts            |  46 +++--
 src/data/index.ts                              |  29 +--
 src/data/overrides.ts                          | 248 +++++++----------------
 src/data/schemas/_ids.generated.ts             | 262 ++++++++++++-------------
 src/data/schemas/defs-scenes/scene.ts          |   2 +-
 src/data/schemas/defs/artillery-misfire.ts     |   2 +-
 src/data/schemas/defs/crew-morale.ts           |   2 +-
 src/data/schemas/defs/crew-test-types.ts       |   2 +-
 src/data/schemas/defs/criticals.ts             |  21 +-
 src/data/schemas/defs/driving-mishap.ts        |   2 +-
 src/data/schemas/defs/drunkenness.ts           |   2 +-
 src/data/schemas/defs/incidents-monture.ts     |   2 +-
 src/data/schemas/defs/land-cargo.ts            |   2 +-
 src/data/schemas/defs/mass-battle.ts           |   2 +-
 src/data/schemas/defs/miscast.ts               |   2 +-
 src/data/schemas/defs/montures.ts              |   2 +-
 src/data/schemas/defs/naval-progression.ts     |   2 +-
 src/data/schemas/defs/obsessions.ts            |   2 +-
 src/data/schemas/defs/problemes-vehicule.ts    |   2 +-
 src/data/schemas/defs/rencontres-edoc.ts       |   2 +-
 src/data/schemas/defs/river-criticals.ts       |   2 +-
 src/data/schemas/defs/river-perils.ts          |   2 +-
 src/data/schemas/defs/sea-cargo.ts             |   2 +-
 src/data/schemas/defs/sea-events.ts            |   2 +-
 src/data/schemas/defs/ship-construction.ts     |   2 +-
 src/data/schemas/defs/ship-criticals.ts        |   2 +-
 src/data/schemas/defs/structure-criticals.ts   |   2 +-
 src/data/schemas/defs/surincantation.ts        |   2 +-
 src/data/schemas/defs/vents-tourbillonnants.ts |   2 +-
 src/data/schemas/defs/weather.ts               |   2 +-
 src/data/schemas/espaces-contrat.test.ts       |  11 +-
 src/data/schemas/exposition-contrats.test.ts   |   6 +-
 src/data/schemas/exposition-derivee.ts         |  29 ++-
 src/data/schemas/grammaire/cle-d-espace.ts     |  48 ++---
 src/data/schemas/grammaire/co-descente.test.ts |   3 +-
 src/data/schemas/grammaire/collection-cle.ts   |  96 ++++++---
 src/data/schemas/grammaire/document.ts         |  22 ++-
 src/data/schemas/grammaire/grammaire.test.ts   |  31 ++-
 src/data/schemas/grammaire/idsVivants.ts       | 109 ++--------
 src/data/schemas/grammaire/ref.ts              |  20 +-
 src/data/schemas/grammaire/sourcesDeSpecs.ts   |   6 +-
 src/data/versionDataset.ts                     |   5 +-
 48 files changed, 592 insertions(+), 655 deletions(-)
```
## git status --short (après npm run gen)
```
 M scripts/docs/build-codex-relations.mjs
 M scripts/docs/build-donnees.mjs
 M scripts/docs/lib/structures-lexique.mts
 M scripts/gen-espaces.mts
 M scripts/gen-registry.mjs
 M scripts/guards/lib/bindingsVifs.mjs
 M src/data/ids-vivants-regime.test.ts
 M src/data/index.ts
 M src/data/overrides.ts
 M src/data/schemas/_ids.generated.ts
 M src/data/schemas/defs-scenes/scene.ts
 M src/data/schemas/defs/artillery-misfire.ts
 M src/data/schemas/defs/crew-morale.ts
 M src/data/schemas/defs/crew-test-types.ts
 M src/data/schemas/defs/criticals.ts
 M src/data/schemas/defs/driving-mishap.ts
 M src/data/schemas/defs/drunkenness.ts
 M src/data/schemas/defs/incidents-monture.ts
 M src/data/schemas/defs/land-cargo.ts
 M src/data/schemas/defs/mass-battle.ts
 M src/data/schemas/defs/miscast.ts
 M src/data/schemas/defs/montures.ts
 M src/data/schemas/defs/naval-progression.ts
 M src/data/schemas/defs/obsessions.ts
 M src/data/schemas/defs/problemes-vehicule.ts
 M src/data/schemas/defs/rencontres-edoc.ts
 M src/data/schemas/defs/river-criticals.ts
 M src/data/schemas/defs/river-perils.ts
 M src/data/schemas/defs/sea-cargo.ts
 M src/data/schemas/defs/sea-events.ts
 M src/data/schemas/defs/ship-construction.ts
 M src/data/schemas/defs/ship-criticals.ts
 M src/data/schemas/defs/structure-criticals.ts
 M src/data/schemas/defs/surincantation.ts
 M src/data/schemas/defs/vents-tourbillonnants.ts
 M src/data/schemas/defs/weather.ts
 M src/data/schemas/espaces-contrat.test.ts
 M src/data/schemas/exposition-contrats.test.ts
 M src/data/schemas/exposition-derivee.ts
 M src/data/schemas/grammaire/cle-d-espace.ts
 M src/data/schemas/grammaire/co-descente.test.ts
 M src/data/schemas/grammaire/collection-cle.ts
 M src/data/schemas/grammaire/document.ts
 M src/data/schemas/grammaire/grammaire.test.ts
 M src/data/schemas/grammaire/idsVivants.ts
 M src/data/schemas/grammaire/ref.ts
 M src/data/schemas/grammaire/sourcesDeSpecs.ts
 M src/data/versionDataset.ts
?? src/data/racines-vivantes.test.ts
?? src/data/schemas/_cles-de-dataset.generated.ts
?? src/data/schemas/_racines-vivantes.generated.ts
```
Arbre principal /home/claude/game : `git status --short` → 0 ligne(s) (aucune fuite).

## Preuve 1 — D4, garde d'identité (src/data/racines-vivantes.test.ts)
Cas asserté dans le test : { racine: 68, niche: 54, objet: 12 } ; mutation :
```
== MUTATION D4 (reprise, ligne 145 seule) : binding species de ARRAYS remplacé par une copie
39ca5ab3919378fc6300338fd429471837331c04c6e4983e3661ab318c38e54b  src/data/overrides.ts
da983b9d2dc5a5c1f35dd2230996b1fda16d3732
145:  characteristics, species: [...species], classes, careers, careerLevels, skills, talents, etats, maladies, traits,
exit rouge=1
   × CLÉS DE DATASET — le binding de la couche donnée EST la collection de la racine vivante > pour chaque clé, `datasetArray`/`datasetObject` === `collectionDuDataset`, par cas de route 30ms
     → expected [ 'species (species.json)' ] to deeply equal []
 FAIL  src/data/racines-vivantes.test.ts > CLÉS DE DATASET — le binding de la couche donnée EST la collection de la racine vivante > pour chaque clé, `datasetArray`/`datasetObject` === `collectionDuDataset`, par cas de route
AssertionError: expected [ 'species (species.json)' ] to deeply equal []
+   "species (species.json)",
      Tests  1 failed | 3 passed (4)
39ca5ab3919378fc6300338fd429471837331c04c6e4983e3661ab318c38e54b  src/data/overrides.ts
da983b9d2dc5a5c1f35dd2230996b1fda16d3732
exit vert=0
 Test Files  1 passed (1)
      Tests  4 passed (4)
```
(Une première tentative de mutation par sed avait touché aussi la ligne d'import 15 → erreur de syntaxe, non comptée ; fichier revenu à la même empreinte 39ca5ab3…/da983b9d…, puis reprise sur la seule ligne 145, ci-dessus.)

## Preuve 2 — D5, garde d'égalité vivant = généré
```
== MUTATION D5 : le régime vivant trie ses ids (lecteur divergent de la phase 2)
39ca5ab3919378fc6300338fd429471837331c04c6e4983e3661ab318c38e54b  src/data/overrides.ts
da983b9d2dc5a5c1f35dd2230996b1fda16d3732
365:      return lecture && ('ids' in lecture ? { ids: new Set([...lecture.ids].sort()) } : lecture);
exit rouge=1
   × RÉGIME VIVANT — chaque espace de l’index se lit sur les racines vivantes, à l’identique > pour chaque clé d’`IDS_PAR_ESPACE`, le régime vivant rend la même liste, dans le même ordre 272ms
AssertionError: expected [ 'actions.json', …(128) ] to deeply equal []
      Tests  1 failed | 3 passed (4)
39ca5ab3919378fc6300338fd429471837331c04c6e4983e3661ab318c38e54b  src/data/overrides.ts
da983b9d2dc5a5c1f35dd2230996b1fda16d3732
exit vert=0
 Test Files  1 passed (1)
      Tests  4 passed (4)
```
## Preuve 3 — D5, écart d'ordre de _ids.generated.ts
```
avant npm run gen : b0666b18b6026d89792043f1649a2dedcfa1b421dce170f94c8f12a88f769fb8  src/data/schemas/_ids.generated.ts
après npm run gen : 012ea1ad31d29b3886999957110bf6cba18f58d7e5a78bfacfcb382e1acee8a5  src/data/schemas/_ids.generated.ts
clés avant 358 après 358 mêmes clés dans le même ordre : true
ordre changé (ensemble égal, 55 ids, premier aid-team → attaque) : actions.json
ordre changé (ensemble égal, 63 ids, premier accomplir-un-rituel → plein-air) : activities.json
ordre changé (ensemble égal, 15 ids) : advancementCosts.json
ordre changé (ensemble égal, 5 ids, premier demeure-de-l-amour → demeure-du-sens) : astrology.json
ordre changé (ensemble égal, 9 ids, premier discretion → social) : axes.json
ordre changé (ensemble égal, 30 ids, premier altdorf-couronne-de-l-empire → livre-de-base) : books.json
ordre changé (ensemble égal, 6 ids, premier corrosif → feu) : breath-types.json
ordre changé (ensemble égal, 6 ids, premier geheimnistag → hexenstag) : calendarIntercalary.json
ordre changé (ensemble égal, 12 ids, premier brauzeit → nachhexen) : calendarMonths.json
ordre changé (ensemble égal, 7 ids, premier apresmidi → aube) : calendarPhases.json
ordre changé (ensemble égal, 8 ids, premier angestag → wellentag) : calendarWeekdays.json
ordre changé (ensemble égal, 432 ids) : careerLevels.json
ordre changé (ensemble égal, 108 ids) : careers.json
ordre changé (ensemble égal, 19 ids, premier agilite → capacite-de-combat) : characteristics.json
ordre changé (ensemble égal, 37 ids, premier act-gate → combat-end-disease) : combat-stakes.json
ordre changé (ensemble égal, 493 ids, premier affreuse-vieille-sorciere-troll-des-marais → humain) : creatures.json
ordre changé (ensemble égal, 9 ids, premier artilleur → capitaine) : crew-roles.json
ordre changé (ensemble égal, 8 ids, premier criticals-aa-bras → criticals-ldb-tete) : criticals.json
ordre changé (ensemble égal, 4 ids, premier electrique → poison) : damage-types.json
ordre changé (ensemble égal, 435 ids, premier arcaneFonce → ombre) : decorPalette.json
ordre changé (ensemble égal, 20 ids, premier bete → feu) : domains.json
ordre changé (ensemble égal, 18 ids, premier bete → feu) : domains.json?arcane
ordre changé (ensemble égal, 9 ids, premier bete → feu) : domains.json?wind
ordre changé (ensemble égal, 21 ids, premier a-terre → assourdi) : etats.json
ordre changé (ensemble égal, 10 ids) : eyes.json
ordre changé (ensemble égal, 34 ids, premier appraise-detect → fall-choice) : flow-stakes.json
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : groups.json
ordre changé (ensemble égal, 10 ids, premier auburn → blond-blanc) : hairs.json
ordre changé (ensemble égal, 31 ids) : interludeEvents.json
ordre changé (ensemble égal, 7 ids) : lieux-services.json
ordre changé (ensemble égal, 5 ids, premier couvert → jour) : lightLevels.json
ordre changé (ensemble égal, 4 ids, premier chandelle → flamme) : lightTones.json
ordre changé (ensemble égal, 55 ids, premier altdorf → reikland) : locations.json
ordre changé (ensemble égal, 18 ids, premier blessure-purulente → infection-mineure) : maladies.json
ordre changé (ensemble égal, 20 ids) : maneuvers.json
ordre changé (ensemble égal, 15 ids, premier albatre → bois-chene) : materials.json
ordre changé (ensemble égal, 8 ids, premier albatre → bois-chene) : materials.json?domain=prop
ordre changé (ensemble égal, 3 ids, premier pierre → terre) : materials.json?domain=relief
ordre changé (ensemble égal, 4 ids, premier chaume → tuile) : materials.json?domain=roof
ordre changé (ensemble égal, 7 ids, premier ammo → melee) : merchantFamilies.json
ordre changé (ensemble égal, 5 ids, premier miscast-colere → miscast-mineure) : miscast.json
ordre changé (ensemble égal, 17 ids, premier edoc-mental-khorne → physique) : mutationTables.json
ordre changé (ensemble égal, 116 ids, premier accro-a-l-adrenaline → pattes-d-animaux) : mutations.json
ordre changé (ensemble égal, 7 ids, premier elfe-sylvain → humain) : names.json
ordre changé (ensemble égal, 39 ids, premier aarnau → l-anguille) : naval-ports.json
ordre changé (ensemble égal, 27 ids, premier allegement → cale) : naval-traits.json
ordre changé (ensemble égal, 15 ids, premier contagion → faim) : night-stakes.json
ordre changé (ensemble égal, 8 ids, premier 10-a-votre-action-au-prochain-round → vous-vous-blessez-en-attaquant-perdez-1-blessure-ignore-be-pa) : oups.json
ordre changé (ensemble égal, 10 ids, premier a-present-c-est-utile → voyage-reposant) : peripeties.json
ordre changé (ensemble égal, 8 ids, premier aelindra-feuille-d-argent → sigmund-reikhardt) : pregens.json
ordre changé (ensemble égal, 99 ids, premier activityPane → screenShell) : primitives.manifest.json
ordre changé (ensemble égal, 123 ids, premier abreuvoir → feu-camp) : props.json
ordre changé (ensemble égal, 39 ids, premier applique-murale → pupitre-chef) : props.json?volume
ordre changé (ensemble égal, 9 ids, premier amour → frenesie) : psychology.json
ordre changé (ensemble égal, 59 ids) : qualities.json
ordre changé (ensemble égal, 12 ids, premier 4e/bestiaire#catalogue-du-bestiaire → 4e/combat#conversion-combat-poursuite) : raw.manifest.json
ordre changé (ensemble égal, 86 ids, premier activites-en-mer → encombrement) : regles.json
ordre changé (ensemble égal, 87 ids, premier advancement-career-jump → test-auto-bands) : reglesOptionnelles.json
ordre changé (ensemble égal, 15 ids, premier auberge-relais → route-imperiale) : reseau-routier.json
ordre changé (ensemble égal, 7 ids, premier camarades-d-equipage-rassemblez-vous → naviguons-tous-ensemble) : sea-shanties.json
ordre changé (ensemble égal, 5 ids, premier avirons → pont) : ship-stations.json
ordre changé (ensemble égal, 7 ids, premier enorme → minuscule) : sizes.json#rangedMod
ordre changé (ensemble égal, 48 ids) : skills.json
ordre changé (ensemble égal, 13 ids, premier boucherie → calligraphie) : skills.json#[art].specs
ordre changé (ensemble égal, 12 ids) : skills.json#[chevaucher].specs
ordre changé (ensemble égal, 20 ids, premier anecdotes-militaires → chant) : skills.json#[divertissement].specs
ordre changé (ensemble égal, 9 ids) : skills.json#[dressage].specs
ordre changé (ensemble égal, 20 ids, premier bete → feu) : skills.json#[focalisation].specs
ordre changé (ensemble égal, 22 ids) : skills.json#[langue].specs
ordre changé (ensemble égal, 53 ids) : skills.json#[metier].specs
ordre changé (ensemble égal, 10 ids) : skills.json#[projectiles].specs
ordre changé (ensemble égal, 11 ids) : skills.json#[representation].specs
ordre changé (ensemble égal, 81 ids) : skills.json#[savoir].specs
ordre changé (ensemble égal, 18 ids, premier chasseur → eclaireur) : skills.json#[signes-secrets].specs
ordre changé (ensemble égal, 27 ids, premier elfes-sylvains → humains-reiklander) : species.json
ordre changé (ensemble égal, 526 ids, premier abondance-de-rhya → benediction-de-bataille) : spells.json
ordre changé (ensemble égal, 347 ids, premier agression-aethyrique → arme-aethyrique) : spells.json?family=arcane
ordre changé (ensemble égal, 26 ids) : spells.json?family=chaos
ordre changé (ensemble égal, 101 ids, premier abondance-de-rhya → encalmine) : spells.json?family=invocation
ordre changé (ensemble égal, 32 ids) : spells.json?family=mineure
ordre changé (ensemble égal, 23 ids, premier cackelfax-le-coq → wymund-l-anachorete) : stars.json
ordre changé (ensemble égal, 6 ids, premier explosion → moteur-broute) : steam-breakdown.json
ordre changé (ensemble égal, 18 ids, premier cloison-basse-a-ossature-en-bois → plain) : structureAppearance.json
ordre changé (ensemble égal, 24 ids, premier barge-moyenne → porte) : structures.json
ordre changé (ensemble égal, 18 ids, premier blesse → fievre) : symptoms.json
ordre changé (ensemble égal, 16 ids, premier bataille-masse → combat) : systemes.manifest.json
ordre changé (ensemble égal, 21 ids, premier allure-demoniaque-indivisible → mendier-ennuis) : tables.json
ordre changé (ensemble égal, 187 ids, premier acrobaties-equestres → talent-aleatoire) : talents.json
ordre changé (ensemble égal, 9 ids, premier deserts → littoral) : talents.json#[bon-marcheur].specs
ordre changé (ensemble égal, 7 ids, premier camarades-d-equipage-rassemblez-vous → naviguons-tous-ensemble) : talents.json#[chanson-de-marin].specs
ordre changé (ensemble égal, 13 ids, premier ennemis-d-ulric → heretiques) : talents.json#[haine].specs
ordre changé (ensemble égal, 20 ids, premier bete → feu) : talents.json#[magie-des-arcanes].specs
ordre changé (ensemble égal, 46 ids) : talents.json#[maitre-artisan].specs
ordre changé (ensemble égal, 29 ids) : talents.json#[sans-peur].specs
ordre changé (ensemble égal, 54 ids) : talents.json#[savant].specs
ordre changé (ensemble égal, 21 ids, premier armee → criminels) : talents.json#[savoir-vivre].specs
ordre changé (ensemble égal, 5 ids, premier gout → ouie) : talents.json#[sens-aiguise].specs
ordre changé (ensemble égal, 45 ids) : talents.json#[travailleur-qualifie].specs
ordre changé (ensemble égal, 4 ids) : talents.json#[vice].specs
ordre changé (ensemble égal, 13 ids) : tavernGames.json
ordre changé (ensemble égal, 29 ids, premier anneau-actif → zone-marche) : teintesJeu.json
ordre changé (ensemble égal, 132 ids) : traits.json
ordre changé (ensemble égal, 79 ids) : traits.json#[a-distance].specs
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : traits.json#[amour].specs
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : traits.json#[animosite].specs
ordre changé (ensemble égal, 65 ids, premier ahlspiess → baton-de-combat) : traits.json#[arme].specs
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : traits.json#[camaraderie].specs
ordre changé (ensemble égal, 18 ids, premier blessure-purulente → infection-mineure) : traits.json#[contagieux].specs
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : traits.json#[effraye].specs
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : traits.json#[haine].specs
ordre changé (ensemble égal, 4 ids, premier electrique → poison) : traits.json#[immunite].specs
ordre changé (ensemble égal, 20 ids, premier bete → feu) : traits.json#[lanceur-de-sorts].specs
ordre changé (ensemble égal, 18 ids, premier blessure-purulente → infection-mineure) : traits.json#[maladie].specs
ordre changé (ensemble égal, 116 ids, premier accro-a-l-adrenaline → pattes-d-animaux) : traits.json#[mutation].specs
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : traits.json#[phobie].specs
ordre changé (ensemble égal, 38 ids, premier bailli → humain) : traits.json#[prejuge].specs
ordre changé (ensemble égal, 6 ids, premier corrosif → feu) : traits.json#[souffle].specs
ordre changé (ensemble égal, 7 ids, premier enorme → minuscule) : traits.json#[taille].specs
ordre changé (ensemble égal, 441 ids, premier acide-de-troll → baton-de-combat) : trappings.json
ordre changé (ensemble égal, 22 ids, premier balle-crache-plomb → carreau) : trappings.json?categorie=ammunition
ordre changé (ensemble égal, 17 ids, premier armure-de-plates-du-leviathan → calotte-de-cuir) : trappings.json?categorie=armor
ordre changé (ensemble égal, 65 ids, premier ahlspiess → baton-de-combat) : trappings.json?categorie=melee
ordre changé (ensemble égal, 79 ids) : trappings.json?categorie=ranged
ordre changé (ensemble égal, 258 ids, premier acide-de-troll → baril) : trappings.json?categorie=trapping
ordre changé (ensemble égal, 29 ids, premier amputation-plaie → dechirure-jambe-mineure) : traumas.json
ordre changé (ensemble égal, 31 ids, premier barge → diligence) : vehicles.json
ordre changé (ensemble égal, 42 ids, premier crew-affaler → river-control-repair) : voyage-stakes.json
ordre changé (ensemble égal, 38 ids, premier animaux-et-vehicules → armes-d-hast) : weaponGroups.json
ordre changé (ensemble égal, 10 ids) : weaponGroups.json?combat=ranged
{
  clesCommunes: 358,
  ordreChange: 129,
  premierChange: 101,
  ensembleDifferent: 0
}
```
## Preuve 4 — D8, garde des suites de niche
```
== MUTATION D8 : la suite de la catégorie weather déclarée 'saisons' au lieu de 'seasons'
b250303c766e2b2a52e46014cc71acf523160527f22c2b74434ef66c46302880  src/data/schemas/defs/weather.ts
334ae4c3a5529876c8cbbcd743f65a48f044ee33
96:    edit: { niche: { categories: { weather: 'saisons', weatherConditions: 'conditions' } } },
exit rouge=1
   × CLÉS DE DATASET — le binding de la couche donnée EST la collection de la racine vivante > pour chaque clé, `datasetArray`/`datasetObject` === `collectionDuDataset`, par cas de route 23ms
     → collectionALaCle : « saisons » ne mène à aucune collection à clé du schéma.
   × `niche.categories` — chaque suite mène à une collection marquée du JSON disque > les 54 catégories nichées 15ms
Error: collectionALaCle : « saisons » ne mène à aucune collection à clé du schéma.
AssertionError: expected [ Array(1) ] to deeply equal []
+   "weather → weather.json#saisons : collectionALaCle : « saisons » ne mène à aucune collection à clé du schéma.",
      Tests  2 failed | 2 passed (4)
b250303c766e2b2a52e46014cc71acf523160527f22c2b74434ef66c46302880  src/data/schemas/defs/weather.ts
334ae4c3a5529876c8cbbcd743f65a48f044ee33
exit vert=0
 Test Files  1 passed (1)
      Tests  4 passed (4)
```
## Preuve 5 — D12, DATASET_FICHIER_DERIVE
```
avant (sonde sonde-niches.mts, arbre 61fef43d7) : DATASET_FICHIER_DERIVE 122
après : DATASET_FICHIER_DERIVE 134
```
## Preuve 6 — morts de C4a
```
$ git grep -nwE 'NESTED_ARRAY_ROOT|OBJECT_FILE|idsSurLaRacine|specsVivantesDe|memoSpecs|specsDesSources|SourceDIdsVivants' -- src scripts ':!scripts/migrations'
exit=1 (1 = aucune ligne)
NESTED_ARRAY_ROOT : 0
OBJECT_FILE : 0
idsSurLaRacine : 0
specsVivantesDe : 0
memoSpecs : 0
specsDesSources : 0
SourceDIdsVivants : 0
```
## Preuve 7
```
typecheck:fast exit=0
vitest exit=0
gen exit=0

> warhammer-v4-rpg@0.1.0 typecheck:fast
> node scripts/typecheck-fast.mjs

typecheck:fast — 0 erreur(s)
sortie complète : /home/claude/game/.wt-1473-r2c3/node_modules/.cache/typecheck-last.txt
mode incrémental — au doute : npm run typecheck (full)
 ✓ src/data/schemas/grammaire/grammaire.test.ts (103 tests) 1683ms
 ✓ src/comment-poison-guard.test.ts (75 tests) 2757ms
 ✓ src/data/schemas/grammaire/co-descente.test.ts (25 tests) 142ms
 ✓ src/data/schemas/exposition-contrats.test.ts (12 tests) 273ms
 ✓ src/data/schemas/grammaire/collection-cle.test.ts (19 tests) 479ms
 ✓ src/data/index-vif-guard.test.ts (14 tests) 5411ms
 ✓ src/data/schemas/grammaire/pool-specs.test.ts (5 tests) 75ms
 ✓ src/data/ids-vivants-regime.test.ts (8 tests) 45ms
 ✓ src/data/racines-vivantes.test.ts (4 tests) 313ms
 ✓ src/data/schemas/espaces-contrat.test.ts (13 tests) 3075ms
 ✓ src/data/seam-ecriture-guard.test.ts (6 tests) 9061ms
 Test Files  11 passed (11)
      Tests  284 passed (284)
gen-registry: RACINES_VIVANTES ← 124 fichiers (src/data/schemas/defs) [inchangé]
gen-espaces: IDS_PAR_ESPACE ← 7085 ids / 358 espaces (src/data/schemas/_ids.generated.ts), CLES_DE_DATASET ← 134 clés (src/data/schemas/_cles-de-dataset.generated.ts) [inchangé]
```

## Tests supplémentaires joués (fichiers, pas la suite)
```
 Test Files  25 passed (25)
      Tests  491 passed (491)
 Test Files  13 passed (13)
      Tests  310 passed (310)
(v3 : 25 fichiers — dataset-save-parse, overrides, spec-pool-contrat, trait-args-derived, refs-migrated, parse-de-mesure, gen-registry-lecteur, ids-vivants, codex-edit-save-transaction, validateEntry, character, spec-hors-pool, spawn-skill-choix, schema-contract, versionDataset, fraicheur-datasets, meteo-codex-vif, creation, registry, relations, materials-fraicheur, validateScene-contenu, codex-edit-ancrage, weather-completude, buildings-catalogue ; v4 : 13 fichiers — comment-poison-guard, slots-contrat, structures-contrat, lecture-def-zod-guard, axes-integrity, spec-pool-contrat, saves-flow, spec-hors-pool, criticals, codex-edit-charge-discriminee, GameOpEditor, config-id-unique, livres-recopies-guard)
```

## Reportés de C3 : lecteur de production ou mort
- `collectionALaCle` (collection-cle.ts:324) : lecteur de production `collectionDuDataset` (overrides.ts:337). Son corps est `atteindre` (collection-cle.ts:296), qui rend `undefined` au lieu de lever ; `lectureDeLEspace` (collection-cle.ts:347, lecteurs : gen-espaces.mts:89 via `idsDeLEspace`, overrides.ts:364) le lit.
- `pasDeLaSuite` (cle-d-espace.ts:41) : lecteur de production `atteindre` et `lectureDeLEspace` (collection-cle.ts).
- `chemin` (champ de `CollectionDuDocument`) : MORT, aucun lecteur (build-structures ne lit que `length` et `marque.espace`).

## build-structures avant / après (`node --import tsx scripts/docs/build-structures.mts --check`, `--cpu-prof`)
Mur (processus entier, 3 passes) : avant 5675 / 5962 / 6049 ms (exit 0) ; après 7624 / 9305 / 7175 ms (exit 1 : docs/structures-donnees.md périmé par les 3 entrées de lexique ajoutées, décalage de 3 lignes → « 4229 autres lignes divergentes » ; l'impression du diff compte dans le mur). Profil, temps inclusif :
```
AVANT
== CPU.20260924.111032.30070.0.001.cpuprofile total 6490 ms
  3610 ms incl     32 self  (anon) docs/build-structures.mts
  1213 ms incl      3 self  scanDuCorpus lib/structures-scan.mts
  1102 ms incl    499 self  (anon) grammaire/descente.ts
  1065 ms incl    112 self  (anon) grammaire/collection-cle.ts
  1058 ms incl      3 self  coDescendre grammaire/descente.ts
  1058 ms incl      0 self  coDescendreLesCollections grammaire/collection-cle.ts
  1058 ms incl      0 self  collectionsDuDocument grammaire/collection-cle.ts
  1058 ms incl      0 self  collectionsDesDocuments grammaire/collection-cle.ts
  1039 ms incl     14 self  (anon) lib/slots-registre.mts
  1023 ms incl      1 self  slotsDuParse lib/slots-registre.mts
  1021 ms incl      3 self  slotsDuDocument lib/slots-registre.mts
  1006 ms incl      7 self  mesureDuParse grammaire/ref.ts
  1006 ms incl      0 self  reperesDuParse grammaire/ref.ts
APRÈS
== CPU.20260924.112837.31976.0.001.cpuprofile total 6306 ms
  3591 ms incl     28 self  (anon) docs/build-structures.mts
  1282 ms incl      6 self  scanDuCorpus lib/structures-scan.mts
  1026 ms incl    438 self  (anon) grammaire/descente.ts
  1024 ms incl      6 self  (anon) lib/slots-registre.mts
  1015 ms incl    102 self  (anon) grammaire/collection-cle.ts
  1009 ms incl      0 self  collectionsDesDocuments grammaire/collection-cle.ts
  1009 ms incl      1 self  slotsDuParse lib/slots-registre.mts
  1008 ms incl      0 self  coDescendreLesCollections grammaire/collection-cle.ts
  1008 ms incl      0 self  collectionsDuDocument grammaire/collection-cle.ts
  1008 ms incl      2 self  slotsDuDocument lib/slots-registre.mts
  1007 ms incl      3 self  coDescendre grammaire/descente.ts
   992 ms incl      1 self  reperesDuParse grammaire/ref.ts
   991 ms incl      4 self  mesureDuParse grammaire/ref.ts
```
Cause de l'écart 1260/717 ms de C3, lue au profil : `build-structures.mts:172` co-descend les 128 documents (`collectionsDesDocuments`, ~1010-1060 ms inclusifs) pour n'imprimer que deux compteurs (664 collections, 309 espaces), EN PLUS du parse de mesure des slots (`slotsDuParse` → `mesureDuParse`, ~1000 ms) que le scan garde ; dans la co-descente, `pasDeDonnee` (560 ms) rappelle `enfantsDe` (~400 ms) à chaque point de donnée, sans mémo par nœud de schéma. C4a ne change pas ce coût (1058 → 1008 ms). Non corrigé ici (le scan est C5/D9 ; un mémo d'`enfantsDe` toucherait `descente.ts`, hors du découpage C4a).

## Questions
1. **Coût de `RACINES_VIVANTES` au bundle (Question 2 du design).** Méthode : `esbuild --bundle` du module généré (entrées : 124 `.json` + le module, aucun autre `.ts`) ; pour chaque fichier, `git grep` à HEAD d'un import par un module d'app (hors tests et `_*.generated`). Fichiers que l'app n'importait pas : `donnees.manifest.json` (25 668 o), `primitives.manifest.json` (42 207), `progression-schemas.derived.json` (159 277), `raw.manifest.json` (2 465), `systemes.manifest.json` (7 013) — 5 fichiers, 236 630 o bruts ; bundlés ensemble et minifiés : 124 574 o, 26 622 o gzip. Ils entrent dans tout chunk qui charge `overrides.ts`. Ce sont des manifestes d'outillage (lus par scripts/docs) déclarés par des defs : le design exclut toute liste d'exclusion, je n'en ai posé aucune. Pas de `vite build` joué (mesure statique).
2. **`idsDeCollection` dans `cle-d-espace.ts` sans cycle ?** Oui. `cle-d-espace.ts:13` n'importe que `import type { MarqueDeCollection } from './collection-cle'`, effacé. Sonde esbuild `--bundle` : entrées du bundle de `cle-d-espace.ts` = `[ 'src/data/schemas/grammaire/cle-d-espace.ts' ]` ; de `idsVivants.ts` = `[ 'src/data/schemas/grammaire/idsVivants.ts' ]` (feuille, 0 import).
3. **`specPoolOf` et le `pool`.** `specPoolOf` (index.ts:3503) lit `SPEC_SOURCES[…].pool()`, dont la ligne est index.ts:3492 : `pool: () => [...(lireLEspace(decl.pool ?? decl.univers) ?? [])],` (et `resolves`, index.ts:3494 : `lireLEspace(decl.univers)?.has(id) ?? false`).
4. **Lecteurs d'`IDS_PAR_ESPACE`/`lireLEspace` qui supposaient un tri** : aucun. Lecteurs relevés : `parse-de-mesure.test.ts:21-24` et `refs-migrated.test.ts:1272` prennent `[0]` comme id d'exemple (n'importe lequel convient) ; `buildings-catalogue.test.ts:90` `.find` ; `pool-specs.test.ts:56` trie lui-même ; `espaces-contrat.test.ts:132` compare `indexDesIds().table` à l'index (même calcul) ; production : `SPEC_SOURCES.pool()` (index.ts:3492) lisait déjà l'ordre de la donnée (`idsSurLaRacine`) — `free[0]` de `character.ts:156` inchangé. Rien modifié à ce titre.

## Écarts design / code, et ce que j'en ai fait
- **D5, `specCatalogOf` : point FAUX, arrêté, non fait.** Le design dit « `specResolves` et `specCatalogOf` lisent l'espace `cleDesSpecs(espaceDe(type), def.id)` ». Pour une entrée à `specsSource`, l'espace est l'UNIVERS ; `specCatalogOf` rend le POOL (index.ts:3512-3513), et `refFormatLivre.ts:20-21` en fait un contrat (« ce qui est ÉNUMÉRABLE (`specCatalogOf`) est un SOUS-ENSEMBLE de ce qui est VALIDE (`specResolves`) quand la def désigne une `specsSource` »). Le lire sur l'espace changerait ce que le Codex imprime (registry.ts:303) et le round-trip libellé→id (character.ts:73, refFormatLivre.ts:30). `specResolves` sur l'espace serait sémantiquement égal (univers, ou tous les `specs[]` dont `pool: false`) mais exige un changement de signature (type + id) sur 4 appelants de production et 12 de test ; laissé avec `specCatalogOf`, le point du design étant un seul. La règle « specsSource → univers, sinon specs[] » reste donc écrite dans `lectureDeLEspace` (collection-cle.ts:347) ET dans `specResolves`/`specCatalogOf`/`specPoolOf` (index.ts:3503-3521).
- **D5, « la version d'un espace est `memoParVersion` des clés de dataset de son fichier »** : incomplet pour un espace à `specsSource`, dont les ids vivent dans le fichier de l'univers. Réglé sans variante de mémo : le mémo met en cache la LECTURE (`{ ids }` ou `{ univers }`, `lectureDeLEspace`), datée par les clés du fichier de la clé ; l'univers se lit à SA propre lecture, datée par son fichier (overrides.ts:360-371). `idsDeLEspace` = `lectureDeLEspace` + suite de l'univers (collection-cle.ts:376).
- **`lectureDeLEspace` rend `undefined` (espace inexistant) au lieu de lever** quand la suite ne mène à aucune collection marquée, quand la collection n'est pas marquée `espace`, ou quand le filtre n'est pas un paramètre de la marque : `catalogueSpecs` (ref.ts:155) interroge `<espace>#[id].specs` pour tout type, et `entreeOuverte` (ref.ts:165) `?specsOpen` sur des espaces qui ne le déclarent pas ; lever là casserait `lireLEspace`. `collectionALaCle` garde la levée (D2).
- **Phase 2, énumération des espaces à `specsSource`** (gen-espaces.mts:71) : lit la PRÉSENCE du champ `specsSource` pour nommer la clé candidate ; la résolution (univers, erreurs « inconnue », « specs ET specsSource ») vit dans `lectureDeLEspace`. Les espaces à `specsSource` sont désormais cherchés dans toute liste marquée `espace`, plus seulement à la racine (même résultat : 358 clés avant et après).
- **D8 et `defs/sea-events.ts` (#1939, hors périmètre du design)** : touché d'une seule ligne (sa carte `niche.categories`), D8 exigeant la carte sur les 54 clés.
- **D6, trois cas de `collectionDuDataset`** : la suite par clé est dérivée dans `exposition-derivee.ts` (`DATASET_SUITE_DERIVE`, `''` pour `dataset`/`none`+`dataset`, la suite de `niche.categories`, absente pour `object`).
- **`datasetSerializeRoot` et `datasetObjectSerializeRoot`** ont désormais le même corps `versDisque(RACINES_VIVANTES[DATASET_FICHIER_DERIVE[key]])` (overrides.ts:386-395) : duplication de transition, l'unification (« UNE racine de sérialisation ») est la puce écrivain de D6, C4b.
- `ref.ts` : la fonction privée homonyme `idsDeLEspace(cle, site)` renommée `idsDesignes` (ref.ts:104), pour ne pas doubler le nom exporté par `collection-cle.ts`.
- `index.ts` : `massBattleData` (lecteur unique : `NESTED_ARRAY_ROOT`) et `RACINE_DE_SOURCE` morts ; `cle-d-espace.ts` : `FichierDe`/`fichierDe` morts (lecteurs : `DatasetDeSource`, mort, et `RACINE_DE_SOURCE`) ; `retenuParFiltre` devient privé.
- Poison corrigé dans le périmètre : commentaires « LOT 1 #422 … `NESTED_ARRAY_ROOT` réécrit le PARENT », en-tête d'`overrides.ts`, doc-comment d'`OBJECTS` (`OBJECT_FILE`), en-tête d'`idsVivants.ts`, `document.ts:122-125`, regex locale de lecture de suite dans `espaces-contrat.test.ts:79` (remplacée par `pasDeLaSuite`/`baseDe`).
- Incident : un `node -e "import('scripts/docs/build-donnees.mjs')"` lancé pour un contrôle de syntaxe ; `git status` ensuite : aucun fichier de `docs/` écrit.

## Lexique (scripts/docs/lib/structures-lexique.mts, `TERMES_COLLECTION_A_CLE`) — entrées créées ou modifiées, verbatim
```
-    'l’INDEX DES IDS généré (`src/data/schemas/_ids.generated.ts`, `scripts/gen-espaces.mts`, phase 2 de `npm run gen`) : clé d’espace → ids, relevé par la co-descente du JSON disque (`collectionsDuDocument`), sans parse — un espace neuf et son premier désignateur entrent dans le même commit. Une entrée à `specsSource` y a pour espace de ses `specs` l’univers de sa source (`grammaire/sourcesDeSpecs.ts`).',
+    'l’INDEX DES IDS généré (`src/data/schemas/_ids.generated.ts`, `scripts/gen-espaces.mts`, phase 2 de `npm run gen`) : clé d’espace → ids, dans l’ORDRE DE LA DONNÉE, par `idsDeLEspace` (`src/data/schemas/grammaire/collection-cle.ts`) sur le JSON disque co-descendu, sans parse — un espace neuf et son premier désignateur entrent dans le même commit. Une entrée à `specsSource` y a pour espace de ses `specs` l’univers de sa source (`grammaire/sourcesDeSpecs.ts`).',
+  ],
+  [
+    'racine vivante',
+    'la racine d’un document de `src/data` en mémoire : le module JSON singleton que la façade et le moteur importent, et que le seam mute EN PLACE ; `RACINES_VIVANTES` (`src/data/schemas/_racines-vivantes.generated.ts`, phase 1 de `npm run gen`) la donne par fichier, un import statique par `file` des defs. Ce que le save sérialise, et ce que le régime vivant navigue le long d’une clé d’espace.',
+  ],
+  [
+    'régime vivant',
+    'le second régime de lecture des ids (`src/data/schemas/grammaire/idsVivants.ts`) : les ids d’un espace calculés sur les racines vivantes par le calcul de la phase 2 (`idsDeLEspace`), posé par la couche donnée (`src/data/overrides.ts`) et daté par la version des clés de dataset du fichier (`memoParVersion`) — une entité créée ou renommée à l’atelier est référençable avant tout `npm run gen`. Sans régime posé (scripts, gardes), l’INDEX DES IDS généré fait foi.',
+  ],
+  [
+    'clé de dataset',
+    'le nom d’une collection que le seam de `src/data/overrides.ts` mute EN PLACE : `CLES_DE_DATASET` / `CleDeDataset` (`src/data/schemas/_cles-de-dataset.generated.ts`, phase 2 de `npm run gen`), le domaine de `DATASET_FICHIER_DERIVE` (`src/data/schemas/exposition-derivee.ts`). `collectionDuDataset` l’atteint sur la racine vivante de son fichier : liste de racine (route `dataset`, `none` + `dataset`), collection au bout de la suite de `niche.categories`, ou la racine elle-même (route `object`).',
```
Synonymes migrés : « régime vif » → « régime vivant » (ids-vivants-regime.test.ts, en-tête et 4 `describe` ; defs-scenes/scene.ts:178 ; document.ts:122-125) ; « source vive » → « source vivante » (bindingsVifs.mjs:405). Non migré : `src/state/sea-voyage-flow.test.ts:142` « la MÊME source vive après un soin » (jauge de coque d'un écran, autre concept que la source des ids ; à trancher par l'orchestrateur). « binding vif », `index-vif-guard.test.ts`, « seam d'édition » : C4b/D7 comme dit au brief (overrides.ts:111 « seam d'édition » intact).

## Pas fait, nommé
- D5 `specResolves`/`specCatalogOf` sur l'espace (voir Écarts : point faux pour `specCatalogOf`).
- `docs/*.md` générés NON régénérés (interdit ici) : `docs/structures-donnees.md` (3 entrées de lexique, texte `IDS_PAR_ESPACE`), `docs/donnees.md` (texte des registres générés, carte `niche`), `docs/codex-relations.md` (texte `niche.categories`) et tout pied `sources-empreinte` touché → `docs:build` à la charge du train.
- Mémo d'`enfantsDe` (cause du coût de build-structures) : non fait, hors C4a.
- C4b entier (écrivain unique, `CodexEdit`, `mode: 'record'`, types des bindings, renommage `DatasetKey`/`ObjectDatasetKey`/`DATASET_KEYS`, D7). `CleDeDataset` généré (`_cles-de-dataset.generated.ts`) et `DatasetKey | ObjectDatasetKey` coexistent ; `versionDataset.ts` lit déjà le type généré ; `racines-vivantes.test.ts` asserte l'égalité des deux domaines (134).
- Gates du train (lint, deps:unused, docs:check, suite, typecheck complet) : non joués. Risque `deps:unused` à surveiller : `collectionDuDataset` n'a de lecteur que de test jusqu'à C4b ; `LectureDEspace` exporté, lu seulement dans son module.

## Fichiers neufs
- src/data/racines-vivantes.test.ts (gardes D4, D5, D8)
- src/data/schemas/_racines-vivantes.generated.ts (phase 1, `genRacinesVivantes`, gen-registry.mjs:493)
- src/data/schemas/_cles-de-dataset.generated.ts (phase 2, gen-espaces.mts)

## ps final
```
19285 19263       10:48 sh -c node scripts/lancer-local.mjs vite -- vite
19286 19285       10:48 node scripts/lancer-local.mjs vite -- vite
19294 19286       10:48 /opt/node22/bin/node /home/claude/game/.wt-1473-t2/node_modules/vite/bin/vite.js
19315 19294       10:48 /home/claude/game/.wt-1473-t2/node_modules/vite/node_modules/@esbuild/linux-x64/bin/esbuild --service=0.21.5 --ping
```
Les processus vite/esbuild listés (pid 19285-19315, 9h36 d'âge) appartiennent à /home/claude/game/.wt-1473-t2, pas à cette mission ; les hooks poison-postcheck sont ceux du harnais. Aucun processus laissé par moi.
