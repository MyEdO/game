/**
 * CONTRAT DE DONNÉE #1650 — le niveau IMPRIMÉ d'un Talent de statbloc, porté par `times`.
 *
 * Le ticket : « le statbloc committé = le statbloc imprimé (chaque talent/spec/times cité à la
 * ligne) ». La FORME est déclarée à `src/data/index.ts:3079-3081` — « Référence STRUCTURÉE à un
 * Talent (`Ref` + niveau `times` ≥2) » : le niveau 1 s'écrit par l'ABSENCE de la clé, et
 * `talentRefLabel` ne suffixe qu'à partir de 2.
 *
 * Deux familles, mesurées par la MÊME fonction pure, gardées différemment :
 *  • FORME — `times` entier ≥2, clés `id`, `spec?`, `times?` dans cet ordre. Rien ne déroge : c'est
 *    la graphie que `TalentRef extends Ref` compose. Contrat à ZÉRO.
 *  • PLAFOND — `TalentData.max` (`LDB 10`, ligne « Maxi ») borne les ACQUISITIONS d'un personnage
 *    qui monte. Un statbloc PUBLIÉ, lui, imprime son nombre : la règle 1 (« aucune invention de
 *    règles ») fait primer le folio sur le plafond, et le dépassement se STOCKE nominativement avec
 *    sa citation — il ne se corrige pas dans la donnée, et il ne se tait pas non plus.
 *
 * Aucun cardinal vivant : un compte de `times` monte à chaque statbloc recopié — il diagnostique,
 * il ne garde rien. La mesure est montée deux fois : sur l'arbre, et sur une fixture forgée qui
 * porte trois dérives (patron « le détecteur MORD », `structures-contrat.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { creatures, talents } from './index';

/** Référence de Talent telle qu'elle est ÉCRITE dans `creatures.json` (ordre des clés compris). */
interface ReferenceLue {
  id: string;
  spec?: string;
  times?: number;
}

/** Porteur d'un statbloc : son profil imprimé (`char`) borne les `times` par bonus de caractéristique. */
interface PorteurLu {
  id: string;
  char: Record<string, number | null>;
  talents: readonly ReferenceLue[];
}

/** Ce que le registre des Talents dit du plafond d'acquisitions d'un Talent. */
interface PlafondLu {
  max: number | { bonusOf: string } | null;
}

/** Les deux familles de violation : la FORME ne déroge jamais, le PLAFOND se stocke à sa citation. */
interface Violations {
  forme: string[];
  plafond: string[];
}

/** Les trois clés de la forme canonique, dans leur ordre de composition. */
const ORDRE_CANONIQUE = ['id', 'spec', 'times'] as const;

/** Nom d'une référence dans un message de violation : `<talentId>` ou `<talentId>/<spec>`. */
const nommeRef = (ref: ReferenceLue): string => (ref.spec ? `${ref.id}/${ref.spec}` : ref.id);

/**
 * Plafond EFFECTIF d'un Talent pour un porteur donné, ou `null` quand rien ne le borne :
 * `max: null` (sans limite, ex. Magnum Opus), ou une caractéristique que le profil ne chiffre pas.
 * Le Bonus d'une caractéristique est sa dizaine (`LDB 04`).
 */
function plafondEffectif(def: PlafondLu, char: Record<string, number | null>): number | null {
  if (def.max == null) return null;
  if (typeof def.max === 'number') return def.max;
  const score = char[def.max.bonusOf];
  return typeof score === 'number' ? Math.floor(score / 10) : null;
}

/**
 * MESURE PURE — rend une violation NOMMÉE par référence fautive, rangée dans sa famille. Aucun état,
 * aucune lecture de disque : l'arbre et la fixture y entrent par la même porte.
 */
export function violationsDeTimes(
  porteurs: readonly PorteurLu[],
  plafonds: ReadonlyMap<string, PlafondLu>,
): Violations {
  const violations: Violations = { forme: [], plafond: [] };
  for (const porteur of porteurs) {
    for (const ref of porteur.talents) {
      const site = `${porteur.id} › ${nommeRef(ref)}`;
      const attendu = ORDRE_CANONIQUE.filter((cle) => ref[cle] !== undefined);
      const lu = Object.keys(ref);
      if (lu.join(',') !== attendu.join(',')) {
        violations.forme.push(`${site} clés [${lu.join(', ')}] — l’ordre canonique est [${attendu.join(', ')}]`);
      }
      if (ref.times === undefined) continue;
      if (!Number.isInteger(ref.times) || ref.times < 2) {
        violations.forme.push(`${site} times ${ref.times} — un niveau 1 s’écrit par l’ABSENCE de la clé, un niveau ≥2 par un entier`);
      }
      const def = plafonds.get(ref.id);
      if (!def) {
        violations.forme.push(`${site} times ${ref.times} — Talent hors registre : son plafond est invérifiable`);
        continue;
      }
      const plafond = plafondEffectif(def, porteur.char);
      if (plafond !== null && ref.times > plafond) {
        violations.plafond.push(`${site} times ${ref.times} > max ${plafond}`);
      }
    }
  }
  return violations;
}

/**
 * DÉROGATIONS IMPRIMÉES, nominatives et citées — des statblocs PUBLIÉS dont le niveau dépasse le
 * « Maxi » du Talent. La donnée est FIDÈLE (règle 1) ; c'est la source qui déroge à son propre
 * plafond, et le jeu doit servir ce qui est imprimé.
 *  • Long Drong Silver, `MDG 16 l.403` : « … Maîtrise du combat 3 … » — Ag 29 (Bonus 2), alors que
 *    `LDB 10 l.763` donne « **Maxi :** Bonus d'Agilité ».
 *  • Vrisk Gratte-le-Fer, `MDG 16 l.497` : « … Chanceux 13 … » — Soc 30 (Bonus 3), alors que
 *    `LDB 10 l.158` donne « **Maxi :** Bonus de Sociabilité ». Le folio le CONFIRME en propre à
 *    `MDG 16 l.502` : « son Talent Chanceux 13 devient Chanceux 3 » — 13 est le niveau nourri à la
 *    malepierre, 3 le niveau nu ; le nombre est voulu, pas une coquille d'import.
 * Une entrée NEUVE ici se gagne par la citation de son folio ; une entrée périmée rougit aussi.
 */
const DEROGATIONS_IMPRIMEES = [
  'long-drong-silver › maitrise-du-combat times 3 > max 2',
  'vrisk-gratte-le-fer › chanceux times 13 > max 3',
];

const PLAFONDS: ReadonlyMap<string, PlafondLu> = new Map(talents.map((t) => [t.id, { max: t.max }]));
const PORTEURS: readonly PorteurLu[] = creatures as readonly PorteurLu[];

describe('niveau IMPRIMÉ d’un Talent de statbloc — `times` (#1650)', () => {
  it('FORME : `times` entier ≥2, clés `id, spec?, times?` — aucune dérogation', () => {
    expect(
      violationsDeTimes(PORTEURS, PLAFONDS).forme,
      'réf(s) de Talent hors forme — le niveau 1 s’écrit par l’ABSENCE de `times`, et les clés se composent dans l’ordre de `TalentRef extends Ref`.',
    ).toEqual([]);
  });

  it('PLAFOND : tout dépassement du « Maxi » d’un Talent est une dérogation IMPRIMÉE, nommée et citée', () => {
    expect(
      violationsDeTimes(PORTEURS, PLAFONDS).plafond,
      'dépassement(s) de plafond hors stock — un niveau au-dessus du « Maxi » (`LDB 10`) ne s’écrit que si un folio l’imprime : cite-le dans `DEROGATIONS_IMPRIMEES`, ou corrige le statbloc.',
    ).toEqual(DEROGATIONS_IMPRIMEES);
  });

  /**
   * Contrôle POSITIF : sans lui, un détecteur qui ne mesure rien rendrait le même vert. La fixture
   * est forgée EN MÉMOIRE (aucune copie de l'arbre) et porte les trois dérives, une par règle.
   */
  it('le détecteur MORD — trois dérives forgées rendent trois violations nominatives', () => {
    const fixture: PorteurLu[] = [{
      id: 'cobaye-forge',
      char: { dexterite: 40 },
      talents: [
        { id: 'bricoleur', times: 1 },
        { id: 'bricoleur', times: 7 },
        { times: 2, id: 'bricoleur' } as ReferenceLue,
      ],
    }];
    expect(violationsDeTimes(fixture, new Map([['bricoleur', { max: { bonusOf: 'dexterite' } }]]))).toEqual({
      forme: [
        'cobaye-forge › bricoleur times 1 — un niveau 1 s’écrit par l’ABSENCE de la clé, un niveau ≥2 par un entier',
        'cobaye-forge › bricoleur clés [times, id] — l’ordre canonique est [id, times]',
      ],
      plafond: ['cobaye-forge › bricoleur times 7 > max 4'],
    });
  });
});
