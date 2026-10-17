---
paths:
  - "src/data/**"
  - "scripts/data/**"
  - "scripts/migrations/**"
  - "src/i18n/**"
  - "scripts/docs/lib/structures-*.mts"
  - "scripts/guards/lib/structuresStock.mjs"
  - "scripts/guards/lib/integriteStock.mjs"
  - "scripts/guards/lib/tableConsumerAudit.ts"
  - "scripts/docs/build-entity-orphans.mjs"
  - "scripts/docs/build-field-consumers.mts"
---

# Données app-owned et migrations

- Un lot de FORME s'inventorie par CONCEPT : grep le concept dans tous les `src/data/*.json`, les schémas et le moteur (libellé, littéral d'op, regex sur label), jamais sur le seul dataset du ticket, et le lot va jusqu'au moteur. La forme cible se COMPOSE depuis `src/data/schemas/grammaire/` (fabriques fermées de `ref.ts`), jamais re-tapée. `src/data/grammaire-guard.test.ts`
- Un écart entre `src/data/*.json` et `Source/` peut être une correction volontaire contre le PDF : cite le Source et la valeur JSON, tranche « bug ou correction ? » écart par écart, flague quand c'est ambigu, et ne tords jamais un test qui asserte une valeur corrigée. `docs/ajouter-un-livre-source.md` § « Piège des PDF sources faillibles »
- Une mesure ou une garde « X référence Y » (FK, orphelins, formes de ref, consommateurs) résout contre l'index des ids (`src/data/schemas/_ids.generated.ts`, `npm run gen`) : une chaîne égale à un id existant, hors clé d'identité, EST une occurrence, et le champ porteur se mesure depuis elles. Refuse un vocabulaire de clés ou un seuil de champ ; imprime collisions d'ids et labels égaux à un id comme angles morts. `scripts/docs/lib/structures-scan.mts`
- Un décor de `src/data/props.json` qu'aucune scène ne pose est du vocabulaire de remplissage de cartes, jamais un orphelin : aucun audit ni garde ne le purge, et il reçoit sa recette volumique comme un décor posé. #1343
