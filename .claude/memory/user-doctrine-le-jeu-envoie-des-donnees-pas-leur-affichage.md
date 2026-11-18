---
name: user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage
description: "Le contrat noyau → hôte portera des données (valeurs, ids, états) et les mots à part, jamais un texte composé ; d abord les maquettes, le noyau et Godot s adaptent après leur validation"
metadata:
  type: user
---

**Verbatim (2026-11-18)**, sur l'encadré du round que le jeu envoie en une ligne « Round 1 · tour 1 sur 26 » alors que la maquette sépare le round et le décompte : « Le jeu il est sensé envoyer des données, pas la façon de les afficher. A priori il envoie trop de texte et pas assez de données ».

**Verbatim (2026-11-18)**, sur l'ordre des chantiers : « Ton chantier c était les maquettes, l application de la maquette à Godot ça vient après une fois validé. Je ne t ai jamais démande de reprendre le texte du noyau, je t ai dit qu il n etait pas encore adapté pour les maquettes … et qu il faudra revoir tout ça après ».

**Why :** une phrase composée par le noyau fige une mise en page. La maquette ne peut alors ni la redisposer ni se nourrir des mêmes données que le jeu (#4411).

**How to apply :**
- D'abord les maquettes : leur JSON porte les données dans la forme visée, et le rendu dessine le kit. Le noyau et Godot ne changent qu'après validation des maquettes, depuis la liste des écarts.
- Un élément de `src/hote/elements.ts` porte ses valeurs typées (nombres, ids, états) et ses mots (libellés traduits, keyés par id) séparément.
- L'hôte et la page de rendu des maquettes les disposent selon la maquette. Aucun hôte n'écrit de mot en dur : la règle « un hôte n'écrit aucun libellé » tient toujours.
- Un texte composé qui mêle valeurs et mots (« tour 1 sur 26 », « ≤ 48 », « DR +3 ») est une dette du contrat. Il se résout en champs.
- Voir aussi [[user-doctrine-maquettes-font-foi-godot-s-adapte]] et [[user-doctrine-ids-stables-labels-affichage]].
