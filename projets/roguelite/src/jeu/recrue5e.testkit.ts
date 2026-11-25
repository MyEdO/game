/**
 * Les héros de témoin : une recrue 5e, un Soldat recruté par le jeu (`recrue`, la création 5e du noyau sous les règles
 * du roguelite), posé au roster d'une partie dont la salle d'armes enseigne le niveau 3 ; un héros 4e nu du moteur
 * (`heros4e`) ; et le prix d'un plan de niveau au noyau (`prixDuPlanAuNoyau`).
 */
import { expect } from 'vitest';
import { ameliorer, nouvellePartie, recrue, PROFILS, type Etat, type Heros } from './index';
import type { EtapeDuPlan } from '../noyau';
import { buyCharAdvance, buySkillAdvance, coutDeLAugmentation } from '../../../../src/engine/advancement';
import { byId } from '../../../../src/data';
import type { CharKey, Combatant } from '../../../../src/engine/types';
import { createHero } from '../../../../src/engine/character';
import { fabriqueLocale } from '../../../../src/engine/fabriqueDId';

/** La partie et sa recrue 5e, `xp` PX à dépenser. */
export function recrue5e(xp: number): { e: Etat; h: Heros } {
  const e = nouvellePartie(7);
  e.or = 10_000; e.trophees = 10;
  expect(ameliorer(e, 'salle')).toBeNull();
  expect(ameliorer(e, 'salle')).toBeNull();
  const h = recrue(e, PROFILS.find((p) => p.id === 'soldat')!);
  h.c.xp = xp;
  expect(h.c.progression).toBe('5e');
  e.roster.push(h);
  return { e, h };
}

/** Un héros 4e de la carrière `carriere` créé par le moteur (`createHero`) à la graine `graine`, son Talent et ses Sorts
 *  mineurs d'identité, sans Augmentation de création, `xp` PX à dépenser. */
export function heros4e(carriere: string, graine: number, xp: number): Heros {
  const p = PROFILS.find((x) => x.id === carriere)!;
  const c = createHero({
    idNeuf: fabriqueLocale(`v${graine}`), speciesId: 'humains-reiklander', careerId: carriere, label: carriere, seed: graine, careerTalent: p.identite.talent,
    ...(p.identite.sortsMineurs ? { pettySpells: [...p.identite.sortsMineurs] } : {}),
  });
  return { c: { ...c, xp }, carriere, espece: 'humains-reiklander', expeditions: 0, victoires: 0 };
}

/** Ce que le noyau fait payer les étapes `etapes` d'un plan de `c` : chaque Augmentation au prix de
 *  `coutDeLAugmentation` sur une copie qui l'achète (`remises` : la remise de chaque Compétence, par `id:spec`), chaque
 *  Talent et le niveau suivant au coût de leur étape. */
export function prixDuPlanAuNoyau(c: Combatant, etapes: readonly EtapeDuPlan[], remises: ReadonlyMap<string, number>): number {
  const copie: Combatant = { ...structuredClone(c), xp: Number.MAX_SAFE_INTEGER };
  let total = 0;
  for (const x of etapes) {
    for (let i = 0; i < x.fois; i++) {
      if (x.genre === 'carac') {
        const prix = coutDeLAugmentation(copie, { kind: 'caracteristique', char: x.id }, true);
        total += prix.ok ? prix.cout : NaN;
        buyCharAdvance(copie, x.id);
      } else if (x.genre === 'competence') {
        const remise = remises.get(`${x.ref.id}:${x.ref.spec ?? ''}`) ?? 0;
        const prix = coutDeLAugmentation(copie, { kind: 'competence', competence: x.ref }, true, remise);
        total += prix.ok ? prix.cout : NaN;
        if (!copie.skills.some((s) => s.id === x.ref.id && s.spec === x.ref.spec)) copie.skills.push({ id: x.ref.id, spec: x.ref.spec, characteristic: byId('skill', x.ref.id)?.characteristic as CharKey, advances: 0 });
        buySkillAdvance(copie, x.ref, true, remise);
      } else total += x.cout;
    }
  }
  return total;
}
