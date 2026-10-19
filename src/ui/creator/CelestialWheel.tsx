/**
 * Roue céleste (arbitrage user 2026-07-13) — sélecteur cérémoniel du Signe astral (ADE II 3) en
 * remplacement du `<select>` nu jugé « catastrophe de densité ». L'ASTROLABE DE LAITON de la planche
 * ratifiée (mock « 4 — Signe astral », l'étalon du lot « ossature enforcée » #393) : géométrie et
 * matières AUX VALEURS de la
 * planche — deux anneaux + un anneau pointillé, un rayon gravé par position portant sa BORNE d100,
 * un moyeu qui nomme l'élu, et l'aiguille tracée du centre au signe posé.
 *
 * La roue rend des POSITIONS, pas des entrées de données : c'est l'appelant qui groupe (les quatre
 * destins de L'Étoile du Sorcier partagent une position — cf. `STAR_POSITIONS`). Elle ne connaît ni
 * `stars.json` ni les libellés de destin : `signs` + `selectedKey` + `onSelect`, rien d'autre.
 *
 * SVG en tokens (`--atelier-*`), aucune palette littérale. Les signes composent `RadioGroup` (`svg`).
 *
 * ANTI-TÉLESCOPAGE (acquis du juge vision P3, tenu ICI par la GÉOMÉTRIE de la planche plutôt que par
 * l'escamotage) : les libellés s'ancrent PAR QUADRANT — `start` à droite du cercle (le texte s'étend
 * vers l'extérieur), `end` à gauche, `middle` aux seuls pôles haut/bas. Chaque libellé fuit ainsi le
 * centre au lieu de chevaucher ses voisins, et les vingt tiennent EN CLAIR (la planche les montre
 * tous nommés). Les tirets de l'ancienne roue étaient le pansement d'un astrolabe trop petit
 * (viewBox 330 px, rayon 110) : la roue de la planche (viewBox 840×560, rayon 252) n'en a plus
 * besoin — et l'escamotage mentait au repos (sans élu, `activeIdx` retombait à 0 et empilait trois
 * noms au pôle nord, cf. capture `ossature-04-avant`).
 */
import { RadioGroup } from '../composites/GroupesDeChoix';

export interface WheelSign {
  /** Clé de POSITION (l'appelant la choisit stable — jamais un libellé). */
  key: string;
  label: string;
  /** Borne d100 de la fourchette RAW, gravée sur le rayon. */
  roll: number;
}

/** Moyeu : ce que la roue grave au centre une fois l'aiguille posée (l'appelant fournit les mots —
 *  la roue ne sait pas ce qu'est un « signe »). */
export interface WheelHub {
  title: string;
  /** Rubrique small-caps sous le nom (ex. « Signe de la Précision »). */
  sub?: string | null;
  /** Note gravée sous la rubrique (ex. « d100 : 11-15 »). */
  note?: string | null;
}

// Géométrie de la planche (unités du viewBox) — le SVG est mis à l'échelle par le CSS.
const CX = 420;
const CY = 280;
const R_RING = 252; // anneau extérieur
const R_RING_IN = 246; // filet laiton intérieur
const R_DASH = 164; // anneau pointillé
const R_HUB = 96; // moyeu
const R_HUB_IN = 88; // filet du moyeu
const R_DOT = 210; // pastille du signe
const R_SPOKE_A = 96; // rayon gravé — départ (bord du moyeu)
const R_SPOKE_B = 150; // rayon gravé — arrivée
const R_NUM = 182; // borne d100
const R_LABEL = 228; // libellé

/** Découpe un libellé en lignes d'au plus `max` caractères (coupe aux MOTS) — le moyeu n'a pas de
 *  `flex`, chaque ligne est un `<tspan>`/`<text>` qu'il faut composer soi-même. */
function wrapWords(text: string, max: number, maxLines: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last != null && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, maxLines);
}

export function CelestialWheel({ signs, selectedKey, onSelect, hub, placeholder }: {
  signs: WheelSign[];
  selectedKey?: string;
  onSelect: (key: string) => void;
  /** Absent = rien d'élu : le moyeu porte `placeholder`. */
  hub?: WheelHub;
  placeholder?: string;
}) {
  const n = signs.length;
  const selIdx = signs.findIndex((s) => s.key === selectedKey);
  // Le roving tabindex a besoin d'UNE entrée focusable même sans élu — mais `activeIdx` ne DÉSIGNE
  // alors personne (aucun rendu ne s'y accroche : `sel` compare la CLÉ, jamais l'index).
  const activeIdx = selIdx >= 0 ? selIdx : 0;

  const hubTitle = hub ? wrapWords(hub.title, 12, 2) : [];
  const hubSub = hub?.sub ? wrapWords(hub.sub.toUpperCase(), 20, 3) : [];
  // Bloc de moyeu centré verticalement sur (CX, CY) : titre (22 d'interligne) + rubrique (13) + note
  // (14) — hauteurs de la planche, empilées depuis le haut du bloc mesuré.
  const hubH = hubTitle.length * 22 + hubSub.length * 13 + (hub?.note ? 14 : 0);
  let hubY = CY - hubH / 2 + 11;

  return (
    <div className="celestial-wheel">
      <svg viewBox="0 0 840 560">
        <defs>
          {/* Pastille de l'élu : la gemme allumée de la planche (`radialGradient #wheelSel`). Les
              teintes sont posées en ATTRIBUT (`stop-color` accepte `var()`) — deux classes de plus
              pour deux `<stop>` seraient de la dette de cadran. */}
          <radialGradient id="cw-sel" cx="35%" cy="30%">
            <stop offset="0%" stopColor="var(--atelier-brass-light)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </radialGradient>
        </defs>
        <circle className="cw-ring" cx={CX} cy={CY} r={R_RING} />
        <circle className="cw-ring-fine" cx={CX} cy={CY} r={R_RING_IN} />
        <circle className="cw-ring-fine" cx={CX} cy={CY} r={R_DASH} strokeDasharray="3 5" />

        <RadioGroup svg label="Roue céleste — signe astral" count={n} activeIndex={activeIdx} onActivate={(idx) => onSelect(signs[idx].key)}>
          {signs.map((s, i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
            const dx = Math.cos(a);
            const dy = Math.sin(a);
            const at = (r: number) => ({ x: CX + r * dx, y: CY + r * dy });
            const dot = at(R_DOT);
            const sel = s.key === selectedKey;
            // Ancrage par QUADRANT (cf. en-tête) : `middle` aux SEULS pôles (dx≈0), sinon le libellé
            // s'étend vers l'extérieur du cercle. Le seuil est serré à dessein — une bande « middle »
            // large recentrerait les libellés sur leur pastille et les ferait se chevaucher.
            const anchor: 'start' | 'middle' | 'end' = Math.abs(dx) < 0.02 ? 'middle' : dx > 0 ? 'start' : 'end';
            // Le libellé fuit sa pastille de quelques unités le long du rayon (planche : ~+2).
            const lab = at(R_LABEL + (anchor === 'middle' ? 0 : 2));
            const num = at(R_NUM);
            const sa = at(R_SPOKE_A);
            const sb = at(R_SPOKE_B);
            return (
              <g
                key={s.key}
                className={sel ? 'cw-node sel' : 'cw-node'}
                role="radio"
                aria-checked={sel}
                aria-label={s.label}
                tabIndex={i === activeIdx ? 0 : -1}
                onClick={() => onSelect(s.key)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(s.key);
                  }
                }}
              >
                {/* L'aiguille : du moyeu au signe posé (planche — seul l'élu la porte). */}
                {sel && <line className="cw-needle" x1={CX} y1={CY} x2={dot.x} y2={dot.y} />}
                <line className="cw-spoke" x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />
                <circle className="cw-dot" cx={dot.x} cy={dot.y} r={sel ? 8 : 4.5} fill={sel ? 'url(#cw-sel)' : undefined} />
                <text className="cw-tick" x={num.x} y={num.y} textAnchor="middle" dominantBaseline="middle">{s.roll}</text>
                <text className="cw-label" x={lab.x} y={lab.y} textAnchor={anchor} dominantBaseline="middle">{s.label}</text>
                <title>{s.label}</title>
              </g>
            );
          })}
        </RadioGroup>

        <circle className="cw-hub" cx={CX} cy={CY} r={R_HUB} />
        <circle className="cw-ring-fine" cx={CX} cy={CY} r={R_HUB_IN} />
        {hub ? (
          <>
            {hubTitle.map((line) => {
              const y = hubY;
              hubY += 22;
              return <text key={line} className="cw-hub-title" x={CX} y={y} textAnchor="middle" dominantBaseline="middle">{line}</text>;
            })}
            {hubSub.map((line) => {
              const y = hubY;
              hubY += 13;
              return <text key={line} className="cw-hub-sub" x={CX} y={y} textAnchor="middle" dominantBaseline="middle">{line}</text>;
            })}
            {hub.note && <text className="cw-hub-note" x={CX} y={hubY + 3} textAnchor="middle" dominantBaseline="middle">{hub.note}</text>}
          </>
        ) : (
          placeholder && (
            <text className="cw-hub-note" x={CX} y={CY} textAnchor="middle" dominantBaseline="middle">
              {wrapWords(placeholder, 16, 3).map((line, i, all) => (
                <tspan key={line} x={CX} dy={i === 0 ? -((all.length - 1) * 8) : 16}>{line}</tspan>
              ))}
            </text>
          )
        )}
      </svg>
    </div>
  );
}
