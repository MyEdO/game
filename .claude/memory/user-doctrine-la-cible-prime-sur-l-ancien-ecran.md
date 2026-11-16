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

**Verbatim (2026-11-16)** : « Surtout ne te fis pas a nos écrans godot existant non traité, ils ne sont pas la cible » — #3935.

**Verbatim (2026-11-16)** : « Les affectations a des postes/activités/tour de garde, dans la ligné de ce qu'on fait pour le voyage en mer/terre. L'écran des interludes, de combat de masse et autres joyeuseté, qui ne fasse pas "Modale avec des trucs a choisir parmis 50 éléments" (oui les interludes se font en ville, c'est liés a des lieux ou des PNJs, c'est vivant quoi) » — #3935.

**Verbatim (2026-11-16)** : « Oui le service du medecin en ville, les jeux de taverne depuis l'écran de service de l'auberge. Franchement si un PNJ donne acces a un service, qu'il ouvre la page des services plutot que la modale, ca marche aussi non ? » — #3935.

**Why :** le fil allait rhabiller en parchemin la fenêtre de jet centrée de l'ancien écran, alors que la cible écrite du combat dit que le bandeau de jet prend la place du meuble de l'actif.

**How to apply :**
- avant tout lot d'écran, relire la cible écrite et ses maquettes, puis nommer dans le brief le passage qui tranche ;
- l'écart se mesure de la cible vers l'écran, jamais par retouche de l'existant ;
- ce que la cible a retiré (fenêtre, panneau, bouton) se retire, il ne se rhabille pas ;
- en combat, ce qui arrête le jeu (jet, critique, début du round) s'affiche dans le bandeau du bas, jamais en fenêtre centrée ;
- un point que la cible ne tranche pas se propose à l'utilisateur en maquette, pas en reprenant l'ancien par défaut.
- la fidélité à la maquette se juge aux détails (police, casse, alignements, centrages, lisibilité), pas au pixel ;
- un lot d'écran Godot se confie à l'agent `ecraniste`.
- un écran Godot non encore traité n'est jamais une source de design, pas plus que l'ancien web ;
- un choix parmi beaucoup d'éléments (poste, activité, tour de garde, interlude, bataille de masse) se met en scène dans son lieu, avec ses PNJ, jamais en fenêtre à longue liste.
- un service (médecin, jeux de taverne, commerce) vit sur la page des services de son lieu ; un PNJ qui y donne accès ouvre cette page, jamais une fenêtre à part.
