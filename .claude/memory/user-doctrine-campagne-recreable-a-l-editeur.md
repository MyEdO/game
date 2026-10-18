---
name: user-doctrine-campagne-recreable-a-l-editeur
description: "La campagne entière se recrée de toutes pièces à l'éditeur : tout registre narratif et toute donnée consommée par un paquet sont éditables au clic"
metadata:
  type: user
---

**Verbatim (2026-10-17, #2547)** : « N'oublie jamais que la campagne doit pouvoir etre recréé de toute piece dans l'éditeur. »

**Why :** l'utilisateur authore en série ; une donnée non modifiable au clic le rend dépendant d'un agent ([[user-doctrine-campagne-jamais-generee-par-script]]).

**How to apply :** tout registre narratif (états, identités, documents, presets, billets, poses de jeu de taverne…) et toute donnée de catalogue qu'un paquet consomme se crée, se modifie et se supprime à l'éditeur ou au Compendium, dans le MÊME lot que son schéma (`.claude/rules/scenes-et-editeur.md`).
