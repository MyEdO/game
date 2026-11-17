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

**Why :** le fil rhabillait en parchemin la fenêtre de jet de l'ancien écran, alors que la cible du combat met le jet dans le bandeau du bas.

**How to apply :**
- un lot d'écran part de la cible écrite et de ses maquettes (agent `ecraniste`), jamais d'un écran existant, Godot non traité ou ancien web ;
- ce que la cible retire se retire ; ce qui arrête le combat s'affiche dans le bandeau du bas ;
- ce que la cible ne tranche pas se propose en maquette ;
- la fidélité se juge aux détails (police, casse, alignements), pas au pixel ;
- un choix parmi beaucoup (poste, tour de garde, interlude, bataille) se met en scène dans son lieu avec ses PNJ ; un service vit sur la page des services de son lieu, qu'ouvre le PNJ qui y donne accès.
