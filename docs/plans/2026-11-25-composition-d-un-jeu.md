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
- **P6 — Un test compose son propre contenu** par la couture `overrides.ts`, déjà le patron de 102 tests
  (verbatim 7 ; #2995, Ajouter une donnée ne rougit aucun test). Ce plan fournit la composition de test ; la
  migration des 458 fichiers de test reste à #2995.
- **P7 — Tout contenu de projet s'édite à l'éditeur** (doctrine `campagne-recreable-a-l-editeur`). Le Compendium de
  Godot édite le livre du projet comme la bibliothèque, et montre la provenance et l'écart d'une entrée modifiée.

**Hypothèses révisables, tranchées par L0.**

- **H1 — Une composition par processus, posée par `overrides.ts` au chargement.** Le pont Godot, l'hôte texte et la
  page du roguelite n'ouvrent chacun qu'un projet. La solution concurrente est un catalogue passé en valeur aux 235
  lecteurs. La mesure dira si un processus doit tenir deux compositions à la fois (coop, tests en parallèle).
- **H2 — Deux étages de choix.** Le projet fixe ce qui est disponible, la partie choisit parmi ce disponible
  (verbatim 5). Le choix de la partie voyage par les canaux qui portent déjà les règles : `SaveGame.rules` et
  `packHouseRules`, étendus à l'empreinte de la composition.

## 5. Lots

| Lot | Contenu | Après | Preuve de fini |
|---|---|---|---|
| L0 | Mesure, en lecture seule. (a) Chaque id de donnée littéral de `src/engine` et `src/noyau`, classé : devient op/`Flow`, ou reste irréductible et passe par un emploi. (b) Qui charge quoi, par processus (H1). (c) Chaque export de `valeurs.ts`, classé. | — | Une annexe chiffrée à ce plan ; H1 et H2 tranchées ou remontées. |
| L1 | Le schéma de la composition, posé par `overrides.ts` (P3, P4, P7) : livres, éléments, modification en place, dérivation, livre du projet. L'édition et la langue de #1816 (WFRP 5e : édition sélectionnable et axe de langue VF/VO) en sont deux champs. | L0 | Tests sur un livre de test : retenir, exclure, modifier, dériver, ajouter. Un refus nomme la chaîne. Le Compendium crée, modifie et supprime une entrée du livre d'un projet. |
| L2 | Chaque processus charge la composition de son projet. Elle voyage dans la sauvegarde et dans la coop (H2). Absorption de `gatedByRule`, des registres narratifs, des champs locaux des ports. Solde de #4919 (Choisir, par livre, le contenu proposé au jeu). | L1 | `npm test` complet et `npm run typecheck` verts. Le lot `npm run jeu-de-role:recette` passe, parcours `campagne` et `editeur` compris. La reprise d'une sauvegarde sous une autre composition est refusée, et l'invité d'une coop reçoit la composition de l'hôte. `git grep` des anciens porteurs vide. |
| L3 | `Id<T>` se ferme à la composition (P5). | L2 | Un id littéral dans une règle de `src/engine` ou de `src/noyau` ne compile pas (banc de typage). |
| L4 | Les ids en dur deviennent ops ou `Flow` (P1), et le reste passe par des emplois (P2). Par familles, dans l'ordre que donne L0. | L3 | Une composition « système seul », avec un livre de test, joue un combat par le noyau. Typecheck complet vert sans littéral d'id. |
| L5 | Premier client : le roguelite. `valeurs.ts` ne garde rien de ce qui touche au noyau (verbatim 6) : ses sélections et ses modifications deviennent sa composition, et `MAIN_SECONDAIRE` et `MUNITION_DE_FAMILLE` passent au noyau. `.claude/rules/roguelite.md` est réécrite. `BATIMENTS`, `EPREUVES` et `CAMP` suivent quand le noyau a leur forme, ce qui est hors de ce plan. | L2 ; la famille d'armes de L4 | `npm run roguelite:recette` passe, avec des images identiques à la référence. `valeurs.ts` ne nomme plus aucun id de la bibliothèque. |

## 6. Critère de fini du chantier

1. `valeurs.ts` du roguelite ne nomme aucun id de la bibliothèque et ne porte aucune connaissance de règle.
2. Une composition « système seul » joue un combat.
3. Le jeu de rôle passe sa suite et son lot de recettes sous la composition « tous les livres ».
4. Aucun id de donnée littéral ne compile dans `src/engine` ni `src/noyau`.
5. Un test du noyau compose son contenu par la composition de test (P6).

## 7. Hors périmètre, chacun à son ticket

- Le concept de chronique ou de dynastie (« L'amour, le succès et l'argent ») et ses lacunes du système, dont
  l'amour, qui passera par une cérémonie d'arbitrage.
- La possession à niveaux, forme générique du noyau (verbatim 1). Elle est cliente de ce chantier : sa forme au
  noyau, ses instances comme contenu de projet. Les `BATIMENTS` du roguelite en dépendent ; ses `EPREUVES` et son
  `CAMP` attendent de même une forme au noyau avant de quitter `valeurs.ts`.
- Les livres VO à autoriser comme sources (*Archives of the Empire Vol III*, *Deft Steps Light Fingers*…) :
  décision de l'utilisateur, livre par livre.
- Les établissements de #4277 (Données de lieu : établissements nommés, qualité à trois niveaux), qui restent à
  leur ticket et deviennent un client de L1.
