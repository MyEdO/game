/**
 * Un refus de la porte HORS schéma, rendu à l'écran (`refusDeLaPorteDuProjet`, `refusDeLaPorte.ts`) : contrat déclaré,
 * la phrase de sa CAUSE sous le verbe du geste, la conséquence que le geste énonce s'il en a une, le rapport en
 * `detail` ; toute autre erreur remonte telle quelle.
 */
import { describe, it, expect } from 'vitest';
import { refusDeLaPorteDuProjet } from './refusDeLaPorte';
import { refusDeForme } from '../worldMap';
import { exigerUnProjetJouable } from '../validateScene';
import { testScene } from '../../scenes/test-fixture';

const sansDepart = () => refusDeForme('entree', ['startSceneId'], 'scène de départ « x » absente du projet');

describe('refusDeLaPorteDuProjet — causes hors schéma', () => {
  it('geste qui énonce sa conséquence : verbe, conséquence, puis la phrase de la cause', () => {
    const e = sansDepart();
    expect(refusDeLaPorteDuProjet(e, 'enregistrement')).toEqual({
      message: 'Enregistrement refusé : ce projet ne pourrait plus être rouvert. Sa scène de départ n’existe pas dans le projet.',
      detail: e.message,
    });
  });

  it('geste qui relit (sans conséquence) : le verbe, puis la cause en une phrase', () => {
    expect(refusDeLaPorteDuProjet(sansDepart(), 'ouverture').message).toBe('Ouverture refusée : sa scène de départ n’existe pas dans le projet.');
  });

  it('validation : la conséquence, puis la première faute à sa scène et son fautif, les suivantes comptées', () => {
    const scene = testScene();
    const action = (id: string) => ({ id, flow: { kind: 'sequence', etapes: [] } });
    scene.entities = [...scene.entities, { id: 'autel', kind: 'prop', decor: { id: 'autel' }, pos: { x: 8, y: 7 }, usable: { actions: [action('chute'), action('glissade')] } } as never];
    let refus: unknown;
    try { exigerUnProjetJouable([scene]); } catch (e) { refus = e; }
    const rendu = refusDeLaPorteDuProjet(refus, 'test');
    expect(rendu.message).toBe('Mise à l’essai refusée : ce projet ne pourrait pas être joué. Faute : scène « test-fixture » — entité « autel » › '
      + 'utilisable › actions « chute » › libellé : libellé requis : aucun libellé du catalogue ne nomme cet identifiant d’action. (et 1 autre à corriger)');
  });

  it('une erreur qui n’est pas un refus de la porte remonte', () => {
    const autre = new TypeError('panne');
    expect(() => refusDeLaPorteDuProjet(autre, 'export')).toThrow(autre);
  });
});
