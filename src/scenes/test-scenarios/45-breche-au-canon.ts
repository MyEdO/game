import { groupeDeScenario } from './_heros';
import { buildScene, type MapSpec } from '../../noyau/mapSpec';
import { crewFormationSlots } from '../../noyau/monde/shipPostes';
import type { AuthoredEnemy } from '../../noyau/monde/encounterAuthoring';
import { findSiegeEngineById, qualityInstance } from '../../data';
import { crewedTeamIndice } from '../../engine/qualities/dispatch';
import { projForPiece, type TestScenario } from './_shared';

/**
 * BRÈCHE AU CANON — une BATTERIE assaillante abat une porte de ville. Carte courte (14×18, 2 couches), authorée
 * comme `siege-enceinte` (`buildScene` + recette `cells`) :
 *  - au NORD, la batterie : des CANONS servis chacun par une ÉQUIPE COMPLÈTE (AA 10 l.236-241), le chef de pièce
 *    en `crewIds[0]`, les servants en FORMATION autour de l'affût (`crewFormationSlots`), tous qualifiés
 *    (`projForPiece`, AA 10 l.230) ; l'IA cible la structure (rencontre `siege`) ;
 *  - quatre fantassins sur les flancs, prêts à passer la brèche ;
 *  - l'ENCEINTE, bande `#` de 2 cases d'épaisseur (rangées 9-10) percée d'UNE case de porte `D` (x7) : une seule
 *    arête `porte-de-ville` (bouche N, côté champ), chemin de ronde auto sur z1 ; aucune rampe (le groupe ne monte pas) ;
 *  - au SUD, la cour pavée où démarre le groupe, derrière la porte.
 * Règle optionnelle pré-activée : `combat-aa-blessures: 'aa'` (AA 10 l.113-114, AA 10 l.127).
 *
 * Valeurs d'adaptation du scénario (leviers de la démonstration, aucune règle) : TROIS `canon-grand` (Équipe 4
 * chacun) tirant leur salve chargée au Round 1, affûts à 4-5 cases (8-10 m) de la porte, dans la bande Bout
 * portant de la pièce ; servants `wolfgard-hohmann` à Projectiles 40 ; fantassins `humain`.
 */
const PIECE = 'canon-grand';
const ENC = 'batterie';
const AFFUTS = [{ x: 1, y: 4 }, { x: 6, y: 4 }, { x: 11, y: 4 }];
const FANTASSINS = [{ x: 0, y: 8 }, { x: 1, y: 8 }, { x: 12, y: 8 }, { x: 13, y: 8 }];

/** Chaque pièce et son équipe complète : l'affût (index `i0`) puis autant de servants que l'Indice d'`arme-d-equipe`
 *  de la pièce (`i0+1…`), en formation autour de l'empreinte, orientés vers la porte (S). Ids déterministes
 *  `enemy-<rencontre>-<index>`. */
function batterie(): AuthoredEnemy[] {
  const fiche = findSiegeEngineById(PIECE)!;
  const equipe = crewedTeamIndice({ qualities: fiche.qualities.map(qualityInstance) });
  return AFFUTS.flatMap((pos, n) => {
    const i0 = n * (equipe + 1);
    const crewIds = Array.from({ length: equipe }, (_, k) => `enemy-${ENC}-${i0 + 1 + k}`);
    const slots = crewFormationSlots({ pos, footprint: 2 }, { crewIds }, { heading: 'S' });
    const affut: AuthoredEnemy = { engin: { id: PIECE }, pos, facing: 'S', postes: [{ trappingId: PIECE, crewIds }] };
    const servants: AuthoredEnemy[] = crewIds.map((_, k) => ({
      creature: { id: 'wolfgard-hohmann' }, pos: slots[k], facing: 'S', label: k === 0 ? 'Chef de pièce' : 'Servant de canon',
      skills: projForPiece(PIECE),
    }));
    return [affut, ...servants];
  });
}

export function spec(): MapSpec {
  return {
    id: 'breche-au-canon',
    label: 'Brèche au canon',
    desc: "Une batterie de canons, à courte portée d'une porte de ville, la pilonne ; des fantassins attendent la brèche. Le groupe tient la cour derrière la porte.",
    size: [14, 18],
    metresPerTile: 2,
    ambiance: 'exterieur',
    ambientLight: 'jour',
    startMessage: { texte: "La batterie ennemie tire à bout portant sur la porte de ville. Tenez la cour : une fois la porte abattue, les fantassins passent par la brèche." },
    legend: { P: 'pave' },
    markerFill: { '@': 'P' },
    cells: {
      '#': { terrain: 'pierre', wall: { structure: 'mur-en-pierre', facing: 'N' } },
      D: { terrain: 'pierre', gate: { structure: 'porte-de-ville', facing: 'N' } },
    },
    levels: {
      z0: [
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '..............',
        '#######D######',
        '#######D######',
        'PPPPPPPPPPPPPP',
        'PPPPPPPPPPPPPP',
        'PPPPPPPP@PPPPP',
        'PPPPPPPPPPPPPP',
        'PPPPPPPPPPPPPP',
        'PPPPPPPPPPPPPP',
        'PPPPPPPPPPPPPP',
      ].join('\n'),
      z1: Array.from({ length: 18 }, () => '..............').join('\n'),
    },
    bind: { '@': 'heroStart' },
    encounters: [
      {
        id: ENC,
        siege: true,
        enemies: [
          ...batterie(),
          ...FANTASSINS.map((pos): AuthoredEnemy => ({ creature: { id: 'humain' }, pos, facing: 'S', label: 'Fantassin' })),
        ],
      },
    ],
  };
}

export const scenario: TestScenario = {
  id: 'breche-au-canon',
  order: 45,
  category: 'combat',
  icon: 'scenario/siege',
  title: 'Brèche au canon',
  tests:
    "Brèche d'une porte de ville par une batterie menée par l'IA : trois canons à équipes complètes et qualifiées " +
    "(postes `crewIds`, servants en formation), à bout portant d'une porte à une seule arête (recette `cells`) ; " +
    "rencontre `siege` (l'IA cible la structure), `combat-aa-blessures: 'aa'` ; la porte passe en brèche en " +
    "3 Rounds au plus, les fantassins passent le tunnel.",
  partyNote: 'Groupe pré-tiré (Soldat / Chasseur / Sorcier / Tueur) dans la cour, derrière la porte.',
  construire: (idNeuf) => ({ party: groupeDeScenario(idNeuf, 'soldat', 'chasseur', 'sorcier', 'tueur'), scene: buildScene(spec()) }),
  autoCombat: ENC,
  rules: { 'combat-aa-blessures': 'aa' },
};
