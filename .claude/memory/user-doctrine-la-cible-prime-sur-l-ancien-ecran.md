---
name: user-doctrine-la-cible-prime-sur-l-ancien-ecran
description: "Quand une cible d'écran est validée (image, cible écrite, maquette), tout lot part d'elle ; l'écran existant n'est jamais le modèle qu'on retouche"
metadata:
  type: user
---

**Verbatim (2026-11-16)** : « Mais les jets d attaques/défenses dans le design est intégré dans la partie basse et non dans un modale non ? » — #3935.

**Verbatim (2026-11-16)** : « Évite de reproduire les erreurs du passé, a vouloir tendre vers l anciens alors qu on a des lignes claires vers notre cible » — #3935.

**Verbatim (2026-11-16)** : « Si "début du round" est a affiché, ca sera au même endroit que le bandeau de jet » — #3935.

**Verbatim (2026-11-16)** : « On a pas besoin que cela soit exact mais il y a des choses qui sont à reprendre » ; « Et pleins de détail oui comme Échec qui actuellement en minuscule, la typo et la case, des elements désalignied » — #3935.

**Verbatim (2026-11-16)** : « On ne devrait pas créer un agent pour comme on a fait pour modeleur ? » — #3935.

**Why :** le fil allait rhabiller en parchemin la fenêtre de jet centrée de l'ancien écran, alors que la cible écrite du combat dit que le bandeau de jet prend la place du meuble de l'actif.

**How to apply :**
- avant tout lot d'écran, relire la cible écrite et ses maquettes, puis nommer dans le brief le passage qui tranche ;
- l'écart se mesure de la cible vers l'écran, jamais par retouche de l'existant ;
- ce que la cible a retiré (fenêtre, panneau, bouton) se retire, il ne se rhabille pas ;
- en combat, ce qui arrête le jeu (jet, critique, début du round) s'affiche dans le bandeau du bas, jamais en fenêtre centrée ;
- un point que la cible ne tranche pas se propose à l'utilisateur en maquette, pas en reprenant l'ancien par défaut.
- la fidélité à la maquette se juge aux détails (police, casse, alignements, centrages, lisibilité), pas au pixel ;
- un lot d'écran Godot se confie à l'agent `ecraniste`.
