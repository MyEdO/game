---
name: user-doctrine-le-jeu-envoie-des-donnees-pas-leur-affichage
description: "Le contrat noyau → hôte porte des données (valeurs, ids, états) et les mots à part, jamais un texte déjà composé pour un affichage : l'hôte compose la mise en page"
metadata:
  type: user
---

**Verbatim (2026-11-18)**, sur l'encadré du round que le jeu envoie en une ligne « Round 1 · tour 1 sur 26 » alors que la maquette sépare le round et le décompte : « Le jeu il est sensé envoyer des données, pas la façon de les afficher. A priori il envoie trop de texte et pas assez de données ».

**Why :** une phrase composée par le noyau fige une mise en page. La maquette ne peut alors ni la redisposer ni se nourrir des mêmes données que le jeu (#4411).

**How to apply :**
- Un élément de `src/hote/elements.ts` porte ses valeurs typées (nombres, ids, états) et ses mots (libellés traduits, keyés par id) séparément.
- L'hôte et la page de rendu des maquettes les disposent selon la maquette. Aucun hôte n'écrit de mot en dur : la règle « un hôte n'écrit aucun libellé » tient toujours.
- Un texte composé qui mêle valeurs et mots (« tour 1 sur 26 », « ≤ 48 », « DR +3 ») est une dette du contrat. Il se résout en champs.
- Voir aussi [[user-doctrine-maquettes-font-foi-godot-s-adapte]] et [[user-doctrine-ids-stables-labels-affichage]].
