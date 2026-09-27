---
name: feedback-editable-geste
description: "« Éditable » se mesure au GESTE, pas au champ — une garde qui compte des écrivains ne voit pas un formulaire inutilisable"
metadata:
  node_type: memory
  type: feedback
---

Verbatim utilisateur (2026-07-26), devant une emprise de pièce exposée en 156 cases à cocher : « De toute évidence ce n'est pas fait pour un être humain ».
**Règle :** avant de déclarer une donnée éditable, écrire le geste de bout en bout — l'auteur SAIT (défaut affiché en français d'auteur), ATTEINT (un clic met en évidence TOUTES les données fautives, à la bonne couche), CORRIGE (pinceau, tracé, glissé quand la donnée est spatiale — pas un formulaire), VÉRIFIE (le compteur baisse sous ses yeux).
**Why:** un champ atteignable par un formulaire satisfait la garde (`src/ui/editor/scene-field-editability-guard.test.ts` compte des écrivains, pas des gestes) et ne rend service à personne quand la donnée est spatiale, massive ou dérivée d'un tracé.
**How to apply:** une étape manquante = donnée NON éditable, quelle que soit la garde verte ; deux chemins d'édition dont l'un est inutilisable = un chemin mort à supprimer ; un validateur qui se tait est pire qu'absent.
