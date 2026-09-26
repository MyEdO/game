---
name: feedback-jamais-git-surgery-arbre-partage-actif
description: "Un fichier GÉNÉRÉ ou un stray d'agent se restaure par son GÉNÉRATEUR et par des opérations de fichiers, jamais par une commande git ; cette discipline est portée par cette fiche, aucun hook ne la porte."
metadata:
  type: feedback
---

Aucun hook n'arbitre les git destructifs ni les suppressions (utilisateur, 2026-09-26 : « Pour les joker et les git destructifs, maintenant qu'on est en worktree, personne ne touche a l'arbre principal, cette garde ne sert plus. »). Sur ce terrain, le seul refus est celui du lien posé sur un `node_modules`, par `scripts/hooks/commande-piege-guard.mjs`. La discipline ci-dessous est portée par cette fiche seule.

**Why:** un `checkout`/`restore` « sûr » n'existe pas sur un arbre partagé — le merge 3-way d'un stash efface silencieusement le WIP de la session voisine —, et la règle n'a aucune exception « fichier généré » ni « ma propre écriture toute fraîche ».

**How to apply:** défaire un stray = supprimer/recréer les fichiers puis rejouer le générateur ; porter du travail sur la branche partagée = la session qui l'occupe le fait elle-même, à l'arrêt ; un WIP écrasé se récupère par `git stash apply <sha-droppé>` (apply, jamais pop).
