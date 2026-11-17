/**
 * LE TÉLÉCHARGEMENT D'UN FICHIER DU SERVEUR DU JEU PAR LA PAGE (#4402) : `PontDuNoyau.requeter` dans l'export Web
 * (`TransportDeLaPage`), le corps lu entier par le `fetch` de la page, puis remis à Godot en une fois.
 */

/** L'issue d'un téléchargement : `reponse`, le corps reçu entier ; `silence`, abandonné après `silenceS` secondes
 *  sans octet ; `echec`, la requête ou la lecture du corps a levé. */
export type IssueDuTelechargement = 'reponse' | 'silence' | 'echec';

/**
 * @contrat Transport
 * - `wfrpPont.telecharger(adresse, methode, corps, entetes, silenceS, rendre)` : la requête de Godot au serveur du jeu
 *   dans la page (`PontDuNoyau.requeter`), par le `fetch` de la page, le corps lu entier avant d'être rendu.
 * - `methode` est le verbe HTTP ; `corps`, le texte envoyé, `""` pour aucun ; `entetes`, une chaîne JSON, la liste des
 *   en-têtes `"Nom: valeur"`.
 * - Elle abandonne après `silenceS` secondes sans octet reçu ; le délai repart à chaque bloc.
 * - `rendre(issue, statut, octets, raison)` : `issue` vaut `reponse`, `silence` ou `echec` ; `statut`, le statut HTTP,
 *   `0` sans réponse ; `octets`, un `ArrayBuffer`, le corps reçu ; `raison`, ce qui a levé, `""` sur une `reponse`.
 */
export function telecharger(
  adresse: string,
  methode: string,
  corps: string,
  entetes: string,
  silenceS: number,
  rendre: (issue: IssueDuTelechargement, statut: number, octets: ArrayBuffer, raison: string) => void,
): void {
  const arret = new AbortController();
  const blocs: Uint8Array[] = [];
  let recus = 0;
  let statut = 0;
  let silencieux = false;
  let veille: ReturnType<typeof setTimeout> | undefined;
  const relancer = () => {
    clearTimeout(veille);
    veille = setTimeout(() => {
      silencieux = true;
      arret.abort();
    }, silenceS * 1000);
  };
  const finir = (issue: IssueDuTelechargement, raison: string) => {
    clearTimeout(veille);
    const octets = new Uint8Array(recus);
    let position = 0;
    for (const bloc of blocs) {
      octets.set(bloc, position);
      position += bloc.byteLength;
    }
    rendre(issue, statut, octets.buffer, raison);
  };
  relancer();
  void (async () => {
    try {
      const reponse = await fetch(adresse, {
        method: methode,
        body: corps === '' ? undefined : corps,
        headers: (JSON.parse(entetes) as string[]).map((ligne): [string, string] => {
          const deuxPoints = ligne.indexOf(':');
          return [ligne.slice(0, deuxPoints).trim(), ligne.slice(deuxPoints + 1).trim()];
        }),
        signal: arret.signal,
      });
      statut = reponse.status;
      relancer();
      const lecteur = reponse.body?.getReader();
      for (let lu = await lecteur?.read(); lu && !lu.done; lu = await lecteur!.read()) {
        blocs.push(lu.value);
        recus += lu.value.byteLength;
        relancer();
      }
      finir('reponse', '');
    } catch (erreur) {
      finir(silencieux ? 'silence' : 'echec', erreur instanceof Error ? erreur.message : String(erreur));
    }
  })();
}
