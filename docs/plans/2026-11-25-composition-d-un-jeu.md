# La composition d'un jeu : un système, une bibliothèque, ce que chaque projet en prend

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

## 3. Mesure (à `origin/main`, 2026-11-25)

- **Base globale.** `src/data/index.ts` importe 97 fichiers JSON au chargement du module et exporte 182 constantes,
  que lisent 237 fichiers de `src/engine` et `src/noyau`.
- **Entrées sourcées.** Chaque entrée porte sa `source` : créatures 618/618 (12 livres), talents 187/187,
  carrières 172/172, objets 529/529. Le catalogue compte 34 livres (`books.json`).
- **Une entité présente dans plusieurs livres** reste une seule entrée, avec N emplacements et N variantes
  (doctrine `une-entite-n-livres-n-variantes`). Filtrer par livre, c'est donc choisir des emplacements et des
  variantes, et pas seulement retirer des entrées.
- **Le contenu qu'un jeu remet au noyau** (`ContenuDUnJeu`, `src/hote/contenu.ts:12-16`) se limite aux campagnes,
  aux scénarios et aux dossiers. Aucune donnée n'y passe.
- **Mécanismes partiels, à absorber dans le mécanisme unique :**
  - Règles optionnelles : 115 entrées, choisies par le joueur dans les réglages de Godot. Elles sont stockées par
    machine (`wfrp4.house-rules`, `src/hote/reglesMaison.ts`) et lues partout par `rule(id)`
    (`src/engine/policy.ts`).
  - Le contenu gaté par une règle : `gatedByRule` existe sur les entrées (`carrieres-crb`), mais le registre ne
    déclare pas structurellement le contenu qu'il gate (`docs/regles-optionnelles.md`).
  - Les registres narratifs d'un paquet de campagne : `presetsPnj`, une créature modifiée champ par champ par
    `resolvePresetCreature` ; `objets` ; `etats`.
  - Les champs locaux des ports, qui modifient le catalogue (`docs/campagne-authoring.md:118`).
  - L'édition et la langue (#1816, WFRP 5e : édition sélectionnable et axe de langue VF/VO).
  - Le filtre par livre (#4919, Choisir, par livre, le contenu proposé au jeu).
  - Les établissements de #4277 (Données de lieu : établissements nommés, qualité à trois niveaux) : prix et
    offres de scénario.
  - `projets/roguelite/src/jeu/valeurs.ts` (365 lignes). Il porte des sélections d'ids (`PROFILS`, `SORTS_*`,
    `COMPETENCES_UTILES`, `TALENTS_HORS_DU_COMBAT`, `ESPECES`, `ARMES_`, `ARMURES_DE_LA_FORGE`, `REMEDES_`,
    adversaires des `DESTINATIONS`), des modifications (nom, identité et dotation d'une carrière), du contenu propre
    (`BATIMENTS`, `DESTINATIONS`, `EPREUVES`, `CAMP`) et des réglages chiffrés. `MAIN_SECONDAIRE` et
    `MUNITION_DE_FAMILLE` ressemblent à de la connaissance de règle à rendre au noyau. `.claude/rules/roguelite.md`
    en fait aujourd'hui la seule source du catalogue : cette règle se révise.
- **Dépendances.**
  - Entre entrées : les références sont typées (`src/data/schemas/grammaire/ref.ts`), et les relations inverses
    existent (`src/noyau/codex/relations.ts`).
  - D'une règle vers une entrée : des ids sont écrits en dur. Sondage sur six compétences dans `src/engine` et
    `src/noyau`, hors tests : `resistance` 21 fichiers, `esquive` 19, `perception` 11, `athletisme` 8, `calme` 7,
    `corps-a-corps` 7. `src/engine/combat.ts:427` écrit `{ skill: { id: 'esquive' }, characteristic: 'agilite' }`,
    alors que l'entrée de la compétence porte déjà sa caractéristique. `weaponSkillId` (`combat.ts:237`) est déjà
    une indirection, mais en code.

## 4. Principes et hypothèses

**Principes.**

- **P1 — Une règle s'exprime en ops ou en `Flow` dans la donnée**, au maximum (verbatim 8). L'id qu'elle vise est
  alors une donnée comme une autre : il se sélectionne, se modifie, et les références le vérifient.
- **P2 — Le code irréductible ne nomme aucune entrée.** Le moteur de dés et l'ordre du round en sont. Ce code passe
  par un *emploi* : un rôle typé, déclaré par la règle qui en a besoin. Le livre de base de l'édition le lie par
  défaut, et un projet le relie s'il s'écarte du livre (verbatim 7). La table des emplois est le reste de P1, et
  elle doit être la plus courte possible.
- **P3 — Les gestes de composition sont les quatre du verbatim 4, plus le contenu propre.** On retient des livres.
  Dans ces livres, on retient des éléments. On modifie une entrée champ par champ sur son id, en gardant sa
  provenance : c'est le précédent `presetsPnj`, généralisé. On ajoute son propre contenu, qui forme le *livre du
  projet* : mêmes schémas, `source` au nom du projet.
- **P4 — Une composition incohérente est refusée au chargement**, avec la chaîne cassée nommée : une référence
  orpheline, ou un emploi non lié d'une règle retenue (verbatim 5).
- **P5 — Le refus est structurel.** Un id de donnée littéral dans une règle de `src/engine` ou de `src/noyau` ne
  compile plus. Les ids se brandent par `Id<…>`, et une règle ne les obtient que de la donnée ou d'un emploi
  (credo ; #2724, Gardes vers structure : rendre le contournement incompilable).
- **P6 — Les tests composent leur propre contenu** : un test est un petit projet. Il ne lit aucune donnée éditable
  (verbatim 7).

**Hypothèses révisables, à trancher par la mesure du lot L0.**

- **H1 — Une composition par processus.** Le pont Godot, l'hôte texte et la page du roguelite n'ouvrent chacun
  qu'un projet. La composition s'applique donc au chargement, avant tout lecteur. La solution concurrente est un
  catalogue passé en valeur jusque dans les 237 lecteurs. La mesure dira si un processus héberge deux compositions
  (coop, tests).
- **H2 — Deux étages de choix.** Le projet fixe ce qui est disponible, la partie choisit parmi ce disponible : les
  règles optionnelles d'aujourd'hui, et demain les livres (verbatim 5). Les règles optionnelles passent alors du
  stockage par machine à la partie.
- **H3 — L'empreinte de la composition** se porte dans la sauvegarde et se vérifie entre l'hôte et l'invité d'une
  partie coop.
- **H4 — Le Compendium Godot** édite la bibliothèque et le livre du projet par le même éditeur. Il montre la
  provenance et l'écart d'une entrée modifiée.

## 5. Lots

| Lot | Contenu | Preuve de fini |
|---|---|---|
| L0 | Mesure, en lecture seule. (a) Tout id de donnée littéral de `src/engine` et `src/noyau`, classé en « devient op/`Flow` » ou « reste irréductible, donc emploi ». (b) Les 237 lecteurs de la base, et qui charge quoi par processus, pour H1. (c) Chaque export de `valeurs.ts` classé. | Une annexe chiffrée à ce plan. H1 et H2 tranchées par la mesure, ou remontées. |
| L1 | Le schéma de la composition et son assemblage au chargement : livres, éléments, modifications champ par champ, livre du projet. Le refus de cohérence (P4). La forme de `presetsPnj` généralisée, sans seconde forme. | Tests sur un livre de test : retenir, exclure, modifier, ajouter. Un refus nomme la chaîne. |
| L2 | Le catalogue est produit par la composition (H1 ou sa concurrente), et les lecteurs migrent famille par famille. | Typecheck complet, suite verte. Le jeu de rôle joue comme avant sous la composition « tous les livres ». |
| L3 | Premier client : le roguelite. `valeurs.ts` ne garde rien de ce qui est au noyau. Ses sélections, modifications et contenu propre deviennent donnée. `.claude/rules/roguelite.md` est réécrite. | Recette du roguelite, avec des images identiques à sa référence. |
| L4 | Absorption de `gatedByRule`, des règles optionnelles (H2), des registres narratifs des paquets et des champs locaux des ports. Solde de #4919. | Il ne reste qu'un seul mécanisme : `git grep` des anciens porteurs vide. |
| L5 | Les ids en dur deviennent ops ou `Flow` (P1), et le reste passe par des emplois (P2, P5). Ce lot peut avancer par familles, en parallèle de L2. | Le cas limite : une composition « système seul », avec un livre de test, joue un combat par le noyau. Aucun littéral d'id de donnée ne compile dans les règles. |
| L6 | L'empreinte de la composition dans la sauvegarde et la coop (H3). | La reprise d'une sauvegarde sous une autre composition est refusée ; un invité à la composition différente aussi. |

## 6. Critère de fini du chantier

1. Le roguelite se construit sans aucune sélection, modification ni contenu propre en TypeScript.
2. Une composition « système seul » joue un combat.
3. Le jeu de rôle joue comme avant.
4. Aucun id de donnée littéral ne compile dans `src/engine` ni `src/noyau`.

## 7. Hors périmètre, chacun à son ticket

- Le concept de chronique ou de dynastie (« L'amour, le succès et l'argent ») et ses lacunes du système, dont
  l'amour, qui passera par une cérémonie d'arbitrage.
- La possession à niveaux, forme générique du noyau (verbatim 1). Elle est cliente de ce chantier : sa forme au
  noyau, ses instances comme contenu de projet.
- Les livres VO à autoriser comme sources (*Archives of the Empire Vol III*, *Deft Steps Light Fingers*…) :
  décision de l'utilisateur, livre par livre.
- Les établissements de #4277 (Données de lieu : établissements nommés, qualité à trois niveaux), qui restent à
  leur ticket et deviennent un client de L1.
