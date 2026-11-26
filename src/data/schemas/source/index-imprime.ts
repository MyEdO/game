// INDEX IMPRIMÉ d'un livre de `Source/` (« Index » : `121 - Index.md` du CRB), lu en ENTRÉES
// `{ terme, qualificatif?, pages, ligne, fin }` (#1887, lot 7). Une entrée et l'une de ses pages forment
// un renvoi (`renvoi.ts`, `Renvoi`) que `resoudreRenvoi` résout comme un « see page N » du texte.
//
// Module PUR : le texte arrive lu, le livre par sa `language` (`src/data/books.json`).
//
// FORME : une table markdown à colonnes TRIÉES, lue colonne par colonne. Une cellule d'une seule
// capitale est un en-tête de lettre ; une cellule sans numéro final est un terme REPLIÉ, complété
// par la cellule suivante de la même colonne, d'une ligne à l'autre comme d'une table à l'autre.
// Une cellule vide ne porte rien. Un terme replié qui ne trouve jamais sa page est une ERREUR.
import { cellulesDe, estSeparateur, stripSpans } from './decoupe.ts';

/** Formes d'un index imprimé dans une LANGUE : mesurées sur le corpus, jamais écrites par livre. */
export interface MotifsDIndexImprime {
  /** Séparateurs d'une LISTE de pages après le terme. */
  separateursDePages: string[];
  /** Ce que vérifie le contenu de la parenthèse finale d'un QUALIFICATIF (`(Talent)`) ; une
   *  parenthèse finale qui ne le vérifie pas est un COMPLÉMENT du terme (`(as Characters)`). */
  qualificatif: RegExp;
  /** Qualificatifs imprimés SANS parenthèses en fin de terme (`Art Skill`), lus quand aucune
   *  parenthèse finale ne qualifie. */
  qualificatifsNus: string[];
}

/**
 * Motifs par LANGUE (`books.json#language`). VO : `121 - Index.md` du CRB, seul index imprimé des
 * livres autorisés (mesure du 2026-10-01) — parenthèses finales en minuscule (`Dwarfs (as Characters) 28`,
 * `Armour Repels the Winds (of Magic) 237`), `Skill` nu (`Art Skill 111`), aucune plage de pages.
 */
export const MOTIFS_D_INDEX_IMPRIME: Readonly<Partial<Record<string, MotifsDIndexImprime>>> = {
  VO: {
    separateursDePages: [','],
    qualificatif: /^\p{Lu}/u,
    qualificatifsNus: ['Skill'],
  },
};

/** Motifs d'une langue ; une langue sans motifs est une ERREUR, jamais un index muet. */
function motifsDe(langue: string): MotifsDIndexImprime {
  const m = MOTIFS_D_INDEX_IMPRIME[langue];
  if (!m) throw new Error(`index imprimé : aucun motif d'index pour la langue « ${langue} »`);
  return m;
}

/** Une entrée de l'index : son terme, son qualificatif imprimé, ses pages, la ligne (1-based) où elle
 *  s'ouvre et celle où elle se ferme (différente pour un terme replié). */
export interface EntreeDIndexImprime {
  terme: string;
  qualificatif?: string;
  pages: number[];
  ligne: number;
  fin: number;
}

const echapper = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** En-tête de lettre : une cellule d'UNE capitale. */
const LETTRE = /^\p{Lu}$/u;

/** Entrées d'un index imprimé, dans l'ordre de lecture (ligne, puis colonne). */
export function lireIndexImprime(md: string, langue: string): EntreeDIndexImprime[] {
  const m = motifsDe(langue);
  const sep = m.separateursDePages.map(echapper).join('|');
  const motifEntree = new RegExp(`^(.*?)\\s*(\\d+(?:\\s*(?:${sep})\\s*\\d+)*)$`, 'u');
  const motifPages = new RegExp(`\\s*(?:${sep})\\s*`, 'u');
  const replis = new Map<number, { texte: string; ligne: number }>();
  const out: EntreeDIndexImprime[] = [];
  md.split(/\r?\n/).forEach((brute, i) => {
    const l = stripSpans(brute);
    if (!/^\s*\|/.test(l) || estSeparateur(l)) return;
    cellulesDe(l).forEach((cellule, col) => {
      if (!cellule || LETTRE.test(cellule)) return;
      const ouvert = replis.get(col);
      const texte = ouvert ? `${ouvert.texte} ${cellule}` : cellule;
      const ligne = ouvert?.ligne ?? i + 1;
      const e = motifEntree.exec(texte);
      if (!e) { replis.set(col, { texte, ligne }); return; }
      replis.delete(col);
      const corps = e[1].trim();
      if (!corps) throw new Error(`index imprimé l.${i + 1} : une page sans terme (« ${texte} »)`);
      const pages = e[2].split(motifPages).map(Number);
      const q = /\s*\(([^()]*)\)$/.exec(corps);
      const qualifie = q != null && m.qualificatif.test(q[1]) && corps.slice(0, q.index).trim() !== '';
      const nu = qualifie ? null : m.qualificatifsNus.find((x) => corps.endsWith(` ${x}`) && corps.length > x.length + 1);
      const [terme, qualificatif] = qualifie
        ? [corps.slice(0, q.index).trim(), q[1]]
        : nu ? [corps.slice(0, -nu.length - 1).trim(), nu] : [corps, null];
      out.push({
        terme,
        ...(qualificatif == null ? {} : { qualificatif }),
        pages,
        ligne,
        fin: i + 1,
      });
    });
  });
  const orphelins = [...replis.values()].map((r) => `l.${r.ligne} « ${r.texte} »`);
  if (orphelins.length) throw new Error(`index imprimé : terme(s) replié(s) sans page — ${orphelins.join(' ; ')}`);
  return out;
}
