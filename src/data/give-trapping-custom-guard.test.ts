/**
 * Garde-fou de SAISIE : un `giveTrapping` `custom` ne doit jamais RECRÉER un objet du catalogue.
 * Un `custom` n'est qu'une étiquette (`customTrapping`, engine/items.ts) — kind `misc`, sans profil
 * de Dégâts, sans PA, sans `capabilities` : « Épée » custom n'est pas une arme, « Ration » custom ne
 * nourrit personne. La forme canonique d'un objet existant est `trappingId` (id STABLE), les qualités
 * de scène se fusionnant par `withGiveQualities`.
 *
 * PORTÉE — deux signaux, tous deux tirés de la DONNÉE du catalogue (aucune liste de mots écrite ici) :
 *  1. HOMONYMIE de `label` (« Ration (1 jour) » ⇄ `ration`) ;
 *  2. FORME de famille : le libellé matche une entrée de `formChoices` d'un objet générique
 *     (« Épée » ⇄ `arme-simple`, dont les formes sont epee/hache/masse/marteau_guerre/demi_lance —
 *     LDB 62 l.125-127 : l'Arme simple couvre « les épées, les haches, les marteaux… »).
 * Ce que la garde NE VOIT PAS : l'équivalence purement CONCEPTUELLE hors `formChoices` (un custom
 * « Lame courte » ou « Gourdin » ne matche rien tant que la donnée ne porte pas cette forme) — le
 * détecteur ne remplace pas la relecture, il attrape la saisie évidente.
 *
 * Le rapprochement se fait par LIBELLÉ : ce test est un DÉTECTEUR DE SAISIE d'auteur (le seul angle
 * disponible sur une étiquette libre), jamais de la logique — aucun code de production ne lit ce
 * rapprochement. Les objets narratifs hors-base (« Clé en fer », « Lettre cachetée ») restent des
 * `custom` légitimes : ils n'ont ni homonyme ni forme au catalogue.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { fileURLToPath } from 'node:url';
import trappings from './trappings.json';
import { replier } from '../lib/ordre.mjs';

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
const SCENES_DIR = join(DATA_DIR, '..', 'scenes');

/** Clé de rapprochement d'un libellé : `replier`, sans suffixe entre parenthèses
 *  (« Ration (1 jour) » ⇄ « Ration »), espaces normalisés. */
function key(label: string): string {
  return replier(label).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
}

type Trapping = { id: string; label: string; formChoices?: string[] };

const CATALOG = new Map<string, string>(); // clé de libellé → id de catalogue
const FORMS = new Map<string, { id: string; form: string }>(); // clé d'une FORME de famille → entrée porteuse
for (const t of trappings as Trapping[]) {
  if (!CATALOG.has(key(t.label))) CATALOG.set(key(t.label), t.id);
  // `formChoices` (ids de forme, ex. 'marteau_guerre') : la donnée DIT elle-même quelles armes
  // concrètes une entrée générique couvre — c'est la source du 2ᵉ signal, jamais une liste écrite ici.
  for (const f of t.formChoices ?? []) if (!FORMS.has(key(f.replace(/_/g, ' ')))) FORMS.set(key(f.replace(/_/g, ' ')), { id: t.id, form: f });
}

/** Id de catalogue que ce libellé libre recrée, s'il y en a un (homonyme de `label`, sinon FORME
 *  d'une entrée générique). Pluriel trivial (« Épées ») ramené au singulier pour le rapprochement. */
function recreates(label: string): { id: string; form?: string } | null {
  const k = key(label);
  const keys = [k, ...(k.length > 3 && k.endsWith('s') && !k.endsWith('ss') ? [k.slice(0, -1)] : [])];
  for (const kk of keys) {
    const byLabel = CATALOG.get(kk);
    if (byLabel) return { id: byLabel };
    const byForm = FORMS.get(kk);
    if (byForm) return byForm;
  }
  return null;
}

/** Ligne de rapport d'un custom fautif — porte l'id à utiliser (et la forme, quand c'est le signal). */
function hitLine(where: string, label: string, hit: { id: string; form?: string }): string {
  return `${where} : custom "${label}" → utiliser trappingId "${hit.id}"${hit.form ? ` (forme ${hit.form})` : ''}`;
}

/** Fichiers d'une racine, à toute profondeur, retenus sur leur NOM de base. */
function fichiersSous(dir: string, garde: (nom: string) => boolean): string[] {
  return listerArbre(dir, { filtre: (rel) => garde(rel.split('/').pop()!) }).map((rel) => join(dir, rel));
}

/** Nœuds `giveTrapping` (Effet `type` ou GameOp `op`) portant un `custom` littéral, dans un JSON. */
function customsInJson(value: unknown, path: string, out: { where: string; label: string }[]): void {
  if (Array.isArray(value)) value.forEach((v, i) => customsInJson(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ((o.type === 'giveTrapping' || o.op === 'giveTrapping') && typeof o.custom === 'string') out.push({ where: path, label: o.custom });
    for (const [k, v] of Object.entries(o)) customsInJson(v, path ? `${path}.${k}` : k, out);
  }
}

const GIVE_CUSTOM_TS = /giveTrapping'[^\n]*?\bcustom:\s*'([^']+)'/;

describe('giveTrapping : un `custom` ne recrée jamais un objet du catalogue', () => {
  const jsonFiles = [
    ...fichiersSous(DATA_DIR, (f) => f.endsWith('.json') && !f.startsWith('_')),
    ...fichiersSous(SCENES_DIR, (f) => f.endsWith('.json')),
  ];
  it('données JSON (data + scènes)', () => {
    const hits: string[] = [];
    for (const f of jsonFiles) {
      const found: { where: string; label: string }[] = [];
      customsInJson(JSON.parse(readFileSync(f, 'utf8')), '', found);
      for (const h of found) {
        const hit = recreates(h.label);
        if (hit) hits.push(hitLine(`${f} (${h.where})`, h.label, hit));
      }
    }
    expect(hits, `Objets de catalogue recréés en \`custom\` :\n${hits.join('\n')}`).toEqual([]);
  });

  it('scènes authorées en TypeScript', () => {
    const hits: string[] = [];
    for (const { rel, text } of readCorpus(['src/scenes'], { exts: ['.ts'] })) {
      text.split(/\r?\n/).forEach((line, i) => {
        const m = GIVE_CUSTOM_TS.exec(line);
        const hit = m && recreates(m[1]);
        if (m && hit) hits.push(hitLine(`${rel}:${i + 1}`, m[1], hit));
      });
    }
    expect(hits, `Objets de catalogue recréés en \`custom\` :\n${hits.join('\n')}`).toEqual([]);
  });
});
