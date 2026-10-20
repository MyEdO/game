---
paths:
  - "src/ui/editor/**"
  - "src/scenes/**"
  - "src/noyau/monde/scene.ts"
  - "src/noyau/sceneEdit.ts"
  - "src/noyau/mapSpec.ts"
  - "src/data/schemas/defs-scenes/**"
---

# Scènes et éditeur

- « Éditable » (utilisateur, 2026-07-26, devant une emprise de pièce en 156 cases à cocher : « De toute évidence ce n'est pas fait pour un être humain ») = l'auteur SAIT (défaut en français d'auteur), ATTEINT (un clic surligne TOUTES les fautives, à la bonne couche), CORRIGE (pour une donnée spatiale : pinceau, tracé ou glissé, jamais un formulaire), VÉRIFIE (le compteur baisse). Une étape manquante = non éditable, `src/ui/editor/scene-field-editability-guard.test.ts` verte ou pas : complète-la ou supprime le chemin. Un validateur qui se tait est pire qu'absent.
- Un champ ajouté à la Scène arrive dans le MÊME lot que son écrivain sous `src/ui/**`, ou qu'une primitive de `src/noyau/sceneEdit.ts` APPELÉE depuis `src/ui/**` ; `TROUS_CONNUS` reste vide. `scripts/guards/lib/sceneFieldEditability.mjs:81` `src/ui/editor/scene-field-editability-guard.test.ts:49` #841
- La garde ne prouve que l'écriture : le lot se clôt sur « l'auteur peut-il créer, modifier ET supprimer cette donnée au clic ? » (utilisateur, 2026-07-26 : « Assure toi toujours qu'on doit pouvoir éditer toutes les données de la scene, on ne doit pas dépendre d'une IA »). Un peintre sans outil dans `src/ui/editor/Palette.tsx` est une affordance morte. Une donnée dérivée se dérive du plan, la surcharge explicite reste l'exception.
- Même critère pour la campagne entière : tout registre narratif et toute donnée de catalogue qu'un paquet consomme se crée, se modifie et se supprime à l'éditeur ou au Compendium, dans le MÊME lot que son schéma (doctrine « campagne recréable à l'éditeur », `docs/doctrines.md`).
