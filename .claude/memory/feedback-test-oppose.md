---
name: feedback-test-oppose
description: "Un Test que le RAW qualifie d'OPPOSÉ se joue en opposition RÉELLE (les deux jets visibles, ré-opposés sous influence) — jamais un test simple avec le DR adverse caché"
metadata:
  node_type: memory
  type: feedback
---

Tout Test qualifié d'OPPOSÉ par le RAW sur le chemin joueur passe par la machinerie d'opposition
(`src/state/combat/triggeredTest.ts`, `openCastOpposition`, `VsHeader`) : les deux jets visibles,
ré-opposition à chaque influence. Jamais un test simple héros plus un tirage adverse résolu dans
l'applier.

**Why:** utilisateur (2026-07-17, verbatim) : « les jets opposés sont un MENSONGE […] alors qu'on
SAIT FAIRE DES JETS OPPOSÉS ! » — les maths peuvent être justes, la FORME ment et le joueur ne voit
jamais l'opposition.

**How to apply:** toute fonction de résolution attaque-like route par la machinerie opposée OU porte
une justification RAW citée de sa simplicité ; la fidélité de RÉSOLUTION est un axe de recensement à
part — un registre ne jure que les axes qu'il a mesurés.
