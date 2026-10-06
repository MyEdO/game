// @vitest-environment jsdom
/**
 * `ProvenanceDuTexte` (#2001) — la provenance d'un texte de campagne en trois états : copie
 * (`source`), adapté (`adapteDe`), maison (aucune référence). Contrat : basculer reporte la référence
 * d'une clé à l'autre, « Maison » la retire, un brouillon incomplet n'émet rien, et JAMAIS une émission
 * ne porte les deux références. Un site sans copie offerte (réplique, journal) n'émet jamais `source`.
 * Câblage : la réplique (`DialogueDetail`) et la ligne de journal (`EffectFields`) ; les sites du
 * narratif sont tenus par `NarratifEditor.test.tsx`.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { DialogueDetail } from './DialogueDetail';
import { EffectList, type Ctx } from './EffectList';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';
import type { Dialogue, Effect } from '../../state/scene';
import { dialogueNodeSchema } from '../../data/schemas/defs-scenes/scene';
import { journalSchema } from '../../data/schemas/defs-scenes/effets';
import type { DescRef, SourceRef } from '../../data/schemas/grammaire/valeurs';
import { bookAbr, findBookById } from '../../data';
import { GALLERY_SPECIMENS } from '../gallery/registry';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;
afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  container?.remove();
  root = undefined;
  container = undefined;
});
function monter(el: ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  act(() => { r.render(el); });
}
function saisir(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, valeur: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, valeur);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function champ<E extends Element>(nom: string): E {
  const el = container!.querySelector<E>(`[aria-label="${nom}"]`);
  if (!el) throw new Error(`« ${nom} » introuvable`);
  return el;
}
const bouton = (mode: string, sujet: string) => container!.querySelector<HTMLButtonElement>(`[aria-label="${mode} — provenance ${sujet}"]`);
function choisir(mode: 'Copie' | 'Adapté' | 'Maison', sujet: string) {
  const b = bouton(mode, sujet);
  if (!b) throw new Error(`provenance « ${mode} » ${sujet} introuvable`);
  act(() => { b.click(); });
}
const retenu = (sujet: string) =>
  ['Copie', 'Adapté', 'Maison'].filter((m) => bouton(m, sujet)?.getAttribute('aria-pressed') === 'true');
/** Livre puis page validée : la seule réf qu'un `SourceRefField` émet. */
function poserRef(sujet: string, ref: SourceRef) {
  saisir(champ<HTMLSelectElement>(`Livre de la source ${sujet}`), ref.book);
  const page = champ<HTMLInputElement>(`Page de la source ${sujet}`);
  saisir(page, String(ref.page));
  act(() => { page.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
}
const libelleDuChamp = () => container!.querySelector('.ed-field .ed-field > span')?.textContent ?? null;

const REF: SourceRef = { book: 'ennemi-dans-l-ombre', page: 12 };
const AUTRE: SourceRef = { book: 'aux-armes', page: 3 };
const SUJET = 'du témoin';

type Valeur = { source?: SourceRef; adapteDe?: SourceRef };
let valeur: Valeur;
let emissions: Record<string, unknown>[];
function Temoin({ initiale, copie }: { initiale: Valeur; copie: boolean }) {
  const [v, setV] = useState<Valeur>(initiale);
  valeur = v;
  const poser = (patch: Record<string, unknown>) => { emissions.push(patch); setV((avant) => ({ ...avant, ...patch })); };
  return copie
    ? <ProvenanceDuTexte identite="témoin" copie sujet={SUJET} value={v} onChange={poser} />
    : <ProvenanceDuTexte identite="témoin" sujet={SUJET} value={v} onChange={poser} />;
}
const monterTemoin = (initiale: Valeur, copie = true) => {
  emissions = [];
  monter(<Temoin initiale={initiale} copie={copie} />);
};

describe('ProvenanceDuTexte — trois états, lus de la valeur', () => {
  it.each([
    ['maison', {}, ['Maison'], null],
    ['copie', { source: REF }, ['Copie'], 'Source'],
    ['adapté', { adapteDe: REF }, ['Adapté'], 'Adapté de'],
  ] as const)('%s : le mode retenu et son champ', (_etat, initiale, mode, libelle) => {
    monterTemoin(initiale);
    expect(retenu(SUJET)).toEqual(mode);
    expect(libelleDuChamp()).toBe(libelle);
  });

  it('site sans copie offerte (réplique, journal) : « Adapté » et « Maison » seuls', () => {
    monterTemoin({}, false);
    expect(bouton('Copie', SUJET)).toBeNull();
    expect(retenu(SUJET)).toEqual(['Maison']);
  });
});

describe('ProvenanceDuTexte — un mode choisi sans référence complète le DIT', () => {
  const consigne = () => container!.firstElementChild!.querySelector(':scope > .hint')?.textContent ?? null;

  it('Copie choisie, rien saisi : la consigne dit ce qui est retenu ; la réf complète la retire', () => {
    monterTemoin({});
    expect(consigne()).toBeNull();
    choisir('Copie', SUJET);
    expect(consigne()).toBe('Retenu : texte maison.');
    poserRef(SUJET, REF);
    expect(consigne()).toBeNull();
  });
});

describe('ProvenanceDuTexte — `adapteRefuse` : « Adapté » refusé, sa raison dite', () => {
  it('le mode est refusé (raison au segment), les autres restent offerts ; sans raison, il est offert', () => {
    emissions = [];
    monter(<ProvenanceDuTexte identite="t" copie sujet={SUJET} value={{ source: REF }} onChange={(p) => emissions.push(p)} adapteRefuse="Raison du refus." />);
    expect(bouton('Adapté', SUJET)?.getAttribute('aria-disabled')).toBe('true');
    act(() => { bouton('Adapté', SUJET)!.click(); });
    expect(emissions).toEqual([]);
    expect(container!.textContent).toContain('Raison du refus.');
    expect(bouton('Maison', SUJET)?.getAttribute('aria-disabled')).toBeNull();
  });
});

describe('ProvenanceDuTexte — bascules', () => {
  it('copie → adapté REPORTE la référence ; adapté → copie la ramène', () => {
    monterTemoin({ source: REF });
    choisir('Adapté', SUJET);
    expect(valeur).toEqual({ source: undefined, adapteDe: REF });
    expect(libelleDuChamp()).toBe('Adapté de');
    choisir('Copie', SUJET);
    expect(valeur).toEqual({ source: REF, adapteDe: undefined });
  });

  it('« Maison » retire la référence et le champ', () => {
    monterTemoin({ adapteDe: REF });
    choisir('Maison', SUJET);
    expect(valeur).toEqual({ source: undefined, adapteDe: undefined });
    expect(libelleDuChamp()).toBeNull();
  });

  it('un brouillon incomplet n’émet rien, et suit la bascule jusqu’à sa complétion', () => {
    monterTemoin({});
    choisir('Copie', SUJET);
    saisir(champ<HTMLSelectElement>(`Livre de la source ${SUJET}`), REF.book);
    expect(emissions).toEqual([]);
    choisir('Adapté', SUJET);
    expect(emissions).toEqual([]);
    const page = champ<HTMLInputElement>(`Page de la source ${SUJET}`);
    saisir(page, String(REF.page));
    act(() => { page.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(valeur).toEqual({ source: undefined, adapteDe: REF });
  });

  it('OPPOSÉ : aucune émission ne porte les deux références, quel que soit l’ordre des gestes', () => {
    monterTemoin({ source: REF });
    for (const mode of ['Adapté', 'Copie', 'Maison', 'Adapté', 'Copie', 'Adapté', 'Maison', 'Copie'] as const) {
      choisir(mode, SUJET);
      if (mode !== 'Maison') poserRef(SUJET, mode === 'Copie' ? AUTRE : REF);
    }
    expect(emissions.length).toBeGreaterThan(8);
    expect(emissions.filter((p) => p.source !== undefined && p.adapteDe !== undefined)).toEqual([]);
    expect(valeur).toEqual({ source: AUTRE, adapteDe: undefined });
  });

  it('OPPOSÉ : un site sans copie offerte n’émet jamais `source`', () => {
    monterTemoin({}, false);
    choisir('Adapté', SUJET);
    poserRef(SUJET, REF);
    choisir('Maison', SUJET);
    expect(emissions).toEqual([{ adapteDe: REF }, { adapteDe: undefined }]);
  });
});

const DESC_REF = {
  book: 'ennemi-dans-l-ombre',
  ch: '01',
  parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }],
} as DescRef;
const TEXTE = 'Le propriétaire essuie un gobelet.';

describe('ProvenanceDuTexte — texte ADRESSÉ reçu (réplique, journal) : lu, puis détaché', () => {
  type Replique = { adapteDe?: SourceRef; desc?: string; descRef?: DescRef };
  let v: Replique;
  let emis: Record<string, unknown>[];
  function Adressee() {
    const [r, setR] = useState<Replique>({ desc: TEXTE, descRef: DESC_REF });
    v = r;
    return <ProvenanceDuTexte identite="adressée" sujet={SUJET} value={r} onChange={(p) => { emis.push(p); setR((a) => ({ ...a, ...p })); }} />;
  }
  const monterAdressee = () => { emis = []; monter(<Adressee />); };
  const detacher = () => act(() => { champ<HTMLButtonElement>(`Détacher le texte ${SUJET}`).click(); });

  it('LECTURE : le badge du passage, « Copie » retenue, les autres modes refusés, aucune saisie', () => {
    monterAdressee();
    const badge = container!.querySelector('.source-badge');
    expect(badge?.textContent, 'réf nue : abréviation et chapitre, sans zéro de remplissage').toBe(`${bookAbr(DESC_REF.book)} 1`);
    expect(badge?.getAttribute('title')).toBe(`${findBookById(DESC_REF.book)!.label}, chapitre 1`);
    expect(retenu(SUJET)).toEqual(['Copie']);
    expect(bouton('Adapté', SUJET)?.getAttribute('aria-disabled')).toBe('true');
    expect(bouton('Maison', SUJET)?.getAttribute('aria-disabled')).toBe('true');
    expect(container!.querySelector('textarea, select, input')).toBeNull();
  });

  it('« Détacher » : `desc` gardé, `descRef` retiré, mode Adapté, livre de l’adresse prérempli sans rien émettre', () => {
    monterAdressee();
    detacher();
    expect(emis).toEqual([{ desc: TEXTE, descRef: undefined }]);
    expect(v).toEqual({ desc: TEXTE, descRef: undefined });
    expect(retenu(SUJET)).toEqual(['Adapté']);
    expect(champ<HTMLSelectElement>(`Livre de la source ${SUJET}`).value).toBe(DESC_REF.book);
    const page = champ<HTMLInputElement>(`Page de la source ${SUJET}`);
    saisir(page, '14');
    act(() => { page.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(v).toEqual({ desc: TEXTE, descRef: undefined, adapteDe: { book: DESC_REF.book, page: 14 } });
  });

  it('« Détacher » : livre amorcé, UN seul signal — ce qui est retenu — tant que rien n’est saisi ; la saisie incomplète se signale', () => {
    monterAdressee();
    detacher();
    expect(champ<HTMLSelectElement>(`Livre de la source ${SUJET}`).value, 'le livre de l’adresse est perdu').toBe(DESC_REF.book);
    expect(container!.querySelector('[role="status"]'), 'un brouillon amorcé non touché se signale incomplet').toBeNull();
    expect(container!.querySelector('[aria-invalid="true"]')).toBeNull();
    expect([...container!.querySelectorAll('.hint')].map((h) => h.textContent)).toEqual(['Retenu : texte maison.']);
    const page = champ<HTMLInputElement>(`Page de la source ${SUJET}`);
    saisir(page, '0');
    act(() => { page.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(container!.querySelector('[role="status"]')?.textContent, 'la saisie incomplète ne se signale pas').toContain('incomplète');
    expect(emis).toEqual([{ desc: TEXTE, descRef: undefined }]);
  });

  it('OPPOSÉ : aucune émission ne porte `descRef` et `adapteDe` ensemble, ni l’état qui en résulte', () => {
    monterAdressee();
    choisir('Adapté', SUJET);
    expect(emis).toEqual([]);
    detacher();
    poserRef(SUJET, REF);
    choisir('Maison', SUJET);
    choisir('Adapté', SUJET);
    poserRef(SUJET, AUTRE);
    expect(emis.filter((p) => 'descRef' in p && 'adapteDe' in p)).toEqual([]);
    expect(v.descRef).toBeUndefined();
    expect(v.adapteDe).toEqual(AUTRE);
  });
});

describe('ProvenanceDuTexte — câblage : la réplique de dialogue', () => {
  it('« Adapté » écrit `adapteDe` dans le nœud ÉDITÉ, qui parse ; le voisin est intact', () => {
    const dialogue: Dialogue = { id: 'd', start: 'n1', nodes: [{ id: 'n1', desc: 'Bonjour.', choices: [] }, { id: 'n2', desc: 'Adieu.', choices: [] }] };
    let dernier = dialogue;
    function Atelier() {
      const [d, setD] = useState(dialogue);
      dernier = d;
      return <DialogueDetail dialogue={d} ctx={{ encounters: [], dialogues: [d], personas: [] } as unknown as Ctx} onChange={setD} />;
    }
    monter(<Atelier />);
    expect(bouton('Copie', 'de la réplique')).toBeNull();
    choisir('Adapté', 'de la réplique');
    poserRef('de la réplique', REF);
    expect(dernier.nodes[0]).toMatchObject({ id: 'n1', desc: 'Bonjour.', adapteDe: REF });
    expect(dernier.nodes[1]).toEqual(dialogue.nodes[1]);
    expect(dialogueNodeSchema.safeParse(dernier.nodes[0]).error).toBeUndefined();
  });
});

describe('ProvenanceDuTexte — câblage : réplique ADRESSÉE, `desc` non saisissable', () => {
  /** Libellé du texte, puis segment de provenance : l'ordre de leurs nœuds dans le document. */
  const ordre = (libelle: string) => {
    const texte = [...container!.querySelectorAll('.ed-field > span')].find((s) => s.textContent === libelle);
    const segment = container!.querySelector('.rm-loc-inline');
    if (!texte || !segment) throw new Error(`« ${libelle} » ou le segment introuvable`);
    return texte.compareDocumentPosition(segment) & Node.DOCUMENT_POSITION_FOLLOWING ? ['texte', 'provenance'] : ['provenance', 'texte'];
  };

  it('le texte, lu puis saisissable, tient sa place sous son libellé : même ordre avant et après « Détacher »', () => {
    const dialogue: Dialogue = { id: 'd', start: 'n1', nodes: [{ id: 'n1', desc: TEXTE, descRef: DESC_REF, choices: [] }] };
    function Atelier() {
      const [d, setD] = useState(dialogue);
      return <DialogueDetail dialogue={d} ctx={{ encounters: [], dialogues: [d], personas: [] } as unknown as Ctx} onChange={setD} />;
    }
    monter(<Atelier />);
    const lu = [...container!.querySelectorAll('.ed-field')].find((f) => f.firstElementChild?.textContent === 'Texte de la réplique');
    expect(lu, 'le texte lu, sous son libellé').toBeDefined();
    expect(lu!.textContent).toContain(TEXTE);
    expect(ordre('Texte de la réplique')).toEqual(['texte', 'provenance']);
    act(() => { champ<HTMLButtonElement>('Détacher le texte de la réplique').click(); });
    expect(ordre('Texte de la réplique')).toEqual(['texte', 'provenance']);
  });

  it('aucune zone de texte tant que l’adresse tient ; « Détacher » rend la prose à la saisie', () => {
    const dialogue: Dialogue = { id: 'd', start: 'n1', nodes: [{ id: 'n1', desc: TEXTE, descRef: DESC_REF, choices: [] }] };
    let dernier = dialogue;
    function Atelier() {
      const [d, setD] = useState(dialogue);
      dernier = d;
      return <DialogueDetail dialogue={d} ctx={{ encounters: [], dialogues: [d], personas: [] } as unknown as Ctx} onChange={setD} />;
    }
    monter(<Atelier />);
    expect(container!.querySelector('textarea.prose-field')).toBeNull();
    act(() => { champ<HTMLButtonElement>('Détacher le texte de la réplique').click(); });
    expect(dernier.nodes[0]).toEqual({ id: 'n1', desc: TEXTE, descRef: undefined, choices: [] });
    expect(container!.querySelector<HTMLTextAreaElement>('textarea.prose-field')?.value).toBe(TEXTE);
  });
});

describe('ProvenanceDuTexte — câblage : la ligne de journal', () => {
  const ctx = { encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE } as unknown as Ctx;
  let dernier: Effect[];
  function Liste({ initiale }: { initiale: Effect[] }) {
    const [effects, setEffects] = useState<Effect[]>(initiale);
    dernier = effects;
    return <EffectList effects={effects} ctx={ctx} onChange={setEffects} />;
  }

  it('le texte se saisit en prose ; « Adapté » écrit `adapteDe` sur CET effet, qui parse', () => {
    monter(<Liste initiale={[{ type: 'journal', desc: 'Le plancher gémit.' }, { type: 'journal', desc: 'Un cri.' }]} />);
    const [premiere] = container!.querySelectorAll<HTMLDetailsElement>('details.eff-row');
    const zone = premiere.querySelector('textarea.prose-field');
    expect(zone).not.toBeNull();
    const sujet = 'de la ligne de journal';
    const seg = premiere.querySelector<HTMLButtonElement>(`[aria-label="Adapté — provenance ${sujet}"]`)!;
    act(() => { seg.click(); });
    const livre = premiere.querySelector<HTMLSelectElement>(`[aria-label="Livre de la source ${sujet}"]`)!;
    saisir(livre, REF.book);
    const page = premiere.querySelector<HTMLInputElement>(`[aria-label="Page de la source ${sujet}"]`)!;
    saisir(page, String(REF.page));
    act(() => { page.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(dernier[0]).toEqual({ type: 'journal', desc: 'Le plancher gémit.', adapteDe: REF });
    expect(dernier[1]).toEqual({ type: 'journal', desc: 'Un cri.' });
    expect(journalSchema.safeParse(dernier[0]).error).toBeUndefined();
  });

  it('journal ADRESSÉ : aucune zone de texte, la prose se lit sous son libellé', () => {
    monter(<Liste initiale={[{ type: 'journal', desc: TEXTE, descRef: DESC_REF }]} />);
    const rangee = container!.querySelector('details.eff-row')!;
    expect(rangee.querySelector('textarea.prose-field')).toBeNull();
    const lecture = [...rangee.querySelectorAll('.ed-field')].find((f) => f.firstElementChild?.textContent === 'Texte du journal');
    expect(lecture?.textContent).toContain(TEXTE);
  });

  it('texte effacé : `desc` ABSENT, jamais une chaîne vide', () => {
    monter(<Liste initiale={[{ type: 'journal', desc: 'Le plancher gémit.' }]} />);
    saisir(container!.querySelector<HTMLTextAreaElement>('details.eff-row textarea.prose-field')!, '');
    expect(dernier[0].type).toBe('journal');
    expect((dernier[0] as { desc?: string }).desc).toBeUndefined();
  });
});

describe('ProvenanceDuTexte — disposition propre à la variante (#2001)', () => {
  const feuille = () =>
    readFileSync(join(process.cwd(), 'src/ui/styles/option-chooser.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const blocsMedia = (css: string) => [...css.matchAll(/@media[^{]*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)].map((m) => m[1]);

  it('la rangée porte la variante empilée', () => {
    monterTemoin({});
    expect(container!.querySelector('.rm-loc-inline')?.hasAttribute('data-empile')).toBe(true);
  });

  it('la feuille : la règle de la variante est portée par `[data-empile]`, aucune règle générique de `.rm-loc-inline` en @media', () => {
    const css = feuille();
    expect(css).toMatch(/\.rm-loc-inline\[data-empile\]\s*\{[^}]*flex-direction:\s*column/);
    for (const bloc of blocsMedia(css)) expect(bloc).not.toMatch(/\.rm-loc-inline(?!\[)/);
  });

  it('la feuille : le segment empilé suit son CONTENU, plafonné à l’hôte — rien ne l’étire ni ne le rembourre', () => {
    const css = feuille();
    const regles = [...css.matchAll(/([^{}]*\[data-empile\][^{}]*)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), decl: m[2] }));
    const de = (sel: RegExp) => regles.filter((x) => sel.test(x.sel)).map((x) => x.decl).join(';');
    expect(de(/\[data-empile\]$/), 'la rangée aligne ses enfants au départ').toMatch(/align-items:\s*flex-start/);
    expect(de(/\[data-empile\] \.seg$/), 'le segment est plafonné à l’hôte').toMatch(/max-width:\s*100%/);
    for (const { sel, decl } of regles) {
      expect(decl, `${sel} : aucun étirement`).not.toMatch(/align-(items|self):\s*stretch/);
      if (/\.seg$/.test(sel)) expect(decl, `${sel} : aucune largeur forcée`).not.toMatch(/(^|[;\s])width:/);
      if (/\.seg (button|\.btn)/.test(sel)) expect(decl, `${sel} : un bouton ne grandit pas`).toMatch(/flex:\s*0\s/);
      expect(decl, `${sel} : le rembourrage reste celui de \`.seg button\` (components.css)`).not.toMatch(/(^|[;\s])padding/);
    }
  });

  it('galerie : le spécimen Maison rend « Maison » retenu', () => {
    const demo = GALLERY_SPECIMENS.find((x) => x.id === 'provenancedutexte')!;
    const Demo = demo.render as () => ReactElement;
    monter(<Demo />);
    expect(retenu('du texte maison')).toEqual(['Maison']);
  });
});
