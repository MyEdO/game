---
name: ajouter-une-icone
description: À utiliser quand une affordance a besoin d'une icône, dès qu'on est tenté de mettre un émoji dans l'UI ou une donnée d'affichage, ou quand le garde no-emoji-affordance échoue.
---

# Ajouter une icône

Lire **`docs/ajouter-une-icone.md`** — registre auto-chargé (`src/data/icons/defs/` + gen-registry),
charte de dessin (24×24, trait 1.8 arrondi, `currentColor`, silhouette lisible à 14px), trois rendus
(`<Icon id>`, `iconSvg()`, `<IconG>`). Toute affordance = **id d'icône EN DONNÉE** — jamais un émoji ;
la liste d'exceptions du garde `no-emoji-affordance.test.ts` doit SE VIDER, jamais grossir.
