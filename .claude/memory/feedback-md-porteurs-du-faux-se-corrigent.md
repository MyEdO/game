---
name: feedback-md-porteurs-du-faux-se-corrigent
description: "Un artefact d'extraction se corrige DANS Source/*.md (vérifié au folio imprimé, réfs ré-ancrées par l'outillage), jamais contourné en donnée, en convention de réf ou en classement de garde."
metadata:
  type: feedback
---

Verbatim utilisateur (au plus tard le 2026-08-14) : « corrige les .md dans ce genre de cas […] Je parlais des fichiers sources .md ».

**Why:** `Source/` est une EXTRACTION — un fichier coupé sur un signet Word, un espace de coupure d'italique ne sont pas du RAW, et les laisser force tout l'aval à des contournements qui sont chacun un mensonge de plus.

**How to apply:** réparer le `.md` source, vérifier au folio (gardes folio-continuity), ré-ancrer par `npm run raw:reanchor` (jamais à la main), puis RETIRER les contournements posés en aval. Les `.md` non-source porteurs d'un faux (fiches, docs vivantes, CLAUDE.md) se corrigent dans le même geste.
