# Sprites de décor interactif (SP2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 5 sprites de décor fouillable (`lettre`, `coffre`, `cle`, `bourse`, `etagere`) au catalogue, avec un flag `searchable` data-driven qui pré-arme l'`interact` (SP1) à la pose dans l'éditeur.

**Architecture:** SVG dessinés à la main dans `catalog/decor.ts` (moule 120×150 existant) ; flag `PropViz.searchable` ; helper pur `propRefPatch` consommé par le sélecteur de décor de l'éditeur (non-destructif). Aucune mécanique SP1 touchée.

**Tech Stack:** TS + React (éditeur), Vitest. Rendu SVG inline. QC via resvg (`scripts/qc/`).

**Spec:** `docs/superpowers/specs/2026-06-08-decor-sprites-sp2-design.md`

⚠️ `Editor.tsx` est édité en parallèle (autre session, Marchand) → patch ciblé + commit propre, et **vérifier après coup que mon code est dans HEAD** (sweep possible). `catalog/decor.ts` / `types.ts` peu disputés.

---

## Task 1 : `PropViz.searchable` + 5 sprites + entrées catalogue (TDD catalogue d'abord)

**Files:**
- Modify: `src/gameIso/catalog/types.ts` (champ `searchable?`)
- Modify: `src/gameIso/catalog/decor.ts` (5 `render` + 5 entrées `PROPS`)
- Modify: `src/gameIso/catalog/decor.test.ts` (assertions catalogue)

- [ ] **Step 1 — test catalogue qui échoue** (ajouter à `decor.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { PROPS, propSvg } from './decor';

describe('SP2 — décors fouillables', () => {
  const NEW = ['lettre', 'coffre', 'cle', 'bourse', 'etagere'];
  it('les 5 nouveaux décors sont enregistrés, searchable, et rendus non vides', () => {
    for (const id of NEW) {
      expect(PROPS[id], id).toBeDefined();
      expect(PROPS[id].searchable, id).toBe(true);
      expect(propSvg(id).length, id).toBeGreaterThan(40);
    }
  });
  it('un décor pur n’est pas searchable', () => {
    expect(PROPS.tonneau.searchable).toBeFalsy();
    expect(PROPS.cadavre.searchable).toBeFalsy();
  });
});
```

- [ ] **Step 2 — run → FAIL** : `cd "C:/Users/gauch/PhpstormProjects/Foundry/Game" && npx vitest run src/gameIso/catalog/decor.test.ts`
  Attendu : FAIL (`PROPS.lettre` undefined).

- [ ] **Step 3 — ajouter le champ** dans `types.ts`, interface `PropViz` (après `label`) :

```ts
  /** Décor « naturellement fouillable/ramassable » : l'éditeur pré-arme `interact` à la pose (SP2↔SP1). */
  searchable?: boolean;
```

- [ ] **Step 4 — 5 fonctions `render`** dans `decor.ts` (avant `export const PROPS`), même moule 120×150 / sol ≈ y146 :

```ts
const lettre = () =>
  `<g><ellipse cx="60" cy="148" rx="28" ry="6" fill="#000" opacity="0.18"/><path d="M30 150 L88 132 Q96 130 95 138 L40 156 Q30 158 30 150 Z" fill="#e8dcae"/><path d="M30 150 L88 132" stroke="#c9b988" stroke-width="2"/><path d="M46 147 h26 M46 151 h22" stroke="#7a6a44" stroke-width="1" opacity="0.6"/><ellipse cx="36" cy="150" rx="8" ry="9" fill="#d8c79a"/><ellipse cx="36" cy="150" rx="3.4" ry="5" fill="#b8a06e"/><circle cx="74" cy="142" r="7" fill="#9e2a22"/><circle cx="74" cy="142" r="7" fill="#000" opacity="0.12"/><path d="M71 142 l3 3 l4 -5" stroke="#5e120e" stroke-width="1.4" fill="none"/></g>`;
const coffre = () =>
  `<g><ellipse cx="60" cy="148" rx="32" ry="8" fill="#000" opacity="0.22"/><rect x="30" y="118" width="60" height="30" rx="3" fill="#6e4a28"/><path d="M30 118 Q60 96 90 118 Z" fill="#7a5230"/><path d="M30 118 Q60 100 90 118" fill="none" stroke="#4a3018" stroke-width="2"/><path d="M44 102 L44 148 M76 102 L76 148" stroke="#7d7a74" stroke-width="4"/><path d="M30 118 h60" stroke="#5a5550" stroke-width="3"/><rect x="54" y="124" width="12" height="12" rx="2" fill="#d8a93b"/><circle cx="60" cy="130" r="2.4" fill="#3a2a10"/></g>`;
const cle = () =>
  `<g><ellipse cx="60" cy="146" rx="22" ry="6" fill="#000" opacity="0.18"/><g transform="rotate(20 60 142)"><circle cx="36" cy="142" r="11" fill="none" stroke="#9a968e" stroke-width="5"/><rect x="46" y="139.5" width="42" height="5" rx="2.5" fill="#9a968e"/><path d="M82 144 v8 h4 v-4 h4 v4 h4 v-8 Z" fill="#9a968e"/></g><circle cx="33" cy="139" r="2" fill="#cfccc4"/></g>`;
const bourse = () =>
  `<g><ellipse cx="58" cy="148" rx="26" ry="7" fill="#000" opacity="0.2"/><path d="M40 128 Q38 150 58 150 Q78 150 76 128 Q70 122 58 122 Q46 122 40 128 Z" fill="#6a4a2a"/><path d="M44 134 Q58 142 72 134" stroke="#4a3018" stroke-width="1.5" fill="none" opacity="0.7"/><path d="M48 124 Q58 116 68 124" fill="#7a5a32"/><path d="M48 124 q5 4 10 0 q5 4 10 0" stroke="#3a2818" stroke-width="2" fill="none"/><ellipse cx="84" cy="147" rx="6" ry="3" fill="#d8a93b"/><ellipse cx="80" cy="144" rx="6" ry="3" fill="#e8c25a"/></g>`;
const etagere = () =>
  `<g><ellipse cx="60" cy="148" rx="28" ry="7" fill="#000" opacity="0.2"/><rect x="34" y="60" width="6" height="88" fill="#5a3c22"/><rect x="80" y="60" width="6" height="88" fill="#5a3c22"/><rect x="32" y="62" width="56" height="7" fill="#6e4a28"/><rect x="32" y="96" width="56" height="7" fill="#6e4a28"/><rect x="32" y="130" width="56" height="7" fill="#6e4a28"/><rect x="42" y="50" width="9" height="12" rx="2" fill="#7a5a32"/><path d="M58 50 q6 0 6 6 v6 h-12 v-6 q0 -6 6 -6z" fill="#8a6a3c"/><rect x="44" y="84" width="14" height="12" fill="#9e2a22"/><rect x="62" y="86" width="10" height="10" rx="2" fill="#3a6a8a"/></g>`;
```

- [ ] **Step 5 — enregistrer** dans `PROPS` (à la fin, avant la `}` de fermeture) :

```ts
  lettre: { id: 'lettre', label: 'Lettre', render: lettre, searchable: true },
  coffre: { id: 'coffre', label: 'Coffre', render: coffre, searchable: true },
  cle: { id: 'cle', label: 'Clé', render: cle, searchable: true },
  bourse: { id: 'bourse', label: 'Bourse', render: bourse, searchable: true },
  etagere: { id: 'etagere', label: 'Étagère', render: etagere, searchable: true },
```

- [ ] **Step 6 — run → PASS** : `npx vitest run src/gameIso/catalog/decor.test.ts` + `npm run typecheck`.

- [ ] **Step 7 — commit** : `git add src/gameIso/catalog/types.ts src/gameIso/catalog/decor.ts src/gameIso/catalog/decor.test.ts && git commit -m "feat(decor): sprites SP2 (lettre/coffre/cle/bourse/etagere) + flag searchable"`

---

## Task 2 : helper pur `propRefPatch` (auto-suggestion interact, testable hors React)

**Files:**
- Create: `src/ui/editor/propDefaults.ts`
- Create: `src/ui/editor/propDefaults.test.ts`

- [ ] **Step 1 — test qui échoue** (`propDefaults.test.ts`) :

```ts
import { describe, it, expect } from 'vitest';
import { propRefPatch } from './propDefaults';

describe('propRefPatch — auto-suggestion interact à la pose', () => {
  it('décor searchable sans interact → pré-arme interact{effects:[]}', () => {
    const p = propRefPatch('coffre', false);
    expect(p.ref).toBe('coffre');
    expect(p.interact).toEqual({ effects: [] });
  });
  it('décor searchable AVEC interact déjà posé → ne clobbe pas (pas de clé interact)', () => {
    const p = propRefPatch('coffre', true);
    expect(p).toEqual({ ref: 'coffre' });
    expect('interact' in p).toBe(false);
  });
  it('décor pur (non searchable) → seulement ref, aucun interact', () => {
    const p = propRefPatch('tonneau', false);
    expect(p).toEqual({ ref: 'tonneau' });
  });
});
```

- [ ] **Step 2 — run → FAIL** : `npx vitest run src/ui/editor/propDefaults.test.ts` (module introuvable).

- [ ] **Step 3 — implémenter** (`propDefaults.ts`) :

```ts
import { PROPS } from '../../gameIso/catalog/decor';
import type { SceneEntity } from '../../state/scene';

/** Patch d'inspecteur quand on choisit un décor : pré-arme `interact` si le prop est `searchable`
 *  ET qu'aucun `interact` n'existe (SP2↔SP1). Ne touche jamais un `interact` présent. PUR. */
export function propRefPatch(ref: string, hasInteract: boolean): Partial<SceneEntity> {
  if (PROPS[ref]?.searchable && !hasInteract) return { ref, interact: { effects: [] } };
  return { ref };
}
```

- [ ] **Step 4 — run → PASS** : `npx vitest run src/ui/editor/propDefaults.test.ts` + `npm run typecheck`.

- [ ] **Step 5 — commit** : `git add src/ui/editor/propDefaults.ts src/ui/editor/propDefaults.test.ts && git commit -m "feat(editor): propRefPatch -- pre-arme interact a la pose d'un decor searchable"`

---

## Task 3 : brancher le sélecteur de décor de l'éditeur

**Files:**
- Modify: `src/ui/editor/Editor.tsx` (import + `onChange` du `<select>` décor, ~`:1362`)

> ⚠️ Fichier partagé. **Relire** le site avant patch (`grep "value={sel.ref ?? 'tonneau'}"`), patch ciblé, commit propre, puis `git show HEAD:src/ui/editor/Editor.tsx | grep propRefPatch` pour confirmer.

- [ ] **Step 1 — import** : ajouter en tête de `Editor.tsx`, près des autres imports éditeur :

```ts
import { propRefPatch } from './propDefaults';
```

- [ ] **Step 2 — remplacer l'onChange du sélecteur de décor** (le `<select>` dont la valeur est `sel.ref ?? 'tonneau'`) :

```tsx
<select value={sel.ref ?? 'tonneau'} onChange={(e) => updateSel(propRefPatch(e.target.value, !!sel.interact))}>
```

(Laisser le `value=` et la liste `Object.values(PROPS).map(...)` inchangés.)

- [ ] **Step 3 — typecheck** : `npm run typecheck` vert.

- [ ] **Step 4 — commit** : `git add src/ui/editor/Editor.tsx && git commit -m "feat(editor): selecteur de decor pre-arme interact via propRefPatch (SP2)"` puis `git show --stat HEAD` (aucun fichier étranger) et `git show HEAD:src/ui/editor/Editor.tsx | Select-String propRefPatch`.

---

## Task 4 : QC reconnaissabilité + recette navigateur

**Files:** (potentiellement) `src/gameIso/catalog/decor.ts` (retouches sprites)

- [ ] **Step 1 — rendu PNG** d'une planche des 5 props (resvg, cf. `scripts/qc/`) : générer un PNG par prop (boîte 120×150) ou une planche montée.

- [ ] **Step 2 — agents aveugles** : faire deviner chaque prop **sans son nom** (« qu'est-ce que c'est ? »). Critère de sortie : chacun deviné correctement par ≥ une passe (coffre ≠ caisse, lettre = parchemin/lettre, bourse = sac de pièces, clé = clé, étagère = rayonnage).

- [ ] **Step 3 — best-of-N** : pour chaque prop mal reconnu, retoucher le SVG (silhouette/contraste/échelle/détail signature : sceau rouge, serrure dorée, panneton, lacet+pièces, planches) et re-rendre jusqu'à reconnaissable. Re-run `npx vitest run src/gameIso/catalog/decor.test.ts` (toujours vert).

- [ ] **Step 4 — recette navigateur** (`npm run dev` + Playwright) : ouvrir l'**éditeur**, palette Décor → vérifier les 5 entrées ; placer un `coffre` → l'inspecteur **pré-coche « Interactif »** (effets vides) ; ajouter un effet `giveTrapping` ; « Tester » → en jeu, le coffre a le **halo** et se **fouille**. 0 erreur console.

- [ ] **Step 5 — commit** (si retouches sprites) : `git add src/gameIso/catalog/decor.ts && git commit -m "polish(decor): reconnaissabilite des sprites SP2 (QC aveugle)"`.

---

## Self-review (couverture spec)

- §3 (5 sprites) → Task 1 steps 4-5. ✓
- §4 (flag `searchable` data-driven) → Task 1 step 3/5. ✓
- §5 (auto-suggestion non-destructive) → Task 2 (helper) + Task 3 (câblage). ✓
- §6 (tests catalogue + éditeur) → Task 1 step 1 + Task 2 step 1. ✓
- §7 (QC reconnaissabilité) → Task 4. ✓
- §8 (fichiers partagés / recette) → Task 3 garde + Task 4 step 4. ✓

**Cohérence des types** : `PropViz.searchable?: boolean` (Task 1) lu par `propRefPatch` (Task 2) et le test catalogue (Task 1) ; `propRefPatch(ref, hasInteract): Partial<SceneEntity>` identique en Task 2 et Task 3. `interact: { effects: [] }` cohérent avec `SceneEntity.interact` (SP1).
