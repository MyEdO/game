# #1463 · concept RÉFÉRENCE — brief du lot R2 v3.2 (2026-09-24) : l'espace de noms est une collection à clé marquée au schéma

Rattachement : #1473 « [#1463 solde] Refs validées AU PARSE contre le registre d'ids généré (livré par #1466
ref(type) + #1468 OP_DEFS) — ce ticket solde les 12 gardes FK nominatives concept par concept (L2/L3) et
gameOpRefFk.mjs ». Voisins : #1528 (ids de racine des documents `config`), #1932 (références typées par une liste
d'ids recopiée, lot R3, après celui-ci), #1939 (désignateurs de `sea-events.params`).

**Historique.** v1 (`1463-r2-brief.md`) réfutée, 5 bloquants structurels. v2 (`1463-r2v2-brief.md`) réfutée
(`juge-design-socle` run `wf_8434ae04-2b8`, 14 bloquants dont 1 structurel : le sélecteur déclaré
`chemin[?champ[=]]` n'exprime pas 25 des 54 listes nichées). Deux designs réfutés sur la même classe (une
DÉCLARATION textuelle de l'emplacement d'une liste, parallèle au schéma qui la décrit déjà) : la v3 est remontée d'un
niveau. v3 jugée FRAGILE (run `wf_d03d39c3-234`, 18 bloquants, aucun structurel, aucun réfuté) ; la v3.1 les intègre.
v3.1 relue FRAGILE (juge `a4b8abc5f889afa3a`, 2026-09-24 : 9 des 18 soldés, 9 incomplets, 5 bloquants neufs, aucun
structurel ; verdict `/mnt/project-files/dettes/1463-r2v31-juge.md`) ; la v3.2 les intègre (section « Design jugé »,
en bas). Aucun des deux verdicts n'est structurel : la v3.2 part au codeur sans troisième jugement de design, et le
codeur conteste en sortie tout point qu'il mesure faux.

**Base (v3.2, relue le 2026-09-24 04:30 UTC).** Le codeur part de `chantier/1473-r2`, tête `c53cf8b6f` : fusion
committée de `chantier/1473-r1` (`81e3f256f`, train 1 et ses corrections 1 et 2) et de la tête de #1897
(`bef51f323`). La correction 3 du train 1 (`familleDuRepere`, vocabulaires d'op en `enumNomme`) n'y est pas encore :
elle entrera par une fusion après le commit C1. Les lignes citées ci-dessous sont celles de `55d4ea7fc` (arbre de
lecture `/home/claude/game/.wt-1473-r2v2-lecture`), sauf mention `r1` = `chantier/1473-r1` ; le codeur les relit à sa
tête (en premier `liste-cle.ts` et `sourcesDeSpecs.ts`, que la fusion de #1897 a changés) et nomme celles qui ont
bougé. `grammaire/slots.ts` et `slots.test.ts` n'ont pas survécu à la fusion (la marche des slots reste démolie) :
toute mention qui les vise est caduque.

Consigne de l'utilisateur, 2026-09-23 : « Fais les choses bien, le but n'est pas que vider la dette a 0, mais
aussi régler les mauvaises décisions découvert en chemin fait par un model des anciennes générations pour une
structure plus adapté ».

## Invariant

1. « **Toute vérification d'un id contre le registre, sous `src/data/schemas`, passe par `idDe`.** » (brief R1
   v1.1, https://github.com/cgauche/game/issues/1473#issuecomment-5801354411). Question : où une référence se
   déclare-t-elle ? Sur une feuille `idDe`. Contre-exemple vivant : `defs-scenes/projet.ts:23` importe
   `IDS_PAR_DATASET` et vérifie `activeAxes` par un `superRefine` (`:89-97`), faute de type `axe` à `TYPES`.
2. « Une garde de synchronisation est un smell : une seule source de vérité. » (`.claude/credo.md`). Question :
   combien de déclarations pour « cette collection d'un document est un ensemble d'ids » ? Aujourd'hui SEPT :
   - la racine d'un document `entite`/`record`, devinée par le générateur (`idsDuDataset`,
     `scripts/gen-registry.mjs:554-565`, heuristiques `estRecordAIds` `:512-518`, `estUnLibelle` `:524`,
     exception nominative `DEFAUTS_IDS` `:537-540`) ;
   - `export const discriminant` (`defs/materials.ts:34`, `defs/spells.ts:23`) ;
   - `export const marqueurs` (`defs/props.ts:18`, `defs/skills.ts:14`, `defs/talents.ts:26`) ;
   - `exposition.edit.niche.categories` (ex. `defs/crew-test-types.ts:43`) et ses liaisons manuscrites `ARRAYS`
     (`src/data/overrides.ts:159-258`), `OBJECTS` (`:275-294`), `NESTED_ARRAY_ROOT` (`:350-425`, 55 entrées),
     accesseurs `critiqueEntries` (`src/data/criticals.ts:160`), `miscastEntries` (`overrides.ts:119`),
     `SHIP_CRITICAL_TABLES` (`src/data/shipCriticals.ts:89`), `RIVER_CRIT_SET` (`:126`) ;
   - `listeCle` (`grammaire/liste-cle.ts`, #1897), verbatim `:2-6` : « la liste DÉCLARE ce qui identifie ses
     éléments, rien ne le devine. `listeCle(element, cle)` construit la liste, y pose l'UNICITÉ de la clé […] et
     MARQUE le nœud rendu ». 28 appels, tous sous `defs-scenes/` ; 0 sous `defs/` ;
   - l'INDEX DES IDS du scan des structures (`scripts/docs/lib/structures-scan.mts:9-19`, verbatim : « LE CŒUR EST
     L'INDEX DES IDS, SCOPÉ PAR DATASET […] 3. DOCUMENTS EMBARQUÉS — objet à clé d'identité […] Leurs ids
     complètent l'index »), qui DEVINE les ids nichés par heuristique (passe 3, `:577-588` ; la passe 1, `:436`, est
     l'index des RACINES et n'est pas en cause) ;
   - `SOURCES_DE_SPECS` (`grammaire/sourcesDeSpecs.ts:34-51`) : pour chaque `specsSource`, un fichier, un record
     niché (`sizes: { dataset: 'sizes.json', cles: 'rangedMod' }`) et des filtres `champ=vaut` / `champ`
     (`univers: combat('melee')`, `pool: { champ: 'wind' }`), évalués par un second moteur de filtre, `retient`
     (`:58-63`). C'est la graphie `fichier#…?champ=valeur` d'E6, déclarée en parallèle.
3. `src/data/schemas/grammaire/document.ts:125-127` : « `niche.categories` nomme les clés de catégorie Codex de
   CE document qui sont routées comme datasets (`CodexEdit.CATEGORY_DATASET`) : chacune édite UN champ tableau du
   document, jamais le document entier ». Question : que désigne une catégorie niche ? Une collection du
   document, éditée comme un dataset.
4. `src/data/config-id-unique.test.ts:20-21` : « ANGLE MORT DIT : les espaces de noms NICHÉS (jetons de scène,
   sous-entrées) ne sont pas relevés — seul le PREMIER NIVEAU l'est, qui est le seul que `IDS_PAR_DATASET`
   indexe. » Question : qu'indexe le registre ? Le premier niveau seulement.
5. `src/data/schemas/grammaire/ref.ts:39` : « Un type s'ajoute avec le lot qui le migre, jamais « au cas où ». »
   Question : quand un type entre-t-il dans `TYPES` ? Avec son premier désignateur migré. Même règle pour un espace
   de noms niché : il entre avec son désignateur.
6. « Étendre le général et le paramétrer plutôt que créer un parallèle » (`.claude/credo.md`, puce « Réutiliser
   l'existant — le CANONIQUE, pas le voisin »). Question : quand un besoin neuf ressemble à un mécanisme existant,
   en crée-t-on un second ? Non : on paramètre le premier. Ici : la marque de collection à clé, la mesure au parse
   et sa grammaire de chemin (`pathNormalise`) existent ; l'espace de noms en est un paramètre.
7. `idsVivants.ts:9-11` : « `_registry.generated.ts` importe les defs, qui appellent `idDe` à l'initialisation —
   lire le registre depuis `ref.ts` fermerait le cycle ». Question : pourquoi le générateur d'ids est-il
   textuel ? Parce que le schéma lit la table à sa CONSTRUCTION (`idDe` → `idsSousListe`, `ref.ts:105-122`,
   « FAIL-FAST à la CONSTRUCTION du schéma » ; `porteLeMarqueur`, `:132-141`). Ce cycle est la cause des
   déclarations textuelles.

## Cas canonique déjà couvert

- **Mesure au parse** (R1 de #1473, `r1`) : `reperesDuParse(schema, donnee)` (`src/data/schemas/grammaire/ref.ts`,
  `r1` `:248-264`) ouvre une fenêtre (`parseDeMesure`, `:143`) où chaque feuille `idDe` émet un REPÈRE (issue
  `custom` à `params[REPERE]`, `:174`) ; `slotsDuParse` (`scripts/docs/lib/slots-registre.mts`, `r1`) rend chaque
  repère en case `(porteur, clé)` ; `pathNormalise` (`r1` `:44-50`) écrit son chemin (`.champ`, `[]` pour un
  élément, `{}` pour une clé de record) ; `defsDeDocument` (`r1` `:25-27`) est le parcours des documents mesurés.
- **Identité d'élément déclarée au nœud** : `listeCle`, marque lue par `cleDe` (`liste-cle.ts:76`) et
  `clesRetrouvees` (`:84-90`) ; ses options existent déjà (`OptionsDeListeCle`, `:39`).
- **Fabrique de document** : `document()` pose la charge (`document.ts:448-498` : `entite` → `z.array(entrée)`,
  `record` → `entries: z.record(…)`, document à rangées → `entries: z.array(rangée)`, puis `affinerDataset`).
- **Mémo par version** : `memoParVersion(cle, calcul)` (`src/data/versionDataset.ts:60-79`), qui accepte déjà une
  liste de clés (`:60`, `cle: CleDeDataset | readonly CleDeDataset[]`).

Le nouveau cas est une INSTANCE de ces quatre : une collection à clé est marquée à son nœud, la mesure au parse
la trouve comme elle trouve une feuille `idDe` et écrit son chemin par `pathNormalise`, le régime vivant lit par
`memoParVersion`.

## Constat

- Sonde du juge v3 (`scratchpad/juge-r2v3/sonde-positions.out`) : 167 positions de schéma de listes nichées
  d'objets à `id` ; 87 sont des listes de RÉFÉRENCES (tous leurs ids au registre ; 12 portent des doublons, dont
  `creatures.json#[].skills`, 179 listes à doublons) ; 68 sont des collections d'identité, sans aucun doublon.
- Les 54 catégories `niche` (sonde du juge v2, reproduite par le juge v3, `sonde-liaisons.out`) : 29 champs
  directs (`crew-test-types.json#types`), 14 à deux niveaux (`ship-criticals.json#tables.cargaison`,
  `sea-events.json#manann.factors`…), 11 sous un élément d'une liste-racine
  (`criticals.json#[criticals-ldb-tete].entries` ×8, `miscast.json#[miscast-mineure].entries` ×3). Leurs 25
  fichiers n'ont AUCUNE liaison dans `ARRAYS` ni `OBJECTS` : leurs racines ne sont atteintes que par les thunks de
  `NESTED_ARRAY_ROOT`. La navigation depuis la racine garde l'identité des 54 tableaux.
- Documents `object: 'single'` (`OBJECTS`) : leurs collections à `id` ne sont ni indexées ni vivantes.
- Spécialisations : `skills.json#[].specs` (12 listes, 256 ids) et `talents.json#[].specs` (11 listes, 243 ids)
  sont des collections d'identité ; `SPECS_PAR_DATASET` (`_ids.generated.ts`, `skills.json` à `:106-123`,
  `talents.json` dès `:124`) en porte une copie identique (`scratchpad/juge-r2v3/specs.out` : 12/12 et 11/11) ; 3 et
  5 entrées ont en plus un `specsSource` (`skills.json:208,557,1164`, `talents.json:419,2681,2895,2913,5980`). Sonde
  du juge v3.1 (`scratchpad/juge-r2v3-1/sonde-univers-specsSource.out`) : `weaponGroupsMelee` (8 ids) et
  `weaponGroupsRanged` (10 ids) n'ont aucune clé dans les tables qui survivraient à la v3.1.
- Critère des positions (sonde du juge v3.1, `sonde-critere-e2.out`, 167 positions) :
  `{"ref?/PAS-idDe":79,"ref?/idDe":8,"identite?/PAS-idDe":68,"DOUBLONS/idDe":6,"DOUBLONS/PAS-idDe":6}`. Aucune
  collection d'identité n'a un `id` en feuille `idDe` ; 85 listes de références n'en ont pas non plus
  (`creatures.json#[].talents`/`traits`/`optionals`, `grammaire/reference.ts:39`
  `talentRefSchema = z.strictObject({ id: z.string(), … })`, listes d'`ops`).
- Typage par clé : `datasetArray<K>(key): (typeof ARRAYS)[K]` (`overrides.ts:296-298`), `setDataset<K>` (`:338`),
  `setObjectDataset<K>` (`:510`) portent le type d'élément ; consommateur `src/ui/EtatPanel.tsx:243`
  (`datasetArray('encumbranceTiers').find((t) => t.tier === …)`). `ObjectDatasetKey` et `OBJECT_FILE`
  (`overrides.ts:303-312`) recopient clé → fichier.
- Passe 3 du scan : elle indexe tout objet embarqué à identité, pions de scène compris (`structures-scan.mts:22-23`) ;
  `docs/structures-donnees.md` liste 136 chemins de documents embarqués, dont 54 dans des `*-projet.json`
  (`scenes.entities`, 442 objets).
- Racines : 82 clés à `IDS_PAR_DATASET` (81 `entite` + `teintesJeu.json`) ; `decorPalette.json` (`record`, 435 ids)
  en est écarté par `DEFAUTS_IDS` seul (`sonde-racines-hors-table.out`).
- `affinerDataset` (`document.ts:498`) clone la charge dans 6 defs (actions, advancementCosts, materials, names,
  stars, terrains) ; une marque posée avant est perdue (`sonde-marque-affinee.out`).
- `listeCle` sert aussi des clés qui ne sont pas des espaces de noms : `scene.ts:545` `members` (clé `entityId`,
  une référence), `:770` `stations` (`sceneId`, une référence), `:760` `layers` (`z`, numérique), `:762` `walls`
  (clé composée `x,y,side,z`, `:688`).
- `discriminant` porte DEUX rôles : la sous-liste par valeur (`IDS_PAR_DISCRIMINANT`) ET la partition de la
  CHARGE éditée (`chargeParDiscriminant`, `schemas/types.ts:54-59` ; `chargeDiscriminee`, `validate.ts:188-196` ;
  `brouillonNeuf`, `:218-219` ; `CodexEdit.tsx:573`).
- Cargaisons : les désignateurs visent TOUTE la liste. `defs/naval-ports.ts:4-5` : « `production`/`surplus`/
  `demande` sont keyés par id de `sea-cargo.json` (+ marqueurs `commerce`/`minimum-vital`, cf. `PortProfile` » ;
  `defs-scenes/worldmap.ts:66` : « ids d'entrées de `land-cargo.json` (marchandises ET marqueurs) ».
- Migrations datées : `scripts/migrations/2026-09-01-1463-*.mjs` lisent la table par la regex
  `/'careers\.json':\s*\[/`, et `replay.mjs` les rejoue (job `migrations`, hook pre-push).
- Termes du lexique (`scripts/docs/lib/structures-lexique.mts`) : `adresse` est pris (`:343-344`, « adresse d'un
  passage du Source (`descRef`) ») ; « espace de noms CLOS, tenu par un document » et « RÉFÉRENCES SCOPÉES » existent
  (`:578-592`, `CLES_REFERENCE_SCOPEE`) ; « INDEX DES IDS » existe (`:5`, `:108`, `structures-scan.mts:9`).
  « Emplacement » est pris par #1897 (la spécialisation non désignée, `choix`, `ref.ts:260`). « Chemin » seul est
  pris trois fois (`structures-lexique.mts:221` chemin de graphie, `structures-scan.mts:61` chemin de fichier,
  `docs/structures-donnees.md:753-755`). « Clé de collection » est pris (`scripts/guards/lib/labelLogic.d.mts:2`,
  `collection-key`, #602). Contre-grep de l'orchestrateur à `55d4ea7fc`, `f9b5cee5d` et
  `origin/chantier/1897-doublons-fan` : `git grep -il "clé d'espace\|cleDEspace" -- src scripts docs` → 0 fichier.
- Défaut relevé par le juge v2 : importer `scripts/gen-registry.mjs` EXÉCUTE la génération (aucune garde de point
  d'entrée).

## Design proposé

- **E1. Une marque de COLLECTION, une primitive.** Le concept est la « collection à clé » : une collection dont
  chaque élément a une identité, lue par sa marque. La marque vit sur la COLLECTION :
  `{ nom, ids(collection) → string[], espace?: { discriminant?, marqueurs? } }` ; une liste et un record en sont deux
  instances (liste : la clé lue dans chaque élément ; record : les noms de propriété). UNE primitive la pose,
  `marquerCollection(noeud, marque)`, sur le nœud FINAL, avec l'unicité. `listeCle(element, cle, options?)` construit
  une liste et l'appelle ; `document()` l'appelle sur la charge APRÈS `affinerDataset`. Le module
  `grammaire/liste-cle.ts` devient `grammaire/collection-cle.ts` (un concept, un terme) et son en-tête se réécrit.
- **E2. L'espace de noms est un PARAMÈTRE explicite de la marque.** Une collection à clé n'est un espace de noms que
  si sa marque porte `espace`. `document()` le pose sur toute racine `entite`/`record` (les 82 racines actuelles,
  plus `decorPalette.json` : `DEFAUTS_IDS` meurt) ; une collection nichée le reçoit avec son premier désignateur
  (Invariant 5). Critère, dans les deux sens : (i) `espace` ne se pose jamais par inventaire ni par heuristique :
  une collection nichée le reçoit dans le commit de son premier désignateur, et là seulement ; (ii) une liste de
  RÉFÉRENCES n'est jamais un espace : `marquerCollection` refuse à la construction `espace` sur une collection dont
  la clé d'élément est une feuille `idDe` (une clé d'UNICITÉ sur une référence reste admise, cas de `members` et
  `stations`), et les listes de références pas encore migrées (`talentRefSchema`, `grammaire/reference.ts:39` ;
  les listes d'`ops`) ne sont touchées par aucun geste de ce lot ; leur migration les fera tomber sous (ii).
  L'inventaire C1 se réduit donc aux collections que ce lot marque (racines, catégories `niche`, `specs`, E10,
  appelants de `listeCle`), chacune avec sa décision `espace` ou non ; la sonde du juge v3.1 est une mesure jointe,
  pas le critère. Les `specs` de `skills`/`talents` sont des espaces de noms (désignés par `refOuSpec`) :
  `SPECS_PAR_DATASET` meurt et le catalogue d'une entrée se lit à l'espace de ses `specs`. L'univers et le pool
  d'une `specsSource` sont des CLÉS D'ESPACE : les filtres deviennent des paramètres `espace` des defs qui portent
  la donnée (`weaponGroups.json` discriminant `combat`, `trappings.json` discriminant `categorie`, `domains.json`
  marqueurs `wind`/`arcane`, `gods.json` marqueurs `blessings`/`miracles`/`chaosSpells`), et `sizes.json#rangedMod`
  est un record marqué `espace`. `SOURCES_DE_SPECS` se réduit à `specsSource → { univers: clé d'espace, pool?: clé
  d'espace }` ; `retient`, `FiltreDeSource` et `entrees` (`sourcesDeSpecs.ts:13-16`, `:58-70`) meurent, la phase 2
  calcule univers et pool comme tout espace filtré. `members`, `stations`, `layers`, `walls` gardent une clé
  d'unicité sans `espace`. Les collections d'identité sans désignateur (ex. `props.json#[].seatSlots`,
  `characteristics.json#[].options`) ne sont pas des espaces.
- **E3. La clé se MESURE au parse, par la grammaire existante.** Dans la fenêtre de mesure, une collection
  marquée émet un repère à son nœud. Sa clé s'écrit par `pathNormalise`, paramétré par le MODE de la mesure (E4) :
  en mode `slots`, rien ne change (`[]` pour un élément, `{}` pour une clé de record : c'est la POSITION de schéma,
  que le registre des slots regroupe, `r1` `slots-registre.mts:146`, et qu'attend `slots-contrat.test.ts:222`) ; en
  mode `espaces`, un pas dans un élément d'une collection marquée s'écrit `[clé]` (la clé de l'élément, jamais son
  rang), un pas dans une liste non marquée `[]`, un pas dans un record `{}`. Une seule graphie, dans le code et les
  docs : `fichier#…` (`skills.json` pour une racine, `crew-test-types.json#types`,
  `criticals.json#[criticals-ldb-tete].entries`, `skills.json#[art].specs`). Un espace de noms sous une liste non
  marquée n'a pas de clé stable : la mesure lève en nommant la liste parente. Preuve : les 54 clés de niche et les 82
  racines se re-dérivent (test promu depuis les sondes des juges v2 et v3), et les positions de slots de
  `slots-contrat.test.ts` sont inchangées.
- **E4. Une mesure, deux modes, un parcours.** La phase 2 de génération mesure les espaces de noms par la MÊME
  fonction que les slots, paramétrée par le mode des feuilles `idDe` : mode `slots` = la pré-vérification B1 de R1
  (parse normal réussi HORS fenêtre, `r1` `ref.ts:249-255`) ; mode `espaces` = pré-vérification ET fenêtre où la
  table est INERTE, pour qu'un espace neuf et son premier désignateur entrent dans le même commit. L'inertie vit
  au LECTEUR de la table, pas à la feuille : `idsDe`, `idsSousListe`, `catalogueSpecs`, `entreeOuverte` et
  `porteLeMarqueur` rendent « tout est admis » en mode `espaces`. Raison mesurée (juge v3.1, sonde
  `sonde-spec-hors-feuille.mts`) : le contrôle de `spec` vit dans l'enveloppe (`ref.ts:313` et `:341`,
  `superRefine` → `refusDeSpec`), et `refOuSpec('skill').safeParse({ id: 'art', spec: 'spec-neuve-du-meme-commit' })`
  échoue alors que la feuille `idDe` est inerte. Le contrôle des références se fait ensuite au parse normal contre
  la table fraîche. Un seul parcours des documents (`defsDeDocument`) rend les slots et les espaces. Les lectures de
  la table à la CONSTRUCTION du schéma (`idsSousListe`, `porteLeMarqueur`) passent au parse ; le test
  `espaces-contrat.test.ts` exige que chaque feuille `idDe`, chaque `spec` désignée, chaque valeur de discriminant et
  chaque marqueur ait sa cible dans la table (les défauts attrapés aujourd'hui à la construction restent attrapés, à
  un autre moment). `scripts/gen-registry.mjs` gagne une garde de point d'entrée ; `npm run gen` enchaîne les deux
  phases.
- **E5. Filtres : paramètres de la marque.** `discriminant` et `marqueurs` deviennent des champs de `espace`
  (`document(…, { espace: { discriminant: 'domain' } })`, `{ marqueurs: ['specsOpen'] }`), lus au nœud par la phase 2,
  donc valables pour un espace niché. `export const discriminant`/`marqueurs` et leur lecture par `lireExports`
  meurent. Second rôle conservé : la partition de la charge (`chargeParDiscriminant`, `schemas/types.ts:59`) lit son
  CHAMP au paramètre `espace.discriminant` de la marque ; sa table valeur → clés de charge reste une donnée du def,
  passée au même appel de `document()`, et n'est plus un export lu au texte (réponse à la réserve du juge v3.1, point
  5 ; si un lecteur texte en survit, le nommer en sortie).
- **E6. Termes.** « Espace de noms » (terme du lexique, `structures-lexique.mts:578`) = les ids d'une collection
  marquée `espace`, éventuellement filtrée. Sa CLÉ D'ESPACE (terme neuf, contre-grep au Constat) s'écrit `fichier#…`,
  suffixée d'un filtre (`?champ=valeur`, `?champ`) ; « chemin » seul ne la nomme jamais, ni dans le code ni dans les
  docs. « INDEX DES IDS » = la table générée. « Dataset » reste le mot de l'édition : une CLÉ DE DATASET édite une
  collection et s'écrit dans la même graphie `fichier#…`. Graphie univoque : `espaces-contrat.test.ts` refuse une clé
  d'élément écrite en pas `[clé]` qui contient `[`, `]`, `#`, `?` ou `=`, et une valeur de discriminant ou un
  marqueur qui contient `?`, `=` ou `#` (sonde du juge v3.1 : aucun cas sur la donnée actuelle, les 11 ids à `#` de
  `raw.manifest.json` sont des racines, jamais écrits en pas). Les termes neufs (« clé d'espace », « collection à
  clé », `marquerCollection`, `RACINES_VIVANTES`, `IDS_PAR_ESPACE`, `espaceDe`) entrent au lexique
  (`structures-lexique.mts`) et à `docs/structures-donnees.md` dans le commit qui les crée. Renommés : `IDS_PAR_DATASET` → `IDS_PAR_ESPACE` (absorbe `IDS_PAR_DISCRIMINANT` et
  `IDS_PAR_MARQUEUR`), `TYPES[].dataset` → `TYPES[].espace`, `cibleDe` → `espaceDe`. Le lot suivant s'appelle
  « références scopées » (terme du lexique, `CLES_REFERENCE_SCOPEE`). Le générateur garde, pour les racines, la
  graphie `'fichier.json': [` que lisent les migrations datées ; celles-ci ne changent pas (historique rejoué),
  et un test verrouille cette graphie.
- **E7. Une table de racines vivantes, tout le reste dérivé.** `RACINES_VIVANTES : fichier → () => racine`, une
  ligne par fichier de `src/data` qui a une collection éditable ou un espace de noms (racines-tableaux, documents
  `single`, les 25 fichiers de niche), dans `src/data/overrides.ts`. `ARRAYS`, `OBJECTS` et `NESTED_ARRAY_ROOT`
  meurent : `datasetArray(clé)` et `datasetObject(clé)` naviguent la racine du fichier le long du chemin de la
  collection, pour TOUTES les familles d'édition, sans cas particulier. `DatasetKey` et les clés des nichés
  dérivent du registre généré (la phase 1 émet l'union des clés de dataset, racines et catégories de `niche`) ; la
  garde (e) de `exposition-contrats.test.ts:137-144` meurt avec ce qu'elle synchronisait. `ObjectDatasetKey` se fond
  dans `DatasetKey` ; `OBJECT_FILE` (`overrides.ts:303-312`, recopie clé → fichier) meurt, le fichier se lit à la clé
  de dataset. Le TYPAGE PAR CLÉ survit sans recopie : `datasetArray<K>`, `datasetObject<K>`, `setDataset<K>` et
  `setObjectDataset<K>` (`overrides.ts:296-298`, `:338`, `:510`) lisent le type d'élément à une carte TYPE-ONLY
  émise par la phase 1 (`import type` des defs, effacés à l'exécution : aucun cycle, Invariant 7). Question en
  sortie : ce type (`z.output` du def) diffère-t-il des interfaces de `src/data/index.ts` que les consommateurs lisent
  (ex. `src/ui/EtatPanel.tsx:243`) ? Chaque écart est une double source de type, à nommer avec `fichier:ligne`.
  `niche.categories` devient une carte catégorie → clé de dataset relative au document (graphie `…` après `#`),
  validée par test contre les clés mesurées ; `defs/criticals.ts` la dérive de sa constante `CATEGORIES`. Coût
  d'une liste : référençable = sa marque et son désignateur ; éditable = 1 entrée de carte au def, plus 1 ligne de
  `RACINES_VIVANTES` si son fichier est neuf.
- **E8. Régime vivant.** `SourceDIdsVivants.entrees(clé d'espace)` navigue depuis `RACINES_VIVANTES` ; la version
  d'un espace est `memoParVersion(toutes les clés de dataset de son fichier)`. `SourceDIdsVivants.version`, le mémo
  local d'`idsVivants.ts` et l'exclusion des nichés meurent. Un fichier sans racine vivante retombe sur la table
  générée.
- **E9. L'INDEX DES IDS du scan dérive des collections mesurées.** La passe 1 de `structures-scan.mts` (`:436`,
  index des RACINES) lit `IDS_PAR_ESPACE` ; la passe 3 (`:577-588`, documents embarqués) lit TOUTES les collections
  marquées, avec ou sans `espace`, par la même mesure (mode `espaces`, `defsDeDocument`) : `IDS_PAR_ESPACE` seul
  ferait régresser le scan, qui indexe aussi les collections d'identité sans désignateur (`seatSlots`, `options`)
  et les pions de scène (`:22-23`), et `:532` remesurerait leur clé `id` comme site de RÉFÉRENCE. Pour les documents
  de `src/scenes` (136 chemins embarqués, dont 54 dans des `*-projet.json`), l'heuristique de la passe 3 reste
  jusqu'au lot « références scopées », qui la tue : elle s'inscrit au REGISTRE DES FOSSILES de #1463 avec ce lot de
  mort, et son code ne s'applique plus qu'à `src/scenes`. Le scan reste le côté OBSERVÉ pour les RÉFÉRENCES (valeurs
  qui résolvent), pas pour les identités.
- **E10. Types et désignateurs** (dernier commit) : `TYPES[t] = { espace, catalogue }`. Entrent avec leur
  désignateur : `crewTestType` (`crew-test-types.json#types` ← `skillDRBonus.testType`), les deux cargaisons
  (`sea-cargo.json#cargoes` ← `naval-ports` `production`, `surplus`/`demande` en `z.record(idDe(…), z.number())` ;
  `land-cargo.json#cargoes` ← `worldmap.ts` `produits`/`demande`), `axe` (`axes.json` ← `activeAxes` en
  `refs('axe')`, le `superRefine` manuscrit de `projet.ts` meurt), `trauma` (`traumas.json` ← `amputer.sequels`,
  son entrée de `GAMEOP_FIELD_TARGETS` meurt).
- **E11. Ce qui meurt, ce qui survit, nominativement.** Meurent : `IDS_PAR_DATASET`, `IDS_PAR_DISCRIMINANT`,
  `IDS_PAR_MARQUEUR`, `SPECS_PAR_DATASET` (noms et contenus) ; `idsDuDataset`, `estRecordAIds`, `estUnLibelle`,
  `DEFAUTS_IDS`, `verifieExhaustiviteDesIds`, `idsParDiscriminant`, `idsParMarqueur`, `discriminantsDeclares`,
  `marqueursDeclares`, `genIds` ; `export const discriminant`/`marqueurs` ; `ARRAYS`, `OBJECTS`,
  `NESTED_ARRAY_ROOT` et la garde (e) ; `SourceDIdsVivants.version` et le mémo local ;
  `idsVivantsDuDiscriminant`/`idsVivantsDuMarqueur` ; `idsDAxes` et son `superRefine` ; l'heuristique des documents
  embarqués du scan hors `src/scenes` ; `ObjectDatasetKey`, `OBJECT_DATASET_KEYS`, `OBJECT_FILE` ; `retient`,
  `FiltreDeSource`, `entrees` et les champs `dataset`/`cles`/`univers`/`pool` en filtre de `SourceDeSpecs` ; les
  étiquettes JSDoc `@generateur` (`defs/props.ts:18`, `defs/skills.ts:14`, `defs/talents.ts:26` à la tête de
  #1897) avec les exports qu'elles justifiaient, et l'entrée `"tags": ["-generateur"]` de `knip.json:19` si le
  contre-grep `git grep -n "@generateur" -- src scripts` rend 0 après C2. Survivent : `marquerCollection` et
  `listeCle` (`collection-cle.ts`), `document()`, `niche.categories` (carte catégorie → clé de dataset relative),
  `RACINES_VIVANTES` (neuve), `SOURCES_DE_SPECS` (réduite à `specsSource → { univers, pool? }` en clés d'espace),
  `lireExports` (ses autres exports), `memoParVersion`.
  Lot suivant nommé, à ouvrir au jugement de ce design : « références scopées » (collections à clé des documents
  de campagne ; désignateurs `presetId`, `affaireId`, `indiceId`, `entityId`, `placeId` ; `superRefine` de
  `projet.ts:99-110` et `narratif.ts:100-102` ; l'heuristique de la passe 3 du scan sur `src/scenes` ; le jumeau d'Effet `giveTrappingSchema.trappingId`, qui vise les objets
  de campagne PUIS la base, `src/state/campaignData.ts:96-98`). Il sera une instance de ce lot : les repères `idDe`
  et les repères d'espace d'un même document s'apparient après le parse, sans grammaire neuve.
- **Commentaires dans le geste.** Chaque commit réécrit les en-têtes que son changement rend faux :
  `liste-cle.ts:8-9` en C1 ; `sourcesDeSpecs.ts:1-9` (« `SPECS_PAR_DATASET` porte l'univers ») en C2 ;
  `overrides.ts:8-10` (nomme `ARRAYS`/`OBJECTS`), `:220-221` et `idsVivants.ts:16-18` en C3, avec la purge des
  étiquettes « LOT n #422 », « FINAL », « exemptions » et « n'étaient pas » d'`overrides.ts` (`:63`, `:72`, `:217`,
  `:227`, `:234`, `:239`, `:254`, `:281-287`, `:387`, `:393`, `:397`) et de la pierre tombale `:99-101` (« 5 clefs y
  étaient sans root déclaré et auraient écrasé ») : un commentaire porte une réf nue.

**Commits.** C1 : `marquerCollection`, `collection-cle.ts`, marque de `document()` après affinage, marques des
collections de `defs/` retenues à l'inventaire, mesure et clés (E1-E3), sans changement de comportement ;
C2 : phase 2, table `IDS_PAR_ESPACE`, filtres paramètres, sources de spécialisations en clés d'espace, lecture par
clé d'espace, amorçage (E4-E6) ; preuve : l'« ancienne table » est l'UNION TRADUITE des trois (`IDS_PAR_DATASET`,
`IDS_PAR_DISCRIMINANT` : `materials.json?domain=` prop/relief/roof, `spells.json?family=`
arcane/beni/chaos/invocation/mineure ; `IDS_PAR_MARQUEUR` : `props.json?volume`, `skills.json?specsOpen`,
`talents.json?specsOpen`), plus `SPECS_PAR_DATASET` traduite en `…#[id].specs` et les univers des 16
`SOURCES_DE_SPECS` ; elle est égale à la nouvelle sur les clés communes, et les clés neuves = espaces nichés ∪
{`decorPalette.json`} (cause : mort de `DEFAUTS_IDS`) ; C3 : racines vivantes, régime vivant, liaisons d'édition,
scan (E7-E9) ; C4 : types et désignateurs (E10). Critère de sortie mécanique, ancré (le motif nu touche des
homonymes : `cibleDe` de `scripts/ops/chantier.mjs:161`, `scripts/guards/lib/fieldConsumers.mjs:290`,
`src/tests-sans-horloge-guard.test.ts:128`) :
`git grep -nwE 'IDS_PAR_DATASET|IDS_PAR_DISCRIMINANT|IDS_PAR_MARQUEUR|SPECS_PAR_DATASET|NESTED_ARRAY_ROOT|OBJECT_FILE' -- src scripts ':!scripts/migrations'`
= 0 ; `git grep -nw 'cibleDe' -- src/data src/engine src/state src/ui` = 0 ; aucun IMPORT de `_ids.generated` hors
`grammaire/ref.ts` (`git grep -nE "from '[^']*_ids\.generated" -- src scripts` = 1 ligne ;
`src/livres-recopies-guard.test.ts:110` nomme le fichier sans l'importer et reste).

## Questions restantes au codeur (réponse en sortie, citation à l'appui)

1. La mesure tient-elle à travers les unions, `optional`, `lazy` et les listes d'ops ? Une collection atteinte par
   deux chemins de schéma a-t-elle un seul chemin de donnée ?
2. Coût de la phase 2 (parse des documents de `SCHEMA_DEFS`) dans `npm run gen` et dans les hooks qui l'appellent.
3. `RACINES_VIVANTES` se dérive-t-elle d'une couture de chargement existante (imports de `src/data/index.ts`) sans
   recopie ? Sinon, dire le nombre de lignes écrites à la main.
4. (juge v3.1, non établi) En mode `slots`, une collection émet-elle son repère ? Si oui, le repère d'une collection
   placée sous un `.pipe` fait-il avorter le `pipe` et perdre les feuilles `idDe` de sa sortie, comme le repère d'une
   feuille (`r1` `ref.ts:243-244`) ? Sonde zod sur une entrée réelle de `skills.json`.
5. (juge v3.1, non établi) Que vaut la version d'un espace dont le fichier n'a aucune clé de dataset
   (`memoParVersion([])`, ex. `sea-cargo.json#…` si le fichier n'est pas éditable) ?
6. E7 : le type d'élément émis par la phase 1 diffère-t-il des interfaces de `src/data/index.ts` lues par les
   consommateurs ? Liste des écarts, `fichier:ligne`.

## Périmètre

- Socle : `scripts/gen-registry.mjs` (+ `.d.mts`), le script de phase 2, `package.json` (`gen`),
  `src/data/schemas/_ids.generated.ts` (par `npm run gen`), `grammaire/ref.ts`, `grammaire/idsVivants.ts`,
  `grammaire/liste-cle.ts` → `grammaire/collection-cle.ts` et ses 28 appelants, `grammaire/document.ts`,
  `grammaire/sourcesDeSpecs.ts`, `grammaire/valeurs.ts`, `scripts/docs/lib/slots-registre.mts`,
  `scripts/docs/lib/structures-scan.mts`, `schemas/types.ts`, `schemas/validate.ts`, `src/data/overrides.ts`,
  `src/data/index.ts` (`:2493`), `src/data/criticals.ts`, `src/data/shipCriticals.ts`,
  `schemas/exposition-derivee.ts`, `src/ui/compendium/CodexEdit.tsx`, leurs tests (`gen-contrat-ids.test.ts`,
  `grammaire/grammaire.test.ts`, `config-id-unique.test.ts`, `spec-pool-contrat.test.ts`, `pool-specs.test.ts`,
  `valeurs-de-champ.test.ts`, `schemas/exposition-contrats.test.ts`, `src/state/buildings-catalogue.test.ts`,
  `grammaire/slots.test.ts` s'il survit à la fusion #27 (`:156` lit `IDS_PAR_DISCRIMINANT`)…), `src/data/index.ts`
  (`SPEC_SOURCES`), `src/ui/EtatPanel.tsx` et tout consommateur typé de `datasetArray`/`datasetObject`,
  `knip.json`, `scripts/docs/lib/structures-lexique.mts`.
- Defs : `defs/materials.ts`, `defs/spells.ts`, `defs/props.ts`, `defs/skills.ts`, `defs/talents.ts` (filtres) ;
  les defs des sources de spécialisations (`weaponGroups`, `trappings`, `domains`, `gods`, `sizes`) ; tout def de
  `defs/` qui porte une collection retenue à l'inventaire ; `defs/criticals.ts`, `defs/miscast.ts` ; les defs à
  `niche`.
- Désignateurs (C4) : `grammaire/mecanique.ts` (`skillDRBonus.testType`, `amputer.sequels`),
  `defs/naval-ports.ts`, `defs-scenes/worldmap.ts`, `defs-scenes/projet.ts`, `scripts/guards/lib/gameOpRefFk.mjs`.
- Docs générés (`npm run docs:build`) à chaque commit.
- Hors périmètre : `defs/sea-events.ts` (#1939) ; les unions littérales (`raceKeySchema`) de #1932 ; les documents
  de campagne (lot « références scopées ») ; les migrations datées.

## Design jugé :

**FRAGILE** — workflow `juge-design-socle`, run `wf_d03d39c3-234`, 2026-09-24, sur la v3. 18 bloquants survivants,
0 structurel, 0 écarté par réfutation. Verdict complet : `/mnt/project-files/dettes/1463-r2v3-juge-design.json`.
Intégration dans la v3.1 :

1. `specs` en double (SPECS_PAR_DATASET) → E2 : les `specs` sont des espaces, `SPECS_PAR_DATASET` meurt.
2. Marque perdue par `affinerDataset` → E1 : `marquerCollection` sur le nœud final.
3. Record-racine sans marque → E1 : marque de collection `ids(collection)`, liste et record instances.
4. Amorçage d'un espace neuf bloqué par B1 → E4 : mode `espaces` inerte jusque dans la pré-vérification.
5. Filtres rattachés au fichier et à la racine → E5 : paramètres de la marque.
6. Régime vivant qui branche par famille → E7-E8 : `RACINES_VIVANTES`, navigation unique.
7. Double déclaration niche + `ARRAYS` → E7 : `DatasetKey` dérivé du registre, garde (e) morte.
8. « Liaison du fichier » inexistante (25 fichiers) → E7 : `RACINES_VIVANTES`, comptée au coût.
9. Pas de critère de collection d'ids → E2 : critère d'exclusion, inventaire des 68 positions.
10. Preuve de C2 fausse (`decorPalette.json`) → Commits : clés neuves = nichés ∪ {`decorPalette.json`}.
11. E3 contre B1 (doublon du 4) → E4.
12. « adresse » déjà pris → E3, E6 : clé `fichier#chemin`, terme « chemin », contre-grep cité.
13. `listeCle` ≠ espace → E2 : `espace` est un paramètre explicite ; `members`, `stations`, `layers`, `walls` nommés.
14. Sixième mécanisme (INDEX DES IDS du scan) et termes doublés → Invariant 2, E6, E9.
15. Seconde grammaire de chemin → E3 : `pathNormalise` paramétré, une graphie.
16. Orphelins des renommages et migrations → E6 (graphie verrouillée), Périmètre étendu, critère de sortie.
17. Poison du périmètre → « Commentaires dans le geste ».
18. « Collection à clé » contre `listeCle` → E1 : le concept nomme le module, `listeCle` reste le constructeur de liste.

**FRAGILE** — relecture de la v3.1 par un juge (agent `a4b8abc5f889afa3a`), 2026-09-24 : 9 des 18 soldés, 9
incomplets, 5 bloquants neufs, aucun structurel. Verdict : `/mnt/project-files/dettes/1463-r2v31-juge.md`.
Intégration dans la v3.2 :

- 1 et N5 (univers `specsSource` sans hôte, `SOURCES_DE_SPECS` septième déclaration) → Invariant 2 (SEPT), E2 :
  univers et pool en clés d'espace, filtres en paramètres `espace` des defs porteurs, `retient` meurt ; E11.
- 4, 11 et N1 (spec neuve bloquée à la pré-vérification) → E4 : l'inertie vit au lecteur de la table.
- 5 (réserve `chargeParDiscriminant`) → E5 : champ lu à la marque, table de charge passée à `document()`.
- 7 et N4 (typage par clé perdu) → E7 : carte type-only émise par la phase 1, `ObjectDatasetKey` et `OBJECT_FILE`
  meurent, question 6.
- 9 (critère dans un seul sens) → E2 : `espace` seulement avec son désignateur, refus d'`espace` sur une clé `idDe`,
  inventaire réduit aux collections marquées par ce lot.
- 10 (clés filtrées oubliées) → Commits : l'ancienne table est l'union traduite des trois, 11 clés filtrées
  nommées.
- 12 (« chemin » pris) → Constat, E3, E6 : terme « clé d'espace », contre-grep à trois arbres ; « chemin » seul
  banni pour ce concept.
- 14 et N3 (plage fausse, régression du scan) → Invariant 2, E9 : passe 3 sur toutes les collections marquées,
  heuristique limitée à `src/scenes` et inscrite au registre des fossiles avec « références scopées ».
- 15 et N2 (chemins de slots cassés) → E3 : `pathNormalise` paramétré par le MODE, `slots` inchangé.
- 16 (critère de sortie inatteignable) → Commits : motifs ancrés, homonymes nommés, imports seulement.
- 17 (pierres tombales hors liste) → « Commentaires dans le geste » : `overrides.ts:8-10`, `:99-101`,
  `sourcesDeSpecs.ts:1-9`.
- Lentilles (e) et (f) → E6 : garde d'univocité de la graphie, termes neufs au lexique dans leur commit.
- Citations fausses → Invariant 1 (`projet.ts:89-97`), Cas canonique (`liste-cle.ts:76`, `:84-90`), Constat
  (`_ids.generated.ts`), E11 (`projet.ts:99-110`).
- Non établis → Questions 4 et 5 ; base relue à la tête de la fusion (Historique).
- Ajout de l'orchestrateur : les étiquettes `@generateur` et `knip.json:19` meurent avec les exports (E11).
