---
name: env-commit-f-fichier
description: Le garde de solde lit le fichier `git commit -F <chemin>` AVANT d'exécuter la commande — chemin littéral absolu ET fichier déjà écrit par une commande antérieure, sinon refus « illisible »
metadata:
  type: project
---

Le garde de solde des commits (hook sur `git commit`) ouvre le fichier donné à `-F`/`--file` **avant** que la commande ne tourne, pour y lire `JUGE:` / `JUGE-VISION:` / `REFUTATION:` / `CLIQUET:` et le solde. Deux formes sont refusées « fichier illisible » : `git commit -F "$f"` (variable non résolue par le garde) et `cat > msg.txt <<'EOF' … && git commit -F "C:/…/msg.txt"` dans la **même** commande (le fichier n'existe pas encore au contrôle).

**Why :** le contrôle est fail-closed (aucune fermeture ni réfutation invisible) ; il ne juge que ce qui est déjà sur disque.
**How to apply :** 1) écrire `msg-<train>.txt` au scratchpad dans sa propre commande ; 2) `git add <chemins explicites>` ; 3) `git commit -F "C:/…/scratchpad/msg-<train>.txt"` seul dans sa commande, chemin littéral. Formes littérales exigées : `JUGE: …`, `JUGE-VISION: …` (dès qu'un écran `src/ui/**` bouge), `REFUTATION: …` — jamais « JUGE (…) : » ni « REFUTATION : » avec une espace avant les deux-points. Sujet ≤ 100 caractères, preuves dans le corps (hook `commit-msg`). Voir [[env-git-show-ordre-commit-avant-paths]].
