import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { reglesCss, FEUILLES_PARTAGEES } from '../../scripts/guards/lib/cssCouches.mjs';
import { OWNERS } from '../../scripts/guards/lib/marqueursPossedes.mjs';

const RACINE_REPO = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Garde structurelle #1318 P8/D10 — les MARQUEURS STRUCTURELS (classes racines distinctives des
 * primitives de `docs/primitives.md`) sont la PROPRIÉTÉ du fichier de leur
 * primitive. Même patron qu'`aria-primitive-guard` (rôle → fichier propriétaire), appliqué au markup :
 * `gallery-exhaustive` garantit le SPÉCIMEN (la primitive existe et est montée), jamais l'USAGE — rien
 * ne rougissait quand un écran RECOPIAIT le markup au lieu de composer la primitive.
 *
 * COMPOSITION vs RECOPIE — seule la RECOPIE rougit : un écran qui monte `<ActivityPane>` reçoit
 * `.activity-pane*` PAR la primitive (aucune occurrence dans sa source, donc aucun hit ici) ; un écran
 * qui écrit lui-même `className="activity-pane-desc"` a recopié le markup. Un modificateur d'appelant
 * passé en prop `className` (`<Tabs className="port-tabs">`) n'est pas un marqueur.
 *
 * PORTÉE — le scan couvre les `.tsx` de `src/ui` (récursif, hors fichiers de test). Hors `src/ui`,
 * le stock de ces marqueurs est mesuré VIDE au 2026-08-16 (sonde sur tous les `.tsx` de `src` :
 * 0 occurrence) — étendre le scan le jour où un marqueur y apparaîtra.
 *
 * CALIBRAGE — seules les classes appartenant à un COMPOSANT de la table sont gatées. Les primitives
 * CSS GLOBALES de `styles.css` (`.bar`, `.grid`, `.split`, `.btn`, `.chip`, `.seg`, textures `.tx-*`
 * d'`ornaments.css`) sont FAITES pour être posées partout : les gater serait du bruit, elles restent
 * hors table.
 */

const UI = 'src/ui';

/** Les composants de `src/ui`, hors tests — chemin DEPUIS `src/ui/`, la forme des tables ci-dessous. */
function composants(): { chemin: string; code: string }[] {
  return readCorpus([UI], { exts: ['.tsx'] }).map(({ rel, text }) => ({
    chemin: rel.slice(UI.length + 1),
    code: text,
  }));
}

/** Une classe citée en commentaire (JSDoc de renvoi vers la primitive) n'est pas une pose de markup.
 *  Les commentaires sont blanchis (et non supprimés) pour préserver la numérotation de lignes. */
const blank = (m: string) => m.replace(/[^\n]/g, ' ');
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\/\/.*$/gm, blank);


/**
 * Stock hors-propriétaire : VIDE (2026-08-16). Les 12 recopies mesurées à la pose de la garde ont été
 * migrées dans la MÊME vague (V10) — sous-composants de primitive (`MenuCardHead`, `DetailIdentity`,
 * `EmbeddedShell`), slot ajouté (`ActivityPane lead`), composition directe (`MenuCard`, `ScreenMeta`,
 * `DetailFrame`) et classes propres pour les sites qui n'étaient PAS la primitive (`.cart-step-cell`,
 * `.btn-sq`, `.market-carrier`). La garde reste sans baseline : toute recopie NEUVE rougit.
 */
const BASELINE: Record<string, string[]> = {};

const MARKERS = Object.keys(OWNERS);
const STRING_LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g;

/** Marqueurs posés en LITTÉRAL de classe (attribut ou variable de classe), avec leur ligne. */
function markersIn(src: string): { marker: string; line: number }[] {
  const out: { marker: string; line: number }[] = [];
  let m: RegExpExecArray | null;
  STRING_LITERAL.lastIndex = 0;
  while ((m = STRING_LITERAL.exec(src))) {
    const text = m[1] ?? m[2] ?? m[3] ?? '';
    if (text === '') continue;
    const line = src.slice(0, m.index).split('\n').length;
    for (const marker of MARKERS) {
      if (new RegExp(`(?<![\\w-])${marker}(?![\\w-])`).test(text)) out.push({ marker, line });
    }
  }
  return out;
}

/** Les RECOPIES : marqueurs posés hors de leur fichier propriétaire, au-delà du stock mesuré. */
function recopies(fichiers: readonly { chemin: string; code: string }[]): string[] {
  const offenders: string[] = [];
  for (const { chemin, code } of fichiers) {
    for (const { marker, line } of markersIn(stripComments(code))) {
      if (OWNERS[marker].includes(chemin)) continue;
      if (BASELINE[chemin]?.includes(marker)) continue;
      offenders.push(
        `${chemin}:${line} → "${marker}" recopié — composer ${OWNERS[marker].join(' / ')} au lieu de réécrire son markup`,
      );
    }
  }
  return offenders;
}

describe('#1318 P8/D10 — marqueurs structurels = propriété des primitives (recopie de markup bloquée)', () => {
  const found = composants().map(({ chemin, code }) => ({ path: chemin, hits: markersIn(stripComments(code)) }));

  it('aucune recopie de marqueur hors du fichier propriétaire au-delà du stock mesuré', () => {
    const offenders = recopies(composants());
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('preuve par mutation côté MARKUP — un écran qui recopie le cadre rougit, celui qui le compose non', () => {
    const recopie = [
      '<div className="cadre-pied"><button /></div>',
      '<div className="modal-body" />',
      '<h3 className="modal-title" />',
      '<div className="modal-overlay"><div className="modal x" /></div>',
      '<button className="btn small cadre-fermer" />',
    ].join('\n');
    const compose = '<Modal title="t" croix footer={<button className="btn">ok</button>}>corps</Modal>';
    expect(recopies([{ chemin: 'FauxEcran.tsx', code: recopie }]).map((o) => o.split(' → ')[1].split(' ')[0])).toEqual([
      '"cadre-pied"', '"modal-body"', '"modal-title"', '"modal-overlay"', '"modal"', '"cadre-fermer"',
    ]);
    expect(recopies([{ chemin: 'FauxEcran.tsx', code: compose }])).toEqual([]);
  });

  it('la baseline est DÉCROISSANTE — aucune entrée périmée', () => {
    const live = new Set(
      found.flatMap(({ path, hits }) => hits.filter((h) => !OWNERS[h.marker].includes(path)).map((h) => `${path}|${h.marker}`)),
    );
    const stale = Object.entries(BASELINE)
      .flatMap(([path, marks]) => marks.map((m) => `${path}|${m}`))
      .filter((k) => !live.has(k))
      .map((k) => `${k.replace('|', ' → ')} : recopie disparue, RETIRER l'entrée de BASELINE`);
    expect(stale, stale.join('\n')).toEqual([]);
  });

  it('chaque primitive propriétaire pose bien son marqueur (table non périmée)', () => {
    const posed = new Set(found.flatMap(({ path, hits }) => hits.map((h) => `${path}|${h.marker}`)));
    const dead = Object.entries(OWNERS)
      .filter(([marker, owners]) => !owners.some((o) => posed.has(`${o}|${marker}`)))
      .map(([marker, owners]) => `"${marker}" : plus posé par ${owners.join(' / ')} — table OWNERS à mettre à jour`);
    expect(dead, dead.join('\n')).toEqual([]);
  });
});

/**
 * #1806 §5.2 — une classe DÉFINIE par le module d'une primitive est POSÉE par cette primitive : son
 * `fichier`, un `poseurs` déclaré au manifeste (fichier ou préfixe de dossier), ou un composant qui
 * la reçoit en enfant. Au-delà de DEUX poseurs étrangers, la classe n'est plus la propriété d'un
 * module : c'est un contrat de couche, qui monte en `components.css` + catalogue. Complète la table
 * OWNERS (`scripts/guards/lib/marqueursPossedes.mjs`), qui garde le MARKUP ; celle-ci garde la FEUILLE.
 *
 * Calibrage : seule la classe que la règle DÉFINIT compte (sélecteur sans combinateur, première
 * classe du compound). Une classe de la couche PARTAGÉE ou d'un AUTRE module de primitive citée en
 * contexte est hors sujet (la garde §5.3 de `css-modules-guard` la juge).
 */
const SEUIL_POSEURS_ETRANGERS = 3;

/**
 * Stock NOMINATIF des classes qu'un module de primitive déclare SANS que sa primitive les pose
 * (`feuille|classe`, mesuré 2026-09-18). Chacune est une identité d'écran parquée dans le module d'une
 * primitive voisine — un défaut à SOLDER en la ramenant à son écran, jamais à blanchir : la garde
 * exige qu'une entrée soldée soit retirée, et le lot de la primitive concernée s'en charge.
 */
const POSEUR_ABSENT_STOCK: readonly string[] = [
  // `gauges.css` : l'écran de voyage en mer y a laissé sa mise en page (lot navire).
  'src/ui/styles/gauges.css|sea-voyage',
  'src/ui/styles/gauges.css|sea-voyage-head',
  'src/ui/styles/gauges.css|sea-voyage-gauges',
  'src/ui/styles/gauges.css|sea-voyage-meta',
  'src/ui/styles/gauges.css|sv-weather',
  'src/ui/styles/gauges.css|sea-voyage-events',
  'src/ui/styles/gauges.css|sea-voyage-log',
  'src/ui/styles/gauges.css|sea-voyage-notes',
  'src/ui/styles/gauges.css|sea-voyage-orders',
  // Groupe de jauges posé par le tableau de bord État, pas par une primitive de jauge.
  'src/ui/styles/gauges.css|notch-gauge-stack',
  // Coin de rose gravé posé par la carte de héros, pas par `RoseAxes`.
  'src/ui/styles/rose.css|rose-corner',
  // Textures d'ambiance : posées par 4+ écrans — identité PARTAGÉE restée au module d'`Ornaments`.
  'src/ui/styles/ornaments.css|tx-parchment',
  'src/ui/styles/ornaments.css|tx-ink',
];

function classesDefiniesPar(cssRel: string): Set<string> {
  const out = new Set<string>();
  for (const r of reglesCss(readFileSync(join(RACINE_REPO, cssRel), 'utf8'))) {
    for (const sel of r.selecteurs) {
      const parts = sel.trim().split(/\s+|>|\+|~/).filter(Boolean);
      if (parts.length !== 1) continue;
      const c = (parts[0].match(/\.[a-zA-Z_-][\w-]*/g) ?? [])[0];
      if (c) out.add(c.slice(1));
    }
  }
  return out;
}

/** classe → fichiers `.tsx` qui la POSENT (token d'un littéral de `className`) — scan PRÉCIS : il
 *  répond « qui pose », et sert donc au jugement du nombre de poseurs ÉTRANGERS.
 *  ANGLE MORT assumé : seul `className=` est lu — une classe posée par TABLE de correspondance
 *  (`src/ui/CharacterPreview.tsx:86`) n'est pas comptée ici ; c'est `mentionsParFichier` qui la voit. */
function posesParFichier(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const { rel, text } of readCorpus(['src'], { exts: ['.tsx'] })) {
    if (estFichierVitest(rel)) continue;
    for (const m of stripComments(text).matchAll(/className\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*'|`[^`]*`)/g)) {
      for (const seg of m[1].matchAll(/(["'`])([^"'`]*)\1/g)) {
        for (const tok of seg[2].split(/[\s${}]+/)) {
          if (!/^[a-zA-Z][\w-]*$/.test(tok)) continue;
          if (!out.has(tok)) out.set(tok, new Set());
          out.get(tok)!.add(rel);
        }
      }
    }
  }
  return out;
}

/** classe → fichiers qui la MENTIONNENT, où que ce soit dans un littéral de chaîne (attribut,
 *  gabarit, variable de classe, table de modificateurs, déf de décor). Scan TOLÉRANT : il répond
 *  « quelqu'un s'en sert-il ? », et ne sert donc qu'à débusquer la règle MORTE — s'en tenir à
 *  `className=` ferait passer pour morte toute classe posée par un gabarit ou une table. */
function mentionsDuTexte(text: string): string[] {
  const out = new Set<string>();
  // Les littéraux d'`id=` sont RETIRÉS avant le scan : un identifiant de nœud n'habille rien, et le
  // gabarit `id={`eq-slot-${…}`}` (`src/ui/EquipmentPanel.tsx:217`) couvrirait sinon toute une
  // famille `.eq-slot-*` morte. L'accolade se ferme À SON NIVEAU (une interpolation `${…}` est
  // traversée) : couper au premier `}` laisserait une apostrophe inverse orpheline, qui décalerait
  // l'appariement de TOUS les gabarits suivants du fichier.
  const src = stripComments(text).replace(/\bid\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"\n]*"|'[^'\n]*'|`[^`]*`)/g, ' ');
  // Trois délimiteurs, trois passes : un gabarit contient des apostrophes (`${x ?? ''}`), donc une
  // classe de caractères qui exclurait les TROIS délimiteurs s'arrêterait au milieu du gabarit et
  // manquerait la classe qui l'ouvre.
  for (const seg of [...src.matchAll(/"([^"\n]*)"/g), ...src.matchAll(/'([^'\n]*)'/g), ...src.matchAll(/`([^`]*)`/g)]) {
    for (const tok of seg[1].split(/[\s${}]+/)) {
      // GABARIT reconnu : `cb-tone-${ton}` laisse le préfixe `cb-tone-` — il POSE toute la famille.
      if (!/^[a-zA-Z][\w-]*$/.test(tok) && !/^[a-zA-Z][\w-]*-$/.test(tok)) continue;
      out.add(tok);
    }
  }
  return [...out];
}

function mentionsParFichier(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const { rel, text } of readCorpus(['src'], { exts: ['.tsx', '.ts'] })) {
    if (estFichierVitest(rel)) continue;
    for (const tok of mentionsDuTexte(text)) {
      if (!out.has(tok)) out.set(tok, new Set());
      out.get(tok)!.add(rel);
    }
  }
  return out;
}

describe('#1806 §5.2 — une classe d’un module de primitive est posée par sa primitive', () => {
  const manifeste: { id: string; fichier: string; css?: string; poseurs?: string[] }[] = JSON.parse(
    readFileSync(join(RACINE_REPO, 'src/data/primitives.manifest.json'), 'utf8'),
  );
  const aCss = manifeste.filter((e) => e.css && existsSync(join(RACINE_REPO, e.css!)));

  it('aucune classe n’est posée par 3 fichiers étrangers ou plus (elle serait PARTAGÉE)', () => {
    const poses = posesParFichier();
    const partagees = new Set(
      FEUILLES_PARTAGEES.filter((f) => existsSync(join(RACINE_REPO, f))).flatMap((f) => [...classesDefiniesPar(f)]),
    );
    const fautes: string[] = [];
    for (const e of aCss) {
      const permis = [e.fichier, ...(e.poseurs ?? [])];
      for (const c of classesDefiniesPar(e.css!)) {
        if (partagees.has(c)) continue;
        const etrangers = [...(poses.get(c) ?? [])].filter((f) => !permis.some((p) => f === p || f.startsWith(p)));
        if (etrangers.length >= SEUIL_POSEURS_ETRANGERS) {
          fautes.push(
            `${e.css} : .${c} posée par ${etrangers.length} fichiers hors de « ${permis.join(', ')} » (${etrangers.join(', ')}) — la remonter en couche partagée + catalogue, ou déclarer \`poseurs\``,
          );
        }
      }
    }
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('chaque classe DÉFINIE par un module de primitive est posée par la primitive qui le possède', () => {
    const mentions = mentionsParFichier();
    const partagees = new Set(
      FEUILLES_PARTAGEES.filter((f) => existsSync(join(RACINE_REPO, f))).flatMap((f) => [...classesDefiniesPar(f)]),
    );
    // Une même feuille peut être POSSÉDÉE par plusieurs primitives (`gauges.css` : LifeBar, NotchGauge,
    // WindRose) : les poseurs se prennent en UNION, sinon chaque entrée dénoncerait les classes des autres.
    const permisParCss = new Map<string, string[]>();
    for (const e of aCss) permisParCss.set(e.css!, [...(permisParCss.get(e.css!) ?? []), e.fichier, ...(e.poseurs ?? [])]);
    /** Qui mentionne cette classe — en toutes lettres, ou par le PRÉFIXE d'un gabarit. */
    const quiPose = (c: string): string[] => {
      const exact = [...(mentions.get(c) ?? [])];
      const parGabarit = [...mentions].filter(([tok]) => tok.endsWith('-') && c.startsWith(tok)).flatMap(([, f]) => [...f]);
      return [...new Set([...exact, ...parGabarit])];
    };
    const orphelines: string[] = [];
    for (const [css, permis] of permisParCss) {
      for (const c of classesDefiniesPar(css)) {
        if (partagees.has(c) || POSEUR_ABSENT_STOCK.includes(`${css}|${c}`)) continue;
        const qui = quiPose(c);
        if (!qui.length) orphelines.push(`${css} : .${c} n’est posée NULLE PART — règle MORTE, à supprimer`);
        else if (!qui.some((f) => permis.some((p) => f === p || f.startsWith(p)))) {
          orphelines.push(
            `${css} : .${c} n’est posée que par ${qui.join(', ')} — hors de « ${[...new Set(permis)].join(', ')} » : identité d’ÉCRAN parquée dans un module de primitive`,
          );
        }
      }
    }
    expect(orphelines, orphelines.join('\n')).toEqual([]);
    const soldees = POSEUR_ABSENT_STOCK.filter((k) => {
      const [css, c] = k.split('|');
      const permis = permisParCss.get(css) ?? [];
      return !classesDefiniesPar(css).has(c) || quiPose(c).some((f) => permis.some((p) => f === p || f.startsWith(p)));
    });
    expect(soldees, `Entrée(s) SOLDÉE(s) du stock de poseurs — retirer la ligne :\n${soldees.join('\n')}`).toEqual([]);
  });

  it('un IDENTIFIANT de nœud ne pose aucune classe — le détecteur voit la règle morte', () => {
    const source = [
      'const cell = <div id={`eq-slot-${layer.key}`} className="eq-slot-live">…</div>;',
      'const autre = <span id="eq-slot-tete" />;',
      'const suite = <div className={`set-card ${actif ? \'active\' : \'\'}`} />;',
    ].join('\n');
    const tokens = mentionsDuTexte(source);
    expect(tokens, 'la classe réellement posée reste vue').toContain('eq-slot-live');
    expect(tokens, 'le gabarit qui SUIT garde son appariement d’apostrophes inverses').toContain('set-card');
    expect(tokens, 'le gabarit d’`id` ne couvre pas la famille `.eq-slot-*`').not.toContain('eq-slot-');
    expect(tokens, 'un `id` littéral ne pose rien non plus').not.toContain('eq-slot-tete');
  });

  it('chaque `poseurs` déclaré est un chemin RÉEL (table non périmée)', () => {
    const morts = aCss.flatMap((e) =>
      (e.poseurs ?? []).filter((p) => !existsSync(join(RACINE_REPO, p))).map((p) => `${e.id} : « ${p} » n’existe pas`),
    );
    expect(morts, morts.join('\n')).toEqual([]);
  });
});
