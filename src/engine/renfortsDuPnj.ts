/**
 * LES RENFORTS D'UN PNJ (#4916) : le modèle de carrière qu'il a suivi à son Niveau, son profil de héros, son rôle de
 * bête, chacun une entrée de `modeles-de-pnj.json`, portés sur sa fiche après son parcours de carrière. BNO p.4-5 ;
 * VO l.118, l.256, l.258-300.
 */
import type { Combatant } from './types';
import { CHAR_KEYS, type Characteristics } from './types';
import type { TraitInstance } from './statEntry';
import type { ParLocalisation } from './classementDeTrait';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { findModeleDePnjById, findTraitById, type ModeleDePnjData } from '../data';
import { acquerirTalent, talentAcquisitions, talentMaxById } from './acquisitionTalents';
import { applyTalentAcquisition } from './talentEffects';
import { augmenterLaCompetence } from './character';
import { blessuresReconciliees } from './characteristics';
import { contexteDeNaissanceDObjet } from './items';
import { doterLePorteur } from './bourse';
import { hashSeed, makeRNG } from './dice';
import { grantTrait } from './grantedTraits';
import { armureDuTrait } from './armourBypass';
import { synchroniserArmesDuProfil } from './creatureEquip';
import { garanti } from '../lib/garanti';

/** Les renforts qu'un auteur pose sur un PNJ du bestiaire (`SceneEntity`), chacun par l'id de son entrée. */
export interface RenfortsDuPnj {
  /** Un modèle de carrière (`kind: 'modele'`) et le Niveau atteint, de 1 à 4. */
  modele?: { id: string; niveau: number };
  /** Un profil de héros (`kind: 'heros'`). */
  heros?: string;
  /** Un rôle de bête (`kind: 'bete'`). */
  bete?: string;
}

/** Les renforts que porte `p`, `undefined` sans aucun. */
export function renfortsDe(p: { modeleDePnj?: Readonly<Record<string, number>>; profilDeHeros?: { id: string }; roleDeBete?: { id: string } }): RenfortsDuPnj | undefined {
  const [modele] = Object.entries(p.modeleDePnj ?? {});
  const r: RenfortsDuPnj = {
    ...(modele ? { modele: { id: modele[0], niveau: modele[1] } } : {}),
    ...(p.profilDeHeros ? { heros: p.profilDeHeros.id } : {}),
    ...(p.roleDeBete ? { bete: p.roleDeBete.id } : {}),
  };
  return Object.keys(r).length ? r : undefined;
}

/** L'entrée `id` de `modeles-de-pnj.json`, de la sorte `kind`. */
function entree<K extends ModeleDePnjData['kind']>(id: string, kind: K): Extract<ModeleDePnjData, { kind: K }> {
  const e = findModeleDePnjById(id);
  return garanti(e?.kind === kind ? (e as Extract<ModeleDePnjData, { kind: K }>) : undefined, id, `entrée « ${kind} » de modeles-de-pnj.json`);
}

/** Le Talent `ref` acquis jusqu'à `fois` acquisitions au plus, borné par son Maxi (`acquerirTalent`). LDB 10 l.18 */
function acquerirJusqua(c: Combatant, ref: RefDesignee, fois: number): void {
  for (let n = 0; n < fois && acquerirTalent(c, ref); n++) applyTalentAcquisition(c, ref.id, ref.spec);
}

/** `c.traits` (et `c.liveTraits`, même instance) où chaque Trait que `change` rend autre est remplacé. */
function remplacerLesTraits(c: Combatant, change: (t: TraitInstance) => TraitInstance | undefined): void {
  const remplaces = new Map<TraitInstance, TraitInstance>();
  for (const t of c.traits ?? []) {
    const neuf = change(t);
    if (neuf) remplaces.set(t, neuf);
  }
  if (!remplaces.size) return;
  c.traits = (c.traits ?? []).map((t) => remplaces.get(t) ?? t);
  if (c.liveTraits) c.liveTraits = c.liveTraits.map((t) => remplaces.get(t) ?? t);
}

/**
 * Le PNJ `c`, fiche du profil `imprime` en main (et son parcours de carrière déjà porté), porté à ses renforts `r`,
 * dans l'ordre modèle, héros, rôle de bête ; une Caractéristique « – » du profil (`imprime[k] === null`) ne reçoit
 * rien. Modèle au Niveau N (VO l.118) : +5×N à ses Caractéristiques et +5×N Augmentations à ses Compétences, chaque
 * Talent acquis N fois jusqu'à son Maxi, ses possessions et sa bourse dotées ; ses Traits facultatifs ne sont qu'une
 * suggestion. Héros (VO l.258-300) : ses modificateurs aux Caractéristiques, +N à chaque Trait Arme, +N au Trait
 * Armure (ou Armure N), ses Traits. Rôle de bête (VO l.256) : le bonus à sa Compétence, son Talent jusqu'à son Maxi.
 * Puis les Blessures recalées sur le profil (`blessuresReconciliees`). Mute `c`.
 */
export function porterAuxRenforts(c: Combatant, r: RenfortsDuPnj, imprime: Partial<Record<keyof Characteristics | 'M' | 'B', number | null>>): void {
  const imprimee = (k: keyof Characteristics) => imprime[k] != null;
  if (r.modele) {
    const m = entree(r.modele.id, 'modele');
    const n = r.modele.niveau;
    for (const k of m.caracteristiques ?? []) if (imprimee(k)) c.characteristics[k] += 5 * n;
    for (const ref of m.competences ?? []) augmenterLaCompetence(c.skills, ref, 5 * n);
    for (const ref of m.talents ?? []) acquerirJusqua(c, ref, n);
    const rng = makeRNG(hashSeed(`renforts:${c.id}:${m.id}`));
    let i = 0;
    const dote = doterLePorteur(m.dotations ?? [], rng, () => `${c.id}-modele-${i++}`, contexteDeNaissanceDObjet(c));
    c.items = [...(c.items ?? []), ...dote.items];
    if (dote.mentions) c.mentions = [...(c.mentions ?? []), ...dote.mentions];
  }
  if (r.heros) {
    const h = entree(r.heros, 'heros');
    for (const k of CHAR_KEYS) if (imprimee(k)) c.characteristics[k] += h.modificateurs?.[k] ?? 0;
    const arme = h.arme;
    if (arme) {
      remplacerLesTraits(c, (t) => (findTraitById(t.id)?.specsSource === 'weaponsMelee' ? { ...t, value: (t.value ?? 0) + arme } : undefined));
      synchroniserArmesDuProfil(c);
    }
    const armure = h.armure;
    if (armure) {
      const trait = armureDuTrait(c.traits);
      if (!trait) grantTrait(c, { id: 'armure', value: armure });
      else remplacerLesTraits(c, (t) => (t !== trait ? undefined : t.parLocalisation
        ? { ...t, parLocalisation: Object.fromEntries(Object.entries(t.parLocalisation).map(([loc, v]) => [loc, v + armure])) as ParLocalisation }
        : { ...t, value: (t.value ?? 0) + armure }));
    }
    for (const id of h.traits ?? []) if (!(c.traits ?? []).some((t) => t.id === id)) grantTrait(c, { id });
  }
  if (r.bete) {
    const b = entree(r.bete, 'bete');
    augmenterLaCompetence(c.skills, b.competence, b.bonus);
    const talent = b.talent;
    const fois = (talentMaxById(c, talent.id) ?? 1) - talentAcquisitions(c, talent.id);
    acquerirJusqua(c, talent, fois);
  }
  c.wounds = blessuresReconciliees(c);
}
