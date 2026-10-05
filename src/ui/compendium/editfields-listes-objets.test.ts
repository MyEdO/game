/**
 * CLIQUET GÉNÉRIQUE (#1548, #1993) — le KIND qu'infère le formulaire ne ment jamais sur la FORME de la
 * donnée qu'il reçoit :
 *  - aucun kind SCALAIRE (`text`, `textarea`, `number`, `checkbox`, `select`) ne reçoit un tableau ;
 *  - aucun kind LISTE (`stringList`, `numberList`, `selectList`) ne reçoit un scalaire ;
 *  - aucune liste de scalaires (`stringList`/`numberList`) ne reçoit d'objets ni de tableaux (un
 *    `<input>` par élément rendrait « [object Object] » et écraserait l'objet au premier caractère).
 *
 * Le scan rejoue la projection réelle de `CodexEdit` sur TOUTES les catégories éditables : inférence
 * AVEC le nœud de la rangée de CHAQUE entrée éditée (`noeudDeLEntree`, d'où viennent `select`/
 * `selectList` ; une variante d'union discriminée par entrée), puis descente dans
 * les sous-formulaires (`ObjectField`, une valeur à la fois) et les tableaux d'objets
 * (`GenericArrayField` : les rangées d'une entrée, puis les colonnes-tableaux mises en commun à travers
 * les rangées), y compris sous les clés dédiées. Aucune liste de cas en dur.
 */
import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import { inferFields, type FieldKind, type RegimeDeLibelle } from './editFields';
import { refFieldCfg } from './RefField';
import { isEditableCategory, editableEntries, dedicatedFieldKeys, editableDataset, editableObjectDataset } from './CodexEdit';
import { noeudDeLEntree, noeudObjet } from '../../data/schemas/validate';

const SCALAIRES: ReadonlySet<FieldKind> = new Set(['text', 'textarea', 'number', 'checkbox', 'select']);
const LISTES: ReadonlySet<FieldKind> = new Set(['stringList', 'numberList', 'selectList']);

type Rangee = Record<string, unknown>;
const estObjet = (x: unknown): x is Rangee => x != null && typeof x === 'object' && !Array.isArray(x);
const tableauDObjets = (v: unknown): v is Rangee[] => Array.isArray(v) && v.length > 0 && v.every(estObjet);

/**
 * Défauts de forme des champs inférés sur `rangees`. `racine` : premier niveau d'une entrée (un tableau
 * d'objets y est rendu PAR ENTRÉE) ; sinon, les colonnes-tableaux d'une rangée sont mises en commun à
 * travers les rangées, comme `GenericArrayField` le fait (`nestedCols`).
 */
function defautsDeForme(rangees: Rangee[], regime: RegimeDeLibelle, chemin: string, racine: boolean): string[] {
  const out: string[] = [];
  for (const f of inferFields(rangees, regime)) {
    const valeurs = rangees.map((r) => r[f.key]).filter((v) => v != null);
    const ici = `${chemin}.${f.key} (kind=${f.kind})`;
    if (SCALAIRES.has(f.kind) && valeurs.some(Array.isArray)) out.push(`${ici} reçoit un tableau`);
    if (LISTES.has(f.kind) && valeurs.some((v) => !Array.isArray(v))) out.push(`${ici} reçoit un scalaire`);
    if ((f.kind === 'stringList' || f.kind === 'numberList') && valeurs.some((v) => Array.isArray(v) && v.some((x) => x != null && typeof x === 'object')))
      out.push(`${ici} reçoit des objets ou des tableaux`);
    const sous: RegimeDeLibelle = { niveau: 'profondeur', noeud: noeudObjet(f.noeud) };
    if (f.kind === 'object') for (const v of valeurs.filter(estObjet)) out.push(...defautsDeForme([v], sous, `${chemin}.${f.key}`, false));
    if (f.kind === 'json') {
      const tableaux = valeurs.filter(tableauDObjets);
      const groupes = racine ? tableaux : [tableaux.flat()].filter((g) => g.length);
      for (const g of groupes) out.push(...defautsDeForme(g, sous, `${chemin}.${f.key}[]`, false));
    }
  }
  return out;
}

describe('Codex — le kind inféré d’un champ ne ment jamais sur la forme de sa donnée (#1548, #1993)', () => {
  const editable = CODEX.filter((c) => isEditableCategory(c.key));

  it('toutes les catégories éditables sont couvertes (au moins une)', () => {
    expect(editable.length).toBeGreaterThan(0);
  });

  for (const cat of editable) {
    it(`${cat.key} : aucun champ ne reçoit une forme que son kind ne rend pas`, () => {
      const ds = editableDataset(cat.key) ?? editableObjectDataset(cat.key)!.ds;
      const entries = editableEntries(cat.key) as Rangee[];
      const dedies = dedicatedFieldKeys(cat.key);
      const menteurs: string[] = [];
      for (const noeud of new Set(entries.map((e) => noeudDeLEntree(ds, e)))) {
        const regime: RegimeDeLibelle = { noeud };
        // Premier niveau : les champs du formulaire générique. Une clé DÉDIÉE n'y est pas rendue, mais un
        // tableau d'objets dédié l'est par `GenericArrayField` avec le nœud de SON champ : il est descendu.
        const generiques = entries.map((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !dedies.has(k) && !refFieldCfg(cat.key, k))));
        menteurs.push(...defautsDeForme(generiques, regime, cat.key, true));
        for (const f of inferFields(entries, regime).filter((x) => dedies.has(x.key) && x.kind === 'json')) {
          for (const v of entries.map((e) => e[f.key]).filter(tableauDObjets)) {
            menteurs.push(...defautsDeForme(v, { niveau: 'profondeur', noeud: noeudObjet(f.noeud) }, `${cat.key}.${f.key}[]`, false));
          }
        }
      }
      expect([...new Set(menteurs)], `champs rendus par un contrôle qui ne porte pas leur forme : ${menteurs.join(' ; ')}`).toEqual([]);
    });
  }
});
