---
name: creer-une-creature
description: À utiliser quand on ajoute une créature, un monstre ou un PNJ au bestiaire (rig, apparence, statbloc), quand une créature s'affiche mal (blob, proportions), ou avant de toucher src/gameIso/rig/creatures/. Aussi pour une nouvelle tenue ou race jouable.
---

# Créer une créature

Lire **`docs/creer-une-creature.md`** et le suivre intégralement — registre `defs/`, corps nu ≠ tenue,
illustration `art-ref/` obligatoire, pièges codifiés. Le statbloc vient du Source (FR, plus le Core
Rulebook 5e — `CLAUDE.md` § *Sources VF* ; règle stricte 1) ; l'apparence est de la donnée
(registres `defs/`, jamais de regex sur les noms — `docs/architecture.md` § Direction visuelle).
QC : golden tests + reconnaissabilité par agent aveugle.

Aucune vague d'art sur un plan corporel avant que son SQUELETTE passe sa porte (utilisateur,
2026-08-04 : « Il est important que chaque squelette soit de qualité si on veut que le reste suive. ») : z par os × vue
complet et testé ; plan de profondeur DÉCLARÉ par vue pour tout élément attaché (part, deco, aile,
feature), jamais concaténé ; parité de silhouette profil/dos mesurée ; ancres et ligne de sol
publiées ; sondes perceptuelles, juge en aveugle, puis œil utilisateur.
