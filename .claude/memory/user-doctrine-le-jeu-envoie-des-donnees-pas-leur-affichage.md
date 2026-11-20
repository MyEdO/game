---
name: user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage
description: "Le contrat générique noyau → hôte porte des données (valeurs, ids, états) et les mots à part. La validation des maquettes précède leur branchement visuel dans Godot"
metadata:
  type: user
---

**Verbatim (2026-11-18)**, sur l'encadré du round que le jeu envoie en une ligne « Round 1 · tour 1 sur 26 » alors que la maquette sépare le round et le décompte : « Le jeu il est sensé envoyer des données, pas la façon de les afficher. A priori il envoie trop de texte et pas assez de données ».

**Verbatim (2026-11-18)**, sur l'ordre des chantiers : « Ton chantier c était les maquettes, l application de la maquette à Godot ça vient après une fois validé. Je ne t ai jamais démande de reprendre le texte du noyau, je t ai dit qu il n etait pas encore adapté pour les maquettes … et qu il faudra revoir tout ça après ».

**Verbatim (2026-11-20)**, sur le périmètre des deux chantiers ([#4574](https://github.com/MyEdO/game/issues/4574)) : « Je pensais les 2 chantier séparé. Le noyau godot est sensé etre générique et exposer les données a n'importe quel hote, et qu'actuellement le noyau perds la moitié des infoirmations et surtout vomi du texte ».

**Why :** une phrase composée par le noyau fige une mise en page. La maquette ne peut alors ni la redisposer ni se nourrir des mêmes données que le jeu (#4411).

**How to apply :**
- Le contrat générique du noyau, ses résolveurs et ses preuves de sérialisation avancent indépendamment des maquettes (#4574). Il expose les faits de jeu et leur visibilité à tout hôte.
- La maquette porte les données de son projet dans son JSON, et le rendu dessine le kit. Sa validation précède son branchement visuel dans Godot (#4411).
- Un élément de `src/hote/elements.ts` porte ses valeurs typées (nombres, ids, états) et ses mots (libellés traduits, keyés par id) séparément.
- L'hôte et la page de rendu des maquettes les disposent selon la maquette. Aucun hôte n'écrit de mot en dur : la règle « un hôte n'écrit aucun libellé » tient toujours.
- Un texte composé qui mêle valeurs et mots (« tour 1 sur 26 », « ≤ 48 », « DR +3 ») est une dette du contrat. Il se résout en champs.
- Voir aussi [[user-doctrine-maquettes-font-foi-godot-s-adapte]] et [[user-doctrine-ids-stables-labels-affichage]].
