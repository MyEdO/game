import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { effectTables, findEffectTableById, domains, findTalentById } from './index';
import { computeObtainability } from '../../scripts/data/lib/obtainabilityGraph';

/**
 * Les 8 tables « MARQUES ARCANIQUES DE <VENT> » (1d10, une par Domaine de Couleur) — `VDM 04 l.156`,
 * `VDM 05 l.142`, `VDM 06 l.141`, `VDM 07 l.142`, `VDM 08 l.136`, `VDM 09 l.136`, `VDM 10 l.144`,
 * `VDM 11 l.142`. Tirées par l'op `rollTable` variante `tableId` sur le résultat « Marqué par la
 * Magie » du Tableau des Incantations Imparfaites (`VDM 02 l.238`).
 *
 * La Marque 10 de chaque Domaine est la source d'OCTROI RAW des 8 Talents *Empreint de (Vent)*
 * (`VDM 13 l.461`) : le lien Domaine→Talent est DÉCLARÉ par l'op `grantTalent` de la rangée, jamais
 * par une table codée. Ce test le prouve BOUT-EN-BOUT — la donnée est vue par le graphe
 * d'obtenabilité (`table:<id>`), ce qui fait redescendre la baseline d'`obtainability-guard`.
 */
const PREFIX = 'vdm-marques-arcaniques-';
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const marques = effectTables.filter((t) => t.id.startsWith(PREFIX));

describe('Marques Arcaniques (VDM) — 8 tables d10, une par Domaine de Couleur', () => {
  it('8 tables, chacune keyée par un `domainId` existant qui porte un Vent', () => {
    expect(marques).toHaveLength(8);
    for (const t of marques) {
      const domainId = t.id.slice(PREFIX.length);
      const domain = domains.find((d) => d.id === domainId);
      expect(domain, `${t.id} : domaine « ${domainId} » introuvable`).toBeDefined();
      expect(domain!.wind, `${domainId} sans Vent`).toBeTruthy();
    }
  });

  it('chaque table : 1d10, 10 rangées 1→10 contiguës, source VDM avec folio', () => {
    for (const t of marques) {
      expect(t.die).toBe('d10');
      expect(t.rows).toHaveLength(10);
      t.rows.forEach((r, i) => {
        expect(r.min, `${t.id} rangée ${i + 1}`).toBe(i + 1);
        expect(r.max, `${t.id} rangée ${i + 1}`).toBe(i + 1);
        expect(r.label, `${t.id} rangée ${i + 1} sans libellé`).toBeTruthy();
        expect(r.ops.length, `${t.id} rangée ${i + 1} sans op`).toBeGreaterThan(0);
      });
      expect(t.source?.book).toBe('vents-de-la-magie');
      expect(t.source?.page).toBeGreaterThan(0);
    }
  });

  it('la rangée 10 de chaque table octroie un Talent *Empreint* DISTINCT et existant', () => {
    const granted = new Set<string>();
    for (const t of marques) {
      const ops = t.rows[9].ops.filter((o) => o.op === 'grantTalent');
      expect(ops, `${t.id} : rangée 10 sans grantTalent`).toHaveLength(1);
      const id = ops[0].op === 'grantTalent' ? ops[0].talent.id : '';
      expect(findTalentById(id), `${t.id} : Talent « ${id} » introuvable`).toBeDefined();
      expect(granted.has(id), `Talent « ${id} » octroyé par deux tables`).toBe(false);
      granted.add(id);
    }
    expect(granted.size).toBe(8);
  });

  it('les 8 Talents *Empreint* sont OBTENABLES par leur table (câblage réel du graphe)', () => {
    const { talentSources } = computeObtainability(ROOT);
    for (const t of marques) {
      const op = t.rows[9].ops.find((o) => o.op === 'grantTalent');
      const id = op?.op === 'grantTalent' ? op.talent.id : '';
      expect([...(talentSources.get(id) ?? [])], `${id} sans source de table`).toContain(`table:${t.id}`);
    }
  });

  it('chaque table est résoluble par `findEffectTableById` (référençable par `rollTable`)', () => {
    for (const t of marques) expect(findEffectTableById(t.id).id).toBe(t.id);
  });
});
