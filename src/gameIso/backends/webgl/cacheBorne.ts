/**
 * CACHE BORNÉ à budget d'OCTETS (#1374) — la machinerie d'éviction des textures statiques de
 * billboard (`svgTexture`). Module PUR : il ne connaît ni
 * three, ni le DOM — ce qu'il libère lui est donné (`disposer`), ce qu'il pèse aussi (`bytesDe`).
 *
 * INVARIANTS :
 *  - l'ordre d'insertion de la Map EST l'ordre d'usage : une entrée SERVIE est réinsérée en queue ;
 *  - une entrée ÉPINGLÉE n'est jamais évincée, quel que soit son âge — c'est ainsi que ce qui est
 *    POSÉ à l'écran survit à la pression du budget ;
 *  - une entrée pas encore RÉSOLUE n'est jamais évincée : il n'y a rien à libérer, et ses demandeurs
 *    tiennent déjà sa promesse ;
 *  - la valeur qu'une résolution est en train de RENDRE n'est jamais libérée par l'éviction de cette
 *    résolution : elle est touchée (queue de l'ordre d'usage) et sautée ;
 *  - un ÉCHEC n'est PAS mémoïsé : l'entrée sort du cache au rejet, la demande suivante refait `faire` ;
 *  - `disposer` est le SEUL chemin de libération, et il ne court jamais deux fois sur la même valeur
 *    (une valeur résolue après le retrait de son entrée est libérée comme orpheline, pas mémoïsée).
 *
 * ANGLES MORTS :
 *  - une entrée EN VOL pèse son ESTIMATION (`bytesEst`) et non son poids réel, remplacé à la
 *    résolution ; le consommateur l'estime à la MÊME formule que le poids réel
 *    (`octetsTextureStatique`), une demande SANS
 *    estimation pèserait zéro tant qu'elle court ;
 *  - une entrée en vol n'est jamais évincée : le stock ne retombe sous sa borne qu'une fois les
 *    cuissons servies ;
 *  - la protection de la valeur rendue ne vaut QUE pour l'éviction de sa propre résolution : une
 *    résolution SUIVANTE peut l'évincer avant que son demandeur ne s'en soit servi. Seule l'ÉPINGLE
 *    tient au-delà — c'est pourquoi un consommateur épingle ce qu'il ATTEND, pas seulement ce qu'il
 *    porte déjà.
 */

/** Ce qu'un cache borné doit savoir de ses valeurs : leur poids, et comment les libérer. */
export interface OptionsCacheBorne<T> {
  /** Budget initial, en octets. */
  budget: number;
  bytesDe: (valeur: T) => number;
  disposer: (valeur: T) => void;
}

/** Ce que l'appelant attache à une entrée : une POIGNÉE mutable, portée de la demande à sa
 *  résolution (le rang de file d'une cuisson, par exemple). `undefined` quand il n'y en a pas. */
export interface DemandeCacheBorne<P> {
  /** Poignée de l'entrée NEUVE — ignorée quand la clé est déjà au cache. */
  poignée?: P;
  /** Appelé quand la clé est SERVIE par le cache, avec la poignée de l'entrée retenue. */
  servir?: (poignée: P) => void;
  /** ESTIMATION du poids de la valeur à venir : ce que l'entrée pèse au budget TANT QU'ELLE COURT,
   *  remplacé par `bytesDe(valeur)` à la résolution. Sans elle, une rafale de demandes ne pèse rien et
   *  le stock gonfle sans borne le temps qu'elles se servent (mesuré en recette : 338 entrées pour
   *  8,9 Mo comptés pendant un demi-tour). */
  bytesEst?: number;
}

interface Entrée<T, P> {
  promise: Promise<T>;
  valeur?: T;
  bytes: number;
  poignée: P;
}

export class CacheBorne<T, P = undefined> {
  private readonly entrées = new Map<string, Entrée<T, P>>();
  private épinglées: ReadonlySet<string> = new Set();
  private budget: number;

  constructor(private readonly opts: OptionsCacheBorne<T>) {
    this.budget = opts.budget;
  }

  /** Change le budget d'octets et évince aussitôt ce qui dépasse — rend l'ANCIEN budget. */
  définirBudget(octets: number): number {
    const avant = this.budget;
    this.budget = octets;
    this.évincer();
    return avant;
  }

  /** Clés ÉPINGLÉES : jamais évincées, quel que soit leur âge. Le jeu d'épingles se REMPLACE (il
   *  décrit ce qui est posé à l'écran MAINTENANT), il ne s'accumule pas. */
  épingler(clés: Iterable<string>): void {
    this.épinglées = new Set(clés);
  }

  /** Les clés épinglées, en lecture seule — l'instrument par lequel une garde mesure ce que le stock
   *  protège. */
  épingles(): ReadonlySet<string> {
    return this.épinglées;
  }

  /** Valeur mémoïsée d'une clé, fabriquée par `faire` au manque. La POIGNÉE de la demande est passée
   *  à `faire` pour l'entrée neuve, et rendue à `servir` quand le cache répond. */
  obtenir(clé: string, faire: (poignée: P) => Promise<T>, demande?: DemandeCacheBorne<P>): Promise<T> {
    const servie = this.entrées.get(clé);
    if (servie) {
      this.entrées.delete(clé);
      this.entrées.set(clé, servie);
      demande?.servir?.(servie.poignée);
      return servie.promise;
    }
    // Lue par les fermetures de `promise` AVANT son affectation : la déclaration ne peut pas porter
    // l'initialiseur.
    // eslint-disable-next-line prefer-const
    let entrée: Entrée<T, P>;
    const poignée = demande?.poignée as P;
    const promise = faire(poignée).then(
      (valeur) => {
        if (this.entrées.get(clé) === entrée) {
          entrée.valeur = valeur;
          entrée.bytes = this.opts.bytesDe(valeur);
          // La valeur est en train d'être RENDUE à son demandeur : l'entrée est touchée (queue de
          // l'ordre d'usage) et l'éviction de CETTE résolution la saute — sinon le demandeur recevrait
          // une valeur déjà libérée (une texture morte posée sur un quad).
          this.entrées.delete(clé);
          this.entrées.set(clé, entrée);
          this.évincer(clé);
        } else {
          this.opts.disposer(valeur);
        }
        return valeur;
      },
      (e: unknown) => {
        if (this.entrées.get(clé) === entrée) this.entrées.delete(clé);
        throw e;
      },
    );
    entrée = { promise, bytes: Math.max(0, demande?.bytesEst ?? 0), poignée };
    this.entrées.set(clé, entrée);
    // Une entrée ESTIMÉE pèse dès sa mise en file : c'est tout l'objet de l'estimation — la pression
    // s'exerce pendant la cuisson, pas seulement après.
    if (entrée.bytes > 0) this.évincer(clé);
    return promise;
  }

  /** Valeur DÉJÀ résolue d'une clé, en SYNCHRONE (`undefined` tant que la fabrication court). Cette
   *  lecture ne compte PAS comme un usage : une boucle d'image la répète soixante fois par seconde et
   *  l'ordre du cache doit y rester ce qu'il est. Ce sont les ÉPINGLES qui protègent ce qui est à
   *  l'écran. */
  valeur(clé: string): T | undefined {
    return this.entrées.get(clé)?.valeur;
  }

  stats(): { entries: number; bytes: number } {
    let bytes = 0;
    for (const e of this.entrées.values()) bytes += e.bytes;
    return { entries: this.entrées.size, bytes };
  }

  /** Vide le cache, libère ce qui est résolu et oublie les épingles. Ce qui court encore sera libéré
   *  en ORPHELIN à sa résolution : son entrée n'est plus là pour le retenir. */
  vider(): void {
    for (const e of this.entrées.values()) {
      if (e.valeur !== undefined) this.opts.disposer(e.valeur);
      else void e.promise.catch(() => undefined);
    }
    this.entrées.clear();
    this.épinglées = new Set();
  }

  /** Évince jusqu'à rentrer dans le budget. `rendue` = la clé dont la valeur part chez son demandeur à
   *  l'instant même : elle est SAUTÉE (cf. les invariants de l'en-tête). */
  private évincer(rendue?: string): void {
    let total = 0;
    for (const e of this.entrées.values()) total += e.bytes;
    for (const [clé, e] of this.entrées) {
      if (total <= this.budget) return;
      if (clé === rendue || this.épinglées.has(clé) || e.valeur === undefined) continue;
      this.entrées.delete(clé);
      total -= e.bytes;
      this.opts.disposer(e.valeur);
    }
  }
}
