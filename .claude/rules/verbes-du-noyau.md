---
paths:
  - "src/noyau/actionsDuNoyau.ts"
  - "src/noyau/rollFlowSpecs.ts"
  - "src/noyau/flowVerbs.ts"
  - "src/noyau/intentionsDeSiege.ts"
  - "src/noyau/modalArbiter.ts"
  - "src/noyau/combatAuto.ts"
  - "src/noyau/designations.ts"
  - "scripts/gen-verbes.mjs"
---

# Verbes du noyau : une API

Tout membre de `ActionsDuNoyau` est un verbe que tout hôte joue (`src/hote/verbes.generated.ts`, `src/hote/geste.ts`). Le modèle est `jet<Verbe>(flux, …)` : un verbe par geste, la fenêtre en argument, une table qui déclare ce que chaque fenêtre accepte (`FLOW_VERBS`). Épique #3366.

- Avant d'ajouter un verbe, cherche dans `src/hote/verbes.generated.ts` celui qui fait déjà ce geste, sous un autre nom ou dans un autre contexte : on l'étend, on ne le double pas.
- Un verbe est un GESTE d'un siège (classe `invité` ou `hôte`). Une lecture est un sélecteur, jamais un verbe. Une écriture du noyau, de l'éditeur ou d'un test est une fonction du noyau, jamais un membre de `ActionsDuNoyau` : `(get, set)` sur le store, ou `Scene → Scene` pour un écrivain de l'éditeur, dont la scène vit hors du store (`src/noyau/sceneEdit.ts`). #3370
- Fermer, régler, choisir, valider ou « tout faire » sur une fenêtre ne crée aucun verbe propre à cette fenêtre : la fenêtre se déclare dans sa table (`MODAL_DEFS`/`HORS_MODAL`, `FLOW_VERBS`) et le verbe générique du geste la prend en premier argument. Tant que ce verbe générique n'existe pas (fermer #3367, régler un jet #3368, choisir et valider #3369), le besoin s'ajoute à l'inventaire de son ticket, jamais un verbe nommé de plus.
- « Tout » est la rangée omise du verbe unitaire, jamais un verbe `*All`. Un jet se valide par `jetConfirm(flux)`.
- Un geste, un verbe : le contexte (combat ou non, lieu, joueur ou automatique) et toute différence de règle qu'il porte se dérivent de l'état, jamais du choix de l'appelant. Aucune paire `battle*`/`ooc*`, `port*`/`land*`. #3371
- Arguments : la fenêtre d'abord, la rangée (`pid`) en dernier et facultative. Ce qui existe se désigne par son id typé `IdDe…` (`src/noyau/designations.ts`), jamais `string` nu, jamais un libellé, jamais un objet entier fourni par l'appelant. Une chose déjà désignée ailleurs garde le même type et le même nom de paramètre.
- Nom : aucun préfixe de contexte (`battle`, `ooc`, `port`, `land`), une seule langue par nom, celle arbitrée sur #3366 ; jamais un nom mi-français mi-anglais.
