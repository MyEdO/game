/**
 * Les carrières : avancements et voies des lanceurs, joués par le noyau.
 */
import { talentDeCombat, progression, type Progression } from '../noyau';

import { voieDe } from './valeurs';
import { Etat, Heros } from './etat';
import { auNoyau, heros } from './outils';

/** Le plus haut niveau de carrière que la salle d'armes ouvre (0 : fermée). */
export const niveauMaximal = (e: Etat): number => (e.batiments.salle ? e.batiments.salle + 1 : 0);


/** Les Talents qui agissent par la donnée mais hors d'un combat automatique : vie sociale, voyage, fuite, soins. */
const TALENTS_HORS_DU_COMBAT: ReadonlySet<string> = new Set(['affable', 'studieux', 'voyageur-aguerri', 'fuite', 'sprinter', 'pansement-de-fortune']);

/** Les offres de la carrière du héros : la voie du lanceur réduite à sa spécialisation, et les seuls Talents qui
 *  agissent dans un combat automatique (`talentDeCombat`). */
export function offresDeCarriere(h: Heros): Progression & { talentAcquis: boolean } {
  const p = progression(h.c);
  const voie = voieDe(h.carriere);
  const talents = p.talents.flatMap((t) => {
    if (voie && t.ref.id === voie.talent) return t.ref.spec && t.ref.spec !== voie.spec ? [] : [{ ...t, ref: { id: voie.talent, spec: voie.spec }, label: voie.nom, aSpecifier: false }];
    return t.aSpecifier || !talentDeCombat(t.ref.id) || TALENTS_HORS_DU_COMBAT.has(t.ref.id) ? [] : [t];
  });
  return { ...p, talentAcquis: p.talents.some((t) => t.possede > 0), talents: talents.filter((t, i, l) => l.findIndex((u) => u.ref.id === t.ref.id && u.ref.spec === t.ref.spec) === i) };
}

export type Achat = { genre: 'carac'; id: string } | { genre: 'competence' | 'talent'; ref: { id: string; spec?: string } } | { genre: 'niveau' } | { genre: 'sort'; id: string };

export function acheter(e: Etat, id: string, a: Achat): string | null {
  const h = heros(e, id);
  if (!h) return 'Héros introuvable.';
  if (!niveauMaximal(e)) return 'La salle d’armes est fermée.';
  if (e.expedition?.groupe.includes(id)) return 'Ce héros est en expédition.';
  const verbe = { carac: 'acheterLaCaracteristique', competence: 'acheterLaCompetence', talent: 'acheterLeTalent', niveau: 'changerDeCarriere', sort: 'acheterLeSort' }[a.genre];
  if (a.genre === 'niveau') {
    const suivant = progression(h.c).suivant;
    if (!suivant) return 'Sommet de la carrière.';
    if (suivant.niveau > niveauMaximal(e)) return 'La salle d’armes n’enseigne pas encore ce niveau.';
    return messageDuNoyau(auNoyau(e, h, [{ verbe, args: [h.c.id, h.carriere, suivant.niveau] }]), () => (h.c.careerLevel ?? 1) === suivant.niveau);
  }
  const xp = h.c.xp ?? 0;
  const args = a.genre === 'carac' || a.genre === 'sort' ? [h.c.id, a.id] : [h.c.id, a.ref];
  return messageDuNoyau(auNoyau(e, h, [{ verbe, args }]), () => (h.c.xp ?? 0) < xp);
}

/** `null` si le geste a pris (`pris`), sinon la ligne du noyau qui dit pourquoi. */
const messageDuNoyau = (ligne: string, pris: () => boolean): string | null => (pris() ? null : ligne || 'Le geste n’a rien changé.');
