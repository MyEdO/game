---
name: user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage
description: "Le contrat générique noyau → hôte porte des données (valeurs, ids, états) et les mots à part. La validation des maquettes précède leur branchement visuel dans Godot"
metadata:
  type: user
---

**Verbatim (2026-11-18)**, sur l'encadré du round que le jeu envoie en une ligne « Round 1 · tour 1 sur 26 » alors que la maquette sépare le round et le décompte : « Le jeu il est sensé envoyer des données, pas la façon de les afficher. A priori il envoie trop de texte et pas assez de données ».

**Verbatim (2026-11-18)**, sur l'ordre des chantiers : « Ton chantier c était les maquettes, l application de la maquette à Godot ça vient après une fois validé. Je ne t ai jamais démande de reprendre le texte du noyau, je t ai dit qu il n etait pas encore adapté pour les maquettes … et qu il faudra revoir tout ça après ».

**Verbatim (2026-11-20)**, sur le périmètre des deux chantiers ([#4574](https://github.com/MyEdO/game/issues/4574)) : « Je pensais les 2 chantier séparé. Le noyau godot est sensé etre générique et exposer les données a n'importe quel hote, et qu'actuellement le noyau perds la moitié des infoirmations et surtout vomi du texte ».

**Why :** un texte composé fige la disposition (#4411).

**How to apply :**
- Le contrat générique, ses résolveurs et ses preuves avancent indépendamment des maquettes (#4574).
- Valider chaque maquette avant son branchement visuel dans Godot (#4411).
- Les éléments de `src/hote/elements.ts` séparent valeurs typées et libellés traduits. L'hôte dispose ces valeurs avec les mots fournis.
- Décomposer les valeurs composées (« tour 1 sur 26 », « ≤ 48 », « DR +3 ») en champs.
- Voir [[user-doctrine-maquettes-font-foi-godot-s-adapte]] et [[user-doctrine-ids-stables-labels-affichage]].
