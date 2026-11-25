# La composition d'un jeu : un système, une bibliothèque, ce que chaque projet en prend

Ticket: #4919

Plan de cadrage du 2026-11-25. Épique parente : #4903 (Un noyau partagé, un dossier par projet). Absorbe #4919
(Choisir, par livre, le contenu proposé au jeu).

## 1. Qualification

- **But réel** : chaque jeu du dépôt se compose sur le système de Warhammer. Ses projets visés sont un jeu de rôle sur
  les campagnes des suppléments, un roguelite aux options limitées, un jeu de dynastie, un jeu de bandes et de
  factions sur une carte, et des jeux encore inconnus. Le jeu déclare sa composition en donnée : édition, langue,
  règles optionnelles, livres retenus, éléments retenus, entrées modifiées, contenu propre. Le noyau joue ce
  qu'on lui remet et ne suppose l'existence d'aucune entrée.
- **Livrable** : ce plan, jugé, puis les lots du § 5.
- **Critère de fini** (§ 6).
- **Irréversible** : rien. Tout passe par branche, PR et file de fusion.

## 2. Verbatims de l'utilisateur (2026-11-25)

1. « Ah ca même pour le roguelite, les posession avec niveau ca serait un sacré plus »
2. « Le noyau n'accepte pas aujourd'hui d'étendre ou d'alterer le data-driven ? C'était quelque chose que je voulais faire et on avait des pistes pour l'adaptation de la campagne EDO »
3. « Je veux revenir dessus. Le noyau propose une immense bibliotheque, mais chaque projet doit pouvoir décidé de ce qu'il veut utiliser (je voulais pouvoir filtrer par livre par exemple, ou prendre certains éléments de certains livres mais pas d'autres ... un peu comme les régles optionnelles mais trié du data-driven) mais aussi utiliser mon propre contenu spécifique a ce projet. »
4. « Sur un autre projet je pouvais décidé les livres que j'utilisais, je pouvais selectionner certains éléments, je pouvais même surcharger leur contenu par un autre »
5. « Je lance ce que j'ai en tete, mais comme on permet aujourd'hui dans jeu de role d'activer ou non des régles optionnelles, on doit pouvoir ajouter ou non des données. Alors oui retirer des compétences mais garder des carrières qui en ont besoin ça bloque forcement, mais si on veut on pourrait faire notre propre jeu en gardant juste le système et ne prendre le contenu d'aucun livre si on voulait. Je te laisse prendre un peu plus de hauteur, réfléchir a mon besoin derrière ce que je te dis, par rapport a mes projets que je souhaite faire et ce dont ils ont besoin pour fonctionner (jeu de role avec des campagnes tirés des suppléments, un roguelite avec des options limités et adapté a ce mode de jeu, un jeu de dynastie, un jeu style mount and blade ... ou que sais je que je n'ai pas imaginé). »
6. « valeurs.js doit pouvoir disparaitre sur le roguelite, en tout cas pour tout ce qui se trouve dans le noyau » ; « enfin géré via data-driven »
7. « Ah le verbatim ... tu sais pourquoi j'ai dit "« le noyau ne doit jamais dépendre du data driven »" ? C'était pour les tests. Mais je suis d'accord avec toi que le jeu ne doit pas supposer l'existence d'une compétence en particulier, ou alors sur une clé que chaque projet peut dire 'cet clef corresponds a cette compétence' (idée en l'air, tu as une meillieur vision que moi) »
8. « Même si bon le mieux c'est que le jeu passe le maximum en ops plutot qu'en dure on ne va pas se mentir »
9. « On commence par partir dans beaucoup de direction, et notre contexte va vite devenir notre ennemie. J'espere que tu affine ton plan »

**Décision du 2026-11-25, par carte**, à la question « Dans le noyau, des index calculés à l'import d'un module ne
voient pas une donnée modifiée ensuite (63 sites). Ta doctrine refuse une garde ; TypeScript ne peut pas interdire une
lecture au moment de l'import. Comment fermer ces 63 index ? ». L'utilisateur a choisi « Catalogue passé en valeur
(Recommandé) », dont la conséquence affichée était : « La base n'est plus exportée en tableaux globaux : une règle reçoit
le catalogue composé en argument. Une lecture à l'import ne compile plus, et c'est déjà la composition par projet. C'est
le plus cher : environ 235 lecteurs à migrer par familles, en avançant L2. » Les options écartées étaient « Donnée non
posée à l'import » et « Étendre la garde existante ». Même carte : « Oui, crée-les (Recommandé) », pour un ticket par
lot sous #4919, avec le brief du codeur en commentaire daté.

Ces verbatims révisent deux lectures du plan `2026-11-24-restructuration-multi-projets.md` :

- **§ 11, le *Bestiaire non officiel*.** La piste écartée était une donnée propre à l'atelier, *refusée au
  lancement*. Le défaut visé était qu'elle ne joue pas en jeu, pas l'existence d'une donnée de projet. Un projet
  a donc un contenu propre, qui joue en jeu.
- **§ 12, « le noyau ne doit jamais dépendre du data driven ».** Ce verbatim vise les tests (verbatim 7, fiche
  `user-arbitrage-tests-jamais-sur-donnee-data-driven`). Il n'interdit pas au noyau de recevoir de la donnée.

## 3. Mesure (à `6b222896d`, 2026-11-25)

- **Base globale.** `src/data/index.ts` importe 97 fichiers JSON au chargement du module et exporte 182 constantes.
  - Dans `src/engine` et `src/noyau`, 235 fichiers l'importent hors `.test`, `.testkit` et `.fixture`. Commande :
    `git grep -lE "from ['\"](\.\./)+data(/index)?['\"]" -- src/engine src/noyau`, ces fichiers exclus.
  - Un parseur compte 222 imports de valeurs.
  - 458 fichiers de test lisent la base.
- **La couture de composition existe déjà** : `src/data/overrides.ts`.
  - Elle remplace en place le contenu des datasets de la façade, par `setDataset`, `setObjectDataset` et
    `resetData`.
  - Son en-tête l'annonce comme la couche de surcharges par campagne : « apply au chargement, reset à la sortie ».
  - 102 fichiers de test posent déjà leurs entrées par elle.
- **Deux fusions champ par champ existent** :
  - `effectiveEntry` et `activeVariant`, dans `src/engine/variants.ts` ;
  - `mergeCreatureProfile`, dans `src/noyau/monde/resolveursDuNarratif.ts`.
- **Entrées sourcées.** Chaque entrée porte sa `source` : créatures 618/618 (12 livres), talents 187/187,
  carrières 172/172, objets 529/529. Le catalogue compte 34 livres (`books.json`).
- **Livres et variantes.** Une entité présente dans plusieurs livres reste une seule entrée, avec ses emplacements
  dans `alsoIn` : 148 entrées en ont. Ses variantes sont gatées chacune par sa règle optionnelle, jamais par son
  livre : 45 entrées en ont (doctrine `une-entite-n-livres-n-variantes`, `activeVariant` lit `v.when.rule`).
- **Aucun filtre par livre au niveau du jeu.** Sur 18 lecteurs de `source.book`, seule la facette du Codex filtre,
  et c'est de l'affichage.
- **Le contenu qu'un jeu remet au noyau** (`ContenuDUnJeu`, `src/hote/contenu.ts:12-16`) se limite aux campagnes,
  aux scénarios et aux dossiers.
- **Les règles optionnelles.** Elles sont 115, choisies par le joueur dans les réglages de Godot, et lues partout par
  `rule(id)` (`src/engine/policy.ts`). Elles ont trois porteurs :
  - le stockage de l'hôte (`wfrp4.house-rules`, `src/hote/reglesMaison.ts`) ;
  - la sauvegarde (`SaveGame.rules`, `src/noyau/persistance/save.ts:47`) ;
  - la coop (`packHouseRules` et `unpackHouseRules`, `src/noyau/coop.ts:39`).
- **`gatedByRule`** porte le contenu gaté par une règle, sur les carrières, les espèces, les objets et les
  compétences. Le registre des règles, lui, ne déclare pas ce qu'elles gatent (`docs/regles-optionnelles.md`).
- **Les registres narratifs d'un paquet.**
  - `presetsPnj` dérive une entité *nouvelle* sous son propre id, depuis une créature de base laissée intacte
    (`resolvePresetCreature`).
  - S'y ajoutent `objets`, `etats` et les champs locaux des ports (`docs/campagne-authoring.md:118`).
- **Les ids sont typés, mais pas fermés à la composition.** `Id<T>` (`src/data/schemas/grammaire/ref.ts:48`) est une
  union fermée, générée depuis toute la base : un littéral `'esquive'` compile. Les références inverses existent
  (`src/noyau/codex/relations.ts`).
- **Des ids écrits en dur dans les règles.** Sondage en *chaînes*, pas en ids de compétence : `perception` est aussi
  un type de Test d'équipage. Résultats dans `src/engine` et `src/noyau`, hors tests et testkits : `resistance` 21,
  `esquive` 19, `perception` 11, `athletisme` 8, `calme` 7, `corps-a-corps` 7. `src/engine/combat.ts:427` écrit
  `characteristic: 'agilite'`, alors que `esquive` porte déjà `agilite` dans `skills.json`. `weaponSkillId`
  (`combat.ts:237`) est déjà une indirection, mais en code.
- **Le roguelite.** `projets/roguelite/src/jeu/valeurs.ts` (365 lignes) est la seule source de son catalogue
  (`.claude/rules/roguelite.md:12`). Il porte :
  - des sélections d'ids de la bibliothèque : `PROFILS`, `SORTS_*`, `COMPETENCES_UTILES`,
    `TALENTS_HORS_DU_COMBAT`, `ESPECES`, `ARMES_`, `ARMURES_DE_LA_FORGE`, `REMEDES_`, les adversaires des
    `DESTINATIONS` ;
  - des modifications d'une entrée *en place* : le nom, l'identité et la dotation d'une carrière ;
  - de la connaissance de règle, à rendre au noyau : `MAIN_SECONDAIRE` et `MUNITION_DE_FAMILLE`
    (`valeurs.ts:359,361`) ;
  - du contenu propre sans forme au noyau : `BATIMENTS`, `EPREUVES`, `CAMP` ;
  - des réglages chiffrés et de l'affichage.

## 4. Principes et hypothèses

**Principes.**

- **P1 — Une règle s'exprime en ops ou en `Flow` dans la donnée**, au maximum (verbatim 8). L'id qu'elle vise est
  alors une donnée : il se sélectionne et se modifie, et les références le vérifient.
- **P2 — Le code irréductible ne nomme aucune entrée.** Il passe par un *emploi* : un rôle typé, déclaré par la
  règle qui en a besoin. Le livre de base de l'édition le lie par défaut. Un projet le relie s'il s'écarte du livre,
  ou s'il ne retient aucun livre (verbatim 7). La table des emplois est le reste de P1.
- **P3 — Les gestes de composition** (verbatims 3 et 4) :
  - **Retenir un livre** agit sur les entrées et sur leurs emplacements (`alsoIn`). Une variante reste gatée par sa
    règle, comme le veut la doctrine.
  - **Retenir ou exclure un élément** d'un livre retenu.
  - **Modifier une entrée en place**, sur son id, champ par champ, en gardant sa provenance. C'est le cas du
    roguelite qui renomme ses carrières. La fusion réutilise `effectiveEntry` ou `mergeCreatureProfile`, et aucune
    troisième fusion n'est écrite.
  - **Dériver une entrée neuve** sous un id propre, depuis une entrée de base laissée intacte. C'est
    `presetsPnj`.
  - **Ajouter du contenu propre** : le *livre du projet*, avec les mêmes schémas et une `source` au nom du projet.
- **P4 — Une composition incohérente est refusée au chargement**, avec la chaîne cassée nommée : une référence
  orpheline, ou un emploi non lié d'une règle retenue (verbatim 5).
- **P5 — Le refus est structurel.** `Id<T>` cesse d'être l'union globale de la base. Une règle n'obtient un id que de
  la donnée composée ou d'un emploi, et un littéral ne compile plus (credo ; #2724, Gardes vers structure : rendre
  le contournement incompilable).
- **P6 — Un test compose son propre catalogue en valeur** par `catalogueDeTest` (§ 5.1), au lieu de la couture
  `overrides.ts` (verbatim 7 ; #2995, Ajouter une donnée ne rougit aucun test). Chaque famille migrée emporte ses
  tests ; la réécriture en invariants des comptes et listes de donnée reste à #2995.
- **P7 — Tout contenu de projet s'édite à l'éditeur** (doctrine `campagne-recreable-a-l-editeur`). Le Compendium de
  Godot édite le livre du projet comme la bibliothèque, et montre la provenance et l'écart d'une entrée modifiée.

**Hypothèses révisables, tranchées par L0.**

- **H1 — Une composition par processus, posée par `overrides.ts` au chargement.** Mesurée tenable par L0 (§ 8.2), puis
  écartée par la décision du § 2 : le catalogue passe en valeur (§ 5.1).
- **H2 — Deux étages de choix.** Le projet fixe ce qui est disponible, la partie choisit parmi ce disponible
  (verbatim 5). Le choix de la partie voyage par les canaux qui portent déjà les règles : `SaveGame.rules` et
  `packHouseRules`, étendus à l'empreinte de la composition.
- **H3 — Les espaces de vocabulaire du système forment le socle de l'édition, hors composition** : caractéristiques,
  enjeux de jet, règles, règles optionnelles, actions (§ 8.1). Le contenu sujet à la composition commence aux
  compétences, états, carrières, talents, qualités et objets. À juger en L1.

## 5. Lots

| Lot | Contenu | Après | Preuve de fini |
|---|---|---|---|
| L0 | Mesure, en lecture seule. (a) Chaque id de donnée littéral de `src/engine` et `src/noyau`, classé : devient op/`Flow`, ou reste irréductible et passe par un emploi. (b) Qui charge quoi, par processus (H1). (c) Chaque export de `valeurs.ts`, classé. | — | Une annexe chiffrée à ce plan ; H1 et H2 tranchées ou remontées. |
| L1 | Le catalogue passé en valeur (§ 5.1) : un design jugé, puis la migration des lecteurs par familles. Le schéma de la composition (P3, P4, P7) produit ce catalogue : livres, éléments, modification en place, dérivation, livre du projet. L'édition et la langue de #1816 (WFRP 5e : édition sélectionnable et axe de langue VF/VO) en sont deux champs. | L0 | Le design est jugé ACCEPTER. Chaque famille migrée : typecheck complet, `npm run test:perimetre` vert, et une lecture de la base au chargement d'un module de la famille ne compile plus. Tests sur un livre de test : retenir, exclure, modifier, dériver, ajouter ; un refus nomme la chaîne. Le Compendium crée, modifie et supprime une entrée du livre d'un projet. |
| L2 | La partie tient son catalogue composé. Il voyage dans la sauvegarde et dans la coop (H2). Absorption de `gatedByRule`, des registres narratifs et des champs locaux des ports. Solde de #4919 (Choisir, par livre, le contenu proposé au jeu). | L1 | `npm test` complet et `npm run typecheck` verts. Le lot `npm run jeu-de-role:recette` passe, parcours `campagne` et `editeur` compris. La reprise d'une sauvegarde sous une autre composition est refusée, et l'invité d'une coop reçoit la composition de l'hôte. `git grep` des anciens porteurs vide. |
| L3 | `Id<T>` se ferme à la composition (P5). | L2 | Un id littéral dans une règle de `src/engine` ou de `src/noyau` ne compile pas (banc de typage). |
| L4 | Les ids en dur deviennent ops ou `Flow` (P1), et le reste passe par des emplois (P2). Par familles, dans l'ordre que donne L0. | L3 | Une composition « système seul », avec un livre de test, joue un combat par le noyau. Typecheck complet vert sans littéral d'id. |
| L5 | Premier client : le roguelite. `valeurs.ts` ne garde rien de ce qui touche au noyau (verbatim 6) : ses sélections et ses modifications deviennent sa composition, et `MAIN_SECONDAIRE` et `MUNITION_DE_FAMILLE` passent au noyau. `.claude/rules/roguelite.md` est réécrite. `BATIMENTS`, `EPREUVES` et `CAMP` suivent quand le noyau a leur forme, ce qui est hors de ce plan. | L2 ; la famille d'armes de L4 | `npm run roguelite:recette` passe, avec des images identiques à la référence. `valeurs.ts` ne nomme plus aucun id de la bibliothèque. |

### 5.1 L1 révisé par la décision du § 2 : le catalogue passé en valeur

Le design de L1a (la donnée globale recomposée à chaud) a été jugé CORRIGER le 2026-11-25. Son point bloquant :
étendre `src/data/index-vivant-guard.test.ts` est une garde, que la doctrine `user-doctrine-structure-avant-garde`
refuse (« les gardes sont a éviter ABSOLUMENT »), et TypeScript ne peut pas interdire une lecture au chargement d'un
module.

L'utilisateur a choisi le catalogue passé en valeur (§ 2). H1 tombe : le catalogue n'est plus un état du processus,
c'est une valeur composée qu'une partie tient et qu'une règle reçoit. L2 se fond dans L1. La remise à zéro entre
fichiers de test, la liste des 7 datasets hors du seam et les 63 captures deviennent sans objet une fois leurs lecteurs
migrés : une capture à l'import ne compile plus.

Les corrections du juge qui survivent, à reprendre au design neuf :
- `DEFAULT_RACE_ID` est un scalaire de `speciesRace` (`src/data/index.ts:1915`).
- Un dataset se déclare par la route de son def, puis `npm run gen` (`CLES_DE_DATASET`, `RACINES_VIVANTES`,
  `src/data/racines-vivantes.test.ts:29`).
- Une lecture de champ est un accesseur, et le mémo sert un vrai calcul.
- Le coût d'une remise de la base est d'environ 50 ms.

#### Design du catalogue en valeur (#5063, 2026-11-25)

Ronde 1 du juge : CORRIGER, 13 points. Ronde 2 : CORRIGER, 3 de ces points partiels et 7 points neufs. Ce texte les
intègre tous, et se recadre sur deux points. L'invariant des suites passe à la clôture de leurs imports. Les
raffinements croisés de `schemas` deviennent des lectures du catalogue, avec leurs appelants nommés. Le texte recadré
se juge comme un livrable neuf. Les verdicts sont consignés au ticket.

**Invariant.** Aucune valeur de la base n'est atteignable depuis `src/engine`, `src/noyau` ou `src/scenes`
autrement que par un argument. Leurs suites de test n'atteignent la base par aucun chemin d'import, même transitif. Une règle lit le catalogue qu'on lui passe. Seul un
hôte compose un catalogue, et il le remet à sa partie.

**Mesure de départ** (2026-11-25, branche à `4c96e8b7f` puis `89f1afcd3`, parseur TypeScript) :
- La façade est lue par 235 fichiers de production : 212 en valeur, 23 en type seul.
- 165 autres fichiers appellent un lecteur, et devront passer le catalogue.
- 19 modules importent un JSON de `src/data` sans passer par la façade : 18 sous `src/engine`, plus
  `src/noyau/codex/registry.ts`.
- 10 fichiers de `src/data/schemas` lisent la base en valeur, une fois retirés les modules purs qui y entrent.
- Les suites qui atteignent la base, mesurées par la ronde 2 :
  - 458 suites d'`engine`, du `noyau` et de `scenes` lisent la façade ;
  - 67 autres l'atteignent hors de la façade (`overrides`, `criticals`, `refFormatLivre`…) ;
  - 70 suites de `schemas` lisent la façade ou un JSON ;
  - 20 suites du noyau passent par `src/hote`, et environ 70 par les testkits de la racine (`src/*.testkit.ts`).
- `rule(` compte 162 appels dans 70 fichiers.
- Le fan-in hors famille va de 8 fichiers (apparence) à 145 (monde et scènes), 128 (objets) et 138 (combat).
- 49 captures à l'import sont localisées hors de `src/data`. La méthode diffère du relevé du § 8.2, qui en comptait
  63 : les deux comptes tombent avec la bascule, sans liste à tenir.

**1. Forme du catalogue, et qui le tient.**
- **La bibliothèque.**
  - C'est la base brute : tous les documents de `SCHEMA_DEFS`, soit les clés de `CLES_DE_DATASET` et les 7
    documents hors du seam (`actions`, `merchantFamilies`, `structureAppearance`, `lieux-services`, `localisation`,
    `ambiance`, `speciesRace`).
  - Elle est gelée, une par processus.
  - Son module est `_racines-vivantes.generated.ts`, régénéré sous `src/data/` et non plus sous `src/data/schemas/`.
    Il n'y a qu'un seul module généré.
- **La composition.**
  - C'est ce que le projet retient, plus les règles optionnelles que la partie a choisies (`JeuDeRegles`, H2).
  - Dans cette migration, elle vaut `compositionTotale` : tous les livres.
  - Les gestes de P3 et P4 sont le ticket du schéma de composition.
- **Le catalogue.**
  - Il vaut `composer(bibliotheque, composition)` : une valeur immuable, qui porte une collection par clé de document,
    et les règles. Son type `Catalogue` est généré des defs.
  - Les variantes sont résolues par `effectiveEntry` sous les règles de la composition.
  - `gatedByRule` ne retire aucune entrée. Il filtre une offre, par `offert(entree, cat)`, qui reprend
    `ouvertParSaRegle` (`src/data/index.ts:1250`). Un objet possédé et une carrière tenue restent résolus quand leur
    règle se coupe en cours de partie.
  - Recomposer donne une valeur neuve, dont l'identité tient lieu de version.
  - Le coût se mesure au socle. La borne est la remise actuelle, d'environ 50 ms.
- **Qui possède quoi.**
  - L'hôte possède la bibliothèque, la composition et le stockage des règles maison (`src/hote/reglesMaison.ts`),
    par `src/hote/catalogue.ts`. Les hôtes sont le pont Godot, l'hôte texte et la page du roguelite.
  - La partie possède son catalogue. Il entre par `EntreesDeLaPartie.catalogue`, qui remplace `reglesMaison`
    (`src/noyau/partie.ts:47`) : une seule source.
  - Le catalogue est porté par `MachinerieDuNoyau.catalogue` (`src/noyau/machinerieDuNoyau.ts`), que fournit le
    propriétaire. Il est hors d'`EtatDeJeu`, donc hors sauvegarde par construction : la sauvegarde ne prend que les
    clés d'`etatInitialDuJeu()` (`src/noyau/persistance/save.ts:6`).
- **Un seul geste, la recomposition.** L'hôte recompose, puis remet le catalogue par `Partie.recomposer(catalogue)`.
  - *Ouverture.* L'hôte compose avec les règles de son stockage. `loadRuleOverrides(entrees.reglesMaison)`
    (`src/noyau/proprietaireDuJeu.ts:91`) disparaît.
  - *Règle maison changée.* Les écrivains de la surface passent à `src/hote` : `surchargerUneRegleMaison`,
    `retablirUneRegleMaison` et `poserLesReglesMaisonPersistees` (`src/noyau/index.ts:409`, `src/noyau/reglesMaison.ts`).
  - *Sauvegarde.* `snapshotSave` reçoit les règles du catalogue de la partie, et non plus `ruleOverrides()`
    (`hotes/godot/pont/pont.ts:1167`). Au chargement, l'hôte compose avec `SaveGame.rules`, puis ouvre.
  - *Coop.* L'hôte envoie les règles de son catalogue (`src/noyau/coop.ts:39`). Chez l'invité, la réception ne charge
    plus rien (`coop.ts:58-59`). La partie émet un événement `reglesDeLHote`, et l'hôte de l'invité recompose et
    remet.
  - *Compendium.* Voir le point 4.

**2. Le moteur pur le reçoit en argument.**
- Une fonction qui lit la base reçoit `cat: Catalogue` en **dernier** paramètre. Un paramètre optionnel qui le précède
  devient `X | undefined`.
- Si la fonction reçoit déjà un contexte, le catalogue va dans ce contexte, et jamais aux deux places : `OpsCtx`
  (`src/engine/ops.ts:523`) et `ContexteDuTest` (`src/engine/decisionDuTest.ts:20`).
- `OpsCtx.resolveTrapping` reste le résolveur de la couche narrative (`src/noyau/monde/resolveursDuNarratif.ts:45-49`) :
  il cherche d'abord dans les objets du paquet, puis dans `cat`.
- Un flux du noyau lit `get().catalogue`. Un utilitaire du noyau sans `get` reçoit `cat`.
- Les lectures vivent dans une zone pure, `src/data/catalogue/`, sans JSON.
  - `entreeDe(cle, id, cat)` est générique. Elle remplace les accesseurs `find…ById` et `indexParId`. Son index se
    mémoïse par l'identité de la collection, dans une `WeakMap`.
  - Les dérivés deviennent des fonctions `(…, cat)` : `dataLabel`, `refLabel`, `levelsForCareer`, `especeParDefaut`.
    Ce dernier remplace le scalaire `DEFAULT_RACE_ID`.
  - Une lecture de champ reste un accesseur. Seul un vrai calcul se mémoïse, par `memoDuCatalogue(clef, calcul,
    cat)`, sur l'identité du catalogue. Ce mémo remplace `memoParVersion`, `indexParChamp` et `bumperDataset`.
  - `regle(id, cat)` remplace `rule(id)` (`src/engine/policy.ts:64`). La `Map` globale des surcharges
    (`policy.ts:47`) disparaît, car les choix sont dans la composition.
- **Les références.** Une référence ne se raffine plus contre un index global. Le schéma garde la forme : il est
  constant, et ne lit aucune donnée. Le parse relève ses repères, par `reperesDuParse` (`src/data/schemas/grammaire/ref.ts:799`).
  Une seconde passe les juge contre un `AccesAuxDocuments` (`src/data/schemas/grammaire/collection-cle.ts:705`).
  - Cette passe juge l'existence d'un id, et rien d'autre : un repère ne porte que `{ path, type, parCle }`
    (`ref.ts:675-679`).
- **Les raffinements croisés.** Certains raffinements croisent un champ du document et un champ de l'entrée visée :
  le cap et les ponts (`defs-scenes/scene.ts:327`), la munition et la pièce (`scene.ts:330-332`), la carrière et le
  profil (`scene.ts:226`). Ils deviennent des lectures `fautesDe…(document, cat)` de `catalogue`. Trois sites les
  appellent :
  - la seconde passe, au chargement de la bibliothèque et au Compendium ;
  - l'éditeur de scène, par `refusDeLEntite` (`scene.ts:313-319`) ;
  - le chargement de paquet du noyau, par `parseProject` (`src/noyau/worldMap.ts:752`).
- **Le sort des 10 fichiers de `schemas` qui lisent la base.** Ils deviennent des fautes, ou des lectures
  `(…, cat)` de `catalogue` :
  - `defs-scenes/scene.ts:60,64` (navire à ponts, `refusDePoseDesPonts`, munitions, carrière) ;
  - `narratif.ts:22` et `worldmap.ts:24` ;
  - `grammaire/reference.ts:52` (`psychologies`, `psychologyLabel`) ;
  - `grammaire/mecanique.ts:17,83` (`findTraitById`, `GROUPES_TIRABLES`) ;
  - `defs/presets-de-personnage.ts:36` ;
  - `defs-scenes/effets.ts:56` et `grammaire/valeurs.ts:16,46`, dont le libellé ou la saison passent au message de la
    faute ;
  - `defs/especes-aleatoires.ts:9-10`, qui lit `species` et `reglesOptionnelles` dans `cat` ;
  - `grammaire/livres-extraits.ts:10-12`, qui lit `books` dans `cat`, sous `memoDuCatalogue`.
  - Le Compendium juge la bibliothèque *candidate* : une entrée créée, puis référencée par une autre, est acceptée sans
    `npm run gen`.
  - `lireLEspace`, `idsVivants`, `fige` et `poserRegimeVivant` meurent.
  - La valeur `IDS_PAR_ESPACE` se régénère sous `src/data/`. `schemas` n'en garde que le type `IdsParEspace`, que lit
    `Id<T>`.

**3. La structure qui ferme la classe.** La règle de couche `COUCHES` (`scripts/guards/lib/couches.mjs`) porte la
fermeture. Le lint `murs/*` l'applique au job `types` (`npm run lint`, `ci.yml:205`). Dans `COUCHES`, le dossier le
plus long gagne (`couches.mjs:156`).

| Zone | Dossier | Contenu | Importe |
|---|---|---|---|
| `schemas` | `src/data/schemas` | grammaire, defs, types d'ids, type `Catalogue`, et les modules purs de `src/data` qui y entrent au socle (`icons`, `cadres`, `fonds`, `paysages`, `sons`, `source`, `dossiers`, `datasets`, `rangees`, `serialize`, `slug`, `*.types`, `icones.generated`, `sourceRefs`, `graphieOpsDeTalent`) | `engine`, feuilles ; `survit: true` |
| `catalogue` | `src/data/catalogue` | lectures pures `(…, cat)`, dont celles des modules de donnée de `src/data` ; `catalogueDeTest.testkit.ts`, et les testkits purs de `src/data` (`idDeFixture`, `deDeLaTable`…) | `schemas`, `engine`, feuilles ; `survit: true` |
| `data` | `src/data` | JSON, bibliothèque, `composer`, `porteDeLHote.ts`, atelier du Compendium | `engine`, `schemas`, `catalogue`, feuilles |
| `engine` | `src/engine` | règles pures | `schemas`, `catalogue`, feuilles ; plus `data` |
| `noyau`, `scenes` | inchangés | | `engine`, `schemas`, `catalogue`, feuilles ; plus `data` |
| `hote` | `src/hote` | détenteur | ce qu'il importe, plus `data` par sa seule porte `src/data/porteDeLHote.ts` |
| projets | `projets/*` | | les ouvertures `data` de #4933 (Roguelite : ne plus importer la base de données ni les scénarios de test) et de #5007 (Jeu de rôle : même titre) se ferment ; un projet lit son catalogue par `src/hote` |

La table gagne deux champs. Ce sont deux règles de couche, que le lint porte : une branche neuve de `purete`, et un
test de plus dans `testsSurvivants` (`couchesLint.mjs:196-207`).
- **`json: false`** sur `engine`, `noyau`, `scenes`, `schemas` et `catalogue`. `murs/purete-imports` y refuse tout
  import d'un `.json`, même interne à la zone. Aujourd'hui, `fermeture` laisse passer un arc interne
  (`couches.mjs:208`).
  - Stock à la pose : les 19 modules lecteurs de JSON, plus `src/scenes/fixtures/contenuDuCommun.ts:8`
    (`paquet-de-test.json`).
  - Ce paquet de test devient un module `.ts` littéral, dans la famille 12.
- **`suitesSansDonnee: true`** sur les mêmes zones. `murs/tests-survivants` refuse à leurs suites tout arc vers une
  zone dont la clôture d'imports atteint `data`. Cette clôture se calcule sur la table, comme celle de
  `fermeParLaSurvie` ; ce n'est pas une liste. Elle couvre `data`, `hote`, `texte`, `godot`, `racine` et les projets.
  - Aujourd'hui, `purete` saute les suites (`estFichierVitest`), et `testsSurvivants` ne juge que la survie et les
    projets.
  - Stock à la pose : les suites mesurées plus haut.
  - Un testkit de la racine qui ne lit pas la base passe en zone `catalogue`. Celui qui la lit sert les invariants
    de `src/data`.
  - Les suites de `schemas` qui parsent la base livrée passent sous `src/data`.
  - Le champ se pose à la bascule.

Avec cette table, un module ou une suite de `engine`, `noyau` ou `scenes` ne charge aucune donnée. `import { skills }
from '../data'` et `import x from '../data/x.json'` sont refusés, et aucune zone qu'ils lisent n'exporte de donnée. La
surface `src/noyau/index.ts` perd ses réexports de la façade et de l'atelier. Elle garde ceux des modules purs passés
à `schemas`.

**Limite déclarée.** Un état global du noyau, posé par un hôte, rouvrirait la classe : un `poserLeCatalogue` du modèle
de `tablesPosees` (`src/noyau/tablesPosees.ts:195,205`). Aucune API ne l'offre, mais aucune structure ne l'interdit :
TypeScript ne refuse pas un `let` de module. C'est la classe « état global du noyau », celle de #4862 (Un seul jeu
branché à la fois : une partie suspendue sur une fenêtre bloque toute autre partie de l'hôte). Cette limite est
remontée à l'utilisateur.

**4. Ce que deviennent la façade et la couture.**
- `src/data/index.ts` cesse d'être une façade de valeurs :
  - ses types passent à `schemas` ou à `catalogue` ;
  - ses accesseurs et ses fonctions passent à `catalogue`, sous `cat` ;
  - ses imports JSON passent à la bibliothèque.
- Chaque module de donnée de `src/data` (un JSON importé, ou une lecture de la façade) devient une lecture `(…, cat)`
  de `catalogue`, avec la famille de ses lecteurs : `poseDesPonts`, `apparencesObjets`, `shipCriticals`, `criticals`,
  `pregens`, `mutations`, `effectTables`, `arcanePhenomena`, `artilleryMisfire`, `interludeEvents`, `obsessions`,
  `oups`, `peripeties`, `saisons`, `structureCriticals`, `valeursNeuves`, `refFormatLivre`, `bookMarker`, `livres`.
- Meurent à la bascule, faute d'état mutable : `overrides.ts` et `versionDataset.ts`, avec les gardes
  `src/data/index-vivant-guard.test.ts` et `seam-ecriture-guard.test.ts`. La classe est soldée par la structure, donc
  sa garde et son stock partent (doctrine `structure-avant-garde`). La vérification de `racines-vivantes.test.ts` se
  rejoue sur la bibliothèque.
- **Le Compendium** (`src/data/atelierDuCodex.ts`) devient pur.
  - `enregistrerEntree(…, bib)` et `supprimerEntree(…, bib)` rendent `{ bibliotheque, fichier, texte, avant }` ou un
    refus. `validerMutation` juge la bibliothèque candidate, références comprises (point 2).
  - La reprise disparaît. L'hôte garde l'ancienne bibliothèque tant que l'écriture disque n'est pas confirmée (le
    `If-Match` de `panneau_du_compendium.gd:121`). Il la remplace ensuite, recompose, et remet le catalogue à la
    partie.
  - Ce geste remplace `publierSiAcceptee` et `abonnerAuxDatasets`.
  - `hotes/godot` atteint l'atelier par `src/hote/compendium.ts`, qui le lit par la porte `src/data/porteDeLHote.ts`.
  - `SessionDuCompendium` (`src/noyau/codex/session.ts`) et `codex/registry.ts` lisent la bibliothèque et le
    catalogue qu'on leur passe.
- `Id<T>` ne change pas ici. Il reste à L3.

**5. Transition.** Ses fossiles sont inscrits au registre des fossiles de #4919 (Choisir, par livre, le contenu
proposé au jeu). Tous lisent `data`. La bascule ferme `data` aux trois zones, et le lint de couche refuse alors chacun de
ces fossiles : la bascule est donc leur cliquet structurel. C'est un refus du lint (`npm run lint`), pas du
compilateur.
- **Fossile 1 : `catalogueDuProcessus()`.** Il vit dans `data`, compose sur la base globale vivante et sur `rule`, et
  se mémoïse par `versionDesDatasets()`.
- **Fossile 2 : le défaut de paramètre.** Une fonction migrée déclare `cat: Catalogue = catalogueDuProcessus()`.
  - Ses appelants non migrés ne changent pas. Un lot ne touche donc que ses propres fichiers, ce qui rend les lots
    disjoints.
  - Un appelant migré passe `cat` explicitement à tout appelé qui le prend.
  - La bascule retire les défauts. Le typecheck nomme alors chaque appel resté sans `cat`. Le reste se sonde à tout
    moment, sur une copie locale aux défauts retirés.
- **Fossile 3 : la façade, et les exports anciens des modules de donnée.** Ils restent pour les lecteurs non migrés.
  Leur logique passe à `catalogue`, et l'ancien export la rappelle sur `catalogueDuProcessus()`.
- **Fossile 4 : `rule(id)`, sa `Map`, `OPTIONAL_RULES` et `loadRuleOverrides`.** Un lot remplace `rule` par `regle`
  dans ses fichiers.
- **Fossile 5 : la repose.** Le propriétaire pose `MachinerieDuNoyau.catalogue` depuis le fossile 1. Il le repose sur
  `abonnerAuxDatasets` et sur un changement de règle, jusqu'au lot du Compendium et des hôtes.
- **Fossile 6 : le catalogue optionnel d'un contexte.** `OpsCtx` et `ContexteDuTest` portent `catalogue?: Catalogue`,
  que lit un seul accesseur, `catalogueDu(ctx) = ctx.catalogue ?? catalogueDuProcessus()`. Le champ devient requis à
  la bascule. Ainsi, aucun littéral de contexte d'une autre famille ne casse dans un lot.

**6. Découpage.** Un ticket par famille. Un lot tient en environ 45 minutes de codeur : au plus 6 fichiers de
production migrés et leurs suites, ou environ 15 fichiers en tout. Grâce aux fossiles 2 et 6, un lot ne touche que ses
fichiers. Deux exceptions sont nommées, et le lot de l'appelé les solde :
- un appel qui passe la fonction en valeur (`.map(findSpellById)`, `grimoire.ts:117` ; `.filter(ouvertParSaRegle)`,
  `creation.ts:61`) reçoit l'index du tableau à la place de `cat`. Le lot le réécrit en `(x) => f(x)`. La mesure en
  compte 11 sites de production.
- une fonction à paramètre rest (`character.ts:104`, `actionRegistry.ts:634`) prend `cat` avant le rest.

 Plusieurs lots peuvent donc voler en parallèle (au plus 3), du moment que leurs ensembles sont disjoints. Un
lot n'est fini que si quatre preuves tiennent :
- aucun de ses fichiers n'importe une valeur de `data` hors de `schemas` et `catalogue`, et aucun n'appelle `rule(`
  (`git grep`) ;
- chaque appel, dans ses fichiers, d'une fonction qui prend `cat` le passe explicitement (sonde aux défauts retirés,
  restreinte aux fichiers du lot) ;
- le typecheck complet et `npm run test:perimetre` sont verts ;
- ses suites sont sur `catalogueDeTest`, et ne lisent plus la base.

L'ordre suit le graphe d'appel, appelés avant appelants. Un appelant migré trouve ainsi ses appelés prêts. Les cycles
entre combat, objets, personnage et magie laissent des appels par défaut ; la sonde du lot les nomme, et le lot qui
ferme le cycle les solde.

| Ordre | Famille | Fichiers de production | Sites de la base | Fan-in hors famille | Lots estimés |
|---|---|---|---|---|---|
| 0 | Socle : zones `schemas` et `catalogue` (sans bascule), modules purs déplacés, type `Catalogue`, bibliothèque, `composer`, `entreeDe`, `memoDuCatalogue`, `regle`, `offert`, `catalogueDeTest`, partie et `MachinerieDuNoyau.catalogue`, fossiles 1, 2 et 5 | ~25 déplacés | — | — | 4 |
| 1 | Grammaire : seconde passe des références sur `AccesAuxDocuments`, fautes croisées et leurs trois appelants, 10 fichiers de `schemas`, `IDS_PAR_ESPACE` sous `data`, 70 suites de `schemas` | 13 | 24 imports | — | 5 |
| 2 | Apparence (`noyau/apparence/*`, `animation`) | 6 | 52 | 8 | 1 |
| 3 | Monde et scènes (`noyau/monde/*`, `sceneEdit*`, `worldMap*`, `engine/structures`, `poseDesPonts`, `valeursNeuves`) | 30 | 116 | 145 | 5 |
| 4 | Repos, maladie, temps (`clock`, `disease`, `rest`, `restFlow`, `innFlow`…) | 12 | 80 | 40 | 2 |
| 5 | Magie (`magic`, `grimoire`, `corruption`, `sortsDuPnj`, `mutations`, `obsessions`, `oups`, `arcanePhenomena`, `effectTables`…) | 18 | 68 | 90 | 3 |
| 6 | Objets et commerce (`items`, `qualities/*`, `merchantFlow`, `tavernFlow`, `apparencesObjets`…) | 29 | 202 | 128 | 5 |
| 7 | Personnage et carrières (`character`, `creation*`, `careerSlots`, `interludeFlow`, `pregens`, `interludeEvents`…) | 34 | 314 | 125 | 6 |
| 8 | Maritime et fluvial (`sea*`, `river*`, `ship*`, `travel*`, `shipCriticals`, `saisons`, `peripeties`…) | 33 | 260 | 64 | 6 |
| 9 | Combat (moteur, flux et voisins : `combat`, `ops`, `traits/*`, `combatFlow`, `actionRegistry`, `criticals`, `structureCriticals`, `artilleryMisfire`…) | 55 | 371 | 138 | 10 |
| 10 | Codex et désignations (`noyau/codex/*`, `designations`, `refFormatLivre`, `bookMarker`, `livres`) | 11 | 371 | 16 | 3 |
| 11 | Transverses du noyau et du moteur : les 165 appelants (`cascade`, `partie`, `etat`, `tablesDuJeu`…) reçoivent et passent `cat` | 165 | — | — | 14 |
| 12 | Compendium, hôtes, scènes, projets : atelier pur, `porteDeLHote.ts`, `src/hote/catalogue.ts`, règles maison chez l'hôte, sauvegarde et coop, `src/scenes` (15), `projets/roguelite/src/noyau` (6), `projets/jeu-de-role/campagnes/lib.mjs`, fossile 5 | ~35 | ~230 | — | 5 |
| 13 | Bascule : `COUCHES` ferme `data` aux trois zones et pose `json` et `suitesSansDonnee` ; les testkits de la racine reçoivent leur zone ; les défauts tombent ; la façade, `overrides.ts`, `versionDataset.ts`, les fossiles et les deux gardes meurent | — | — | — | 2, plus le reste de la sonde |

L'estimation est d'environ 75 lots, à 25 % près. Les familles 2 à 12 se partagent les suites d'`engine`, du `noyau` et de
`scenes`, chacune celles de ses fichiers. Les suites qui passent par `src/hote` ou par les testkits de la racine
migrent avec la famille du fichier qu'elles testent.

**Critère « N+1 = une ligne ».**
- Un dataset neuf, c'est son def puis `npm run gen` : le type `Catalogue` et la bibliothèque sont générés.
- Un lecteur neuf, c'est un paramètre `cat`.
- Un projet neuf, c'est sa composition, une donnée remise à `composer`.

**7. Les tests.**
- `catalogueDeTest(partiel)` (`src/data/catalogue/catalogueDeTest.testkit.ts`) donne une collection vide à chaque clé
  absente. Le test déclare ses entrées (fiche `user-arbitrage-tests-jamais-sur-donnee-data-driven`). C'est un
  testkit, donc il est jugé par `purete`, comme la production.
- Une suite d'`engine`, de `noyau` ou de `scenes` qui atteint la base, même transitivement, est refusée par
  `suitesSansDonnee` dès la bascule.
  Chaque lot migre donc les suites de ses fichiers. Les 97 suites qui posent leurs entrées par `setDataset` passent à
  `catalogueDeTest`.
- Les invariants génériques sur la bibliothèque livrée restent sous `src/data` : parse, références par la seconde
  passe, `obtainability`. Ils lisent la bibliothèque.
- `isolate:false` (`vitest.config.ts:36`) cesse d'être un risque : aucun état de base ne fuit d'un fichier au suivant.
- Une assertion par compte, liste ou instantané de donnée réelle que le lot croise se réécrit en invariant. Le solde
  de #2995 (Ajouter une donnée ne rougit aucun test) reste à son ticket.

## 6. Critère de fini du chantier

1. `valeurs.ts` du roguelite ne nomme aucun id de la bibliothèque et ne porte aucune connaissance de règle.
2. Une composition « système seul » joue un combat.
3. Le jeu de rôle passe sa suite et son lot de recettes sous la composition « tous les livres ».
4. Aucun id de donnée littéral ne compile dans `src/engine` ni `src/noyau`.
5. Un test du noyau compose son contenu par la composition de test (P6).

## 7. Hors périmètre, chacun à son ticket

- Le concept de chronique ou de dynastie (« L'amour, le succès et l'argent ») et ses lacunes du système, dont
  l'amour, qui passera par une cérémonie d'arbitrage.
- Le contenu propre du roguelite qui ne quitte pas `valeurs.ts` dans L5, chacun avec ce qu'il demande au noyau :

  | Point | Ce que le noyau a | Ce qu'il faut |
  |---|---|---|
  | `BATIMENTS` | Ce qu'un palier ouvre : qualité du repos, Disponibilité, soins | Une forme neuve, la possession à niveaux (verbatim 1). Elle est voisine des établissements de #4277 (Données de lieu : établissements nommés, qualité à trois niveaux), car le relais est une auberge dont la qualité monte avec le palier. |
  | `EPREUVES`, `ACTIONS_A_JET`, `CAMP` | `usable.actions`, le `Flow` `test`, les Effets `startCombat` et `giveMoney` du schéma de scène | Aucune forme neuve. C'est un doublon à réécrire en scène, avec au plus une extension du vocabulaire (qui tente l'action). |
  | `Voie` | Les sorts et leur domaine dans la bibliothèque ; leur achat aux PX par le noyau (`prixDuSort`, lu par `projets/roguelite/src/jeu/carrieres.ts:43-46`) ; les sorts mineurs choisis à la création | Aucune forme neuve : une sélection des sorts du domaine, et ce que la Salle d'armes propose à chaque niveau de carrière, valeur d'adaptation (#4947). |
  | `identite`, `designations`, `dotation` des profils | La création choisit le talent et désigne les emplacements « au choix » (`designateSlot`, `skillSlots`, `src/engine/careerSlots.ts`) ; l'op `giveTrapping` | Une forme en donnée pour des choix de création tranchés d'avance, partagée avec les prétirés (#3884, Prétirés officiels à fiche figée) et l'Atelier des PNJ. |

  `Epreuve`, `FluxDEpreuve`, `Identite` et `Designation` vivent dans `projets/roguelite/src/noyau/`, la couche
  d'adaptation du roguelite, qui lit des internes du noyau hors de sa porte (`heros.ts:13-19`).
- Les livres VO à autoriser comme sources (*Archives of the Empire Vol III*, *Deft Steps Light Fingers*…) :
  décision de l'utilisateur, livre par livre.
- Les établissements de #4277 (Données de lieu : établissements nommés, qualité à trois niveaux), qui restent à
  leur ticket et deviennent un client de L1.

## 8. Annexe : mesure de L0 (2026-11-25, à `6b222896d`)

Les scripts de relevé ont tourné hors du dépôt. Ils ne sont pas gardés, car L3 rend le premier relevé
incompilable et L1 rend le second testable par banc. Les chiffres ci-dessous sont ceux de leur sortie.

### 8.1 Ids de donnée écrits en dur (`src/engine`, `src/noyau`, hors tests)

- **Méthode.** AST de 273 fichiers. Les ids viennent de `IDS_PAR_ESPACE` (`src/data/schemas/_ids.generated.ts`).
  - Un littéral égal à un id compte.
  - Il est écarté comme *ambigu* quand son type contextuel est un vocabulaire du moteur (`Difficulty`,
    `DefenseMode`…), ou quand son seul espace est interne.
- **Totaux.** 3560 littéraux égaux à un id. 1730 sont ambigus. **1830 sont retenus**, dans 214 fichiers, soit 595
  ids distincts dans 53 espaces.
- **La frontière entre système et contenu se lit dans les espaces.**
  - Espaces du *système*, qu'aucun projet ne retire : caractéristiques 294, enjeux de jet 238, règles optionnelles
    159, règles 147, actions 132.
  - Espaces de *contenu*, sujets à la composition : compétences 183, éléments de décor 83, états 72, qualités 46,
    carrières 41, groupes 31, talents 30, et une longue traîne.
  - Cette frontière est l'hypothèse **H3**, à juger en L1 : les espaces du système forment le socle de l'édition,
    hors composition.
- **Classes (heuristique par espace, à relire en L4).** Emplois 1095 (entre 287 et 504 emplois distincts avant
  fusion par rôle), autres 566, ops ou `Flow` 141, doublons 28. Le cas de `src/engine/combat.ts:427` donne `esquive`
  comme emploi et `agilite` comme doublon.
- **Familles les plus lourdes.** `noyau/seaVoyageFlow` 155, `noyau/combatFlow` 127, `engine/combat` 93,
  `engine/ruleRefs` 76, `noyau/restFlow` 59, `noyau/planDeLaCaraque` 52, `engine/magic` 46.
- **Non vu par la mesure.** Les ids construits par concaténation, ou importés d'un autre module ; les 1730 ambigus.

### 8.2 Chargement par processus (H1)

- **Un projet par processus.**
  - Pont Godot : un second `demarrer` est refusé.
  - Hôte texte : un graphe Vite unique.
  - Page du roguelite.
  - Le relay n'importe rien de `src/`.
  - En coop, l'hôte et l'invité sont deux processus. Chacun compose seul, d'où l'empreinte de H2.
  - Le seul cas multi-composition est Vitest : `isolate:false` (`vitest.config.ts:36`), où une composition fuit
    d'un fichier au suivant.
  - Non vérifié : le worker `pile` du pont.
- **L'invalidation existe** : `memoParVersion`, `indexParId` et `indexParChamp` (`src/data/versionDataset.ts`),
  incrémentés par `bumperDataset` à chaque écriture d'`overrides.ts`. 172 mémos s'en servent.
- **63 captures n'en profitent pas** : 22 dérivés, 38 appels au chargement, 3 effets. Exemples :
  - `src/noyau/actionRegistry.ts:832` et `:893` ;
  - `src/noyau/monde/aretes.ts:95` ;
  - `src/noyau/marchandEnVue.ts:73` ;
  - `src/data/index.ts:1464` ;
  - `src/engine/seaNavigation.ts:57` ;
  - `src/noyau/restFlow.ts:543` ;
  - `projets/roguelite/src/jeu/boutiques.ts:57`.

  Le Compendium mute déjà la base en place, par `src/data/atelierDuCodex.ts`. Ces captures ne voient donc pas ses
  éditions aujourd'hui : c'est un défaut existant, qui se solde en L1.
- **Datasets hors d'`overrides.ts`** : `ACTIONS`, `merchantFamilies`, `structureAppearances`, `lieuxServices`,
  `tablesDeLocalisation`, `ambiance`, `DEFAULT_RACE_ID`.
- **Aucun appel ne pose aujourd'hui une composition au chargement.** Seul l'éditeur appelle `setDataset` en
  production. La pose au chargement est à écrire.

### 8.3 `projets/roguelite/src/jeu/valeurs.ts` (L5)

| Classe | Exports | Lignes |
|---|---|---|
| Sélection | `PROFILS` (22 carrières), `SORTS_MINEURS`, `SORTS_DES_VOIES`, `COMPETENCES_UTILES`, `TALENTS_HORS_DU_COMBAT`, `ESPECES`, `PRIERE_DE_SOIN`, créatures des `DESTINATIONS`, `ARMES_`, `ARMURES_DE_LA_FORGE`, `REMEDES_DE_L_HOSPICE`, `GROUPES_SANS_COMPETENCE` | ~95 |
| Modification en place | `PROFILS.nom`, `ESPECES.nom` ; `identite` et `dotation` n'existent pas sur les carrières du noyau | ~25 |
| Connaissance de règle | `MAIN_SECONDAIRE`, qui double `isOffHandEligible` (`src/engine/items.ts:693`) ; `MUNITION_DE_FAMILLE`, `MUNITION_DES_ARMES` et `MUNITIONS`, face à `ammoFamily` et `defaultAmmo` (`items.ts:1852`, `:1885`) | 6 |
| Contenu propre | `BATIMENTS`, `EPREUVES`, `ACTIONS_A_JET`, `CAMP`, `Voie`, `ROLES`, `RANG_DU_ROLE`, `CONSIGNES`, `LIEUX_DE_SEJOUR`, `CHAMBRE_DU_RELAIS` | ~110 |
| Réglage | prix, butin, PX, trophées, taille du groupe, or initial, semaine de repos | ~30 |
| Affichage et code | libellés, pictos, utilitaires | ~60 |

Les tests du roguelite qui verrouillent ces valeurs par listes ou par comptes se réécrivent en L5, au sens de
#2995 (Ajouter une donnée ne rougit aucun test) : `recrues.test.ts`, `forge.test.ts`, `creation5e.test.ts`,
`catalogue.test.ts`, `progression.test.ts`, `sauvegarde.test.ts`.

