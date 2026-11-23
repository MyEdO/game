import { describe, it, expect } from 'vitest';
import { ENTREES_DU_BANC, surUnBancHorsTest } from '../noyau/banc.testkit';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { groupeDeScenario } from '../scenes/test-scenarios/_heros';
import { testScene } from '../scenes/test-fixture';
import { emptyScene, type SceneEntity } from '../noyau/monde/scene';
import { appliquerLInstantane, instantaneDeLaCoop } from '../noyau/coop';
import { chargerLaSave, exporterLaSauvegarde, lireSave, snapshotSave } from '../noyau/persistance/save';
import { ciblePsy } from '../engine/psych/ciblage';
import { tenueDesJetons } from '../hote/partie';
import { nouvelEntete } from '../hote/partieDeTest';
import { creerPartie } from '../noyau/partie';
import { jouerUnGeste, type PartieRejouee } from './partieTexte';
import { BORNES, projeter, rendreLaVue, rendreLesChoix } from './vue';

describe('Colérique à l’hôte texte (#4017)', () => {
  it('pagine les choix connus et joue le nom déjà vu après avoir restauré la partie', () => {
    const { suspendue, choix, etapeId, cibleId, connueId } = surUnBancHorsTest((banc) => {
      const [lanceur, cible] = groupeDeScenario(idsDeTest, 'sorcier', 'soldat');
      lanceur.spells = [...(lanceur.spells ?? []), 'colerique'];
      banc.setState({ party: [lanceur, cible] });
      const scene = emptyScene('texte-colerique', 60, 16);
      const connue: SceneEntity = { id: 'pnj-cible-secrete', kind: 'personnage', creature: { id: 'humain' },
        label: 'Aurore vue de près', pos: { x: 7, y: 10 } };
      const embusquee: SceneEntity = { ...connue, id: 'pnj-embusque-test', label: 'Embusquée inconnue',
        pos: { x: 6, y: 11 }, combat: { hiddenUntilCombat: true } };
      const foule = Array.from({ length: 36 }, (_, i): SceneEntity => ({
        ...connue,
        id: `temoin-${i}`,
        label: `Témoin ${i}, observateur chargé de la réception dans la grande salle du conseil de la ville médiévale`,
        pos: { x: 7 + i % 6, y: 4 + Math.floor(i / 6) },
      }));
      scene.entities = [testScene().entities[0], ...foule, connue, embusquee];
      banc.getState().lancerLaScene(scene);
      const loin: SceneEntity = { ...connue, label: 'Identité secrète', pos: { x: 58, y: 13 } };
      const courante = banc.getState().scene!;
      banc.setState({ scene: { ...courante, entities: courante.entities.map((e) => (e.id === connue.id ? loin : e)) } });

      const sauver = lireSave(exporterLaSauvegarde(snapshotSave(banc.getState(), '2026-11-22T09:00:00Z')));
      if (typeof sauver === 'string') throw new Error(sauver);
      expect(chargerLaSave(sauver).etat.personnesVues[scene.id]?.[connue.id]).toBe(connue.label);

      banc.getState().incanterLeSort(lanceur.id, 'colerique', cible.id);
      banc.getState().jetLancer('incantation');
      const pc = banc.getState().pendingCast!;
      banc.setState({ pendingCast: { ...pc, result: { ...pc.result!, cast: true, sl: 2, isCritical: false, isFumble: false } } });
      banc.getState().jetValider('incantation');

      const etat = banc.getState();
      const invite = appliquerLInstantane(instantaneDeLaCoop(etat), etat).etat;
      const vue = projeter({ ...etat, ...invite }, 0, 0);
      const etape = vue.fenetre?.etape;
      expect(etape?.genre).toBe('personneChoisie');
      expect(etape?.choix).not.toContain(connue.id);
      const texte = rendreLaVue(vue).join('\n');
      expect(etape?.choix.length).toBeGreaterThan(30);
      expect(texte).toContain('verbes (pid');
      expect(texte).toContain('lire {"quoi":"choix"}');
      const pages: string[] = [];
      let depuis: number | undefined;
      for (let i = 0; i < 3; i++) {
        const lignes = rendreLesChoix(vue, depuis);
        expect(lignes).toHaveLength(Math.min(etape!.choix.length - (depuis ?? 0), BORNES.lignes.choix));
        expect(lignes.every((l) => l.length <= BORNES.largeur)).toBe(true);
        const page = lignes.join('\n');
        pages.push(page);
        const suivant = /"depuis":(\d+)/.exec(page);
        depuis = suivant ? Number(suivant[1]) : undefined;
        expect(depuis).toBe(i < 2 ? (i + 1) * BORNES.page : undefined);
      }
      const valeurs = pages.join('\n').split('\n').flatMap((l) => /^(personne\/\d+) = /.exec(l)?.[1] ?? []);
      expect(valeurs).toEqual(etape!.choix);
      const choix = valeurs.find((cle) => pages[2].includes(`${cle} = ${connue.label}`));
      expect(choix).toBeDefined();
      for (const secret of [connue.id, embusquee.id, embusquee.label, loin.label, '(58,13)', 'personnesEnOption']) {
        expect(`${texte}\n${pages.join('\n')}`).not.toContain(secret);
        expect(JSON.stringify(vue)).not.toContain(secret);
      }

      const suspendue = lireSave(exporterLaSauvegarde(snapshotSave(etat, '2026-11-22T09:04:00Z')));
      if (typeof suspendue === 'string') throw new Error(suspendue);
      return { suspendue, choix: choix!, etapeId: etape!.id, cibleId: cible.id, connueId: connue.id };
    });
    const partie = creerPartie(chargerLaSave(suspendue).etat, { ...ENTREES_DU_BANC, graine: 7 });
    const rejouee: PartieRejouee = {
      partie, jetons: tenueDesJetons(partie), entete: nouvelEntete('magie', { graine: 7 }), gestes: [], journal: [], reprises: [],
    };
    try {
      jouerUnGeste(rejouee, { type: 'jetRegler', args: ['cascade', 'choix', choix, etapeId] });
      jouerUnGeste(rejouee, { type: 'jetValider', args: ['cascade'] });
      expect(rejouee.gestes.map((g) => g.type)).toEqual(['jetRegler', 'jetValider']);
      const traits = partie.etat().party.find((c) => c.id === cibleId)!.psychTraits;
      expect(traits).toContainEqual({ type: 'prejuge', cible: ciblePsy.individu(connueId), src: { kind: 'sort', id: 'colerique' } });
    } finally {
      partie.fermer();
    }
  });
});
