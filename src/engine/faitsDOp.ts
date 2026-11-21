import type { Combatant } from './types';
import type { DiceSpec } from './dice';
import type { Formula, GameOp, OpsCtx } from './ops';
import { hullShipSize } from './coque';
import { findFallTable } from '../data/shipCriticals';
import { t } from '../i18n';
import type { PlayerText } from '../i18n/playerText';

/** Les ops de NAVIRE : résolues sur la seule cible `navire` d'un EffectOp (`noyau/navireOps.ts`), inertes
 *  partout ailleurs. */
export const OPS_DU_NAVIRE = ['shipMorale', 'manann', 'shipCritical', 'navireMod', 'meteoImposee', 'cargaison', 'provisions', 'equipage', 'perilDeMer', 'navireHostile', 'infestation', 'combatEnMer', 'commission', 'constructeurDEscale', 'rationsDEscale'] as const satisfies readonly GameOp['op'][];
export type OpDuNavire = Extract<GameOp, { op: (typeof OPS_DU_NAVIRE)[number] }>;
export const estOpDuNavire = (o: GameOp): o is OpDuNavire => (OPS_DU_NAVIRE as readonly string[]).includes(o.op);

/** Op de la BOURSE DU GROUPE (`money` à `groupe`) : résolue une fois par la feuille de scène qui la porte
 *  (Effet `ops`, `noyau/combatEffects.ts`), inerte dans `applyOps`. */
export const estOpDeLaBourseDuGroupe = (o: GameOp): o is Extract<GameOp, { op: 'money' }> => o.op === 'money' && o.groupe === true;

/** Op du MARCHÉ D'UN PORT : résolue une fois par la feuille de scène qui la porte (Effet `ops`,
 *  `noyau/combatEffects.ts`), inerte dans `applyOps`. */
export const estOpDuMarche = (o: GameOp): o is Extract<GameOp, { op: 'marcheDuPort' }> => o.op === 'marcheDuPort';
/** L'op des ATTAQUES SUBIES : résolue une fois, sur la cible unique de la feuille `ops` qui la porte ; `applyOps` la
 *  laisse inerte. */
export const estOpDAttaquesSubies = (o: GameOp): o is Extract<GameOp, { op: 'attaquesSubies' }> => o.op === 'attaquesSubies';

/**
 * CLÉ d'un dé d'op (#1508) — rang de l'op dans SON tableau + champ qui le porte (`#3.hauteur`).
 * SOURCE UNIQUE de la clé, et personne ne l'écrit à la main : la DÉCLARATION de l'op (`DES_DUNE_OP`)
 * nomme ses champs, `demandesDeDes` en dérive les clés qu'elle annonce et le helper `de(…)` d'`applyOps`
 * en dérive les clés qu'il relit. Le rang suffit à l'unicité (deux ops d'un tableau ne partagent pas de
 * rang) et le champ nomme le dé, pour que l'étape ouverte dise ce qu'elle décide.
 */
export function cleDeDe(rang: number, champ: string): string {
  return `#${rang}.${champ}`;
}

/**
 * DÉ QU'UNE OP DEMANDE À LA PORTE (#1508) — ce que le moteur FABRIQUE pour que la couche `noyau`
 * OUVRE : quels dés (`spec`), sous quelle clé les reverser (`cle`, cf. `cleDeDe`), ce qu'ils décident
 * (`libelle`) et dans quelle unité se lit leur total (`unite` — « m », affichage pur).
 *
 * C'est la même forme qu'une déclaration d'étape à dé nu (`noyau/rollSeam.DieStepSpec`) privée de ce
 * que seul l'applier sait (le porteur, la séquence d'accueil) : le moteur ne connaît ni sièges ni
 * fenêtres, il dit le dé.
 */
export interface DemandeDe {
  cle: string;
  spec: DiceSpec;
  libelle: PlayerText;
  unite?: string;
}

/**
 * LES DÉS que chaque op du canal déclare, PAR NOM (#1508) — la table qui donne au `champ` son type.
 * Les deux bouts du canal lisent la MÊME union : le nom demandé par le `case` se vérifie contre les
 * champs que l'op DÉCLARE, et un nom absent de la table ne compile pas.
 *
 * L'op N+1 coûte toujours UNE déclaration : une ligne ici (ses champs) et son entrée dans
 * `DES_DUNE_OP` — les deux au même endroit, impossibles à désaccorder (le registre est typé par cette
 * table, une entrée qui déclarerait un autre champ ne compile pas).
 */
interface ChampsDOp {
  fall: 'hauteur' | 'degats';
  zone: 'duree';
}

/** UN dé DÉCLARÉ par une op, avant que son rang ne lui donne sa clé — la forme AUTEUR de `DemandeDe`. */
export interface DeDeclare<C extends string = string> {
  champ: C;
  spec: DiceSpec;
  libelle: PlayerText;
  unite?: string;
}

/** LDB 15 l.80 */
export const D10_CHUTE: DiceSpec = Object.freeze({ n: 1, sides: 10 }); // #2097

/**
 * HAUTEUR déclarée d'une chute d'op `fall` — LECTURE UNIQUE de (table × Taille de coque × station du
 * tombant), MDG 13 l.684-688. Partagée par la DÉCLARATION (qui annonce le dé) et par le `case 'fall'`
 * (qui le consomme) : une seconde lecture ferait diverger ce qui est annoncé de ce qui est lu.
 *
 * Rend la `Formula` de hauteur ET le libellé de la table. Table inconnue, coque absente, Taille non
 * couverte, station sans colonne : anomalie NOMMÉE (une chute sans hauteur n'est pas une chute).
 */
export function hauteurDeChute(o: Extract<GameOp, { op: 'fall' }>, target: Combatant, ctx: OpsCtx): { hauteur: Formula; table: string } {
  const table = findFallTable(o.hauteur.table.id);
  if (!table) throw new Error(`op « fall » : table de hauteur inconnue « ${o.hauteur.table.id} » (tablesDeChute, ship-criticals.json).`);
  const taille = ctx.hull ? hullShipSize(ctx.hull) : undefined;
  if (!taille) throw new Error(`op « fall » (« ${table.label} ») : aucune Taille de coque au contexte (ctx.hull) — la hauteur se lit par la Taille du bateau (MDG 12 l.122-129).`);
  const bande = table.bandes.find((b) => b.tailles.includes(taille));
  if (!bande) throw new Error(`op « fall » (« ${table.label} ») : aucune bande ne couvre la Taille « ${taille} ».`);
  const colonne = Object.entries(bande.hauteurs).find(([station]) => station === target.shipStation)?.[1];
  const hauteur = colonne === undefined ? undefined : structuredClone(colonne); // #2097
  if (hauteur === undefined) throw new Error(`op « fall » (« ${table.label} ») : ${target.label} n'a pas de colonne de hauteur pour la station « ${target.shipStation ?? '—'} ».`);
  return { hauteur, table: table.label };
}

/**
 * DÉCLARATION UNIQUE « quels dés cette op demande à la porte » (#1508) — le registre par `op`, LU aux
 * DEUX bouts du canal : `demandesDeDes` l'énumère pour ouvrir les étapes, et le helper `de(…)`
 * d'`applyOps` le relit pour consommer ce qui est tombé. Une op qui rejoint le canal coûte UNE entrée
 * ici plus un `de(…)` à son `case` : la clé s'écrit à UN endroit, les deux bouts la dérivent.
 *
 * Une op ABSENTE d'ici tire encore ses dés sous `applyOps` : c'est la DETTE inventoriée par
 * `DES_HORS_PORTE_STOCK`, pas une classe de dé exemptée (doctrine utilisateur du 2026-09-04).
 */
const DES_DUNE_OP: { [K in keyof ChampsDOp]: (o: Extract<GameOp, { op: K }>, target: Combatant, ctx: OpsCtx) => DeDeclare<ChampsDOp[K]>[] } = {
  fall: (o, target, ctx): DeDeclare<ChampsDOp['fall']>[] => {
    const { hauteur, table } = hauteurDeChute(o, target, ctx);
    return [
      // MDG 13 l.684
      ...(typeof hauteur === 'object' && 'dice' in hauteur
        ? [{ champ: 'hauteur' as const, spec: hauteur.dice, libelle: t('op.chute.deHauteur', { table }), unite: 'm' }]
        : []),
      { champ: 'degats' as const, spec: D10_CHUTE, libelle: t('op.chute.deDegats') },
    ];
  },
  // #4202
  zone: (o): DeDeclare<ChampsDOp['zone']>[] => (typeof o.durationRounds === 'object' && 'dice' in o.durationRounds
    ? [{ champ: 'duree' as const, spec: o.durationRounds.dice, libelle: t('op.zone.deDuree'), unite: 'Rounds' }]
    : []),
};

/**
 * CETTE OP DEMANDE-T-ELLE UN DÉ À LA PORTE ? (#1508) — lecture du MÊME registre que `demandesDeDes`
 * (`DES_DUNE_OP`), donc jamais une seconde liste à tenir : une op qui rejoint le canal devient vraie
 * ici du seul fait de sa déclaration.
 *
 * PRÉDICAT PUR et TOTAL : il ne lit ni cible ni contexte, donc il ne LÈVE pas — c'est ce qui permet à
 * un appelant de DÉCIDER de son chemin (différable ou non) avant d'avoir de quoi annoncer.
 */
export function opDemandeUnDe(op: GameOp): boolean {
  return op.op in DES_DUNE_OP;
}

/** Les dés déclarés, typés par les champs de l’op consommée. */
export function desDeclaresDe<O extends GameOp>(o: O, target: Combatant, ctx: OpsCtx): DeDeclare<ChampsDOp[Extract<O['op'], keyof ChampsDOp>]>[];
export function desDeclaresDe(o: GameOp, target: Combatant, ctx: OpsCtx): DeDeclare[] {
  const decl = (DES_DUNE_OP as Partial<Record<GameOp['op'], (op: GameOp, t: Combatant, c: OpsCtx) => DeDeclare[]>>)[o.op];
  return decl ? decl(o, target, ctx) : [];
}

/**
 * DÉS QUE CES OPS DEMANDENT À LA PORTE (#1508) — ÉNUMÉRATION PURE, ni tirage ni mutation : ce que
 * l'applier doit OUVRIR en étapes de dé avant d'appeler `applyOps`, et ce qu'il lui reversera dans
 * `ctx.des`. Le canal op → applier tient dans ce couple : le moteur FABRIQUE, `noyau` OUVRE (patron
 * `shipCritical.applyCrewHit`, qui REND son `testFlow` au lieu de le jouer).
 *
 * LÈVE sur donnée malformée (table de chute inconnue, coque absente…) AVANT qu'aucune op de la feuille
 * ne s'applique : c'est voulu, et c'est le même fail-fast que le `case` correspondant — une feuille
 * dont un dé ne peut être annoncé ne s'applique pas À MOITIÉ.
 *
 * NIVEAU 1, et l'état des autres niveaux est MESURÉ, pas supposé : une op à dé IMBRIQUÉE (rangée de
 * `rollTable`, palier de `rollThreshold`, forme d'un échelon) n'est pas énumérée et ses dés tombent
 * sous `applyOps` (`imbrique` retire `ctx.des`) ; le walker PUR `noyau/combat/flowEval.runPureFlowLines`
 * appelle `applyOps` hors de la porte. Ces deux chemins sont au solde `DES_HORS_PORTE_STOCK` (comptés
 * à l'`applyOps` de leurs appelants), qui les porte jusqu'à zéro (#1508). Une récursion ici ne les
 * couvrirait pas : elle annoncerait des dés que la branche non prise ne tire jamais.
 */
export function demandesDeDes(ops: readonly GameOp[], target: Combatant, ctx: OpsCtx): DemandeDe[] {
  return ops.flatMap((o, rang) => desDeclaresDe(o, target, ctx)
    .map((d) => ({ cle: cleDeDe(rang, d.champ), spec: d.spec, libelle: d.libelle, ...(d.unite ? { unite: d.unite } : {}) })));
}
