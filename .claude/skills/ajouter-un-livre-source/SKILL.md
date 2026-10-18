---
name: ajouter-un-livre-source
description: À utiliser quand on intègre un nouveau livre ou supplément WFRP (PDF → Source/ → Atlas → données), quand une abréviation de livre inconnue apparaît dans une réf, ou avant de citer un livre absent de docs/sources-vf.md.
---

# Ajouter un livre source

Lire **`docs/ajouter-un-livre-source.md`** — pipeline complet : extraction Marker, découpe en
chapitres `Source/<Livre>/NN - Titre.md`, enregistrement dans `src/data/books.json` (dont `BOOKS` dérive),
intégration Atlas `docs/raw/`, curation MANUELLE de la donnée taguée `source`, gardes
`coverage.mjs`/`reconcile.mjs`. ⚠ Seuls les livres AUTORISÉS au § Sources VF d'`AGENTS.md` (FR,
plus le Core Rulebook 5e en VO — #1816) ; les PDFs sont faillibles — vérifier cas par cas.
