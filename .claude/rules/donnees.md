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

- Avant d'écrire une donnée de `src/data/*.json` (#148, doublon « Bélier ») : grep l'id, le label ET le concept dans tout `src/data/*.json`, car un concept vit peut-être déjà dans un autre sous-système (le Bélier existe dans 6 fichiers) ; cherche par label et synonymes, jamais par préfixe d'id. S'il existe, ne le duplique pas : étends-le ou re-scope. Un descripteur (« petit », « de qualité », « féroce ») se vérifie au RAW : s'il nomme un trait (`Taille`, `Rapide`…) ou une règle, il se modélise sur la référence (trait, ou Atout `qualities`/`qualityChoice`, `src/data/schemas/grammaire/reference.ts`, matérialisé avec sa `value` par `qualityInstance`, `src/data/index.ts`), jamais par une entité distincte. `docs/donnees.md` dit où va chaque donnée et ses conventions (book, page, formes) : une machine de guerre, un véhicule ou un navire n'est pas un trapping. Sort, créature, effet mécanique, icône ou livre : skill de domaine dédié.
- Chaque champ = Source RAW (en-tête de table incluse) ⊕ convention des entrées voisines, sans inflexion RAW silencieuse (issue au gabarit #101, ou valeur `maison` taguée). La FORME suit l'intention du RAW, pas seulement ses valeurs : une qualité ou un champ qui implique un mode d'emploi (Équipe N ⇒ poste servi, jamais un loadout porté ; monture ⇒ monté) se déploie dans son mécanisme. #156 (bélier modélisé en arme portée, règle d'Équipe contournée)
- Après édition : canonicalise par `serializeDataset` (`src/data/serialize.ts`), puis `npm run typecheck:fast` et `npm run test:perimetre` (suite et typecheck complets : CI de branche) ; gardes de la donnée : `src/data/serialize.test.ts`, `src/data/no-html-in-prose.test.ts`, `src/data/id-collisions.test.ts`.

- Un lot de FORME s'inventorie par CONCEPT : grep le concept dans tous les `src/data/*.json`, les schémas et le moteur (libellé, littéral d'op, regex sur label), jamais sur le seul dataset du ticket, et le lot va jusqu'au moteur (utilisateur, 2026-08-23 : « il n'y a aucune raison d'avoir autant de structure différente, même entre type. Il faudrait fournir une structure type partagé […] et l'imposé comme structure obligatoire pour tout json de l'application »). La forme cible se COMPOSE depuis `src/data/schemas/grammaire/` (fabriques fermées de `ref.ts`), jamais re-tapée. `src/data/grammaire-guard.test.ts`
- Un écart entre `src/data/*.json` et `Source/` peut être une correction volontaire contre le PDF : cite le Source et la valeur JSON, tranche « bug ou correction ? » écart par écart, flague quand c'est ambigu, et ne tords jamais un test qui asserte une valeur corrigée. `docs/ajouter-un-livre-source.md` § « Piège des PDF sources faillibles »
- Une mesure ou une garde « X référence Y » (FK, orphelins, formes de ref, consommateurs) résout contre l'index des ids (`src/data/schemas/_ids.generated.ts`, `npm run gen`) : une chaîne égale à un id existant, hors clé d'identité, EST une occurrence, et le champ porteur se mesure depuis elles. Refuse un vocabulaire de clés ou un seuil de champ ; imprime collisions d'ids et labels égaux à un id comme angles morts. `scripts/docs/lib/structures-scan.mts`
- Un décor de `src/data/props.json` qu'aucune scène ne pose est du vocabulaire de remplissage de cartes, jamais un orphelin : aucun audit ni garde ne le purge, et il reçoit sa recette volumique comme un décor posé. #1343
