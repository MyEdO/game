import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { fileURLToPath } from 'node:url';
import { effectTables, findEffectTableById, mutationTables } from './index';
import { TABLE_ORPHAN_RATCHET } from '../../scripts/guards/lib/tableConsumerStock.mjs';
import { ecartDuVolet, remedeNomme, type EntreeNominative } from '../../scripts/guards/lib/stock.mjs';
import { MOTIF_DECLARATION, sitesTableOrpheline } from '../../scripts/guards/lib/tableConsumerAudit';

/**
 * Intégrité de `tables.json` (tables d'effets référençables) + BIEN-FORMATION des ops `rollTable`/
 * `rollMutation` dans TOUS les `src/data/*.json` : `gameOpSchema` est LOOSE (seul `op` validé), donc les
 * contraintes XOR (`rows` ⊕ `tableId`) et la résolution des refs (`tableId` → tables.json ; `table` →
 * mutationTables.json) vivent ICI (jamais un tirage vers une table fantôme au runtime).
 */
const DIR = fileURLToPath(new URL('.', import.meta.url));
const files = listerDossier(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
const effectIds = new Set(effectTables.map((t) => t.id));
const mutationTableIds = new Set(mutationTables.map((t) => t.id));

/** Collecte toutes les ops d'un `op` donné, en profondeur, de tous les datasets. */
function collectOps(op: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (n: unknown): void => {
    if (Array.isArray(n)) return void n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (o.op === op && !('kind' in o)) out.push(o);
    for (const v of Object.values(o)) walk(v);
  };
  for (const f of files) walk(JSON.parse(readFileSync(join(DIR, f), 'utf8')));
  return out;
}

describe('tables.json — tables d’effets référençables', () => {
  it('chaque table : id unique, die valide, rangées non vides, source citée', () => {
    const seen = new Set<string>();
    for (const t of effectTables) {
      expect(seen.has(t.id), `id dupliqué : ${t.id}`).toBe(false);
      seen.add(t.id);
      expect(['d10', 'd100']).toContain(t.die);
      expect(t.rows.length).toBeGreaterThan(0);
      expect(t.source?.book, `${t.id} sans source`).toBeTruthy();
      for (const r of t.rows) expect(r.min).toBeLessThanOrEqual(r.max);
    }
  });

  it('les 4 colonnes du Tableau des aspects démoniaques (EDOC 13) existent, 10 rangées chacune', () => {
    for (const dom of ['nurgle', 'slaanesh', 'tzeentch', 'indivisible']) {
      const t = findEffectTableById(`allure-demoniaque-${dom}`);
      expect(t.rows).toHaveLength(10);
      expect(t.die).toBe('d10');
    }
  });

  it('findEffectTableById fail-fast sur un id inconnu', () => {
    expect(() => findEffectTableById('inexistante')).toThrow(/introuvable/i);
  });
});

describe('bien-formation des ops rollTable / rollMutation (tous les datasets)', () => {
  it('rollTable : EXACTEMENT un de `rows` ⊕ `tableId`', () => {
    const bad = collectOps('rollTable').filter((o) => ('rows' in o) === ('tableId' in o));
    expect(bad, `rollTable doit porter rows OU tableId (jamais les deux, jamais aucun) :\n${JSON.stringify(bad)}`).toEqual([]);
  });

  it('rollTable.tableId résout dans tables.json', () => {
    const bad = collectOps('rollTable').filter((o) => 'tableId' in o && !effectIds.has(o.tableId as string));
    expect(bad, `tableId introuvable :\n${JSON.stringify(bad)}`).toEqual([]);
  });

  it('rollMutation.table résout dans mutationTables.json', () => {
    const bad = collectOps('rollMutation').filter((o) => !mutationTableIds.has(o.table as string));
    expect(bad, `table de mutation introuvable :\n${JSON.stringify(bad)}`).toEqual([]);
  });
});

describe('cliquet — toute table d’effets a un CONSOMMATEUR (donnée écrite, non tirée = dette)', () => {
  const STOCK = 'scripts/guards/lib/tableConsumerStock.mjs';

  /** Les orphelines MESURÉES en SITES `{ file, ref }` — `file` = le dataset où la table est
   *  DÉCLARÉE —, confrontées au stock par la primitive partagée, dans les deux sens. La MESURE
   *  (corpus des consommateurs, motif de déclaration, jeton cité) vit dans
   *  `scripts/guards/lib/tableConsumerAudit.ts` : la garde et le régénérateur
   *  `scripts/data/regen-table-orphan-stock.mts` en partagent la SEULE lecture. */
  const ecartOrphelines = (stock: Iterable<EntreeNominative> = TABLE_ORPHAN_RATCHET) =>
    ecartDuVolet({ sites: sitesTableOrpheline(), stock, ou: STOCK });

  // #1467 L1b V-FLIP-ENTITE-b — le MOTIF de retrait est ce qui tient tout le cliquet : s'il rate
  // une déclaration, la table qui la porte devient sa propre consommatrice et sort du décompte des
  // orphelines EN SILENCE. Il se vérifie donc sur la donnée RÉELLE, pas seulement par son effet.
  it('le motif de DÉCLARATION retire exactement une déclaration par table — jamais une de moins', () => {
    const raw = readFileSync(join(DIR, 'tables.json'), 'utf8');
    const trouves = raw.match(MOTIF_DECLARATION) ?? [];
    expect(trouves.length, 'une déclaration par table : le motif ne doit en rater AUCUNE').toBe(effectTables.length);
    // Et il ne laisse aucun `"id"` de PREMIER NIVEAU derrière lui : ce qui reste appartient aux rangées.
    for (const t of effectTables) {
      expect(raw.replace(MOTIF_DECLARATION, ''), `déclaration de « ${t.id} » non retirée`).not.toContain(`"${t.id}",`);
    }
  });

  it('le stock d’orphelines est INCLUS dans les orphelines mesurées — un solde à tort est impossible', () => {
    const { perimees } = ecartOrphelines();
    expect(perimees, `entrée(s) du stock qui ne sont PLUS mesurées orphelines — vérifier le MOTIF avant de solder :\n${perimees.join('\n')}`).toEqual(
      [],
    );
  });

  /** Les deux sens, par la primitive PARTAGÉE du dépôt (`ecartDuVolet`, `scripts/guards/lib/stock.mjs`).
   *  Aucun PLAFOND : ce qu'une dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et c'est
   *  l'entrée `{ fichier, ref, occurrence }` — qui NOMME `src/data/tables.json` — que la porte de
   *  plage (`croissanceDesStocks`) voit à l'append. Un compte, lui, lui est invisible. */
  it('chaque table est portée par une donnée ou le code de prod — les orphelines vivent dans le stock nominatif', () => {
    const { neuves, perimees } = ecartOrphelines();
    expect(neuves, `table(s) NEUVE(s) sans consommateur — câbler, jamais stocker :\n${neuves.join('\n')}`).toEqual([]);
    expect(perimees, `entrée(s) du stock désormais consommées — retirer leur ligne de tableConsumerStock.mjs :\n${perimees.join('\n')}`).toEqual([]);
  });

  it('chaque entrée NOMME le dataset où la table est déclarée — c’est ce que la porte de plage voit', () => {
    const muettes = TABLE_ORPHAN_RATCHET.filter((e) => e.fichier !== 'src/data/tables.json');
    expect(muettes, `Entrées dont le \`fichier\` n'est pas le dataset des tables : elles seraient INVISIBLES\n` +
      `à \`croissanceDesStocks\` :\n  ${JSON.stringify(muettes)}`).toEqual([]);
  });

  /** ALLONGER le stock ne s'échange plus contre un plafond relevé : une entrée de plus se DÉCLARE,
   *  parce qu'elle nomme un fichier — la garde la voit PÉRIMÉE, la porte de plage la voit à l'append. */
  it('ALLONGER le stock rougit : une entrée que plus aucune orpheline ne porte est PÉRIMÉE', () => {
    const gonfle = [...TABLE_ORPHAN_RATCHET, {
      fichier: 'src/data/tables.json', ref: 'table-qui-n-existe-pas', occurrence: 1,
    }];
    const { perimees } = ecartOrphelines(gonfle);
    expect(remedeNomme(perimees, ' :: table-qui-n-existe-pas :: 1')).toBe(true);
    expect(remedeNomme(perimees, 'entrée SOLDÉE')).toBe(true);
  });
});
