---
name: env-marker-extraction
description: "Extraction Marker d'un PDF source : diagnostiquer les « kills » sans se tromper (exit 143 = timeout de l'outil, sortie de fond bufferisée)"
metadata:
  node_type: memory
  type: reference
---

**Why:** l'extraction dure des heures (commande et options dans `docs/ajouter-un-livre-source.md:19-24`) et tous ses modes d'échec ressemblent à un tueur externe, ce qui envoie chercher un watchdog inexistant.

**How to apply:** `exit 143` (SIGTERM) en avant-plan = le plafond de l'outil, pas un tueur — mesurer le temps écoulé réel ; la preuve de vie est la RAM/CPU du process python, jamais la taille du fichier de sortie (buffering au chargement des modèles) ; un vrai kill de fond se relance UNE fois, sinon extraction par tranches (`--page_range`) en fenêtres de moins de 10 min ; vérifier la taille du `.md` produit (perte OCR sur livre illustré).
