---
name: user-doctrine-noyau-generique-besoins-des-projets
description: "Un besoin d'un projet (roguelite…) entre au noyau par sa forme générique : étendre le verbe ou l'op qui le couvre en partie, jamais un verbe ou un cas spécifique de plus"
metadata:
  type: user
---

**Verbatim (2026-11-24)**, sur #4947 et #4899 : « Faut faire attention au noyau, on a des besoins spécifiques sur notre roguelite mais le noyau doit avoir une vision "générique", on ne veut pas multiplier des verbes si certains le couvre deja en partie ou gérer des cas spécifiques alors qu'on peut gérer en plus global ... en faite un peu comme on gere les ops »

**Why :** le noyau sert tous les projets ; un verbe ou une branche par besoin d'un projet le fragmente, comme une op par effet le ferait.

**How to apply :** avant d'ouvrir ou de coder un manque du noyau vu d'un projet, inventorier les verbes (`src/hote/verbes.generated.ts`, `.claude/rules/verbes-du-noyau.md`), ops et sélecteurs qui couvrent déjà une part du besoin, puis étendre et paramétrer le plus général ; le nom, les arguments et les tests disent le concept générique, jamais le projet. Un changement de noyau qui ajoute un verbe ou un cas propre à un projet est un défaut du juge.
