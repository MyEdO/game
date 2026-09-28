/**
 * CLIQUET AST DES ÉTAPES DE SÉQUENCE (#1279) — une étape de manche qui LANCE dit son ENJEU, et c'est
 * mesuré sur la FORME du programme, pas sur une baseline nominative. Jumeau structurel de
 * `cascade-step-stake-guard.test.ts` (qui scanne par expressions régulières tout `src/state`) : ici
 * le parcours est un ARBRE SYNTAXIQUE (API TypeScript), donc le scan voit la DÉCLARATION réelle —
 * un `stake` en dernière propriété, un raccourci, une propriété apportée par ÉPANDAGE ne le trompent
 * pas, et un littéral qui n'est pas le 1ᵉʳ argument d'un monteur ne l'excite pas.
 *
 * COUVERTURE, nommée (un détecteur ne mesure que sa couverture) : les fichiers de `src/state` qui
 * ENREGISTRENT une séquence (`registerSequence`) — c'est-à-dire les FAMILLES de manches jouées par le
 * socle (`sequenceCore`). Une famille NEUVE entre donc dans la garde le jour où elle s'enregistre,
 * sans qu'aucune liste ne soit tenue à la main.
 *
 * CE QUI LANCE : les monteurs qui produisent une ÉTAPE porteuse d'un jet (`bandStep`, `monoStep`,
 * `tableStep`, `tableStepDone`). Les autres monteurs de la famille (`choiceStep`, `quantityStep`,
 * `displayStep`) ne lancent rien — une décision, une saisie, un affichage n'ont pas d'enjeu à dire —
 * et les monteurs de RANGÉE (`rollStep`, `figurantRow`, `equipierRow`, `tavernRow`) sont des
 * CONTRIBUTEURS : l'enjeu est porté par l'ÉTAPE qui les réunit, jamais par la rangée. Cette partition
 * est mesurée plus bas, elle n'est pas supposée.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { join, sep } from 'node:path';
import { readCorpus, type CorpusFile } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../detenteur.testkit';

const SRC = join(process.cwd(), 'src');
const STATE = join(SRC, 'state');

/** Tous les monteurs de la famille — ceux qui LANCENT et ceux qui ne lancent pas. */
export const MONTEURS_LANCANTS = ['bandStep', 'monoStep', 'tableStep', 'tableStepDone'] as const;
export const MONTEURS_SANS_JET = ['choiceStep', 'quantityStep', 'displayStep'] as const;
export const MONTEURS_DE_RANGEE = ['rollStep', 'figurantRow', 'equipierRow', 'tavernRow'] as const;
const TOUS = [...MONTEURS_LANCANTS, ...MONTEURS_SANS_JET, ...MONTEURS_DE_RANGEE] as string[];

/** Les FAMILLES de séquence : les `.ts` de `src/state` (hors tests, corpus rendu par la primitive de
 *  marche `readCorpus`) qui enregistrent une définition auprès du socle. */
export function fichiersDeSequence(): CorpusFile[] {
  return readCorpus([STATE], { exts: ['.ts'] }).filter((f) => /\bregisterSequence\s*[<(]/.test(f.text));
}

const keyOf = (f: string) => f.slice(SRC.length + 1).split(sep).join('/');

export interface AppelDeMonteur {
  monteur: string;
  ligne: number;
  /** Le 1ᵉʳ argument est-il un LITTÉRAL d'objet (la déclaration lisible) ? */
  litteral: boolean;
  /** La propriété `stake` est-elle POSÉE au premier niveau de ce littéral ? */
  stake: boolean;
  /** Le littéral porte un ÉPANDAGE : ce qu'il apporte n'est pas lisible à cet endroit. */
  epandage: boolean;
}

/** Tous les appels de monteur d'un source, avec ce que leur déclaration DIT de leur enjeu. */
export function appelsDeMonteur(src: string, nom = 'sonde.ts'): AppelDeMonteur[] {
  const sf = ts.createSourceFile(nom, src, ts.ScriptTarget.Latest, true);
  const out: AppelDeMonteur[] = [];
  const visite = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && TOUS.includes(n.expression.text)) {
      const arg = n.arguments[0];
      const obj = arg && ts.isObjectLiteralExpression(arg) ? arg : undefined;
      const props = obj?.properties ?? [];
      out.push({
        monteur: n.expression.text,
        ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        litteral: !!obj,
        stake: props.some((p) => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
          && !!p.name && ts.isIdentifier(p.name) && p.name.text === 'stake'),
        epandage: props.some((p) => ts.isSpreadAssignment(p)),
      });
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return out;
}

describe('cliquet AST — une étape de SÉQUENCE qui lance dit son enjeu (#1279)', () => {
  const mesure = detenteur(() =>
    fichiersDeSequence().map(({ abs, text }) => ({ f: abs, appels: appelsDeMonteur(text, abs) })),
  );

  it('la COUVERTURE est peuplée : les familles de séquence sont bien vues', () => {
    expect(mesure().length, 'aucun fichier n’enregistre de séquence — le scan mesurerait le vide').toBeGreaterThan(0);
    expect(mesure().some((m) => m.appels.length > 0), 'aucun monteur trouvé : l’AST ne voit rien').toBe(true);
  });

  it('AUCUNE étape lançante sans enjeu — par la FORME, sans baseline', () => {
    const muettes: string[] = [];
    for (const { f, appels } of mesure()) {
      for (const a of appels) {
        if (!MONTEURS_LANCANTS.includes(a.monteur as typeof MONTEURS_LANCANTS[number])) continue;
        if (!a.litteral) continue; // déclaration indirecte : mesurée par le test suivant
        if (!a.stake) muettes.push(`${keyOf(f)}:${a.ligne} — ${a.monteur}`);
      }
    }
    expect(muettes, ['Étape de séquence qui LANCE sans `stake` (le joueur doit savoir ce que la manche met en jeu) :', ...muettes].join('\n')).toEqual([]);
  });

  /** Un monteur lançant appelé avec un `spec` construit AILLEURS échapperait à la lecture de sa
   *  déclaration : le scan ne peut pas dire ce qu'il porte. `monoStep`/`tableStep` sont tenus par le
   *  TYPE (`stake` requis), `bandStep` NON — une bande déclarée indirectement serait donc l'angle
   *  mort. La garde exige que cette forme n'existe pas. */
  it('aucune étape lançante déclarée INDIRECTEMENT (le scan lit des déclarations)', () => {
    const indirectes: string[] = [];
    for (const { f, appels } of mesure()) {
      for (const a of appels) {
        if (!MONTEURS_LANCANTS.includes(a.monteur as typeof MONTEURS_LANCANTS[number])) continue;
        if (!a.litteral) indirectes.push(`${keyOf(f)}:${a.ligne} — ${a.monteur}`);
      }
    }
    expect(indirectes, ['Étape lançante montée depuis un `spec` construit ailleurs — sa déclaration ne se lit pas :', ...indirectes].join('\n')).toEqual([]);
  });

  /** PARTITION mesurée : ce que la garde exige et ce qu'elle n'exige PAS. Les monteurs sans jet et les
   *  monteurs de rangée existent bel et bien dans les familles — sans quoi « ils sont exemptés » ne
   *  vaudrait rien (une exemption qui ne porte sur aucun site est une phrase, pas une règle). */
  it('PARTITION : les familles montent AUSSI des étapes sans jet et des rangées — exemptées, et vues', () => {
    const par = new Map<string, number>();
    for (const { appels } of mesure()) for (const a of appels) par.set(a.monteur, (par.get(a.monteur) ?? 0) + 1);
    const lancantes = MONTEURS_LANCANTS.reduce((n, m) => n + (par.get(m) ?? 0), 0);
    const rangees = MONTEURS_DE_RANGEE.reduce((n, m) => n + (par.get(m) ?? 0), 0);
    const sansJet = MONTEURS_SANS_JET.reduce((n, m) => n + (par.get(m) ?? 0), 0);
    expect(lancantes, 'aucune étape lançante mesurée : le cliquet ne mordrait rien').toBeGreaterThan(0);
    expect(rangees, 'aucune rangée mesurée : l’exemption des contributeurs ne porterait sur rien').toBeGreaterThan(0);
    expect(sansJet, 'aucune étape sans jet mesurée : idem').toBeGreaterThan(0);
  });

  it('FAIL-CLOSED : une bande synthétique sans enjeu est VUE muette, avec enjeu elle ne l’est pas', () => {
    const sans = `const b = bandStep({ id: 'x', kind: 'k', icon: 'nav/dice', label: 'L', meta: { round: 1 } }, rows);`;
    const avec = `const b = bandStep({ id: 'x', kind: 'k', icon: 'nav/dice', label: 'L', stake: combatStakeRef('tavernGame'), meta: { round: 1 } }, rows);`;
    const raccourci = `const b = bandStep({ id: 'x', kind: 'k', stake }, rows);`;
    const dernier = `const b = bandStep({ id: 'x', kind: 'k', label: 'L', stake: voyageStakeRef('k') }, rows);`;
    expect(appelsDeMonteur(sans)[0]).toMatchObject({ monteur: 'bandStep', litteral: true, stake: false });
    expect(appelsDeMonteur(avec)[0].stake).toBe(true);
    expect(appelsDeMonteur(raccourci)[0].stake, 'le RACCOURCI `stake` est un enjeu posé').toBe(true);
    expect(appelsDeMonteur(dernier)[0].stake, 'en DERNIÈRE propriété aussi').toBe(true);
  });

  it('FAIL-CLOSED : un `stake` ENFOUI dans un sous-objet ne compte pas pour l’étape', () => {
    const enfoui = `const b = bandStep({ id: 'x', kind: 'k', meta: { stake: 'triché' } }, rows);`;
    expect(appelsDeMonteur(enfoui)[0].stake, 'seul le PREMIER niveau de la déclaration compte').toBe(false);
  });

  it('FAIL-CLOSED : une déclaration INDIRECTE est vue comme telle, et l’épandage est signalé', () => {
    const indirect = `const b = bandStep(spec, rows);`;
    const epandu = `const b = bandStep({ ...commun, id: 'x', kind: 'k' }, rows);`;
    expect(appelsDeMonteur(indirect)[0]).toMatchObject({ litteral: false, stake: false });
    expect(appelsDeMonteur(epandu)[0]).toMatchObject({ litteral: true, stake: false, epandage: true });
  });

  it('FAIL-CLOSED : un appel HOMONYME hors monteur n’excite pas le scan, et les rangées ne sont pas exigées', () => {
    const rangee = `const r = figurantRow(id, label, valeur, { skill: 'esquive' }, 0);`;
    const autre = `const x = autreFonction({ id: 'x', kind: 'k' });`;
    expect(appelsDeMonteur(rangee)[0].monteur, 'la rangée est VUE (partition), pas exigée').toBe('figurantRow');
    expect(appelsDeMonteur(autre), 'une fonction hors famille n’est pas un monteur').toHaveLength(0);
  });
});
