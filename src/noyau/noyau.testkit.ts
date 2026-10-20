/**
 * Le RÉGIME DES TABLES d'un test (#2889, D10) : « un régime se POSE par le seam sur une fixture, puis
 * se restaure » (`.claude/rules/tests.md`). Le seam est celui de la production, `brancherLeJeu`.
 */
import { onTestFinished } from 'vitest';
import { brancherLeJeu, debrancherLeJeu, jeuBranche } from './branchement';
import { tablesDuJeu } from './tablesDuJeu';
import { tablesPosees, type TablesDuJeu } from './tablesPosees';
import type { SequenceDef } from './sequenceContract';

/** Une fixture de tables : une table nommée REMPLACE celle du jeu. Sa table de séquences est OUVERTE
 *  (le socle lit une définition par id, `sequenceDefOf`) : une famille synthétique s'y pose par
 *  `sequenceDeFixture`, sans augmenter `SequenceFamilies`. */
export type FixtureDeTables = Partial<Omit<TablesDuJeu, 'sequences'>> & {
  readonly sequences?: Readonly<Record<string, SequenceDef<never> | TablesDuJeu['sequences'][keyof TablesDuJeu['sequences']]>>;
};

/** Une définition de séquence de fixture, typée sur sa charge utile `P`, rangée dans la table ouverte. */
export function sequenceDeFixture<P>(def: SequenceDef<P>): SequenceDef<never> {
  return def as unknown as SequenceDef<never>;
}

/** Une clé de test HORS des listes de clés de code — posée par la fixture (`avecLesTables`), ou sans
 *  entrée (étape de sonde sans conséquence) : un producteur de production est typé par ces listes
 *  (`GenreDEtape`…), un test le nourrit par cette porte. `K` nomme l'union visée quand le site la
 *  laisse inférer (constante, littéral converti). */
export function cleDeFixture<K extends string = never>(cle: string): K {
  return cle as K;
}

/**
 * Pose `fixture` pour le test COURANT (appelé dans le test ou son `beforeEach`, jamais hors d'un test) : débranche le jeu, le
 * rebranche sur le même `get`/`set` avec les tables du jeu dont `fixture` REMPLACE les tables qu'elle
 * nomme, et restaure les tables du jeu à la fin du test. Une fixture qui a besoin d'une entrée réelle
 * l'étale dans un objet neuf (`{ ...tablesDuJeu().appliers, deja: … }`), sans muter la table du jeu.
 * Une seule pose par test : une seconde LÈVE, la première serait perdue en silence.
 */
export function avecLesTables(fixture: FixtureDeTables): void {
  const jeu = jeuBranche();
  if (!jeu) throw new Error('avecLesTables : aucun jeu branché (le store le branche à sa création)');
  if (tablesPosees() !== tablesDuJeu()) throw new Error('avecLesTables : une fixture est déjà posée pour ce test');
  // La restauration s'enregistre AVANT la pose : hors d'un test (`beforeAll`, corps de `describe`),
  // `onTestFinished` lève et rien n'est posé.
  onTestFinished(() => {
    debrancherLeJeu();
    brancherLeJeu(jeu.get, jeu.set, tablesDuJeu());
  });
  debrancherLeJeu();
  brancherLeJeu(jeu.get, jeu.set, { ...tablesDuJeu(), ...fixture } as TablesDuJeu);
}
