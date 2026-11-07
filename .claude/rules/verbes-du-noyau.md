---
paths:
  - "src/noyau/actionsDuNoyau.ts"
  - "src/noyau/machinerieDuNoyau.ts"
  - "src/noyau/rollFlowSpecs.ts"
  - "src/noyau/flowVerbs.ts"
  - "src/noyau/intentionsDeSiege.ts"
  - "src/noyau/modalArbiter.ts"
  - "src/noyau/combatAuto.ts"
  - "src/noyau/designations.ts"
  - "src/noyau/reglagesDuJet.ts"
  - "scripts/gen-verbes.mjs"
---

# Verbes du noyau : une API

Tout membre de `ActionsDuNoyau` est un verbe que tout hôte joue (`src/hote/geste.ts`). Le modèle est `jet<Verbe>(flux, …)` : un verbe par geste, la fenêtre en argument, une table qui déclare ce que chaque fenêtre accepte (`FLOW_VERBS`). Épique #3366.

- Avant d'ajouter un verbe, cherche dans `src/hote/verbes.generated.ts` celui qui fait déjà ce geste, sous un autre nom ou dans un autre contexte : on l'étend, on ne le double pas.
- Un verbe est ce qu'un siège envoie ou ce qu'un hôte joue (classe `invité`, `hôte` ou `local`). Une lecture est un sélecteur, jamais un verbe. Une écriture du noyau, de l'éditeur ou d'un test est un membre de `MachinerieDuNoyau`, que seul un `Get<JeuDuNoyau>` atteint et que ni `Intention` ni `VERBES` ne nomment, ou un `Scene → Scene` pour un écrivain de l'éditeur, dont la scène vit hors du store (`sceneEdit.ts`). Un commit de clic est de la machinerie : le verbe est le clic qui l'appelle (`cliquerLaCase`). #3370
- Fermer, régler, choisir, valider ou « tout faire » sur une fenêtre ne crée aucun verbe propre à cette fenêtre : la fenêtre se déclare dans sa table (`MODAL_DEFS`/`HORS_MODAL`/`SURFACES_HORS_PENDING`, `FLOW_VERBS`) et le verbe générique du geste la prend en premier argument. Un réglage de jet se déclare à `ReglagesDuJet` (la forme de sa valeur, absolue) et `REGLAGES_DU_JET` (sa phase, sa portée, ce qui l'offre), son corps à `CorpsDesReglages` : il se joue par `jetRegler(flux, reglage, valeur[, pid])`, y compris l'axe d'un flux sans dé (phase `horsDuJet`). Une fenêtre qui se valide ou se ferme déclare `validation` ou `sortie` à son registre (avec qui la joue), son corps à `ValidationsDeFenetre` ou `SortiesDeFenetre` : elle se joue par `fenetreValider(fenetre)` ou `fenetreFermer(fenetre)`, le quorum marquant le siège prêt (`jouerOuMarquer`, #3369). Une fenêtre qui fait choisir déclare chaque axe à `ChoixDesFenetres` (la forme de sa valeur) et `CHOIX_DES_FENETRES` (son effet, qui le joue, sa portée), les valeurs que l'état ouvre à `OUVERTS_DU_CHOIX`, son corps à `CorpsDesChoix` : il se joue par `fenetreChoisir(fenetre, axe, valeur[, pid])`, `pid` le héros d'une rangée (#3369). Un réglage de jet déclare le même effet.
- « Tout » est la rangée omise du verbe unitaire, jamais un verbe `*All` : `jetLancer('cascade')` sans rangée résout la cascade, un réglage de rangée `toutes` se joue sans rangée sur celles du siège. Un jet se valide par `jetValider(flux)`.
- Un geste, un verbe : le contexte (combat ou non, lieu, joueur ou automatique) et toute différence de règle qu'il porte se dérivent de l'état, jamais du choix de l'appelant. Aucune paire `battle*`/`ooc*`, `port*`/`land*`. #3371
- Arguments : la fenêtre d'abord, la rangée (`pid`) en dernier et facultative. Ce qui existe se désigne par son id typé `IdDe…` (`designations.ts`), jamais `string` nu (`gen-verbes` lève ; texte : `TexteLibre`), ni libellé, ni objet entier de l'appelant, sauf ce qui n'existe pas encore (`HerosEngage.brouillon`) ou l'instantané d'affichage qu'un geste acquitte (`marquerLesIndices`, #2415). Une chose déjà désignée ailleurs garde le même type et le même nom de paramètre.
- Nom : en français (arbitré sur #3366), `<action>` ou `<action><Complément>`, l'action au lexique fermé (`ActionDuLexique`, `jet<Action>…`, `fenetre<Action>`) ; sans préfixe de contexte (`battle`, `ooc`, `port`, `land`). `verrouDuLexique` (`fabriquesDuNoyau.ts`) refuse, en le nommant, un nom hors lexique ; le nom d'un verbe de jet ne vit qu'à `NOM_DU_VERBE_DE_JET` (`flowVerbs.ts`). Une action neuve entre au lexique en revue. Une table coop a pour clé un verbe typé (`EntreeDeRoute`).
