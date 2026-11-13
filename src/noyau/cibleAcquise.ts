/**
 * LA CIBLE d'un Trait psy ACQUIS en cours de partie (ADE II 09 l.9, l.15) : le joueur qui tient le porteur la
 * choisit parmi les candidats à une étape `cibleAcquise` ; un porteur non surfacé prend celle par défaut. Les
 * Terreurs subies s'y mémorisent, et le Trait s'y pose, à l'étape comme d'office. #1463 #3045
 */
import type { Combatant } from '../engine/types';
import { followsCharacterRules } from '../engine/relations';
import { ciblesDePhobieDuNoir, traitAcquis, type CiblesAcquises, type PsychTrait, type TypeAcquis } from '../engine/psychology';
import { libelleDeCible, type CiblePsy } from '../engine/psych/ciblage';
import { desactiverLAfflictionSansTrait, grantPsychTrait } from '../engine/grantedTraits';
import { groupesPercus, type PorteurDeGroupes } from '../engine/groups';
import { rule } from '../engine/policy';
import { COND } from '../engine/conditions';
import { psychologyLabel } from '../data';
import { t } from '../i18n';
import type { Get, Set } from './flowTypes';
import { pushStep } from './cascade';
import { choiceStep, surfaceOf } from './rollSeam';
import { revealPurpose } from './combatEffects';
import { nomDIndividu } from './monde/sceneNpc';
import { nomDe } from '../engine/nom';

/** Pose sur `c` le Trait acquis envers `cible` (`traitAcquis`, `grantPsychTrait`), en retire ceux qu'il remplace
 *  de sa fiche comme des suspensions de ses effets, désactive leur affliction (`desactiverLAfflictionSansTrait`),
 *  et rend la ligne de journal. */
export function poserLeTraitAcquis(get: Get, c: Combatant, type: TypeAcquis, cible: CiblePsy): string {
  const acquis = traitAcquis(c, type, cible);
  const garder = (l: readonly PsychTrait[]) => l.filter((p) => !acquis.remplace.includes(p));
  c.psychTraits = garder(c.psychTraits ?? []);
  for (const e of c.activeEffects ?? []) if (e.suppressedPsych) e.suppressedPsych = garder(e.suppressedPsych);
  for (const p of acquis.remplace) desactiverLAfflictionSansTrait(c, p);
  grantPsychTrait(c, acquis.type, cible);
  const groupe = libelleDeCible(cible, nomDIndividu(get()));
  return t(type === 'phobie' ? 'cf.phobieAcquise' : acquis.type === 'haine' ? 'cs.haineGain' : 'cs.animositeGain', { name: nomDe(c), groupe });
}

/** Le Trait `type` que `c` acquiert : à choisir à une étape `cibleAcquise`, ajoutée à la séquence d'accueil,
 *  quand plusieurs Cibles s'offrent à un porteur surfacé (`surfaceOf`) — rend `null`, l'étape posera le Trait —,
 *  sinon posé d'office envers la Cible par défaut — rend sa ligne de journal. Une Phobie vide les Terreurs
 *  subies dès qu'elle est acquise. ADE II 09 l.11 */
export function acquerirLeTrait(get: Get, set: Set, c: Combatant, type: TypeAcquis, cibles: CiblesAcquises): string | null {
  if (type === 'phobie') c.terreursSubies = [];
  if (cibles.candidats.length < 2 || !surfaceOf(get, c.id)) return poserLeTraitAcquis(get, c, type, cibles.parDefaut);
  const nom = nomDIndividu(get());
  pushStep(set, (i) => choiceStep({
    id: `cibleAcquise-${c.id}-${i}`,
    kind: 'cibleAcquise', actorId: c.id, icon: 'mecanique/psychologie',
    label: t('step.cibleAcquise', { name: nomDe(c) }),
    options: cibles.candidats.map((cible) => ({ key: cible, label: libelleDeCible(cible, nom), detail: psychologyLabel(traitAcquis(c, type, cible).type) })),
    defaultChoice: cibles.parDefaut,
    meta: { psychAcquis: type },
  }), revealPurpose('sequence', false));
  return null;
}

/** SEUL point d'écriture d'une Terreur subie, appelé par chaque site qui applique l'État d'échec d'une Terreur
 *  (`inflige` : l'État et son nombre) : mémorise sur `c`, s'il suit les règles de Personnage (`followsCharacterRules`), les États Brisé
 *  infligés et les Groupes perçus de sa `cause` (aucun sans cause), règle `psycho-acquisition-optionnelle` allumée,
 *  puis acquiert la Phobie du noir qu'offre la mémoire (`ciblesDePhobieDuNoir`) ; rend la ligne d'une Phobie
 *  posée d'office. ADE II 09 l.5, l.9 ; #3045 */
export function subirLaTerreur(get: Get, set: Set, c: Combatant, inflige: { etat?: string; nombre: number }, cause: PorteurDeGroupes | undefined): string | null {
  if (inflige.etat !== COND.brise || inflige.nombre <= 0 || !followsCharacterRules(c) || !rule('psycho-acquisition-optionnelle')) return null;
  c.terreursSubies = [...(c.terreursSubies ?? []), { brise: inflige.nombre, groupes: cause ? groupesPercus(cause) : [] }];
  const cibles = ciblesDePhobieDuNoir(c, c.terreursSubies);
  return cibles ? acquerirLeTrait(get, set, c, 'phobie', cibles) : null;
}
