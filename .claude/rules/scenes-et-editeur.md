---
paths:
  - "src/ui/editor/**"
  - "src/scenes/**"
  - "src/noyau/monde/scene.ts"
  - "src/noyau/sceneEdit.ts"
  - "src/noyau/edition/**"
  - "src/noyau/mapSpec.ts"
  - "src/data/schemas/defs-scenes/**"
---

# Scènes et éditeur

- « Éditable » (#1728) = l'auteur SAIT (défaut en français d'auteur), ATTEINT (un clic surligne TOUTES les fautives, à la bonne couche), CORRIGE (pour une donnée spatiale : pinceau, tracé ou glissé, jamais un formulaire), VÉRIFIE (le compteur baisse). Une étape manquante = non éditable, `src/scene-field-editability-guard.test.ts` verte ou pas : complète-la ou supprime le chemin. Un validateur qui se tait est pire qu'absent.
- Un champ ajouté au document d'une racine de `RACINES` (scène, carte du monde, narratif) arrive dans le MÊME lot que son écrivain : une primitive d'`AUTHOR_PATH` (pont Godot, `src/hote/`, `src/noyau/*Edit*.ts`, `src/noyau/edition/`, `src/data/refFormatLivre.ts`) APPELÉE depuis la méthode `editer` du pont (`ENTREE_GODOT`), ou une écriture que l'aller-retour d'`editer` joue, au banc de sa racine (`src/ecrituresJouees.testkit.ts`) ; un écrivain sous `src/ui/**` ne crédite rien (#3606). Aucun orphelin, sur aucune racine. `scripts/guards/lib/editabiliteDesChamps.mjs` `src/scene-field-editability-guard.test.ts` `src/carte-field-editability-guard.test.ts` `src/narratif-field-editability-guard.test.ts` #841 #4234
- La garde ne prouve que l'écriture : le lot se clôt sur « l'auteur peut-il créer, modifier ET supprimer cette donnée au clic ? » (#1728). Un peintre sans outil dans `src/ui/editor/Palette.tsx` est une affordance morte. Une donnée dérivée se dérive du plan, la surcharge explicite reste l'exception.
- Même critère pour la campagne entière : tout registre narratif et toute donnée de catalogue qu'un paquet consomme se crée, se modifie et se supprime à l'éditeur ou au Compendium, dans le MÊME lot que son schéma (doctrine « campagne recréable à l'éditeur », `docs/doctrines.md`).
