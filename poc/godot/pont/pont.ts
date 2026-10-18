// Adaptateur `wfrpPont` du prototype #2793 : contrat `poc/godot/pont/CONTRAT.md`.
// `store` évalué avant `combatManeuvers` : sinon `combatEffects.ts:738` est lu avant son initialisation
// (combatManeuvers → triggeredEffects → combatEffects → campaignData → store.ts:1816 → registerCloture).
import '../../../src/state/store';
import { findCreatureById } from '../../../src/data';
import { makePregens } from '../../../src/data/pregens';
import { hasActiveFlag } from '../../../src/engine/activeFlags';
import { gainAdvantage } from '../../../src/engine/advantage';
import { groupAdvantage } from '../../../src/engine/advantagePool';
import { assertAttackWeapon, compteDuCoup, initiativeOrder, resolveMelee, type AttackResult, type CompteDuCoup } from '../../../src/engine/combat';
import { hasCritRollTwiceTalent } from '../../../src/engine/combatFeatures/dispatch';
import { addCondition, appliquerMortSubite, applyZeroWounds, COND, hasCondition, isOutOfAction } from '../../../src/engine/conditions';
import { critiqueTriviale, jeuDeCritique, porteurDeCritique, regimeDePorteur, resolveCritique, type CriticalResolved } from '../../../src/engine/critical';
import { makeRNG, type RNG } from '../../../src/engine/dice';
import { effectiveMovement } from '../../../src/engine/encumbrance';
import { applyOps } from '../../../src/engine/ops';
import { isInanimate } from '../../../src/engine/structures';
import { consolidateAmputations, reinjuryBleed } from '../../../src/engine/trauma';
import { locationLabel, type Combatant, type HitLocation } from '../../../src/engine/types';
import { t } from '../../../src/i18n';
import { bestDefenseMode } from '../../../src/state/combatManeuvers';
import { creatureToCombatant } from '../../../src/state/spawn';

export const VERSION_DU_PONT = 1;
const LIGNES_DE_JOURNAL = 20;
const ADVERSAIRE = 'brigand';
const NOMBRE_DE_HEROS = 4;
const NOMBRE_D_ADVERSAIRES = 2;

export type NatureDErreur = 'refus' | 'entree' | 'etat' | 'exception';

export type Erreur = {
  nature: NatureDErreur;
  action: { methode: string; entree: unknown };
  message: string;
  pile?: string;
  partiels?: unknown;
};

export type CombattantVu = {
  id: string; libelle: string; camp: 'heros' | 'adversaires';
  blessures: number; blessuresMax: number;
  avantage: number;
  etats: { id: string; valeur: number }[];
  mouvement: number;
  aDeplace: boolean; aAttaque: boolean;
  horsDeCombat: boolean;
};

export type Vue = {
  pont: 1;
  round: number;
  actif: string | null;
  ordre: string[];
  combattants: CombattantVu[];
  journal: string[];
  issue: null | 'victoire' | 'defaite';
};

export type Resultat = {
  touche: boolean;
  jetAttaque: number; cibleAttaque?: number; drAttaque?: number;
  jetDefense?: number; cibleDefense?: number; drDefense?: number;
  drNet: number; localisation?: string; degats?: number; blessuresPerdues?: number; critique: boolean;
  critiques: { libelle: string; localisation: string; mortel: boolean }[];
  mortSubite: boolean;
  journal: string;
};

export type Pont = {
  version(): string;
  demarrer(entree?: string): string;
  vue(): string;
  deplacer(entree?: string): string;
  attaquer(entree?: string): string;
  finDeTour(): string;
  simulerAttaque(entree?: string): string;
  erreursGlobales(): string;
  sondeExceptionNue(): never;
};

type Partie = {
  combattants: Combatant[];
  ordre: string[];
  tour: number;
  round: number;
  rng: RNG;
  aDeplace: Set<string>;
  aAttaque: Set<string>;
  journal: string[];
};

/** Échec attendu d'une méthode : porte sa nature, l'enveloppe le rend en `{ ok:false }`. */
class EchecDuPont extends Error {
  constructor(readonly nature: Exclude<NatureDErreur, 'exception'>, message: string) {
    super(message);
  }
}

/** Ce qu'une méthode a calculé avant d'échouer, relayé par l'enveloppe en `partiels`. */
type Noter = (partiels: unknown) => void;

/** Les combattants de la rencontre du prototype, neufs : 4 premiers pré-tirés, 2 `brigand`. */
export function combattantsDeLaRencontre(): Combatant[] {
  const heros = makePregens().slice(0, NOMBRE_DE_HEROS);
  const creature = findCreatureById(ADVERSAIRE);
  if (!creature) throw new Error(`créature « ${ADVERSAIRE} » absente du bestiaire`);
  const adversaires = Array.from({ length: NOMBRE_D_ADVERSAIRES }, (_, i) => creatureToCombatant(creature, `${ADVERSAIRE}-${i + 1}`, { x: 0, y: i }));
  return [...heros, ...adversaires];
}

const campDe = (c: Combatant): CombattantVu['camp'] => (c.kind === 'hero' ? 'heros' : 'adversaires');

/** Ce que l'encaissement du coup a fait à la cible. */
export type Encaissement = { blessuresPerdues: number; critiques: CriticalResolved[]; mortSubite: boolean };

/** L'AttackResult projeté dans la forme du contrat, et son encaissement quand il a eu lieu. */
export function resultatDe(res: AttackResult, encaissement?: Encaissement): Resultat {
  const a = res.attackerDetail;
  const d = res.defenderDetail;
  return {
    touche: res.hit,
    jetAttaque: res.attackerRoll,
    ...(a ? { cibleAttaque: a.target, drAttaque: a.sl } : {}),
    ...(d ? { jetDefense: d.roll, cibleDefense: d.target, drDefense: d.sl } : res.defenderRoll != null ? { jetDefense: res.defenderRoll } : {}),
    drNet: res.netSL,
    ...(res.location ? { localisation: res.location } : {}),
    ...(res.damage != null ? { degats: res.damage } : {}),
    ...(encaissement ? { blessuresPerdues: encaissement.blessuresPerdues } : {}),
    critique: res.critical,
    critiques: (encaissement?.critiques ?? []).map((c) => ({ libelle: c.label, localisation: c.location, mortel: c.lethal })),
    mortSubite: encaissement?.mortSubite ?? false,
    journal: res.log,
  };
}

/** combatFlow.ts:178 */
const critiquesTireesDeuxFois = (c: Combatant): boolean => hasActiveFlag(c, 'critRollTwice') || hasCritRollTwiceTalent(c);

/** Une Blessure critique de Personnage appliquée : combatFlow.ts:1756, branche `personnage` (:1792-1869). */
function appliquerLaCritique(cible: Combatant, lieu: HitLocation, overkill: number, twice: boolean, rng: RNG, log: string[]): CriticalResolved {
  const jeu = jeuDeCritique(twice);
  const crit = resolveCritique(jeu, cible, lieu, rng, { overkill, twice });
  if (!(jeu === 'aa' && critiqueTriviale('aa', crit.location, crit.roll))) cible.criticalWounds = (cible.criticalWounds ?? 0) + 1;
  cible.tookCriticalThisFight = true;
  cible.critEntriesSuffered = [...(cible.critEntriesSuffered ?? []), crit.entryId];
  log.push(crit.log);
  if (crit.traumas.length) {
    cible.traumas = [...(cible.traumas ?? []), ...crit.traumas];
    for (const s of crit.traumas) log.push(`  ↳ ${s.label} (${locationLabel(s.location, cible.bodyShape)}).`);
    for (const l of consolidateAmputations(cible)) log.push(`  ↳ ${l}`);
  }
  if (crit.lethal) {
    cible.dead = true; // combatFlow.ts:1654
    return crit;
  }
  for (const l of applyOps(cible, crit.ops, { rng, location: lieu })) log.push(`  ↳ ${l}`);
  if (crit.desc) log.push(`  ↳ ${crit.desc}`);
  return crit;
}

/** Les Blessures du coup, puis sa Mort subite et ses Blessures critiques, toutes subies : combatFlow.ts:2520,
 *  :2471, :2543. */
function encaisserLeCoup(cible: Combatant, coup: CompteDuCoup, twice: boolean, rng: RNG, log: string[]): Encaissement {
  const porteur = porteurDeCritique(cible);
  if (porteur !== 'personnage') throw new Error(`porteur « ${porteur} » de ${cible.label} : seul le Personnage est encaissé par le prototype`);
  const { lieu, compte } = coup;
  const currentBefore = cible.wounds.current;
  cible.wounds.current = Math.max(0, currentBefore - compte.blessures);
  const blessuresPerdues = currentBefore - cible.wounds.current;
  if (!isInanimate(cible)) {
    const reinj = reinjuryBleed(cible, lieu);
    if (reinj > 0) {
      addCondition(cible, COND.hemorragique, reinj);
      log.push(t('cf.reinjuryBleed', { name: cible.label, n: reinj, loc: locationLabel(lieu, cible.bodyShape) }));
    }
  }
  if (compte.mortSubite) appliquerMortSubite(cible, log);
  const critiques: CriticalResolved[] = [];
  for (const entree of compte.critiques) {
    const crit = appliquerLaCritique(cible, lieu, entree.overkill, twice, rng, log);
    critiques.push(crit);
    if (crit.lethal) break; // combatFlow.ts:2483
  }
  if (regimeDePorteur(cible).clore && cible.wounds.current <= 0 && !cible.dead && !hasCondition(cible, COND.inconscient)) applyZeroWounds(cible); // combatFlow.ts:2543
  return { blessuresPerdues, critiques, mortSubite: compte.mortSubite };
}

/** Résout une attaque de mêlée et l'applique comme combatFlow.ts:2721-2879, par les primitives de
 *  `src/engine`. Mute `attaquant` et `cible` ; pousse les lignes de l'encaissement dans `log`. */
export function resoudreEtAppliquer(attaquant: Combatant, cible: Combatant, rng: RNG, log: string[], noter: Noter = () => {}): Resultat {
  const arme = assertAttackWeapon(attaquant.weapons, true);
  const res = resolveMelee(attaquant, cible, arme, rng, { defense: bestDefenseMode(cible) });
  noter(resultatDe(res));
  const twice = critiquesTireesDeuxFois(attaquant);
  const coup = compteDuCoup(res, arme, attaquant, cible, 0);
  if (res.advantageTo === 'attacker') gainAdvantage(attaquant, 1);
  const { compte, lieu, coupCritique } = coup;
  let encaissement: Encaissement | undefined;
  if (res.hit && (compte.blessures || compte.critiques.length || compte.mortSubite || coupCritique)) {
    if (compte.relance) { res.location = lieu; res.localisationRelancee = true; }
    res.woundsLost = compte.blessures;
    encaissement = encaisserLeCoup(cible, coup, twice, rng, log);
  }
  if (res.advantageTo === 'defender') {
    gainAdvantage(cible, 1);
    if (!groupAdvantage()) attaquant.advantage = 0; // combatFlow.ts:2877
  }
  if (res.hit && res.woundsLost && !groupAdvantage()) cible.advantage = 0; // combatFlow.ts:2879
  return resultatDe(res, encaissement);
}

function issueDe(combattants: Combatant[]): Vue['issue'] {
  const debout = (camp: CombattantVu['camp']) => combattants.some((c) => campDe(c) === camp && !isOutOfAction(c));
  if (!debout('heros')) return 'defaite';
  if (!debout('adversaires')) return 'victoire';
  return null;
}

function actifDe(p: Partie): Combatant | undefined {
  const id = p.ordre[p.tour];
  return p.combattants.find((c) => c.id === id);
}

function vueDe(p: Partie): Vue {
  const actif = actifDe(p);
  const issue = issueDe(p.combattants);
  return {
    pont: VERSION_DU_PONT,
    round: p.round,
    actif: issue || !actif || isOutOfAction(actif) ? null : actif.id,
    ordre: [...p.ordre],
    combattants: p.combattants.map((c) => ({
      id: c.id,
      libelle: c.label,
      camp: campDe(c),
      blessures: c.wounds.current,
      blessuresMax: c.wounds.max,
      avantage: c.advantage,
      etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
      mouvement: effectiveMovement(c),
      aDeplace: p.aDeplace.has(c.id),
      aAttaque: p.aAttaque.has(c.id),
      horsDeCombat: isOutOfAction(c),
    })),
    journal: p.journal.slice(-LIGNES_DE_JOURNAL),
    issue,
  };
}

function objetDEntree(entree: unknown): Record<string, unknown> {
  if (typeof entree !== 'object' || entree === null || Array.isArray(entree)) throw new EchecDuPont('entree', 'entrée attendue : un objet JSON');
  return entree as Record<string, unknown>;
}

function chaine(e: Record<string, unknown>, cle: string): string {
  const v = e[cle];
  if (typeof v !== 'string' || v === '') throw new EchecDuPont('entree', `« ${cle} » attendu : une chaîne non vide`);
  return v;
}

function entier(e: Record<string, unknown>, cle: string): number {
  const v = e[cle];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new EchecDuPont('entree', `« ${cle} » attendu : un entier positif ou nul`);
  return v;
}

function combattant(p: Partie, id: string): Combatant {
  const c = p.combattants.find((x) => x.id === id);
  if (!c) throw new EchecDuPont('entree', `combattant inconnu : « ${id} »`);
  return c;
}

/** Le combattant qui agit : connu, en état de combattre, dont c'est le tour. */
function agissant(p: Partie, id: string): Combatant {
  const c = combattant(p, id);
  if (isOutOfAction(c)) throw new EchecDuPont('etat', `${c.label} est hors de combat`);
  if (issueDe(p.combattants)) throw new EchecDuPont('etat', 'la rencontre est terminée');
  if (actifDe(p)?.id !== c.id) throw new EchecDuPont('refus', `ce n'est pas le tour de ${c.label}`);
  return c;
}

/** La cible d'une attaque : connue, en état de combattre, du camp adverse. */
function cibleValide(p: Partie, attaquant: Combatant, id: string): Combatant {
  const cible = combattant(p, id);
  if (isOutOfAction(cible)) throw new EchecDuPont('refus', `${cible.label} est hors de combat`);
  if (campDe(cible) === campDe(attaquant)) throw new EchecDuPont('refus', `${cible.label} est du même camp que ${attaquant.label}`);
  return cible;
}

type Corps = (entree: unknown, noter: Noter) => Record<string, unknown>;

export function creerPont(): Pont {
  let partie: Partie | null = null;
  const erreurs: { message: string; source?: string }[] = [];

  const enCours = (): Partie => {
    if (!partie) throw new EchecDuPont('etat', 'partie non démarrée : appeler demarrer');
    return partie;
  };

  /** L'enveloppe unique : décode l'entrée, ne lève jamais, rend une chaîne JSON. */
  const envelopper = (methode: string, corps: Corps) => (json?: string): string => {
    let entree: unknown = json;
    let partiels: unknown;
    try {
      if (json !== undefined) {
        try {
          entree = JSON.parse(json);
        } catch {
          throw new EchecDuPont('entree', 'JSON invalide');
        }
      }
      return JSON.stringify({ ok: true, ...corps(entree, (p) => { partiels = p; }) });
    } catch (e) {
      const erreur: Erreur = e instanceof EchecDuPont
        ? { nature: e.nature, action: { methode, entree }, message: e.message }
        : {
          nature: 'exception',
          action: { methode, entree },
          message: e instanceof Error ? e.message : String(e),
          ...(e instanceof Error && e.stack ? { pile: e.stack } : {}),
          ...(partiels !== undefined ? { partiels } : {}),
        };
      return JSON.stringify({ ok: false, erreur });
    }
  };

  const cible = globalThis as { addEventListener?: (type: string, f: (ev: unknown) => void) => void };
  cible.addEventListener?.('error', (ev) => {
    const e = ev as { message?: string; filename?: string; lineno?: number };
    erreurs.push({ message: e.message ?? String(ev), ...(e.filename ? { source: `${e.filename}:${e.lineno ?? 0}` } : {}) });
  });
  cible.addEventListener?.('unhandledrejection', (ev) => {
    const raison = (ev as { reason?: unknown }).reason;
    erreurs.push({ message: raison instanceof Error ? raison.message : String(raison), source: 'unhandledrejection' });
  });

  return {
    version: envelopper('version', () => ({ pont: VERSION_DU_PONT })),
    demarrer: envelopper('demarrer', (entree) => {
      const graine = entier(objetDEntree(entree), 'graine');
      const rng = makeRNG(graine);
      const combattants = combattantsDeLaRencontre();
      const ordre = initiativeOrder(combattants, rng).map((c) => c.id);
      partie = { combattants, ordre, tour: 0, round: 1, rng, aDeplace: new Set(), aAttaque: new Set(), journal: [] };
      return { vue: vueDe(partie) };
    }),
    vue: envelopper('vue', () => ({ vue: vueDe(enCours()) })),
    deplacer: envelopper('deplacer', (entree) => {
      const p = enCours();
      const e = objetDEntree(entree);
      const c = agissant(p, chaine(e, 'id'));
      const cases = entier(e, 'cases');
      if (p.aDeplace.has(c.id)) throw new EchecDuPont('refus', `${c.label} s'est déjà déplacé ce tour`);
      const mouvement = effectiveMovement(c);
      if (cases > mouvement) throw new EchecDuPont('refus', `${c.label} ne peut parcourir que ${mouvement} cases`);
      p.aDeplace.add(c.id);
      p.journal.push(`${c.label} se déplace de ${cases} cases.`);
      return { vue: vueDe(p) };
    }),
    attaquer: envelopper('attaquer', (entree, noter) => {
      const p = enCours();
      const e = objetDEntree(entree);
      const attaquant = agissant(p, chaine(e, 'attaquant'));
      const defenseur = cibleValide(p, attaquant, chaine(e, 'cible'));
      if (p.aAttaque.has(attaquant.id)) throw new EchecDuPont('refus', `${attaquant.label} a déjà attaqué ce tour`);
      const lignes: string[] = [];
      const resultat = resoudreEtAppliquer(attaquant, defenseur, p.rng, lignes, noter);
      p.aAttaque.add(attaquant.id);
      p.journal.push(resultat.journal, ...lignes);
      if (isOutOfAction(defenseur)) p.journal.push(`${defenseur.label} est hors de combat.`);
      return { vue: vueDe(p), resultat };
    }),
    finDeTour: envelopper('finDeTour', () => {
      const p = enCours();
      if (issueDe(p.combattants)) throw new EchecDuPont('etat', 'la rencontre est terminée');
      for (let pas = 1; pas <= p.ordre.length; pas++) {
        const suivant = (p.tour + pas) % p.ordre.length;
        if (suivant === 0) p.round += 1;
        const c = combattant(p, p.ordre[suivant]);
        if (isOutOfAction(c)) continue;
        p.tour = suivant;
        p.aDeplace.delete(c.id);
        p.aAttaque.delete(c.id);
        return { vue: vueDe(p) };
      }
      throw new Error('finDeTour : aucun combattant en état de combattre sans issue de rencontre');
    }),
    simulerAttaque: envelopper('simulerAttaque', (entree, noter) => {
      const p = enCours();
      const e = objetDEntree(entree);
      const attaquant = combattant(p, chaine(e, 'attaquant'));
      const defenseur = combattant(p, chaine(e, 'cible'));
      const graine = entier(e, 'graine');
      const resultat = resoudreEtAppliquer(structuredClone(attaquant), structuredClone(defenseur), makeRNG(graine), [], noter);
      return { resultat };
    }),
    erreursGlobales: envelopper('erreursGlobales', () => ({ erreurs: erreurs.splice(0) })),
    sondeExceptionNue: () => {
      throw new Error('sonde-exception-nue');
    },
  };
}
