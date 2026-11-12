---
name: user-doctrine-web-d-abord-bureau-en-plus
description: "Cibles du jeu : le web reste la première cible, une version de bureau s'y ajoute par le même hôte Godot et le même noyau"
metadata:
  type: user
---

*Question posée (carte de décision, non-verbatim utilisateur) : Autoriser une version de bureau en plus du jeu 100 % web ?*

**Verbatim —** option choisie par l'utilisateur (2026-11-11) : « Web d'abord, bureau en plus »

**Why :** hors d'une page, Godot donne son débogueur, son profileur et son rendu complet ; le web reste ce que le joueur reçoit d'abord.

**How to apply :**
- Le web reste la première cible : ce qui se livre se joue dans l'export Web, et rien ne s'y dégrade au profit du bureau.
- Le bureau s'ajoute par le même hôte Godot et le même noyau : un seul pont, un transport par lieu du noyau (#3945), jamais un second jeu (fiche `user-doctrine-un-hote-jamais-duplique`).
- Un rendu plus riche au bureau est permis ; une règle ou une fonctionnalité de jeu propre à une cible ne l'est pas.
- L'ordre des lots et leur état vivent à l'épique #3944.
