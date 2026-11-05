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

Tout membre de `ActionsDuNoyau` est un verbe que tout hôte joue (`src/hote/verbes.generated.ts`, `src/hote/geste.ts`). Le modèle est `jet<Verbe>(flux, …)` : un verbe par geste, la fenêtre en argument, une table qui déclare ce que chaque fenêtre accepte (`FLOW_VERBS`). Épique #3366.

- Avant d'ajouter un verbe, cherche dans `src/hote/verbes.generated.ts` celui qui fait déjà ce geste, sous un autre nom ou dans un autre contexte : on l'étend, on ne le double pas.
- Un verbe est ce qu'un siège envoie ou ce qu'un hôte joue (classe `invité`, `hôte` ou `local`). Une lecture est un sélecteur, jamais un verbe. Une écriture du noyau, de l'éditeur ou d'un test est un membre de `MachinerieDuNoyau` (`src/noyau/machinerieDuNoyau.ts`), que seul un `Get<JeuDuNoyau>` atteint et que ni `Intention` ni `VERBES` ne nomment, ou un `Scene → Scene` pour un écrivain de l'éditeur, dont la scène vit hors du store (`src/noyau/sceneEdit.ts`). Un commit de clic est de la machinerie : le verbe est le clic qui l'appelle (`cliquerLaCase`, `battleClickEntity`, `battleClickTile`). #3370
- Fermer, régler, choisir, valider ou « tout faire » sur une fenêtre ne crée aucun verbe propre à cette fenêtre : la fenêtre se déclare dans sa table (`MODAL_DEFS`/`HORS_MODAL`, `FLOW_VERBS`) et le verbe générique du geste la prend en premier argument. Un réglage de jet se déclare à `ReglagesDuJet` (la forme de sa valeur, absolue) et `REGLAGES_DU_JET` (sa phase, sa portée), son corps à `CorpsDesReglages` : il se joue par `jetRegler(flux, reglage, valeur[, pid])`. Tant que le verbe générique n'existe pas (choisir et valider #3369), le besoin s'ajoute à l'inventaire de son ticket, jamais un verbe nommé de plus.
- « Tout » est la rangée omise du verbe unitaire, jamais un verbe `*All`. Un jet se valide par `jetConfirm(flux)`.
- Un geste, un verbe : le contexte (combat ou non, lieu, joueur ou automatique) et toute différence de règle qu'il porte se dérivent de l'état, jamais du choix de l'appelant. Aucune paire `battle*`/`ooc*`, `port*`/`land*`. #3371
- Arguments : la fenêtre d'abord, la rangée (`pid`) en dernier et facultative. Ce qui existe se désigne par son id typé `IdDe…` (`src/noyau/designations.ts`), jamais `string` nu, jamais un libellé, jamais un objet entier fourni par l'appelant. Une chose déjà désignée ailleurs garde le même type et le même nom de paramètre.
- Nom : en français (arbitré sur #3366), sans préfixe de contexte (`battle`, `ooc`, `port`, `land`) ; jamais un nom mi-français mi-anglais. Un verbe existant au nom anglais se renomme en français dans le lot de #3371 qui le traverse, `jet*` compris.
