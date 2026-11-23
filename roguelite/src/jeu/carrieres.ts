/**
 * Les carrières : avancements et voies des lanceurs, joués par le noyau.
 */
import { coutDesAugmentations, planDuNiveau, talentDeCombat, progression, type EtapeDuPlan, type OffreDeCompetence, type Progression } from '../noyau';

import { COMPETENCES_UTILES, TALENTS_HORS_DU_COMBAT, voieDe } from './valeurs';
import { Etat, Heros } from './etat';
import { auNoyau, heros } from './outils';
import { prendreSesArmes } from './boutiques';

/** Le plus haut niveau de carrière que la salle d'armes ouvre (0 : fermée). */
export const niveauMaximal = (e: Etat): number => (e.batiments.salle ? e.batiments.salle + 1 : 0);


const estUtile = (ref: { id: string; spec?: string }): boolean => COMPETENCES_UTILES.has(ref.id) || COMPETENCES_UTILES.has(`${ref.id}:${ref.spec}`);

/** Les offres de la carrière du héros : chaque Compétence marquée `utile` (`COMPETENCES_UTILES`), la voie du lanceur
 *  réduite à sa spécialisation, et les seuls Talents qui agissent dans un combat automatique (`talentDeCombat`). */
export function offresDeCarriere(h: Heros): Omit<Progression, 'competences'> & { competences: (OffreDeCompetence & { utile: boolean })[]; talentAcquis: boolean } {
  const p = progression(h.c);
  const voie = voieDe(h.carriere, h.c);
  const talents = p.talents.flatMap((t) => {
    if (voie && t.ref.id === voie.talent) return t.ref.spec && t.ref.spec !== voie.spec ? [] : [{ ...t, ref: { id: voie.talent, spec: voie.spec }, label: voie.nom, aSpecifier: false }];
    return t.aSpecifier || !talentDeCombat(t.ref.id) || TALENTS_HORS_DU_COMBAT.has(t.ref.id) ? [] : [t];
  });
  return { ...p, competences: p.competences.map((k) => ({ ...k, utile: estUtile(k.ref) })), talentAcquis: p.talents.some((t) => t.possede > 0), talents: talents.filter((t, i, l) => l.findIndex((u) => u.ref.id === t.ref.id && u.ref.spec === t.ref.spec) === i) };
}

/** Le héros peut-il acheter un avancement maintenant (au hameau, salle d'armes ouverte, assez de PX pour la moins
 *  chère de ses Caractéristiques, de ses Compétences de carrière, ou son niveau suivant) ? */
export function peutProgresser(e: Etat, h: Heros): boolean {
  if (!niveauMaximal(e) || e.expedition?.groupe.includes(h.c.id)) return false;
  const p = progression(h.c);
  const couts = [...p.caracs.map((x) => x.cout), ...p.competences.map((x) => x.cout), ...(p.complet && p.suivant && p.suivant.niveau <= niveauMaximal(e) ? [p.suivant.cout] : [])];
  return couts.length > 0 && (h.c.xp ?? 0) >= Math.min(...couts);
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
  const refus = messageDuNoyau(auNoyau(e, h, [{ verbe, args }]), () => (h.c.xp ?? 0) < xp);
  if (!refus && a.genre === 'talent') prendreSesArmes(e, h);
  return refus;
}

/** `null` si le geste a pris (`pris`), sinon la ligne du noyau qui dit pourquoi. */
const messageDuNoyau = (ligne: string, pris: () => boolean): string | null => (pris() ? null : ligne || 'Le geste n’a rien changé.');

/** Ce qu'un pas achète au plus : cinq Augmentations. */
const PAS = 5;

export type CibleDuPas = { genre: 'carac'; id: string } | { genre: 'competence'; ref: { id: string; spec?: string } };
/** Ce qu'une suite d'achats a pris : combien de fois, les PX débités, et le refus du noyau qui l'a arrêtée. */
export interface Achete { fois: number; cout: number; refus: string | null }

/** Achète `a` jusqu'à `fois` fois, une par une par `acheter`, et s'arrête au premier refus. */
function repeter(e: Etat, h: Heros, a: Achat, fois: number): Achete {
  const xp = h.c.xp ?? 0;
  let n = 0;
  let refus: string | null = null;
  while (n < fois && !(refus = acheter(e, h.c.id, a))) n++;
  return { fois: n, cout: xp - (h.c.xp ?? 0), refus };
}

/** Ce que coûte un pas de `cible` au héros, `null` si sa carrière ne l'offre pas (`coutDesAugmentations`). */
export function prixDuPas(h: Heros, cible: CibleDuPas): number | null {
  const p = progression(h.c);
  if (cible.genre === 'carac') {
    const k = p.caracs.find((x) => x.id === cible.id);
    return k ? coutDesAugmentations(k.augmentations, PAS, 'caracteristique') : null;
  }
  const k = p.competences.find((x) => x.ref.id === cible.ref.id && (x.ref.spec ?? '') === (cible.ref.spec ?? ''));
  return k ? coutDesAugmentations(k.augmentations, PAS, 'competence', k.remise) : null;
}

/** Un pas : jusqu'à cinq Augmentations de `cible`, achetées une par une ; s'arrête net quand le noyau refuse. */
export function acheterUnPas(e: Etat, heroId: string, cible: CibleDuPas): Achete {
  const h = heros(e, heroId);
  return h ? repeter(e, h, cible, PAS) : { fois: 0, cout: 0, refus: 'Héros introuvable.' };
}

/** Le plan conseillé du niveau courant (`planDuNiveau`) : les Compétences utiles d'abord, un Talent de combat
 *  (`offresDeCarriere`) avant les autres ; chaque étape et son coût, et le total. */
export function planVersLeNiveau(h: Heros): { etapes: EtapeDuPlan[]; total: number } {
  const p = progression(h.c);
  const etapes = planDuNiveau({ ...p, talents: [...offresDeCarriere(h).talents, ...p.talents] }, estUtile);
  return { etapes, total: etapes.reduce((s, x) => s + x.cout, 0) };
}

/** Suit le plan conseillé dans l'ordre tant que le noyau accepte : les étapes prises (la dernière peut l'être en
 *  partie), les PX débités, et le refus qui l'a arrêté. */
export function suivreLePlan(e: Etat, heroId: string): { achats: EtapeDuPlan[]; cout: number; refus: string | null } {
  const h = heros(e, heroId);
  if (!h) return { achats: [], cout: 0, refus: 'Héros introuvable.' };
  const achats: EtapeDuPlan[] = [];
  for (const etape of planVersLeNiveau(h).etapes) {
    const r = repeter(e, h, etape, etape.fois);
    if (r.fois) achats.push({ ...etape, fois: r.fois, cout: r.cout });
    if (r.refus) return { achats, cout: achats.reduce((s, x) => s + x.cout, 0), refus: r.refus };
  }
  return { achats, cout: achats.reduce((s, x) => s + x.cout, 0), refus: null };
}
