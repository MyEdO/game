---
name: game-codeurs-paralleles
description: "Arbre partagé : ton diff n'est pas ton geste — chemins explicites par défaut, index chirurgical pour un fichier dual-touché, et un rebase long n'est fini qu'après la suite complète"
metadata:
  node_type: memory
  type: feedback
---

Le diff d'un fichier montre l'écart HEAD↔arbre, pas ton geste : un pathspec protège des fichiers d'autrui, jamais de tes LIGNES dans les tiens. Contrôle décisif avant de livrer : le type que le fichier instancie porte-t-il déjà le champ à HEAD (lecture de la version HEAD du fichier de types) ?

**Why:** livrer le fragment d'une migration transverse d'autrui pousse du code contre un type qui ne l'attend pas (tronc rouge pour tous), et c'est un défaut de PATERNITÉ même quand tout est vert.

**How to apply:** classer chaque fichier (à moi / dual / à eux) AVANT le premier ajout à l'index ; par défaut, livrer par chemins explicites (`.claude/credo.md` § « L'arbre git est PARTAGÉ ») ; un fichier DUAL s'extrait en patch de ses seuls hunks, s'applique à l'INDEX seul, se vérifie au diff indexé, puis se livre SANS pathspec (un pathspec reprendrait le working tree et annulerait l'index). Des erreurs tsc HORS de tes fichiers = le WIP d'un voisin : les signaler, jamais un stash pour « isoler » ; un rebase long n'est fini qu'après gen + typecheck + suite COMPLÈTE, et le worktree d'une recette est GELÉ.
