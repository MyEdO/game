/**
 * CONTRAT D'AFFICHAGE DE JET (#1078) — le SOCLE des primitives, vérifié en contrat POSITIF :
 * l'issue d'un jet est une DONNÉE rendue par la coquille, quelle que soit la cardinalité ; chaque
 * rôle du bandeau porte SA classe ; le verbe de `VsHeader` est un vocabulaire FERMÉ (id d'icône) ;
 * la sous-ligne d'une rangée a un canal UNIQUE (`PanelRowData.note` → `.rr-note`).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { renderToStaticMarkup } from 'react-dom/server';
import { RollShell, type RollRowData, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { buildParticipantRows } from './buildParticipantRows';
import { testBreakdown, testPending } from './breakdown';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { toRecapLines } from '../state/recapLine';
import type { Combatant } from '../engine/types';
import type { VerdictReason } from '../engine/tests';
import { RULE_REF } from '../engine/ruleRefs';
import { codexLookupById } from './compendium/registry';

const noop = () => {};

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy'): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [], advantage: 0, size: 'moyenne', pos: { x: 0, y: 0 }, wounds: { current: 18, max: 18 }, resilience: 2, fortune: 2,
     species: 'humains-reiklander', bodyShape: 'humanoide', movement: 4,
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } } as unknown as Combatant);

const rolledRow = (label = 'Athlétisme', over: Partial<RollRowData> = {}): BuiltRollRow => ({
  ...buildRollRow({ row: { d: testBreakdown(label, 45, { roll: 22, target: 45, sl: 2, success: true }) }, onRoll: noop }),
  ...over,
});

const actions: RollAction[] = [{ key: 'confirm', label: 'Appliquer', onClick: noop, when: 'post' }];

describe('RollShell — l’ISSUE se rend à toute cardinalité (#1078)', () => {
  it('une coquille à 2 rangées (jet OPPOSÉ) rend son `outcome`', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Test opposé"
        rows={[rolledRow(), rolledRow('Esquive', { interactive: false })]}
        rolled
        winnerIndex={1}
        outcome={toRecapLines(['Gustav esquive le coup'])}
        actions={actions}
      />,
    );
    expect(html).toContain('Gustav esquive le coup');
  });

  it('une coquille MULTI (3 rangées) rend son `outcome` — et son `summary` reste un bandeau distinct', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Multi"
        rows={[rolledRow(), rolledRow('Voile'), rolledRow('Rame')]}
        rolled
        outcome={toRecapLines(['La manœuvre passe'])}
        summary={<>DR total +6</>}
        actions={actions}
      />,
    );
    expect(html).toContain('La manœuvre passe');
    expect(html).toContain('DR total +6');
  });

  it('le mono rend toujours son `outcome`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="Mono" rows={[rolledRow()]} rolled outcome={toRecapLines(['Réussi'])} actions={actions} />,
    );
    expect(html).toContain('Réussi');
  });
});

describe('RollShell — l’issue est une DONNÉE, rendue par LA coquille (#1078 LOT B1)', () => {
  const combatants = [mk('Gustav', 'hero'), mk('Skaven', 'enemy')];

  it('le CADRE d’issue et la ligne appartiennent à la coquille : `.rm-journal` > `.recap-line`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={toRecapLines(['Le coup porte'])} actions={actions} />,
    );
    const frame = html.slice(html.indexOf('rm-journal'));
    expect(html, 'la coquille pose le cadre elle-même').toContain('class="rm-journal"');
    expect(frame, 'et rend chaque ligne par le renderer UNIQUE').toContain('recap-line');
    expect(frame).toContain('Le coup porte');
  });

  it('une issue produite par `recapLineOfEvent` garde sa coloration PAR CAMP et son icône', () => {
    const line = recapLineOfEvent(ev('damage', 'Gustav frappe Skaven', 'Gustav', 'Skaven'), combatants);
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={[line]} actions={actions} />,
    );
    const frame = html.slice(html.indexOf('rm-journal'));
    expect(frame, 'l’allié se colore').toContain('nm-ally');
    expect(frame, 'l’ennemi aussi').toContain('nm-foe');
    expect(frame, 'et l’icône du kind est rendue').toContain('<svg class="icon"');
  });

  it('une issue VIDE ne pose AUCUN cadre (pas de boîte fantôme)', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={[]} actions={actions} />,
    );
    expect(html).not.toContain('rm-journal');
  });

  it('N lignes d’issue se rendent DANS LE MÊME cadre (une seule boîte)', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow()]} rolled outcome={toRecapLines(['Premier fait', 'Second fait'])} actions={actions} />,
    );
    expect(html.split('rm-journal').length - 1, 'un seul cadre').toBe(1);
    expect(html).toContain('Premier fait');
    expect(html).toContain('Second fait');
  });
});

/**
 * CLIQUET (#1078 LOT B1) — le CONTENEUR d'issue `.rm-journal` appartient à la coquille : plus aucun
 * module de `src/` ne l'écrit à la main. Un site qui recomposerait sa boîte d'issue en JSX contournerait
 * le renderer unique — et échapperait au TYPE de `outcome`, qui interdit le JSX et n'expose aucun champ
 * de verdict (que le TEXTE ne redise pas le verdict relève, lui, du CONTRAT).
 * Baseline ZÉRO, sans liste d'exception : `RollShell.tsx` est le seul propriétaire de la classe.
 *
 * Le motif traqué est la SOUS-CHAÎNE, pas une forme d'écriture : `className={'rm-journal'}`,
 * `cx("rm-journal")`, une concaténation, un `class=` de gabarit ou un attribut coupé sur deux lignes
 * sont tous des poses de la classe. Les feuilles CSS sont hors périmètre (la classe y est STYLÉE),
 * les fichiers de test aussi (ce cliquet porte lui-même le motif).
 */
describe('CLIQUET — `.rm-journal` n’est écrit QUE par la coquille', () => {
  const OWNER = 'ui/RollShell.tsx';

  it('aucun module de `src` (hors RollShell) ne pose la classe `rm-journal`', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      const name = rel.slice('src/'.length);
      if (name === OWNER) continue;
      text.split('\n').forEach((l, i) => {
        if (l.includes('rm-journal')) offenders.push(`${name}:${i + 1}`);
      });
    }
    expect(offenders, 'Cadre d’issue recomposé à la main — fournir la DONNÉE (RecapLine[]) à RollShell.outcome :\n' + offenders.join('\n')).toEqual([]);
  });
});

/**
 * CLIQUET (#1078 LOT C1) — l'OPPOSITION A→B a UNE surface : `VsHeader`. La classe `.rm-vs` n'est
 * donc posée QUE par `ui/VsHeader.tsx` : un site qui la repose habille en opposition ce qui n'oppose
 * personne (le sous-titre a `.rm-subtitle`, l'issue agrégée `.rm-summary`, la rangée `.prow`) — c'est
 * la confusion de rôles que le LOT A1 a démêlée.
 * Baseline ZÉRO, sans liste d'exception.
 *
 * COUVERTURE : les modules `.ts(x)` de `src` hors tests, COMMENTAIRES RETIRÉS avant le scan — nommer
 * la classe dans une prose de commentaire (`CastModal` explique pourquoi elle ne l'utilise PAS) n'est
 * pas la poser. Reste traqué toute forme d'ÉCRITURE (`className="rm-vs"`, `cx('rm-vs')`,
 * concaténation, gabarit) : c'est la sous-chaîne dans du CODE qui compte, pas un nom d'identifiant.
 */
describe('CLIQUET — `.rm-vs` n’est écrit QUE par `VsHeader`', () => {
  const OWNER = 'ui/VsHeader.tsx';

  /** Retire les commentaires (bloc et ligne) en gardant les sauts de ligne — les numéros de ligne
   *  rapportés restent ceux du fichier. */
  const stripComments = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (_m, p1: string) => p1);

  it('aucun module de `src` (hors VsHeader) ne pose la classe `rm-vs`', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      const name = rel.slice('src/'.length);
      if (name === OWNER) continue;
      stripComments(text).split('\n').forEach((l, i) => {
        if (l.includes('rm-vs')) offenders.push(`${name}:${i + 1}`);
      });
    }
    expect(offenders, 'A→B recomposé à la main — composer `VsHeader` (ou la classe du rôle réellement rendu) :\n' + offenders.join('\n')).toEqual([]);
  });
});

describe('RollShell — sous MASQUE, l’issue se tait (#990)', () => {
  /** Rangée dont le DÉ est masqué (`mask: 'roll'`) : le spectateur ne doit rien pouvoir déduire. */
  const maskedRow = (): BuiltRollRow => {
    const r = rolledRow('Furtivité');
    return { ...r, row: { ...r.row, d: { ...r.row.d!, mask: 'roll' } } };
  };

  it('une rangée MASQUÉE fait taire `outcome`, comme le halo et le badge « DR net »', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé masqué"
        rows={[maskedRow(), rolledRow('Perception', { interactive: false })]}
        rolled
        winnerIndex={0}
        netSL={3}
        outcome={toRecapLines(['Gustav passe inaperçu'])}
        actions={actions}
      />,
    );
    expect(html, 'l’issue dit ce que le dé caché a produit').not.toContain('Gustav passe inaperçu');
    expect(html).not.toContain('rm-netsl');
    expect(html).not.toContain('rr-win');
  });

  it('les MÊMES rangées RÉVÉLÉES rendent leur `outcome`', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé révélé"
        rows={[rolledRow('Furtivité'), rolledRow('Perception', { interactive: false })]}
        rolled
        winnerIndex={0}
        netSL={3}
        outcome={toRecapLines(['Gustav passe inaperçu'])}
        actions={actions}
      />,
    );
    expect(html).toContain('Gustav passe inaperçu');
    expect(html).toContain('rm-netsl');
  });
});

/**
 * Z5c (`docs/charte-ui.md`) — la RAISON du verdict est une ANNOTATION de LA ligne (Z5) : elle vit
 * dans le bloc de la ligne qu'elle explique, jamais dans un bandeau de bilan (Z13, qui COMPARE), et
 * ne paraît QUE quand la comparaison des DR AFFICHÉS ne suffit pas (départage d'un Test opposé, LDB
 * 12 l.160). Ce que le moteur pose (`RollBreakdown.decided`), la coquille le montre — sans rien
 * recomparer, et sous le MÊME verrou de découverte que le halo et le « DR net » (#990). La phrase EST
 * l'affordance de la règle : elle porte le renvoi Codex vers la fiche « Tests opposés ».
 */
describe('RollShell — Z5c : la raison du départage annote la LIGNE gagnante', () => {
  /** Les MOTS du RAW (LDB 12 l.160) tels que la ligne les rend — la condition est DITE. */
  const PHRASE_VALEUR = 'DR égaux — la Compétence ou Caractéristique la plus élevée';
  /** Rangée résolue portant la raison du verdict, telle que le résolveur la pose sur son détail. */
  const withReason = (label: string, decided: VerdictReason, over: Partial<RollRowData> = {}): BuiltRollRow => {
    const r = rolledRow(label, over);
    return { ...r, row: { ...r.row, d: { ...r.row.d!, decided } } };
  };
  /** Le bloc de ligne (`.rm-roll-block`) qui contient `label` — pour mesurer OÙ vit l'annotation. */
  const blocDe = (html: string, label: string) =>
    html.split('class="rm-roll-block"').find((b) => b.includes(label)) ?? '';

  it('départage à la VALEUR : l’annotation est dans le bloc de la ligne GAGNANTE, avec les deux valeurs nues', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé"
        rows={[withReason('Corps à corps', { by: 'valeur', own: 45, other: 30 }),
               rolledRow('Esquive', { interactive: false })]}
        rolled
        winnerIndex={0}
        netSL={0}
        actions={actions}
      />,
    );
    const gagnante = blocDe(html, 'Corps à corps');
    const perdante = blocDe(html, 'Esquive');
    expect(gagnante, 'la raison explique le ✓ de CETTE ligne').toContain(PHRASE_VALEUR);
    expect(gagnante, 'les deux grandeurs comparées sont lues telles que le moteur les a comparées').toContain('45');
    expect(gagnante).toContain('30');
    expect(perdante, 'la ligne perdante n’annonce rien').not.toContain(PHRASE_VALEUR);
    expect(html.split(PHRASE_VALEUR).length - 1, 'une seule annotation').toBe(1);
  });

  it('ÉGALITÉ parfaite : les deux lignes portent le statu quo', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé"
        rows={[withReason('Corps à corps', { by: 'egalite' }),
               withReason('Esquive', { by: 'egalite' }, { interactive: false })]}
        rolled
        actions={actions}
      />,
    );
    expect(blocDe(html, 'Corps à corps')).toContain('statu quo');
    expect(blocDe(html, 'Esquive')).toContain('statu quo');
  });

  it('les DR ont tranché (aucune raison posée) : la coquille n’écrit RIEN — le cas nominal ne se commente pas', () => {
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé"
        rows={[rolledRow('Corps à corps'), rolledRow('Esquive', { interactive: false })]}
        rolled
        winnerIndex={0}
        netSL={3}
        actions={actions}
      />,
    );
    expect(html).not.toContain(PHRASE_VALEUR);
    expect(html).not.toContain('statu quo');
  });

  it('panneau MASQUÉ : la raison se tait — elle CITERAIT la valeur que la ligne adverse cache', () => {
    const masque = (r: BuiltRollRow, mask: 'roll' | 'value'): BuiltRollRow => ({ ...r, row: { ...r.row, d: { ...r.row.d!, mask } } });
    for (const mask of ['roll', 'value'] as const) {
      const html = renderToStaticMarkup(
        <RollShell
          title="Opposé masqué"
          rows={[withReason('Corps à corps', { by: 'valeur', own: 45, other: 30 }),
                 masque(rolledRow('Esquive', { interactive: false }), mask)]}
          rolled
          winnerIndex={0}
          actions={actions}
        />,
      );
      expect(html, `masque « ${mask} » : la raison compare les deux jets`).not.toContain(PHRASE_VALEUR);
      expect(html, `masque « ${mask} » : la valeur nue de l’adversaire ne fuit pas`).not.toContain('&gt; 30');
    }
  });

  it('la phrase EST le renvoi Codex : elle vit DANS un `CodexRef` RÉSOLU (fiche « Tests opposés »)', () => {
    const ref = RULE_REF['tests-opposes'];
    expect(codexLookupById(ref.category, ref.id), 'la fiche de règle est authorée au Codex').toBeTruthy();
    const html = renderToStaticMarkup(
      <RollShell
        title="Opposé"
        rows={[withReason('Corps à corps', { by: 'valeur', own: 45, other: 30 }),
               rolledRow('Esquive', { interactive: false })]}
        rolled
        winnerIndex={0}
        actions={actions}
      />,
    );
    const bloc = blocDe(html, 'Corps à corps');
    const i = bloc.indexOf('<span class="codex-ref');
    expect(i, 'aucun renvoi Codex : la phrase ne mène nulle part').toBeGreaterThan(-1);
    expect(bloc.slice(i), 'la phrase est le CONTENU du renvoi, pas un voisin').toContain(PHRASE_VALEUR);
    expect(bloc.slice(i, bloc.indexOf(PHRASE_VALEUR)), 'renvoi INERTE (fiche introuvable) : le lecteur n’a plus de porte').not.toContain('codex-static');
  });
});

describe('RollShell — un RÔLE, une classe (#1078) : la coquille ne pose JAMAIS `.rm-vs`', () => {
  it('le sous-titre porte `.rm-subtitle`, jamais `.rm-vs`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" subtitle="Un jet de Calme" rows={[rolledRow()]} rolled actions={[]} />,
    );
    expect(html).toContain('class="rm-subtitle"');
    expect(html).not.toContain('class="rm-vs"');
  });

  it('le bandeau d’issue agrégée porte `.rm-summary`, jamais `.rm-vs`', () => {
    const html = renderToStaticMarkup(
      <RollShell title="T" rows={[rolledRow(), rolledRow('Voile')]} rolled summary={<>DR total +4</>} actions={[]} />,
    );
    expect(html).toContain('class="rm-summary"');
    expect(html).not.toContain('class="rm-vs"');
  });

  it('`VsHeader` (l’OPPOSITION) garde `.rm-vs`', () => {
    const html = renderToStaticMarkup(<VsHeader actor={mk('a', 'hero')} target={mk('b', 'enemy')} />);
    expect(html).toContain('class="rm-vs"');
  });
});

describe('VsHeader — le verbe est un VOCABULAIRE FERMÉ (décision utilisateur 2026-08-04)', () => {
  it('sans `verb` : glyphe « → » (la direction dit qui agit)', () => {
    const html = renderToStaticMarkup(<VsHeader actor={mk('a', 'hero')} target={mk('b', 'enemy')} />);
    expect(html).toContain('→');
  });

  it('avec `verb` : l’icône du registre est rendue (aucun texte n’est composé)', () => {
    const html = renderToStaticMarkup(<VsHeader actor={mk('a', 'hero')} target={mk('b', 'enemy')} verb="melee/disengage" />);
    const arrow = html.slice(html.indexOf('rm-vs-arrow'));
    expect(arrow).toContain('<svg class="icon"');
    expect(arrow).not.toContain('→');
  });
});

describe('sous-ligne d’une rangée — CANAL UNIQUE `note` (#1078)', () => {
  const parts = [{ id: 'a', interactive: true, result: { roll: 22, target: 45, sl: 2, success: true } }];

  it('la `note` du builder atterrit dans `.rr-note`, sous la ligne de jet', () => {
    const rows = buildParticipantRows(parts, [mk('a', 'hero')], {
      onRoll: noop, onReroll: noop, onBonusSL: noop, onDarkPact: noop, onForce: noop,
      row: (_p, actor, res) => ({ combatant: actor, d: testBreakdown('Voile', 45, { roll: res!.roll, target: res!.target, sl: res!.sl, success: true }) }),
      note: (_p, _a, res) => <span className="cs-outcome">+{res.sl} DR ×2</span>,
    });
    const html = renderToStaticMarkup(<RollShell title="T" rows={rows} rolled actions={[]} />);
    expect(html).toContain('rr-note');
    expect(html.slice(html.indexOf('rr-note'))).toContain('+2 DR ×2');
  });

  it('sans `note`, la rangée ne rend aucune sous-ligne', () => {
    const rows = buildParticipantRows(parts, [mk('a', 'hero')], {
      onRoll: noop, onReroll: noop, onBonusSL: noop, onDarkPact: noop, onForce: noop,
      row: (_p, actor) => ({ combatant: actor, d: testBreakdown('Voile', 45, { roll: 22, target: 45, sl: 2, success: true }) }),
    });
    const html = renderToStaticMarkup(<RollShell title="T" rows={rows} rolled actions={[]} />);
    expect(html).not.toContain('rr-note');
  });
});

/**
 * Enfants DIRECTS de la pile du corps (`.modal-body > .stack`, `RollShell.tsx`) de la coquille, dans
 * l'ordre du document — lus sur le markup rendu (l'environnement de test est `node`, sans DOM). Le compteur de profondeur ne s'appuie que sur la syntaxe
 * auto-fermante émise par `react-dom/server` (`<br/>`, `<img …/>`) : aucune liste de balises vides à
 * tenir à jour, donc aucun angle mort quand un rendu SVG entre dans une zone.
 */
function scrollChildren(html: string): string[] {
  const marker = '<div class="modal-body">';
  const start = html.indexOf(marker);
  expect(start, 'la coquille rend bien son corps défilable `.modal-body`').toBeGreaterThanOrEqual(0);
  const pile = /^<div class="stack"[^>]*>/.exec(html.slice(start + marker.length));
  expect(pile, 'le corps est une pile `Stack`').not.toBeNull();
  const out: string[] = [];
  let depth = 0;
  const tagRe = /<(\/?)([a-zA-Z][-\w]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  tagRe.lastIndex = start + marker.length + pile![0].length;
  for (let m = tagRe.exec(html); m; m = tagRe.exec(html)) {
    const [, fermante, tag, attrs, autoFermante] = m;
    if (fermante) {
      if (depth === 0) break; // le `</div>` de la pile elle-même : fin des enfants directs
      depth--;
      continue;
    }
    if (depth === 0) out.push(/class="([^"]*)"/.exec(attrs)?.[1] ?? `<${tag}>`);
    if (!autoFermante) depth++;
  }
  return out;
}

/**
 * INVARIANT DE GÉOMÉTRIE (#1142, `docs/charte-ui.md` § « Invariant de GÉOMÉTRIE d'une fenêtre de
 * jet ») : le bord HAUT de la fenêtre est invariant pour une session de jet donnée. Ce que le
 * markup doit garantir — et que ces trois contrats mesurent : ce qui APPARAÎT au jet est rendu
 * APRÈS les rangées, la seule zone volatile au-dessus d'elles est Z4 (`setup`), et les zones qui
 * précèdent les rangées sont les MÊMES d'un état à l'autre. Le CSS ancre ensuite le haut
 * (`roll-shell.css`) ; sans cet ordre du document, l'ancrage haut ferait simplement descendre le
 * contenu au lieu de hisser la fenêtre — le tremblement changerait de forme, pas de nature.
 *
 * Ce qui est mesuré est l'ORDRE PAR CLASSES, jamais un index brut : un `extra` en Fragment (ou tout
 * nœud stable de plus au-dessus des rangées) déplace l'index sans rien casser de l'invariant — un
 * contrat qui compare des index ne mesurerait que sa propre fixture. Les fixtures en portent donc
 * un, exprès.
 */
describe('RollShell — ORDRE DU DOCUMENT : rien de volatile au-dessus des rangées (#1142)', () => {
  const preRow = buildRollRow({ row: { pending: testPending('Athlétisme', 45) }, onRoll: noop });
  const setupNode = <div className="rm-options">Parade / Esquive</div>;
  /** Nœuds STABLES d'un site, servis en Fragment : présents aux deux états, ils décalent l'index
   *  des enfants directs de la pile du corps sans toucher à l'ordre relatif que le contrat mesure. */
  const extraNode = <><div className="rm-portraits">Gustav</div><div className="rm-subtitle">Portée</div></>;
  /** Zones VOLATILES : elles n'existent qu'APRÈS le jet. Les trois premières sont rendues par la
   *  coquille elle-même (`RollShell.tsx` : `.rm-journal`, `.rm-netsl`, `.rm-summary`) ; les deux
   *  suivantes sont les classes des nœuds passés aux slots post-jet `postRollExtra`/`forcedExtra`. */
  const ZONES_VOLATILES = ['rm-journal', 'rm-netsl', 'rm-summary', 'rm-note', 'rm-loc-grid'];
  const volatilesDe = (classes: string[]) =>
    classes.filter((c) => c.split(/\s+/).some((n) => ZONES_VOLATILES.includes(n)));

  it('aucune zone volatile ne précède les rangées, pré-jet comme post-jet (ordre par CLASSES)', () => {
    const pre = scrollChildren(renderToStaticMarkup(
      <RollShell title="Athlétisme" subtitle="Gustav — Franchir (Athlétisme)" extra={extraNode} rows={[preRow]} rolled={false} actions={actions} />,
    ));
    const post = scrollChildren(renderToStaticMarkup(
      <RollShell
        title="Athlétisme" subtitle="Gustav — Franchir (Athlétisme)" extra={extraNode}
        rows={[rolledRow()]} rolled
        outcome={toRecapLines(['Gustav franchit'])} summary={<>DR +2</>}
        postRollExtra={<div className="rm-note" data-ton="attente">Surincantation</div>}
        actions={actions}
      />,
    ));
    for (const [etat, enfants] of [['pré-jet', pre], ['post-jet', post]] as const) {
      const i = enfants.indexOf('cs-rows');
      expect(i, `${etat} : les rangées ne sont pas rendues (le contrat ne mesurerait rien)`).toBeGreaterThanOrEqual(0);
      expect(volatilesDe(enfants.slice(0, i)), `${etat} : une zone volatile est rendue AU-DESSUS des rangées — elle hissera la fenêtre en apparaissant`)
        .toEqual([]);
    }
    expect(post.slice(0, post.indexOf('cs-rows')), 'les zones qui précèdent les rangées sont les mêmes d’un état à l’autre')
      .toEqual(pre.slice(0, pre.indexOf('cs-rows')));
  });

  it('toute zone qui APPARAÎT au jet est rendue APRÈS les rangées — aucune ne les précède', () => {
    const post = scrollChildren(renderToStaticMarkup(
      <RollShell
        title="Opposé" subtitle="Gustav — Frapper (Corps à corps)" extra={extraNode}
        rows={[rolledRow(), rolledRow('Esquive', { interactive: false })]} rolled
        winnerIndex={0} netSL={2}
        outcome={toRecapLines(['Le coup porte'])} summary={<>DR total +6</>}
        postRollExtra={<div className="rm-note" data-ton="attente">Contre-sort</div>}
        forcedExtra={<div className="rm-loc-grid">Localisation</div>}
        actions={actions}
      />,
    ));
    const rangees = post.indexOf('cs-rows');
    expect(rangees).toBeGreaterThanOrEqual(0);
    for (const zone of ZONES_VOLATILES) {
      const i = post.indexOf(zone);
      expect(i, `la zone « ${zone} » est rendue (sinon le contrat ne mesure rien)`).toBeGreaterThanOrEqual(0);
      expect(i, `la zone « ${zone} » pousse vers le BAS : elle suit les rangées`).toBeGreaterThan(rangees);
    }
  });

  it('la SEULE zone volatile au-dessus des rangées est Z4 (`setup`), et elle disparaît au jet', () => {
    const avecSetup = scrollChildren(renderToStaticMarkup(
      <RollShell title="Athlétisme" subtitle="Gustav — Franchir (Athlétisme)" rows={[preRow]} rolled={false} setup={setupNode} actions={actions} />,
    ));
    const sansSetup = scrollChildren(renderToStaticMarkup(
      <RollShell title="Athlétisme" subtitle="Gustav — Franchir (Athlétisme)" rows={[preRow]} rolled={false} actions={actions} />,
    ));
    // Le MÊME `setup` passé post-jet : la coquille ne le rend plus (`!rolled && setup`).
    const postAvecSetup = scrollChildren(renderToStaticMarkup(
      <RollShell title="Athlétisme" subtitle="Gustav — Franchir (Athlétisme)" rows={[rolledRow()]} rolled setup={setupNode} actions={actions} />,
    ));
    const teteAvec = avecSetup.slice(0, avecSetup.indexOf('cs-rows'));
    const teteSans = sansSetup.slice(0, sansSetup.indexOf('cs-rows'));
    const tetePost = postAvecSetup.slice(0, postAvecSetup.indexOf('cs-rows'));
    expect(teteAvec, 'Z4 est bien rendue au-dessus des rangées, pré-jet').toContain('rm-options');
    expect(teteAvec.filter((c) => c !== 'rm-options'), 'et elle est le SEUL écart avec la tête sans Z4')
      .toEqual(teteSans);
    expect(tetePost, 'post-jet, `setup` n’est plus rendu : la tête retombe sur les seules zones stables')
      .toEqual(teteSans);
  });
});
