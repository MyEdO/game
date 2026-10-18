---
paths:
  - "scripts/ops/**"
  - "scripts/gates/**"
  - ".github/workflows/**"
  - ".github/actions/**"
  - "scripts/agents/**"
  - "scripts/hooks/**"
  - "scripts/guards/**"
---

# Outillage ops, train, CI

- Un outil ou une garde qui juge l'entrée d'un outil TIERS (paramètres lean-ctx, histoire git) se code d'emblée en forme FERMÉE : liste blanche minimale lue aux sources du tiers, tout le reste refusé. Épingle la version auditée dans une constante confrontée par un test `--version`. Deux réfutations de la même classe de trou : remonte au design fermé au lieu de boucher le trou suivant. #2180 #2222 `scripts/guards/lib/contratGarde.mjs:55` `scripts/hooks/canal-outil-guard.test.mjs:255`
