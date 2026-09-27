/**
 * LE LIBELLÉ D'UNE RÉPONSE RECOPIE-T-IL CE QUE LA FENÊTRE ANNONCE ? (#1869) — masque PUR, UNIQUE, lu
 * par les deux portes de la classe : la garde de corpus (`scripts/guards/lib/dialogueLabelTest.mjs`,
 * sur les documents committés) et la validation de scène rendue à l'éditeur (`validateScene`, sur le
 * projet qu'on édite). Ce qu'une réponse annonce est DÉRIVÉ de sa DONNÉE — le Test de son flux
 * (`testAnnonce`), le coût de son `cost` (`Coins`) ; un libellé qui le répète est une seconde vérité.
 *
 * Aucun vocabulaire n'est redéclaré ici : l'appelant INJECTE le libellé des Compétences (donnée
 * `skills.json`), des Caractéristiques et des Difficultés (`CHAR_LABELS`, `DIFFICULTY_LABELS`), et les
 * deux écritures canon de la monnaie (`formatMoney`, `spellMoney`).
 */

/** Vocabulaire du tag dérivé, injecté depuis ses sources. */
export interface VocabulaireDuTag {
  competence: (id: string) => string | undefined;
  carac: Readonly<Record<string, string>>;
  difficultes: Readonly<Record<string, string>>;
  /** Écritures canon d'un montant : la notation de la puce (« 4 sc », « 1 CO », « 4/– ») et
   *  l'épellation (« 4 pistoles d'argent »). */
  monnaie: { formater: (m: Montant) => string; epeler: (m: Montant) => string };
}

/** Montant tel que `cost` le porte. */
export interface Montant { gold: number; silver: number; brass: number }

/** Nœud de flux tel que la DONNÉE le porte (document JSON ou `Flow` typé) : lu champ à champ. */
type NoeudBrut = Record<string, unknown> | null | undefined;

/** Clé de comparaison : accents déposés, casse repliée. */
const cle = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Le terme apparaît-il en MOT ENTIER dans ce libellé ? (« Soin » ne se lit pas dans « Soigner ».) */
function contientLeTerme(label: string, terme: string): boolean {
  if (terme.length < 2) return false;
  const motif = new RegExp(`(^|[^\\p{L}\\p{N}])${cle(terme).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'u');
  return motif.test(cle(label));
}

/** Le MOT que le jeu emploie pour NOMMER un jet (« (Test de …) », « (Test étendu, 5 DR) »). */
const MOT_DU_JET = 'Test';

/**
 * Termes qu'un flux INTERDIT à son PROPRE libellé de réponse — tout ce que le tag DÉRIVÉ dira déjà :
 * la Compétence, sa spécialisation, la Caractéristique, la Difficulté déclarée (forme complète ET nom
 * seul), le DR CUMULÉ d'un Test étendu, et le mot « Test ». Le parcours descend dans TOUTES les
 * branches (`seq`, `if`, `test`, `yes`/`no` d'un `choice`) : un jet enfoui annonce autant qu'un jet de
 * tête.
 */
function termesDuFlux(flow: NoeudBrut, voc: VocabulaireDuTag, out: string[] = []): string[] {
  if (!flow || typeof flow !== 'object') return out;
  const prendre = (n: NoeudBrut) => {
    if (!n || typeof n !== 'object') return;
    const skill = n.skill as { id?: unknown; spec?: unknown } | undefined;
    if (skill && typeof skill.id === 'string') {
      out.push(voc.competence(skill.id) ?? skill.id);
      if (typeof skill.spec === 'string') out.push(skill.spec);
    }
    if (typeof n.characteristic === 'string' && voc.carac[n.characteristic]) out.push(voc.carac[n.characteristic]);
    const diff = typeof n.difficulty === 'string' ? voc.difficultes[n.difficulty] : undefined;
    if (diff) out.push(diff, diff.replace(/\s*\(.*$/, ''));
    if (typeof n.targetDR === 'number') out.push(`${n.targetDR} DR`);
    out.push(MOT_DU_JET);
  };
  const effect = flow.effect as NoeudBrut;
  if (flow.kind === 'test') prendre(flow.test as NoeudBrut);
  if (flow.kind === 'do' && effect?.type === 'extendedTest') prendre(effect);
  const branches = [flow.then, flow.else, flow.success, flow.fail, flow.yes, flow.no];
  for (const suite of [flow.steps as NoeudBrut[] | undefined, branches as NoeudBrut[]]) {
    for (const s of suite ?? []) termesDuFlux(s, voc, out);
  }
  return out;
}

/** Mots-outils de l'épellation, que l'abréviation saute (« pistole d'argent » → « pa »). */
const MOTS_OUTILS = new Set(['de', 'd']);

/**
 * Termes qu'un `cost` INTERDIT à son libellé — ce que la puce de coût dira déjà : pour CHAQUE pièce
 * du montant, sa notation de puce, son épellation, le nombre suivi du nom de la pièce (« 4 sous »),
 * et suivi de son abréviation (initiales des mots de l'épellation : « 4 pa », « 1 co », « 4 sc ») ;
 * plus la notation du montant entier (« 6/8 »). Un nombre SANS rapport avec le montant ne lève rien.
 */
function termesDuCout(cost: unknown, voc: VocabulaireDuTag): string[] {
  if (!cost || typeof cost !== 'object') return [];
  const brut = cost as Partial<Montant>;
  const montant: Montant = { gold: brut.gold ?? 0, silver: brut.silver ?? 0, brass: brut.brass ?? 0 };
  const out = [voc.monnaie.formater(montant)];
  for (const piece of ['gold', 'silver', 'brass'] as const) {
    const n = montant[piece];
    if (!n) continue;
    const seul: Montant = { gold: 0, silver: 0, brass: 0, [piece]: n };
    const epele = voc.monnaie.epeler(seul);
    const mots = epele.replace(/^\s*\d+\s*/, '').split(/[\s'’]+/).filter((m) => m && !MOTS_OUTILS.has(cle(m)));
    out.push(voc.monnaie.formater(seul), epele);
    if (mots.length) out.push(`${n} ${mots[0]}`, `${n} ${mots.map((m) => m[0]).join('')}`);
  }
  return out;
}

/** Une réponse telle que la donnée la porte : son libellé, et ce dont la fenêtre dérive l'annonce. */
export interface ReponseBrute { label: string; flow?: unknown; cost?: unknown }

/** Le PREMIER terme annoncé (Test du flux, puis coût) que le libellé recopie, ou `undefined`. */
export function termeRecopie(reponse: ReponseBrute, voc: VocabulaireDuTag): string | undefined {
  return [...termesDuFlux(reponse.flow as NoeudBrut, voc), ...termesDuCout(reponse.cost, voc)]
    .find((terme) => contientLeTerme(reponse.label, terme));
}
