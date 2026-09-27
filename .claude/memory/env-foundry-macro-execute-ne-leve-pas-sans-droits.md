---
name: env-foundry-macro-execute-ne-leve-pas-sans-droits
description: "Foundry — Macro#execute() sans droits n'échoue pas : il avertit et rend undefined, d'où un faux vert"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ac141400-e348-4fc8-af3c-169f74f555f3
  modified: 2026-09-16T14:06:47.287Z
---

`Macro#execute()` ne lève **aucune** exception quand le poste n'a pas le droit d'exécuter la macro :
il affiche un avertissement d'interface et rend `undefined`. Un orchestrateur qui enchaîne des
sous-macros dans un `try/catch` se déclare donc **vert** alors qu'aucune n'a rien posé.

Cas réel (bascule 5e, monde « Campagne Impériale Mercredi ») : une macro créée par `Macro.create`
hérite de `ownership.default = 0`, alors que les sous-macros existantes sont à `2` (Observateur).
Côté joueur, `game.wfrp4e.nom5e` restait `undefined` et `__bascule5eRates` valait `[]`.

**How to apply :** toute boucle qui exécute des macros contrôle `m.canExecute` AVANT l'appel et
compte le refus comme un échec. Après avoir créé une macro par script, aligner son `ownership` sur
celui d'une macro voisine du même dossier — la création par script ne le fait pas.

Corollaire de mesure : une sous-macro asynchrone peut mettre plusieurs secondes à se poser sur un
poste joueur ; sonder trop tôt produit le même symptôme sans le même défaut. Distinguer les deux en
relançant la sonde après quelques secondes avant de conclure.

Voir [[env-foundry-effectscripts-cle-id-nu-et-script-vide-falsy]] et
[[env-foundry-recharger-un-onglet-retombe-sur-la-derniere-session]].
