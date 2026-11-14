/**
 * LES GESTES D'UN OBJET (#3328, `gestesDeLObjet`) : chaque geste n'existe que pour l'objet qu'il touche, et se ferme
 * par le verdict que son verbe applique : en combat, `refusDInventaire` ; l'Évaluation et la Détection, `refusDEvaluation`
 * (le délai maison après une Évaluation manquée, `marche-evaluation-delai-jours` ; une tentative par détecteur, LDB 10 l.336) ;
 * poser au sol, une scène où le poser (`refusDePoser`) ; le geste présent et refusé, sa raison dite.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { gestesDeLObjet } from './gestesDeLObjet';
import { appraiseRefus, refusDeDetection } from './merchantFlow';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { MINUTES_PER_DAY } from '../engine/clock';
import { t } from '../i18n';
import type { Jeu } from './etat';

/** Deux pré-tirés hors combat, au jour 3 ; `rosa`, la seconde, porte un objet non identifié (`inconnu`). */
function partie(inconnu: { appraiseTriedDay?: number; detectTriedBy?: string[] } = {}) {
  const party = groupeDeScenario(idsDeTest, 'soldat', 'apothicaire');
  const rosa = party[1];
  const pilon = rosa.items!.find((i) => i.label === 'Pilon et Mortier')!;
  Object.assign(pilon, { identified: false, ...inconnu });
  const s: Pick<Jeu, 'battle' | 'party' | 'possessions' | 'gameTime' | 'scene'> = { battle: null, party, possessions: [], gameTime: 3 * MINUTES_PER_DAY + 10, scene: null };
  return { s, rosa, uid: (label: string) => rosa.items!.find((i) => i.label === label)!.uid };
}

describe('les gestes d’un objet', () => {
  it('chacun pour l’objet qu’il touche, ouvert hors combat', () => {
    const { s, rosa, uid } = partie();
    const justaucorps = gestesDeLObjet(s, rosa.id, uid('Justaucorps de cuir'))!;
    expect([justaucorps.porter, justaucorps.mains, justaucorps.utiliser], 'une armure se porte, ne se tient ni ne s’utilise')
      .toEqual([{ porte: true, refus: null, geste: { verbe: 'equiperLObjet', args: [uid('Justaucorps de cuir')] } }, null, null]);
    const dague = gestesDeLObjet(s, rosa.id, uid('Dague'))!;
    expect([dague.porter, dague.mains?.main], 'une arme se tient ; tenue en main principale, son geste la lâche')
      .toEqual([null, { tenue: true, refus: null, geste: { verbe: 'garnirLaPanoplie', args: [rosa.id, dague.mains!.set, 'main', null] } }]);
    expect(dague.donner?.choix.map((c) => c.geste), 'elle se donne à l’autre héros').toEqual([{ verbe: 'transmettreLObjet', args: [uid('Dague'), s.party[0].id] }]);
    const pilon = gestesDeLObjet(s, rosa.id, uid('Pilon et Mortier'))!;
    expect([pilon.evaluer, pilon.detecter], 'un objet non identifié s’évalue et se détecte, au verdict de l’Évaluation').toEqual([
      { refus: appraiseRefus(s.party), geste: { verbe: 'evaluerLObjet', args: [uid('Pilon et Mortier')] } },
      { refus: refusDeDetection(s.party, rosa.items!.find((i) => i.label === 'Pilon et Mortier')!), geste: { verbe: 'evaluerLObjet', args: [uid('Pilon et Mortier'), 'detection'] } },
    ]);
    expect(dague.poser, 'tout objet se pose, refusé sans sol où le poser')
      .toEqual({ refus: t('pf.poserSansScene', { item: 'Dague' }), geste: { verbe: 'poserLObjet', args: [uid('Dague')] } });
    expect(gestesDeLObjet(s, rosa.id, 'personne'), 'sans l’objet, aucun geste').toBeNull();
  });

  it('l’Évaluation manquée ce jour et la Détection tentée par chaque détecteur restent offertes, fermées, et le disent', () => {
    const { s, rosa, uid } = partie({ appraiseTriedDay: 3 });
    rosa.talents = [...(rosa.talents ?? []), { talentId: 'detection-d-artefact', times: 1 }];
    rosa.items!.find((i) => i.label === 'Pilon et Mortier')!.detectTriedBy = [rosa.id];
    const pilon = gestesDeLObjet(s, rosa.id, uid('Pilon et Mortier'))!;
    expect([pilon.evaluer, pilon.detecter?.refus]).toEqual([
      { refus: t('mf.evaluationARetenter', { label: 'Pilon et Mortier', jours: 1 }), geste: { verbe: 'evaluerLObjet', args: [uid('Pilon et Mortier')] } },
      t('mf.detectionDejaTentee', { label: 'Pilon et Mortier' }),
    ]);
    const veille = partie({ appraiseTriedDay: 2 });
    expect(gestesDeLObjet(veille.s, veille.rosa.id, veille.uid('Pilon et Mortier'))!.evaluer, 'tentée la veille, elle s’offre').toEqual({ refus: appraiseRefus(veille.s.party), geste: { verbe: 'evaluerLObjet', args: [veille.uid('Pilon et Mortier')] } });
  });

  it('en combat, chacun se refuse par le verdict de l’inventaire', () => {
    const { s, rosa, uid } = partie();
    const enCombat = { ...s, battle: {} as NonNullable<Jeu['battle']> };
    const g = gestesDeLObjet(enCombat, rosa.id, uid('Potion de guérison'))!;
    expect([g.utiliser?.refus, g.ranger?.refus, g.donner?.refus, g.poser.refus]).toEqual(Array(4).fill(t('pf.inventoryLocked')));
  });
});
