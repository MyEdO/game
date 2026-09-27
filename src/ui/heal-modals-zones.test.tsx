// @vitest-environment jsdom
/**
 * #1078 LOT B2 — ZONES des fenêtres de SOIN, contrat POSITIF mesuré à l'ÉCRAN (montage réel, patron
 * `createRoot`/`act` du repo) sur les DEUX hôtes : la modale de Guérison (`HealModal`) et le
 * dossier d'opération de l'infirmerie (`MedicModal` → `useSurgeryJetProps`).
 *  - la DIFFICULTÉ se lit à UNE seule place, la LIGNE du jet (`.rm-roll-diff`, #1072) ;
 *  - l'A→B est le bandeau `VsHeader` (portraits + flèche annotée de l'acte) quand le soignant EST un
 *    `Combatant` ; face à un PNJ tarifé (aucune fiche), l'acte reste lisible en note, sans bandeau ;
 *  - le patient y est en cadre `full` : ses pastilles d'ÉTATS sont ce que le jet fait bouger ;
 *  - EMBARQUÉ dans l'infirmerie, aucun bandeau : la bande de patients le porte déjà ;
 *  - EMBARQUÉ, les gestes du jet sont au pied de la boîte des soins, jamais dans son corps
 *    (`docs/charte-ui.md`, `.cadre-pied`).
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { HealModal } from './HealModal';
import { MedicModal } from './MedicModal';
import { DIFFICULTY_LABELS, type Combatant } from '../engine/types';
import { resetDismissLayers } from './useDismissLayer';
import { useGameKeyboard } from './useGameKeyboard';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, over: Partial<Combatant> = {}): Combatant =>
  ({ id, name: id, label: id, kind: 'hero', characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 12, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  useGame.setState({ battle: null, party: [], pendingHeal: null, pendingSurgery: null, medic: null } as never);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, party: [], pendingHeal: null, pendingSurgery: null, medic: null } as never);
});

/** Ce qu'un joueur LIT dans la fenêtre, espaces normalisés. */
const screen = () => (host.textContent ?? '').replace(/\s+/g, ' ');
const occurrences = (needle: string) => screen().split(needle).length - 1;
/** Texte de la zone de Difficulté de la ligne de jet. */
const diffZone = () => [...host.querySelectorAll('.rm-roll-diff')].map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim());

const DIFF = 'accessible' as const;
const LABEL = DIFFICULTY_LABELS[DIFF]; // « Accessible (+20) »

describe('Guérison (HealModal) — la Difficulté vit sur la LIGNE', () => {
  it('elle se lit UNE fois, et c’est dans `.rm-roll-diff`', () => {
    const healer = mk('Soigneur');
    const patient = mk('Blessé');
    useGame.setState({
      battle: null, party: [healer, patient],
      pendingHeal: {
        healerId: healer.id, healerName: healer.label, targetId: patient.id, targetName: patient.label,
        mode: 'wounds', intBonus: 4, skillValue: 45, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
      },
    } as never);
    act(() => root.render(<HealModal />));
    expect(diffZone(), 'la ligne du jet porte la Difficulté').toEqual([LABEL]);
    expect(occurrences(LABEL), 'et elle ne se lit nulle part ailleurs').toBe(1);
    // A→B CANONIQUE (décision utilisateur 2026-08-04) : bandeau de portraits + flèche annotée de
    // l'acte — aucune phrase « A soigne B » ne subsiste dans la fenêtre.
    const vs = host.querySelectorAll('.rm-vs');
    expect(vs, 'un bandeau d’opposition, un seul').toHaveLength(1);
    expect(vs[0].children, 'A → B : les deux portraits encadrent la flèche').toHaveLength(3);
    expect(vs[0].querySelector('.rm-vs-arrow')?.textContent, 'la flèche annonce l’acte').toContain('Blessures');
    expect(screen(), 'plus aucun A→B TEXTUEL').not.toMatch(/soigne |rééduque |opère /);
  });
});

describe('fenêtre de Guérison — le patient montre ses ÉTATS, et une seule fois', () => {
  const bleeding = () => mk('Blessé', { conditions: [{ id: 'hemorragique', value: 2 }] } as never);
  const put = (patient: Combatant, healer: Combatant | null) => {
    useGame.setState({
      battle: null, party: healer ? [healer, patient] : [patient],
      pendingHeal: {
        healerId: healer?.id ?? 'pnj-soigneur', healerName: healer?.label ?? 'Médecin',
        targetId: patient.id, targetName: patient.label,
        mode: 'bleed', intBonus: 4, skillValue: 45, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
      },
    } as never);
  };

  it('mode `bleed` : les pastilles d’ÉTATS du patient sont visibles (cadre `full`)', () => {
    const patient = bleeding();
    put(patient, mk('Soigneur'));
    act(() => root.render(<HealModal />));
    const vs = host.querySelector('.rm-vs')!;
    expect(vs.querySelectorAll('.ptile-states').length, 'le CIBLÉ porte ses États').toBeGreaterThan(0);
    expect(vs.querySelectorAll('.pt-state').length, 'l’Hémorragie se suit passe par passe').toBeGreaterThan(0);
  });

  it('EMBARQUÉ dans l’infirmerie : aucun bandeau (la bande de patients porte déjà le patient)', () => {
    const patient = bleeding();
    put(patient, mk('Soigneur'));
    useGame.setState({ medic: { patientId: patient.id } } as never);
    act(() => root.render(<MedicModal />));
    expect(host.querySelectorAll('.rm-vs'), 'pas de second portrait du patient').toHaveLength(0);
  });
});

describe('Guérison par un PNJ tarifé — pas d’A→B sans fiche', () => {
  it('soigneur PNJ (id sentinelle, absent du groupe) : aucun bandeau, mais l’acte reste lisible', () => {
    const patient = mk('Blessé');
    useGame.setState({
      battle: null, party: [patient],
      pendingHeal: {
        healerId: 'pnj-soigneur', healerName: 'Médecin', targetId: patient.id, targetName: patient.label,
        mode: 'wounds', intBonus: 4, skillValue: 45, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
      },
    } as never);
    act(() => root.render(<HealModal />));
    expect(host.querySelectorAll('.rm-vs'), 'pas d’A→B sans acteur à opposer').toHaveLength(0);
    expect(screen(), 'l’acte et le patient se disent quand même').toContain('Blessures — Blessé');
  });
});

describe('Chirurgie (MedicModal → useSurgeryJetProps) — la Difficulté vit sur la LIGNE', () => {
  it('elle se lit UNE fois, et c’est dans `.rm-roll-diff`', () => {
    const surgeon = mk('Chirurgien');
    const patient = mk('Opéré', { traumas: [{ label: 'Fracture', location: 'brasG', surgery: true }] } as never);
    useGame.setState({
      battle: null, party: [surgeon, patient],
      medic: {
        patientId: patient.id,
        surgery: { kind: 'surgery', difficulty: DIFF, healerId: surgeon.id, healerName: surgeon.label, skill: 45, intBonus: 4, traumaIdx: 0, targetDR: 6, cumDR: 2 },
      },
      pendingSurgery: {
        healerId: surgeon.id, healerName: surgeon.label, targetId: patient.id, targetName: patient.label,
        kind: 'surgery', skillValue: 45, intBonus: 4, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
        traumaIdx: 0, targetDR: 6, cumDR: 2,
      },
    } as never);
    act(() => root.render(<MedicModal />));
    expect(diffZone(), 'la ligne de la passe porte la Difficulté').toEqual([LABEL]);
    expect(occurrences(LABEL), 'et elle ne se lit nulle part ailleurs').toBe(1);
  });
});

describe('dossier d’opération — l’A→B n’est rendu que s’il EXISTE', () => {
  const patient = () => mk('Opéré', { traumas: [{ label: 'Fracture', location: 'brasG', surgery: true }] } as never);
  /** Ouvre le dossier d'opération d'un patient, le chirurgien étant du GROUPE ou un PNJ tarifé
   *  (`healerId` sentinelle posé par `medicFlow.medicAct`, absent du groupe). */
  const openSurgery = (healerId: string, party: Combatant[]) => {
    useGame.setState({
      battle: null, party, pendingSurgery: null,
      medic: {
        patientId: party[party.length - 1].id,
        surgery: { kind: 'surgery', difficulty: DIFF, healerId, healerName: 'Docteur', skill: 45, intBonus: 4, traumaIdx: 0, targetDR: 6, cumDR: 2 },
      },
    } as never);
    act(() => root.render(<MedicModal />));
  };

  it('chirurgien du GROUPE : bandeau A→B complet (les deux portraits, l’acte annoncé)', () => {
    const surgeon = mk('Chirurgien');
    const p = patient();
    openSurgery(surgeon.id, [surgeon, p]);
    const vs = host.querySelectorAll('.rm-vs');
    expect(vs, 'un seul bandeau d’opposition').toHaveLength(1);
    // Bandeau COMPLET = portrait A + flèche annotée + portrait B (les `CharFrame` de `VsHeader`
    // rendent la vitalité, pas les noms — la structure est ce qui se mesure).
    expect(vs[0].children, 'A → B : les deux portraits encadrent la flèche').toHaveLength(3);
    expect(vs[0].querySelector('.rm-vs-arrow')?.textContent?.replace(/\s+/g, ' '), 'l’acte est annoncé sur la flèche').toContain('Chirurgie');
  });

  it('PNJ tarifé (aucune fiche) : AUCUN bandeau dégénéré, mais l’acte reste lisible', () => {
    const p = patient();
    openSurgery('pnj-soigneur', [p]);
    expect(host.querySelectorAll('.rm-vs'), 'pas d’A→B sans acteur à opposer').toHaveLength(0);
    expect(screen(), 'l’acte et le patient se disent quand même').toContain('Chirurgie — Opéré');
  });
});

describe('infirmerie — les gestes du jet posé sont au PIED de la boîte des soins', () => {
  /** Textes des boutons d'une zone, dans l'ordre du document. */
  const gestes = (zone: Element | null) => [...(zone?.querySelectorAll('button') ?? [])].map((b) => (b.textContent ?? '').trim());
  const boite = () => host.querySelector('.modal')!;
  const piedsDeLaBoite = () => boite().querySelectorAll('.cadre-pied');
  const corps = () => boite().querySelector('.modal-body');

  it('jet de soin posé : un seul pied, « Annuler » au début, « Lancer » à la fin ; aucun geste dans le corps', () => {
    const healer = mk('Soigneur');
    const patient = mk('Blessé');
    useGame.setState({
      battle: null, party: [healer, patient], medic: { patientId: patient.id },
      pendingHeal: {
        healerId: healer.id, healerName: healer.label, targetId: patient.id, targetName: patient.label,
        mode: 'wounds', intBonus: 4, skillValue: 45, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
      },
    } as never);
    act(() => root.render(<MedicModal />));
    expect(piedsDeLaBoite(), 'la boîte n’a qu’un pied').toHaveLength(1);
    expect(gestes(piedsDeLaBoite()[0]), 'le pied porte les gestes du jet').toEqual(['Annuler', 'Lancer']);
    expect(corps()?.querySelectorAll('.cadre-pied'), 'aucun pied ne défile dans le corps').toHaveLength(0);
  });

  it('passe de Chirurgie posée : « Annuler » (la passe) au début, « Lancer » à la fin, au pied de la boîte', () => {
    const surgeon = mk('Chirurgien');
    const patient = mk('Opéré', { traumas: [{ label: 'Fracture', location: 'brasG', surgery: true }] } as never);
    useGame.setState({
      battle: null, party: [surgeon, patient],
      medic: {
        patientId: patient.id,
        surgery: { kind: 'surgery', difficulty: DIFF, healerId: surgeon.id, healerName: surgeon.label, skill: 45, intBonus: 4, traumaIdx: 0, targetDR: 6, cumDR: 2 },
      },
      pendingSurgery: {
        healerId: surgeon.id, healerName: surgeon.label, targetId: patient.id, targetName: patient.label,
        kind: 'surgery', skillValue: 45, intBonus: 4, difficulty: DIFF, target: 65, roll: null, success: false, sl: 0,
        traumaIdx: 0, targetDR: 6, cumDR: 2,
      },
    } as never);
    act(() => root.render(<MedicModal />));
    expect(piedsDeLaBoite(), 'la boîte n’a qu’un pied').toHaveLength(1);
    expect(gestes(piedsDeLaBoite()[0]), 'le pied porte les gestes de la passe').toEqual(['Annuler', 'Lancer']);
    expect(corps()?.querySelectorAll('.cadre-pied'), 'aucun pied ne défile dans le corps').toHaveLength(0);
  });
});

describe('infirmerie — Échap annule le jet posé, jamais l’opération qui l’englobe', () => {
  const Clavier = () => { useGameKeyboard(); return null; };
  let clavier: { hote: HTMLDivElement; root: Root };
  beforeEach(() => {
    resetDismissLayers();
    const hote = document.createElement('div');
    document.body.appendChild(hote);
    clavier = { hote, root: createRoot(hote) };
    act(() => clavier.root.render(<Clavier />));
  });
  afterEach(() => {
    act(() => clavier.root.unmount());
    clavier.hote.remove();
    resetDismissLayers();
  });
  const echap = () => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); });
  const gestesDuPied = () => [...(host.querySelector('.modal > .cadre-pied')?.querySelectorAll('button') ?? [])];

  it('passe posée sur une opération qui a cumulé : Échap rend l’opération armée, cumul et patient intacts', () => {
    const surgeon = mk('Chirurgien');
    const patient = mk('Opéré', { traumas: [{ label: 'Fracture', location: 'brasG', surgery: true }] } as never);
    const operation = { kind: 'surgery', difficulty: DIFF, healerId: surgeon.id, healerName: surgeon.label, skill: 45, intBonus: 4, traumaIdx: 0, targetDR: 6, cumDR: 3, last: { roll: 12, sl: 3 } };
    useGame.setState({
      screen: 'campaign', mode: 'exploration', gameMenuOpen: false, dialogue: null, battle: null,
      party: [surgeon, patient], pendingHeal: null, pendingSurgery: null,
      medic: { patientId: patient.id, surgery: operation },
    } as never);
    act(() => root.render(<MedicModal />));
    act(() => useGame.getState().openSurgeryPass());
    expect(useGame.getState().pendingSurgery, 'la passe est posée').not.toBeNull();

    echap();

    const st = useGame.getState();
    expect(st.pendingSurgery, 'Échap annule la passe posée').toBeNull();
    expect(st.medic?.surgery, 'l’opération armée survit').toBeDefined();
    expect(st.medic?.surgery?.cumDR, 'son cumul est intact').toBe(3);
    expect(st.medic?.surgery?.last, 'sa dernière passe aussi').toEqual({ roll: 12, sl: 3 });
    expect(st.medic?.patientId, 'le patient reste celui opéré').toBe(patient.id);
    const pied = gestesDuPied();
    expect(pied.map((b) => (b.textContent ?? '').trim()), 'le pied reprend la sortie de l’opération armée').toEqual(['Arrêter l’opération', 'Opérer (une passe)']);
    expect(pied[0].className, 'arrêter après une passe aboutie est un abandon irréversible').toBe('btn btn-ghost danger');
  });

  const cliquer = (texte: string) => {
    const b = [...host.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === texte);
    expect(b, `bouton « ${texte} »`).toBeDefined();
    act(() => b!.click());
  };
  const soigneur = () => mk('Soigneur', { skills: [{ id: 'guerison', characteristic: 'intelligence', advances: 10 }] } as never);

  it('deux jets de soin de suite : chaque Échap annule le sien, le suivant ferme l’infirmerie', () => {
    const patient = mk('Blessé', { wounds: { current: 4, max: 12 } } as never);
    useGame.setState({
      screen: 'campaign', mode: 'exploration', gameMenuOpen: false, dialogue: null, battle: null,
      party: [soigneur(), patient], pendingHeal: null, pendingSurgery: null, medic: null,
    } as never);
    act(() => useGame.getState().openMedic({ patientId: patient.id }));
    act(() => root.render(<MedicModal />));
    for (const tour of [1, 2]) {
      cliquer('Soigner les Blessures');
      expect(useGame.getState().pendingHeal, `soin ${tour} posé`).not.toBeNull();
      echap();
      expect(useGame.getState().pendingHeal, `Échap ${tour} annule le soin`).toBeNull();
      expect(useGame.getState().medic, `l’infirmerie reste après l’Échap ${tour}`).not.toBeNull();
    }
    echap();
    expect(useGame.getState().medic, 'jet annulé : l’Échap suivant ferme l’infirmerie').toBeNull();
  });

  it('après une passe annulée par Échap puis l’opération arrêtée, Échap annule encore le soin', () => {
    const patient = mk('Opéré', { wounds: { current: 4, max: 12 }, traumas: [{ label: 'Fracture', location: 'brasG', surgery: true }] } as never);
    const chir = soigneur();
    const operation = { kind: 'surgery', difficulty: DIFF, healerId: chir.id, healerName: chir.label, skill: 45, intBonus: 4, traumaIdx: 0, targetDR: 6, cumDR: 3, last: { roll: 12, sl: 3 } };
    useGame.setState({
      screen: 'campaign', mode: 'exploration', gameMenuOpen: false, dialogue: null, battle: null,
      party: [chir, patient], pendingHeal: null, pendingSurgery: null,
      medic: { patientId: patient.id, surgery: operation },
    } as never);
    act(() => root.render(<MedicModal />));
    cliquer('Opérer (une passe)');
    echap();
    expect(useGame.getState().pendingSurgery, 'Échap annule la passe').toBeNull();
    cliquer('Arrêter l’opération');
    expect(useGame.getState().medic?.surgery, 'opération arrêtée').toBeFalsy();
    cliquer('Soigner les Blessures');
    expect(useGame.getState().pendingHeal, 'soin posé').not.toBeNull();
    echap();
    expect(useGame.getState().pendingHeal, 'l’Échap suivant annule le soin').toBeNull();
    expect(useGame.getState().medic, 'l’infirmerie reste').not.toBeNull();
  });
});
