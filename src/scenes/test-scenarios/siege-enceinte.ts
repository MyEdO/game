import { pregenParty, PREGEN } from '../../data/pregens';
import { findTrappingById, type SkillRef } from '../../data';
import type { SceneEntity } from '../../state/scene';
import { buildScene, type MapSpec } from '../../state/mapSpec';
import type { TestScenario } from './_shared';

/**
 * SIÈGE COMPLET — défendre l'enceinte, entièrement DÉCLARÉ en UN `MapSpec` (plus aucune plomberie bespoke :
 * `buildScene` rejoue les primitives de l'éditeur). Carte PROFONDE (30×46, 2 couches) à l'échelle d'un vrai siège :
 *  - au NORD, le CAMP assaillant (tentes, braséros, bannières) et sa BATTERIE braquée sur la PORTE : une
 *    CATAPULTE pilonne de TRÈS LOIN en tir indirect (~71 m), un CANON de siège AVANCÉ tire en direct (~46 m) —
 *    l'IA cible la structure (Atout Siège), le canon BRÈCHE la porte tout seul ;
 *  - des FANTASSINS qui traversent le glacis, FRANCHISSENT la RIVIÈRE par le PONT (seul passage) et s'amassent
 *    à la porte tant qu'elle tient ;
 *  - l'ENCEINTE = une VRAIE MASSE de maçonnerie PLEINE, authorée par la RECETTE `cells` (une LETTRE = la case
 *    complète). La bande de mur de 2 cases d'épaisseur (rangées y37-y38) est `#` (mur plein) ; la PORTE `D`
 *    (cols 14-15). Chaque `#`/`D` AUTO-POSE une ZONE REMPART sur la couche z1 (bloc solide à 4 m + chemin de
 *    ronde marchable + crénelure) → le z0 sous la bande devient IMPASSABLE (on ne traverse PLUS la « jupe » :
 *    le mur EST des cases pleines, le chemin de ronde est SON TOIT). La PORTE laisse le z0 en TUNNEL passable
 *    et pose sa HERSE `porte-de-ville` sur la BOUCHE extérieure (arête N, côté champ) ; intacte elle bloque le
 *    passage, abattue → BRÈCHE. Le chemin de ronde passe au-dessus du tunnel (gatehouse continu).
 *  - le CHEMIN DE RONDE (couche z1, 4 m) est garni de PIÈCES servies (baliste/canon) et d'ARCHERS PNJ alliés-IA ;
 *    on le rejoint par UNE RAMPE au FLANC GAUCHE (cols 3-4, montant ≤1 m/case — le moteur en fait une pente,
 *    plus aucun escalier), DÉPORTÉE de la porte pour dégager la cour DERRIÈRE la porte (zone de mort) ;
 *  - au SUD, une COUR pavée MODESTE où démarre le groupe.
 * Combat VERTICAL : les défenseurs (couche z1, 4 m) pilonnent en contrebas et la mêlée est refusée à travers le
 * vide (`combatDistance` ajoute la séparation métrique) ; la crénelure (rendu, PAS un WallSeg) ne coupe pas la
 * LdV plongeante.
 *
 * TOUT est dans le `MapSpec` ci-dessous (grilles ASCII des 2 étages, recette `cells`, relief de rampe, binds de
 * marqueurs, entités à ids FIXES, rencontre). Les seules parts de code restantes = le `projForPiece` (Projectiles
 * dérivée de la pièce) et le `makeParty` (le SOLDAT reçoit les Spé de service). AUCUN push/setEncounters résiduel.
 */

// Compétence Projectiles APPROPRIÉE au Groupe de l'engin (AA 10 l.230) : un servant ne compte dans l'équipe
// QUE s'il la possède (sinon « n'est pas considéré comme un membre de l'équipe », AA 10 l.253). Dérivée de la pièce
// (`weaponGroup` du trapping) → la Spé = id du Groupe (arbalete/poudre-noire/catapulte). Test ~40.
const projForPiece = (trappingId: string): SkillRef[] => {
  const g = findTrappingById(trappingId)?.weaponGroup;
  return g ? [{ id: 'projectiles', spec: g, value: 40 }] : [];
};

// Servant de pièce (entité à id FIXE, référencé par le `crew` de l'emplacement) : une VRAIE créature du
// bestiaire (a une CT pour viser), SANS arme propre → sa seule arme à distance est la PIÈCE servie (l'IA tire
// donc la baliste/le canon, pas un arc). Posté à CÔTÉ de l'affût (x-1). On lui DONNE la Projectiles du Groupe de
// SA pièce → il compte comme membre d'équipe qualifié (sinon effectif 0). `ref` garde-du-village (défenseur) /
// brigand (assaillant).
const gunner = (
  id: string,
  pos: { x: number; y: number },
  trappingId: string,
  label: string,
  opts: { z?: number; facing?: SceneEntity['facing']; ref?: string } = {},
): SceneEntity => ({
  id,
  kind: 'personnage',
  pos,
  label,
  ref: opts.ref ?? 'garde-du-village',
  ...(opts.z ? { z: opts.z } : {}),
  ...(opts.facing ? { facing: opts.facing } : {}),
  combat: { skills: projForPiece(trappingId) },
});

export const spec: MapSpec = {
  id: 'siege-enceinte',
  label: 'Siège — défendre la muraille',
  desc:
    "Un siège à grande échelle : au nord, le camp assaillant et sa batterie (canon + catapulte) qui pilonne la " +
    "porte de très loin ; des fantassins franchissent la rivière par le pont et s'amassent à la porte ; au sud, " +
    "l'enceinte de maçonnerie pleine à porte brèchable, son chemin de ronde (le TOIT du mur, à 4 m) garni de " +
    "pièces et d'archers, rejoint par une rampe au flanc gauche, et une cour pavée.",
  size: [30, 46],
  metresPerTile: 2, // person-scale (LDB) : 1 case = 2 m → bandes de portée (canon 50 m / catapulte 75 m)
  ambiance: 'exterieur',
  ambientLight: 'jour', // plein jour : on voit l'assaut approcher sur tout le glacis
  startMessage:
    "Défendez l'enceinte. Gagnez le CHEMIN DE RONDE (le dessus du mur) par la RAMPE du flanc gauche, SERVEZ une " +
    "pièce et pilonnez l'assaut en contrebas. La batterie ennemie brèche la porte de très loin ; les assaillants " +
    "ne peuvent forcer le passage — le tunnel de la porte — qu'une fois la herse abattue.",

  // ── Légende partagée (base z0='herbe', z1='vide'). '~'=rivière, '='=pont, 'P'=pavé de cour, '4/3/2/1'=paliers
  //    de la rampe. L'ENCEINTE ('#' mur plein, 'D' porte) est décrite par la RECETTE `cells` ci-dessous. ─────────
  legend: { '~': 'eau', '=': 'planches', P: 'pave', '1': 'pave', '2': 'pave', '3': 'pave', '4': 'pave' },
  // Terrain laissé sous un marqueur nettoyé : '@' garde la cour pavée. A/G/B/K (z1) et k/p/o (z0) → '.' par défaut
  //   (le chemin de ronde SOUS les pièces/archers est auto-posé par `cells`, pas par le fill du marqueur).
  markerFill: { '@': 'P' },
  // HAUTEURS pilotées par l'ASCII : SEULE la RAMPE ('4/3/2/1', pente ≤1 m/case). La hauteur du rempart est
  //   auto-posée par `cells` (bande → zone rempart à 4 m sur z1) — plus aucun 'elevate W'.
  elevate: { '4': 4, '3': 3, '2': 2, '1': 1 },
  // ── RECETTE `cells` : une LETTRE = la case COMPLÈTE. '#' = ENCEINTE PLEINE (fondation 'pierre' + zone rempart
  //   auto sur z1 : bloc solide 4 m + chemin de ronde marchable + crénelure ; le z0 devient impassable). 'D' =
  //   PORTE : idem mais le z0 reste un TUNNEL passable et une HERSE `porte-de-ville` est posée sur la BOUCHE
  //   extérieure (arête N, facing:'N' car le champ est AU NORD/en haut) ; intacte elle bloque, abattue → brèche. ─
  cells: {
    '#': { terrain: 'pierre', wall: { structure: 'mur-en-pierre', facing: 'N' } },
    D: { terrain: 'pierre', gate: { structure: 'porte-de-ville', facing: 'N' } },
  },

  // ── Grilles ASCII des 2 étages (RECOPIÉES telles quelles, marqueurs inclus). La RAMPE n'est PAS un marqueur :
  //    ce sont des cases de cour dont la HAUTEUR monte (`elevate`). Marqueurs z0 : '@'=départ · 'k'=canon de siège
  //    ennemi · 'p'=catapulte ennemie · 'o'=fantassin ennemi. Marqueurs z1 (sur le chemin de ronde) : 'B'=baliste ·
  //    'K'=canon · 'A'=archer défenseur · 'G'=guetteur (au-dessus du tunnel de la porte). La BANDE d'enceinte est
  //    la recette `cells` : '#'=mur plein, 'DD'=porte (cols 14-15), 2 cases d'épaisseur (rangées 37-38). ──────────
  levels: {
    z0: [
      '...T....F.....T......F....T...',
      '............E....E............',
      '........p.....................',
      '..............................',
      '..............................',
      '...............o..............',
      '....o....................o....',
      '..........o........o..........',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '.....................k........',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '~~~~~~~~~~~~~====~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~====~~~~~~~~~~~~~',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............o...............',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '##############DD##############',
      '##############DD##############',
      'PPP44PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPP33PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPP22PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPP11PPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
      'PPPPPPPPPPPPPP@PPPPPPPPPPPPPPP',
      'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    ].join('\n'),
    z1: [
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '....A.....A...G...A.....A.....',
      '........B............K........',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
      '..............................',
    ].join('\n'),
  },

  // ── TOUT est POSÉ PAR L'ASCII (zéro coordonnée) ────────────────────────────────────────────────────────────
  //  • ENCEINTE : bande `#`/`DD` (z0, rangées 37-38) → zone rempart auto sur z1 (masse pleine 4 m + chemin de
  //    ronde marchable + crénelure de PÉRIMÈTRE) ; le z0 sous la bande est IMPASSABLE, sauf le TUNNEL de la porte.
  //  • RAMPE : paliers '4/3/2/1' (z0, cols 3-4, rows 39-42) → pente ≤1 m/case, sommet (y39, 4 m) jouxte le chemin
  //    de ronde (y38). DÉPORTÉE de la porte → cour dégagée derrière la porte (zone de mort).

  // ── ENTITÉS à ids FIXES : SEULS les SERVANTS de pièce (`entities`, PAS des marqueurs). Leur id est référencé
  //    par le `crew` des emplacements ET par le roster de la rencontre → il doit être STABLE (un marqueur en
  //    générerait un frais). Tout le RESTE (pièces, archers, gobelins, décor du camp) est posé PAR L'ASCII. ──────
  entities: [
    // Servants de pièce DE REMPART (z1, côté défenseur) — postés à x-1 de leur affût (B(8,38)→(7,38), K(21,38)→(20,38)).
    gunner('crew-baliste', { x: 7, y: 38 }, 'baliste', 'Servant de baliste', { z: 1 }),
    gunner('crew-canon', { x: 20, y: 38 }, 'canon-petit', 'Servant de canon', { z: 1 }),
    // Servants de la BATTERIE assaillante (z0, côté assaut, facing S) — à x-1 de leur affût (k(21,15)→(20,15), p(8,2)→(7,2)).
    gunner('brg-canon', { x: 20, y: 15 }, 'canon-petit', 'Canonnier de siège', { facing: 'S', ref: 'brigand' }),
    gunner('brg-cata', { x: 7, y: 2 }, 'catapulte-petite', 'Servant de catapulte', { facing: 'S', ref: 'brigand' }),
  ],

  // ── BINDS des marqueurs → poses. Archers/guetteur = PNJ alliés-IA (arcs). Emplacements = affûts INERTES servis
  //    par leur équipage (crew ci-dessus), enrôlés SANS `ai` (aucun tour propre). Gobelins = fantassins ennemis. ─
  bind: {
    '@': 'heroStart',
    // Archers défenseurs (z1, arcs) : PNJ alliés-IA (agissent seuls).
    A: {
      entity: { kind: 'personnage', ref: 'garde-du-village', weapon: 'arc', facing: 'N', z: 1, label: 'Archer du guet' },
      member: { enc: 'assaut', side: 'ally', ai: true },
    },
    // Guetteur au-dessus du tunnel de la porte (chemin de ronde continu au-dessus de la brèche).
    G: {
      entity: { kind: 'personnage', ref: 'garde-du-village', weapon: 'arc', facing: 'N', z: 1 },
      member: { enc: 'assaut', side: 'ally', ai: true },
    },
    // Pièces de REMPART : affûts INERTES (pas d'`ai`), servis par leur équipage QUALIFIÉ (crew), sur le chemin de ronde (z1).
    B: { emplacement: 'baliste', crew: 'crew-baliste', facing: 'N', member: { enc: 'assaut', side: 'ally' } },
    K: { emplacement: 'canon-petit', crew: 'crew-canon', facing: 'N', member: { enc: 'assaut', side: 'ally' } },
    // BATTERIE assaillante (z0) : affûts INERTES servis par les brigands-équipage, camp ennemi.
    k: { emplacement: 'canon-petit', crew: 'brg-canon', facing: 'S', member: { enc: 'assaut', side: 'enemy' } },
    p: { emplacement: 'catapulte-petite', crew: 'brg-cata', facing: 'S', member: { enc: 'assaut', side: 'enemy' } },
    // Fantassins gobelins (z0) : assaut ennemi qui traverse le pont et s'amasse à la porte.
    o: { entity: { kind: 'personnage', ref: 'gobelin', facing: 'S' }, member: { enc: 'assaut', side: 'enemy' } },
    // CAMP assaillant (décor PUR, rangées 0-1) : tentes / braséros / étendards — POSÉS PAR L'ASCII (zéro coordonnée).
    T: { kind: 'prop', ref: 'tente' },
    F: { kind: 'prop', ref: 'brasero' },
    E: { kind: 'prop', ref: 'etendard' },
  },

  // ── RENCONTRE : le roster des servants (alliés-IA au rempart ; brigands ennemis à la batterie) — le RESTE
  //    (emplacements inertes, archers, guetteur, gobelins) arrive par bind→member ci-dessus. ────────────────────
  encounters: [
    {
      id: 'assaut',
      // Rencontre de SIÈGE déclarée (`EncounterDef.siege`) : sans elle, la batterie assaillante ne verrait
      // AUCUNE structure et ne brècherait jamais la porte — c'est tout le sujet du scénario.
      siege: true,
      members: [
        { entityId: 'crew-baliste', side: 'ally', ai: true },
        { entityId: 'crew-canon', side: 'ally', ai: true },
        { entityId: 'brg-canon', side: 'enemy' },
        { entityId: 'brg-cata', side: 'enemy' },
      ],
    },
  ],
};

const scene = buildScene(spec);

export const scenario: TestScenario = {
  id: 'siege-enceinte',
  order: 41,
  category: 'combat',
  icon: 'scenario/siege',
  title: 'Siège — défendre la muraille',
  tests:
    'Siège à grande échelle (30×46, 2 couches) : champ d\'approche profond (~76 m) + camp & BATTERIE assaillante ' +
    '(canon direct + catapulte indirecte) qui BRÈCHE la porte de loin (IA cible la structure, Atout Siège) ; rivière ' +
    '+ pont qui canalise l\'assaut ; enceinte à porte brèchable (WallSpec sans hauteur) ; chemin de ronde = couche 1 ' +
    'à 4 m, rejoint par UNE RAMPE au FLANC GAUCHE (déportée de la porte), parapet z1 sur l\'arête extérieure ; ' +
    'pièces servies + ARCHERS PNJ alliés-IA ; combat VERTICAL (LdV plongeante, mêlée refusée à travers le vide).',
  partyNote: 'Groupe pré-tiré (Soldat / Chasseur / Sorcier / Tueur) : montez au rempart par la rampe du flanc gauche ; le SOLDAT sait servir les pièces (Baliste/Canon).',
  makeParty: () => {
    const party = pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.sorcier, PREGEN.tueur);
    // Le SOLDAT sait SERVIR les pièces de rempart : on lui octroie la Projectiles du Groupe de CHAQUE pièce
    // (Baliste→Arbalète, Canon→Poudre noire). Sans cette Spé, il ne COMPTE PAS dans l'effectif d'équipe
    // (AA 10 l.230) → la pièce qu'il prend tirerait en sous-effectif. Dérivé des pièces (aucun libellé en dur).
    const gunner0 = party[0];
    for (const tid of ['baliste', 'canon-petit'])
      for (const ref of projForPiece(tid))
        if (!gunner0.skills.some((s) => s.id === ref.id && s.spec === ref.spec))
          gunner0.skills.push({ id: ref.id, spec: ref.spec, characteristic: 'capacite-de-tir', advances: 20 });
    return party;
  },
  scene,
  autoCombat: 'assaut',
};
