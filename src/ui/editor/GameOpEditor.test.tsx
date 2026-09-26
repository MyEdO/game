import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameOpEditor, FormulaField, opSummary, newOp, formulaSummary, shapeOf, formulaForShape, OP_LABEL, OP_REF_FIELDS, opMissingRefs, opsMissingRefs } from './GameOpEditor';
import { datasetArray } from '../../data/overrides';
import { fallTables } from '../../data/shipCriticals';
import { lightTones } from '../../data';
import type { GameOp } from '../../engine/ops';

/**
 * ÉDITEUR D'OPS COMPLET — gate de RÉGRESSION : (a) une Formule (`{dice}`/`{charOf}`) se lit/édite sans
 * être écrasée en nombre (le bug `num()` → 0), (b) le menu « + op » propose TOUT le vocabulaire, (c)
 * chaque op a un éditeur — dédié ou repli JSON. Round-trip SANS PERTE = critère n°1.
 */

describe('GameOpEditor — Formule sans perte (correction du bug num()→0)', () => {
  it('un wounds {dice} N’affiche PAS « 0 » et rend l’éditeur de dés (1 d 10)', () => {
    const ops: GameOp[] = [{ op: 'wounds', amount: { dice: { n: 1, sides: 10 } } }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    // Le résumé montre la formule, pas « 0 » (le bug historique : num()→0 → « 0 Blessure(s) »).
    expect(html).toContain('1d10');
    expect(opSummary(ops[0])).not.toMatch(/(^|[^d\d])0 Blessure/); // pas un « 0 » isolé devant « Blessure »
    expect(opSummary(ops[0])).toContain('1d10 Blessure');
    // L’éditeur est sur la forme « Dés » sélectionnée (pas un champ nombre à 0).
    expect(html).toContain('value="dice"');
    expect(html).toContain('value="1"'); // n
    expect(html).toContain('value="10"'); // faces
  });

  it('opSummary lit chaque forme de Formula (littéral / Bonus / Valeur / Dés)', () => {
    expect(opSummary({ op: 'wounds', amount: 5 })).toContain('5 Blessure');
    expect(opSummary({ op: 'wounds', amount: { bonusOf: 'force-mentale' } })).toContain('BFM Blessure');
    expect(opSummary({ op: 'wounds', amount: { charOf: 'force-mentale' } })).toContain('FM Blessure');
    expect(opSummary({ op: 'heal', amount: { dice: { n: 1, sides: 10, plus: 2 } } })).toContain('1d10+2');
  });

  it('formulaSummary couvre les 4 formes (jamais « 0 » pour une formule réelle)', () => {
    expect(formulaSummary(7)).toBe('7');
    expect(formulaSummary({ bonusOf: 'force' })).toBe('BF');
    expect(formulaSummary({ charOf: 'intelligence' })).toBe('Int');
    expect(formulaSummary({ dice: { n: 2, sides: 6 } })).toBe('2d6');
  });

  it('changer de forme NE clobbe PAS une formule déjà de la bonne forme', () => {
    const dice = { dice: { n: 1, sides: 10 } } as const;
    // Rester sur « dice » renvoie la MÊME référence (aucune coercition en nombre).
    expect(shapeOf(dice)).toBe('dice');
    expect(formulaForShape('dice', dice)).toBe(dice);
    expect(shapeOf({ charOf: 'force-mentale' })).toBe('char');
    expect(formulaForShape('char', { charOf: 'force-mentale' })).toEqual({ charOf: 'force-mentale' });
    // Bascule littéral→nombre conserve la valeur littérale ; vers une forme structurée → défaut valide.
    expect(formulaForShape('lit', 4)).toBe(4);
    expect(formulaForShape('dice', 4)).toEqual({ dice: { n: 1, sides: 10 } });
  });
});

describe('GameOpEditor — menu « + op » COMPLET', () => {
  it('le menu propose narrative ET grantWeapon (entre autres)', () => {
    const html = renderToStaticMarkup(<GameOpEditor ops={[]} onChange={() => {}} />);
    expect(html).toContain('Effet narratif'); // narrative
    expect(html).toContain('Invoquer une arme magique'); // grantWeapon
    expect(html).toContain('+ Op mécanique');
  });

  it('toutes les op du vocabulaire ont un défaut valide et un libellé', () => {
    for (const k of Object.keys(OP_LABEL) as GameOp['op'][]) {
      expect(OP_LABEL[k], `${k} → libellé`).toBeTruthy();
      expect(opSummary(newOp(k)), `${k} → résumé`).not.toBe(''); // résumé informatif, jamais vide
    }
  });
});

/**
 * GRAINE d'une op : une op créée par l'atelier n'ÉLIT jamais une entrée de registre à la place de
 * l'auteur. Deux verdicts complémentaires, sur TOUT le vocabulaire (aucune liste à la main) :
 *  (a) tout champ-réf d'une op fraîche est VIDE — l'auteur choisit, l'op porte sa raison ;
 *  (b) s'il est malgré tout renseigné, il RÉSOUT dans son dataset (le défaut historique : `talentId:
 *      'sang-froid'` absent de talents.json, `ref: 'Loup'`/'Ours' — des LIBELLÉS là où le bestiaire
 *      est keyé `loup`/`ours` → `RefIrresoluble` au jeu).
 */
describe('GameOpEditor — aucune graine de réf semée par newOp', () => {
  const knownIds = (ds: string) => new Set((datasetArray(ds as never) as { id?: string }[]).map((e) => e.id));

  it('chaque champ-réf de chaque op fraîche est vide, et résout s’il ne l’est pas', () => {
    for (const k of Object.keys(OP_LABEL) as GameOp['op'][]) {
      const fresh = newOp(k) as unknown as Record<string, unknown>;
      for (const f of OP_REF_FIELDS[k] ?? []) {
        const v = fresh[f.field];
        expect([undefined, ''], `${k}.${f.field} = ${String(v)} — graine de réf`).toContain(v);
        if (typeof v === 'string' && v !== '') {
          expect(knownIds(f.ds).has(v), `${k}.${f.field} « ${v} » introuvable dans ${f.ds}`).toBe(true);
        }
      }
    }
  });

  it('une op fraîche à champ-réf REQUIS porte sa raison ; renseignée, elle n’en porte plus', () => {
    expect(opMissingRefs(newOp('grantTalent'))).toEqual(['Accorder un Talent : Talent à choisir']);
    expect(opMissingRefs({ op: 'grantTalent', talentId: 'ambidextre' })).toEqual([]);
    // Champ FACULTATIF (`removeCondition.id` = « au choix ») : absent ≠ manquant.
    expect(opMissingRefs(newOp('removeCondition'))).toEqual([]);
  });

  it('opsMissingRefs descend dans les ops IMBRIQUÉES (rangée de table, différé)', () => {
    const nested: GameOp = { op: 'rollTable', die: 'd10', rows: [{ min: 1, max: 5, ops: [newOp('summon')] }] };
    expect(opsMissingRefs(nested)).toEqual(['Invoquer une créature : Créature à choisir']);
    expect(opsMissingRefs({ passive: [newOp('skillMod')] })).toHaveLength(1);
  });
});

describe('GameOpEditor — éditeur pour TOUTE op (dédié ou repli JSON)', () => {
  it('grantWeapon (sans éditeur dédié) rend un repli JSON montrant ses params', () => {
    const ops: GameOp[] = [{ op: 'grantWeapon', label: 'Arme aethyrique', damage: { bonusOf: 'force-mentale' }, plusBF: false }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(html).toContain('(JSON)'); // repli JSON présent
    expect(html).toContain('Arme aethyrique'); // params lisibles dans le textarea
    expect(html).toContain('bonusOf'); // la formule de Dégâts est visible (pas perdue)
    expect(opSummary(ops[0])).toContain('Arme aethyrique');
  });

  it('narrative a un éditeur de texte dédié', () => {
    const ops: GameOp[] = [{ op: 'narrative', text: 'Le sol tremble.' }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(html).toContain('Le sol tremble.');
    expect(opSummary(ops[0])).toContain('Le sol tremble.');
  });

  it('light a un éditeur dédié : rayon SAISISSABLE et ton élu dans le catalogue lightTones', () => {
    const ops: GameOp[] = [{ op: 'light', radiusM: 7, tone: 'chandelle' }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(html).not.toContain('(JSON)'); // éditeur dédié, pas un repli
    expect(html).toContain('Rayon (m)');
    expect(html).toContain('value="7"'); // rayon éditable
    // Le select liste TOUT le catalogue (aucune liste en dur), et l'op élue est sélectionnée.
    for (const t of lightTones) expect(html).toContain(`value="${t.id}"`);
    expect(html).toContain('value="chandelle" selected');
  });

  // (Un Test imbriqué est un nœud de la STRUCTURE Flow `{kind:'test'}` (édité par le FlowEditor, pas
  //  le GameOpEditor), résolu cadence-aware.)

  it('rollTable a un éditeur STRUCTURÉ (dé + rangées récursives), jamais de repli JSON (#514)', () => {
    const ops: GameOp[] = [{
      op: 'rollTable', die: 'd10', addNegativeSL: true,
      rows: [{ min: 1, max: 2, ops: [{ op: 'wounds', amount: 3 }] }],
    }];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(html).not.toContain('(JSON)'); // aucun repli JSON pour cette op
    expect(html).toContain('value="d10"'); // sélecteur de dé
    expect(html).toContain('value="1"'); // min de la rangée
    expect(html).toContain('value="2"'); // max de la rangée
    expect(html).toContain('3 Blessure'); // ops de la rangée rendus par le MÊME GameOpEditor (récursif)
    expect(opSummary(ops[0])).toContain('1 rangée');
  });
});

describe('#1318 E1 — la borne d’une Formula littérale atteint le champ (cale de NumberField)', () => {
  it('FormulaField propage son `min` au champ nombre', () => {
    const avec = renderToStaticMarkup(<FormulaField label="Bonus (m)" value={3} min={0} onChange={() => {}} />);
    expect(avec).toMatch(/min="0"/);
    const sans = renderToStaticMarkup(<FormulaField label="Bonus (m)" value={3} onChange={() => {}} />);
    expect(sans).not.toMatch(/min="/);
  });
});


/**
 * #1508 T2 — L'OP `fall` S'ÉDITE. Elle naissait avec un id de table EN DUR (`tomberDuGreement`) et
 * n'avait AUCUN champ : l'auteur ne pouvait ni voir ni changer la table dont la hauteur se lit. La
 * recette navigateur l'a trouvée muette dans l'atelier.
 */
/**
 * ÉCART DIT — `fall` n'entre PAS dans `OP_REF_FIELDS` : ses candidats (`tablesDeChute`) sont un
 * tableau NICHÉ de `ship-criticals.json` dont la clé de dataset n'est pas encore ouverte. Le fichier en
 * expose déjà cinq (`overrides.ts:337-342` : `shipCriticalsCargaison`/`Greement`/`Coque`/`Avirons`/
 * `Equipements`), une par Localisation ; celle des tables de chute reste à ouvrir. Conséquence mesurée :
 * une op `fall` à table vide n'est pas listée par `opMissingRefs` — le `<select>` la montre « à
 * choisir », mais le récapitulatif des réfs manquantes l'ignore.
 */
describe('GameOpEditor — l’op `fall` a son champ de table (recette #1508)', () => {
  it('une op `fall` fraîche ne code AUCUN id : la table est à choisir', () => {
    const fresh = newOp('fall') as Extract<GameOp, { op: 'fall' }>;
    expect(fresh.hauteur.table.id, 'aucun id en dur — la donnée décide').toBe('');
    expect(opSummary(fresh)).toContain('table à choisir');
  });

  it('la rangée expose son SÉLECTEUR de table, peuplé depuis la donnée', () => {
    const ops: GameOp[] = [newOp('fall')];
    const html = renderToStaticMarkup(<GameOpEditor ops={ops} onChange={() => {}} />);
    expect(html).not.toContain('paramètres de l’op'); // l'op a son éditeur dédié, pas le repli JSON
    expect(html).toContain('Table de hauteur');
    expect(html).toContain('— (choisir une table) —');
    for (const t of fallTables) expect(html).toContain(`value="${t.id}"`);
    expect(fallTables.length, 'la donnée en porte au moins une').toBeGreaterThan(0);
  });

  it('un id CHOISI est relu dans l’op, et le résumé nomme la MÉCANIQUE puis la table', () => {
    const table = fallTables[0];
    const choisie: GameOp = { op: 'fall', hauteur: { table: { id: table.id } } };
    expect(opSummary(choisie)).toContain('hauteur lue dans');
    expect(opSummary(choisie)).toContain(table.label);
    expect(OP_LABEL.fall).toBe('Chute (hauteur lue dans une table)');
    const html = renderToStaticMarkup(<GameOpEditor ops={[choisie]} onChange={() => {}} />);
    expect(html).toContain(`value="${table.id}"`);
  });
});
