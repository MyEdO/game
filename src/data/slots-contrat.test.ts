import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  champDuPath,
  champsJoints,
  champsSansSlot,
  estTypeDuRegistre,
  idsDuType,
  slotsDeclares,
  valeursAuPath,
} from '../../scripts/docs/lib/slots-registre.mjs';
import { listerDocuments, scanDuCorpus } from '../../scripts/docs/lib/structures-scan.mjs';
import { ANGLES_MORTS_SLOTS, MANDAT_SLOTS } from '../../scripts/docs/lib/structures-lexique.mjs';
import { SLOTS_INTERNES, SLOTS_SANS_DECLARATION } from '../../scripts/guards/lib/slotsStock.mjs';
import { champsAveugles, ecartsDeStock, lignesMalQualifiees } from '../../scripts/guards/lib/stock.mjs';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — quelles références les schémas des DEUX racines DÉCLARENT-ils, à quel path ? ' +
    'B — les valeurs posées à ces paths RÉSOLVENT-elles toutes contre le registre des ids ? ' +
    'C — quels champs portent des références OBSERVÉES qu’AUCUN slot ne déclare (la dette d’adoption) ?',
  primitive:
    '`slotsDe` (`src/data/schemas/grammaire/slots.ts`) pour le DÉCLARÉ, `scannerDonnees` ' +
    '(`scripts/docs/lib/structures-scan.mts`) pour l’OBSERVÉ, joints par `scripts/docs/lib/slots-registre.mts`.',
  /** Le MANDAT ne se reformule pas : il se LIT à sa source unique. */
  mandat: MANDAT_SLOTS,
  perimetre:
    'Les documents authorés des deux racines `src/data` et `src/scenes` et leurs schémas zod des registres ' +
    '`SCHEMA_DEFS` / `SCHEMA_DEFS_SCENES`, joints par BASENAME (`nomDeDocument`).',
  angleMort: ANGLES_MORTS_SLOTS,
  baseline: {
    fichier: 'scripts/guards/lib/slotsStock.mjs',
    decroissant: true,
    raison:
      'Le stock EST la dette d’ADOPTION du registre : une ligne se solde en faisant ADOPTER la fabrique de ' +
      'référence par le schéma du champ (L2/L3, #1473), et part dans le MÊME commit que l’adoption.',
  },
  ticket: '#1466',
} as const;

const ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
/** La composition defs → familles/enums → scan vit dans `scanDuCorpus` (`structures-scan.mts`) : la
 *  MÊME que lisent `structures-contrat.test.ts`, `build-structures.mts` et `horsStrateAudit.ts`. */
const { defs: DEFS, scan } = scanDuCorpus(ROOT);
const SLOTS = slotsDeclares(DEFS);
const DOCUMENTS = new Map(listerDocuments(ROOT).map((d) => [d.nom, JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8')) as unknown]));

/** Clé de la dette d'ADOPTION : le couple (dataset, champ) ET son compte d'occurrences — une
 *  occurrence de plus est une entrée neuve, pas une ligne qui bouge. */
const CLE_DETTE = (c: { dataset: string; champ: string; occurrences: number }) =>
  `${c.dataset} | ${c.champ} | ${c.occurrences}`;

describe('registre des SLOTS — déclaré × observé (#1466 L1a, volet A)', () => {
  it('l’en-tête de garde est structuré (#1475) : question A→B→C, primitive, périmètre, angles morts, baseline, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('slots.ts');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER les deux racines mesurées.').toMatch(/src\/data.*src\/scenes/s);
    expect(GARDE.angleMort, 'les angles morts se lisent dans UNE source (`ANGLES_MORTS_SLOTS`), jamais recopiés.').toBe(ANGLES_MORTS_SLOTS);
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(4);
    expect(GARDE.mandat, 'le mandat se lit dans UNE source (`MANDAT_SLOTS`), jamais reformulé.').toBe(MANDAT_SLOTS);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/slotsStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1466');
  });

  it('MANDAT et ANGLES MORTS ont UNE source : le lexique, recopié nulle part (stock, doc)', () => {
    const stock = readFileSync(join(ROOT, 'scripts/guards/lib/slotsStock.mjs'), 'utf8');
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    expect(
      ANGLES_MORTS_SLOTS.filter((a) => !stock.includes(a)),
      'l’en-tête de `slotsStock.mjs` ne porte plus les angles morts de `ANGLES_MORTS_SLOTS` — la copie a divergé.',
    ).toEqual([]);
    expect(
      ANGLES_MORTS_SLOTS.filter((a) => !doc.includes(a)),
      'le §6.3 de `docs/structures-donnees.md` a divergé de `ANGLES_MORTS_SLOTS`.',
    ).toEqual([]);
    for (const porteur of [stock, doc])
      expect(porteur.includes(MANDAT_SLOTS), 'le MANDAT du volet a été reformulé quelque part au lieu d’être cité.').toBe(true);
  });

  it('la JOINTURE déclaré × observé est NON VIDE (sans elle, ce volet serait un no-op à faux vert)', () => {
    const joints = champsJoints(scan.formes, SLOTS);
    expect(
      joints,
      'aucun champ porteur de références OBSERVÉES n’est atteint par un slot DÉCLARÉ — la jointure (basename, projection path → champ) est cassée, et tout le volet rendrait vert sans rien mesurer.',
    ).toContain('merchants.json | curated');
    expect(SLOTS.length, 'aucun slot déclaré : la marche des schémas ne rend rien.').toBeGreaterThan(0);
  });

  it('PROJECTION path → champ : fonction PURE, cas `merchants.curated` committé', () => {
    expect(champDuPath('[].curated[]')).toBe('curated');
    expect(champDuPath('narratif.presetsPnj[].base')).toBe('base');
    expect(champDuPath('|0.of[].id')).toBe('id');
    expect(champDuPath('{}.id')).toBe('id');
    expect(champDuPath('[]'), 'un path sans segment-clé porte sur l’entrée elle-même.').toBe('(racine)');
    const curated = SLOTS.find((s) => s.dataset === 'merchants.json' && s.espece === 'id')!;
    expect(curated.path).toBe('[].curated[]');
    expect(champDuPath(curated.path)).toBe('curated');
    expect(
      scan.formes.some((f) => f.strate === 'Référence' && f.dataset === 'merchants.json' && f.champ === champDuPath(curated.path)),
      'le champ projeté ne rejoint aucune forme OBSERVÉE de `merchants.json` : la projection a divergé du champ que le scan mesure.',
    ).toBe(true);
  });

  it('RÉSOLUTION : toute valeur posée à un slot typé du registre résout, et le rouge est NOMINATIF', () => {
    const fautives: string[] = [];
    let posees = 0;
    for (const s of SLOTS) {
      if (s.espece !== 'id' || !estTypeDuRegistre(s.type)) continue;
      const ids = new Set(idsDuType(s.type));
      for (const v of valeursAuPath(DOCUMENTS.get(s.dataset), s.path)) {
        posees++;
        if (!ids.has(v.valeur)) fautives.push(`${s.dataset} › ${s.path}${v.chemin} = « ${v.valeur} » (type \`${s.type}\`)`);
      }
    }
    expect(
      posees,
      'AUCUNE valeur posée sous un slot typé : la résolution ne mesurerait rien (jointure vide, faux vert).',
    ).toBeGreaterThan(0);
    expect(
      fautives.sort(),
      'valeur(s) posée(s) à un slot DÉCLARÉ qui ne résolvent pas contre `_ids.generated` — une FK morte que le parse laisserait passer.',
    ).toEqual([]);
  });

  it('les slots NON résolubles ici sont au stock `SLOTS_INTERNES` : observé == stock, croissance = rouge', () => {
    const cle = (s: { dataset: string; path: string; type?: string }) => `${s.dataset} | ${s.path} | ${s.type ?? '—'}`;
    const internes = SLOTS.filter((s) => s.espece === 'id' && !estTypeDuRegistre(s.type));
    expect(
      internes.map(cle).sort(),
      'écart entre les slots d’espèce `id` visant un type INCONNU du registre et `SLOTS_INTERNES` — un slot en trop côté observé vise une entité interne à une scène que ce volet ne sait pas résoudre : il s’inscrit au stock (et se solde par `typedRef` en L2, #1473) ; un slot en trop côté stock est périmé.',
    ).toEqual(SLOTS_INTERNES.map(cle).sort());
    expect(SLOTS_INTERNES.length, 'le stock des slots INTERNES a GONFLÉ.').toBeLessThanOrEqual(0);
    expect(SLOTS_INTERNES.filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s.date))).toEqual([]);
    expect(
      GARDE.angleMort.some((a) => a.includes('`acteur`')),
      'l’espèce `acteur` sort de la résolution sans que l’angle mort le dise.',
    ).toBe(true);
    expect(SLOTS.filter((s) => s.espece === 'acteur').length, 'aucun slot `acteur` : l’angle mort porterait sur du vide.').toBeGreaterThan(0);
  });

  it('COUVERTURE : les champs porteurs de réfs OBSERVÉES sans slot déclaré == stock, et ne CROISSENT pas', () => {
    const ecarts = ecartsDeStock({ observe: champsSansSlot(scan.formes, SLOTS), stock: SLOTS_SANS_DECLARATION, cle: CLE_DETTE });
    expect(
      ecarts.neuves,
      'champ(s) en trop côté OBSERVÉ : une référence neuve qui n’a pas adopté la fabrique — elle s’adopte, elle ne s’inscrit pas au stock.',
    ).toEqual([]);
    expect(
      ecarts.perimees,
      'champ(s) en trop côté STOCK : entrée périmée — elle se retire dans le commit de l’adoption.',
    ).toEqual([]);
    expect(
      ecarts.taille,
      'clé(s) DUPLIQUÉE(S) au stock : la comparaison travaille sur des clés DISTINCTES, un doublon inscrit y passerait invisible.',
    ).toBe(SLOTS_SANS_DECLARATION.length);
  });

  it('chaque ligne du stock porte sa DATE et son LOT de mort', () => {
    expect(
      lignesMalQualifiees(SLOTS_SANS_DECLARATION.map((c) => [`${c.dataset} | ${c.champ}`, c])),
      'une ligne sans lot de mort ni date est un régime, pas un cliquet.',
    ).toEqual([]);
  });

  it('MUTATION par champ : chaque champ du stock entre dans la clé comparée', () => {
    expect(
      champsAveugles(SLOTS_SANS_DECLARATION, CLE_DETTE, ['dataset', 'champ', 'occurrences']),
      'champ(s) de stock HORS de la clé comparée : les muter laisse la garde verte.',
    ).toEqual([]);
  });

  it('le volet est ÉMIS dans `docs/structures-donnees.md` (le doc et la garde lisent la MÊME mesure)', () => {
    const doc = readFileSync(join(ROOT, 'docs/structures-donnees.md'), 'utf8');
    expect(doc, 'le §6 du doc a disparu : le volet SLOTS n’aurait plus de face lisible.').toContain(
      '## 6. Slots DÉCLARÉS × réfs OBSERVÉES',
    );
    expect(doc).toContain(`**${SLOTS_SANS_DECLARATION.length}** couples (dataset, champ) sans slot déclaré.`);
    expect(doc).toContain(`Slots déclarés : **${SLOTS.length}**`);
  });
});
