/**
 * LE CHOIX D'UN SCÉNARIO DE TEST (#3786), commun aux hôtes du noyau, avant toute partie : chaque section du catalogue
 * (`SCENARIO_SECTIONS`) qui en range un en entité, et chacun de ses scénarios (`testScenarios`, dans leur ordre) en
 * entité : ce qu'il vérifie, le groupe qu'il fixe, et le bouton qui le démarre (`{ scenario }`).
 */
import { t } from '../i18n';
import { coupeAuMot } from '../lib/coupeAuMot.mjs';
import { testScenarios } from '../scenes/test-scenarios';
import { SCENARIO_SECTIONS, type TestScenario } from '../scenes/test-scenarios/_shared';
import { ligne, type Bouton, type Entite } from './elements';

/** Les zones du choix d'un scénario : sous `scenarios.sections`, une entité par section. */
export interface ZonesDesScenarios {
  'scenarios.sections': Entite[];
}

/** Les caractères au plus de ce qu'un scénario vérifie, dit sur sa carte ; le texte entier va au détail. */
const TESTS_A_LA_CARTE = 120;

/** Le scénario `sc` en entité : son titre, ce qu'il vérifie (coupé au mot, entier au détail) et son groupe, et son
 *  lancement. */
function entiteDuScenario(sc: TestScenario): Entite {
  const lancer: Bouton = { type: 'bouton', id: `lancer/${sc.id}`, libelle: t('ecran.scenarios.lancer'), jeu: { scenario: sc.id }, presse: false, focus: false, refus: null };
  return { type: 'entite', id: sc.id, ton: 'neutre', nom: sc.title, elements: [ligne('fiche', `${coupeAuMot(sc.tests, TESTS_A_LA_CARTE)}\n${sc.partyNote}`, 'neutre', sc.tests), lancer] };
}

/** Les zones du choix d'un scénario de test. */
export function zonesDesScenarios(): ZonesDesScenarios {
  return {
    'scenarios.sections': SCENARIO_SECTIONS.flatMap((s): Entite[] => {
      const scenarios = testScenarios.filter((sc) => sc.category === s.key);
      return scenarios.length ? [{ type: 'entite', id: `section/${s.key}`, ton: 'neutre', nom: s.label, elements: scenarios.map(entiteDuScenario) }] : [];
    }),
  };
}
