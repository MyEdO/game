// DÉTECTEURS PURS de la HAUTEUR (#1847) — ils ne lisent qu'un RELEVÉ, jamais le DOM : c'est ce qui
// les rend testables à fixtures (`detecteurs-hauteur.test.mjs`, gate `test:recette`) alors que le
// contrat qu'ils gardent est un contrat de RENDU, invisible à jsdom.
// La MESURE vit dans la sonde navigateur (`hauteur-reelle.mjs`), le VERDICT ici.
//
// L'invariant qu'ils servent, à chacune des vues de `vues-recette.json` : l'action principale d'un
// écran est atteignable sans défiler la PAGE, et un corps de modale n'est jamais écrasé par ses
// bandes.

/** Une boîte COUVRE le viewport si ses quatre bords y collent : elle n'est plus un cadre DANS un
 *  écran, elle EST l'écran. Tolérance d'UN pixel, comme partout ici. */
function couvreLeViewport(boite, fenetre) {
  if (!boite || !fenetre) return false;
  return boite.left <= 1 && boite.top <= 1
    && boite.right >= fenetre.largeur - 1 && boite.bottom >= fenetre.hauteur - 1;
}

/**
 * SCROLLPORT DE PAGE — mesure FONDATRICE du ticket (#1847) : à 1366×650, la carte du menu principal
 * faisait 782px et ce qui défilait était la surface plein champ qui la porte. Rien d'ancré ne le
 * restait, et l'action principale pouvait sortir de l'écran.
 *
 * Le critère est structurel, jamais une valeur d'écran : **le scrollport ne doit jamais être
 * `document.scrollingElement` — ni un élément qui en tient lieu.** Une boîte défilante qui COUVRE
 * tout le viewport est le scrollport de page sous un autre nom : la distinction « page » / « cadre »
 * ne se lit pas au nom de l'élément, elle se lit à sa BOÎTE.
 * Un contenu plus haut que la fenêtre reste légitime — il défile DANS un cadre (`.screen-scroll`,
 * le corps d'une carte, un inspecteur), et ce qui est autour de ce cadre, lui, ne bouge pas.
 *
 * `defileurs` sert des deux côtés du verdict : il porte les cadres qui en tiennent lieu (jugés) et
 * dit, quand la page déborde, où le contenu aurait dû aller.
 *
 * @param {{ vue: string, ecran: string, page: { scrollH: number, clientH: number },
 *           fenetre?: { largeur: number, hauteur: number },
 *           defileurs?: { sel: string, scrollH: number, clientH: number,
 *                         boite?: { left: number, top: number, right: number, bottom: number } }[] }} releve
 * @returns {string[]} un défaut par scrollport de page (liste vide = tout défile dans un cadre)
 */
export function scrollportDePage(releve) {
  const { page } = releve;
  if (!page) return [`${releve.vue} · ${releve.ecran} : aucune mesure de page — sonde aveugle`];
  const out = [];
  const cadres = (releve.defileurs ?? []).filter((d) => d.scrollH - d.clientH > 1);
  const debord = +(page.scrollH - page.clientH).toFixed(1);
  if (debord > 1) {
    const ou = cadres.length
      ? `les cadres défilants montés (${cadres.map((d) => d.sel).join(', ')}) ne l'absorbent pas`
      : `aucun cadre défilant ne le recueille`;
    out.push(`${releve.vue} · ${releve.ecran} : la PAGE défile de ${debord}px (scrollHeight ${page.scrollH} > clientHeight ${page.clientH}) — ${ou}`);
  }
  for (const d of cadres) {
    // Un cadre dont la boîte commence SOUS le viewport est la vraie cause : la page défile de
    // quelques pixels, mais ce qui est en jeu est un cadre entier hors champ. Le dire, sinon le
    // chiffre du débord de page (« 3px ») est exact et trompeur.
    if (releve.fenetre && d.boite && d.boite.top >= releve.fenetre.hauteur - 1) {
      out.push(
        `${releve.vue} · ${releve.ecran} : « ${d.sel} » commence SOUS la fenêtre (haut ${d.boite.top} pour ` +
        `${releve.fenetre.hauteur}px) et porte ${d.scrollH}px de contenu dans ${d.clientH}px — ce qu'il tient ` +
        `n'est pas à l'écran`,
      );
    }
    if (couvreLeViewport(d.boite, releve.fenetre)) {
      out.push(
        `${releve.vue} · ${releve.ecran} : « ${d.sel} » couvre TOUT le viewport et défile de ` +
        `${+(d.scrollH - d.clientH).toFixed(1)}px (scrollHeight ${d.scrollH} > clientHeight ${d.clientH}) — ` +
        `c'est le scrollport de PAGE sous un autre nom : rien d'ancré ne le reste`,
      );
    }
  }
  return out;
}

/**
 * CORPS DE MODALE ÉCRASÉ — « la fenêtre tient-elle ce qu'elle RÉCLAME ? ». Aucune constante ici :
 * le contrat est publié par le CSS lui-même (`roll-shell.css` : `--roll-fenetre` la boîte réclamée,
 * `--roll-band-min` / `--roll-dock-min` les planchers des deux bandes), la sonde le lit au
 * `getComputedStyle` du voile et le passe tel quel. Le détecteur ne fait que confronter.
 *
 * Ce qu'une fenêtre DOIT tenir dès lors que son corps défile : sa boîte réclamée, ou — si l'écran
 * est trop bas pour elle — tout ce que l'écran laisse une fois les deux planchers pris. En deçà,
 * ce sont les bandes qui la tiennent, pas l'écran. Tolérance d'UN pixel : les bandes se calculent
 * en `vh`, donc en sous-pixels.
 *
 * Une fenêtre dont le voile ne PUBLIE PAS son contrat est un défaut NOMMÉ, jamais un silence : le
 * jour où `--roll-fenetre` disparaît, la sonde doit crier, pas devenir muette.
 *
 * @param {{ vue: string, modales?: { quoi: string, corps: { clientH: number, scrollH: number },
 *           place: number, boite: number, reclame: number | null,
 *           plancherHaut: number, plancherBas: number }[] }} releve
 * @returns {string[]}
 */
export function corpsDeModaleEcrase(releve) {
  const out = [];
  for (const m of releve.modales ?? []) {
    if (!m.corps || !m.place) continue;
    const cache = +(m.corps.scrollH - m.corps.clientH).toFixed(1);
    if (cache <= 1) continue; // le corps ne défile pas : rien à juger
    if (m.reclame == null) {
      out.push(
        `${releve.vue} : le corps de « ${m.quoi} » défile (${m.corps.clientH}px rendus sur ${m.corps.scrollH}px) ` +
        `et le voile ne PUBLIE aucun contrat (\`--roll-fenetre\`) — rien à confronter, le contrat a disparu du CSS`,
      );
      continue;
    }
    const du = Math.min(m.reclame, m.place - m.plancherHaut - m.plancherBas);
    if (m.boite < du - 1) {
      out.push(
        `${releve.vue} : « ${m.quoi} » ne tient que ${m.boite}px alors qu'elle réclame ${m.reclame}px et que ` +
        `l'écran lui en laisse ${du}px (place ${m.place} − planchers ${m.plancherHaut}/${m.plancherBas}) ` +
        `— son corps défile pour ${cache}px que ses bandes retiennent`,
      );
    }
  }
  return out;
}

/**
 * COMMANDE INATTEIGNABLE dans une carte de menu — le CRITÈRE d'atteignabilité : un bouton est
 * atteignable si son bas tombe dans la boîte du corps défilant (`corpsBas`), ou dans la course qui
 * reste à défiler (`restant`). Au-delà, aucun geste du joueur ne l'amène sous ses yeux.
 * La sonde RELÈVE (bas de chaque commande, bas du corps, course restante) ; le verdict est ici.
 * Tolérance d'UN pixel, comme partout ici.
 *
 * @param {{ vue: string, ecran: string, cartes?: { sel: string, corpsBas: number, restant: number,
 *           commandes?: { nom: string, bas: number }[] }[] }} releve
 * @returns {string[]}
 */
export function commandesInatteignables(releve) {
  const out = [];
  for (const c of releve.cartes ?? []) {
    const atteignableJusqua = c.corpsBas + c.restant;
    for (const e of c.commandes ?? []) {
      if (e.bas <= atteignableJusqua + 1) continue;
      out.push(
        `${releve.vue} · ${releve.ecran} : « ${e.nom} » (bas ${e.bas}) est INATTEIGNABLE dans ${c.sel} ` +
        `— le corps s'arrête à ${c.corpsBas} et il ne reste que ${c.restant}px de course`,
      );
    }
  }
  return out;
}

/**
 * ACTEUR COURANT HORS CHAMP — celui dont c'est le tour doit être VISIBLE dans sa piste, entier :
 * une frise plus longue que l'écran qui ne ramène pas l'entrée au trait dans son champ laisse le
 * joueur sans réponse à « qui joue ? ». Le verdict porte sur la piste (le scrollport de la frise),
 * jamais sur la fenêtre : une piste peut légitimement défiler, l'entrée au trait non.
 * Tolérance d'UN pixel, comme partout ici.
 *
 * `courant` absent = rien n'est au trait (pause d'initiative, combat fini) : il n'y a rien à dire,
 * et une sonde qui crierait là rendrait le détecteur inutilisable hors du tour d'un héros.
 *
 * @param {{ vue: string, courant?: { nom: string, left: number, right: number, top: number, bottom: number } | null,
 *           piste?: { left: number, right: number, top: number, bottom: number } | null }} releve
 * @returns {string[]}
 */
export function courantHorsChamp(releve) {
  const { courant, piste } = releve;
  if (!courant || !piste) return [];
  const sorties = [];
  if (courant.left < piste.left - 1) sorties.push(`de ${+(piste.left - courant.left).toFixed(1)}px par la GAUCHE`);
  if (courant.right > piste.right + 1) sorties.push(`de ${+(courant.right - piste.right).toFixed(1)}px par la DROITE`);
  if (courant.top < piste.top - 1) sorties.push(`de ${+(piste.top - courant.top).toFixed(1)}px par le HAUT`);
  if (courant.bottom > piste.bottom + 1) sorties.push(`de ${+(courant.bottom - piste.bottom).toFixed(1)}px par le BAS`);
  if (!sorties.length) return [];
  return [`${releve.vue} : l'acteur au trait « ${courant.nom} » sort du champ de sa piste ${sorties.join(', ')}`];
}

/**
 * PIED DE CADRE HORS CHAMP — le pied d'un cadre (`.cadre-pied` : `Modal`, `EmbeddedShell`,
 * `ScreenShell`) reste à l'écran : il est hors du défileur, aucun défilement ne le ramène. Un pied
 * dont le bas passe sous la fenêtre (ou le haut au-dessus) a perdu ses gestes — la mesure du juge B5
 * (#1920) : récap de chapitre à 1366×650, pied 661..708 pour 650 de haut. Tolérance d'UN pixel.
 *
 * `piedExige` : l'écran jugé porte un pied. Aucun pied relevé est alors un défaut NOMMÉ — un écran
 * absent (non monté au relevé, jamais ouvert) ne passe pas pour un écran conforme.
 *
 * @param {{ vue: string, ecran: string, fenetre?: { largeur: number, hauteur: number },
 *           piedExige?: boolean,
 *           pieds?: { sel: string, top: number, bottom: number }[] }} releve
 * @returns {string[]}
 */
export function piedHorsChamp(releve) {
  const { fenetre } = releve;
  if (releve.piedExige && !(releve.pieds ?? []).length) {
    return [`${releve.vue} · ${releve.ecran} : aucun pied de cadre relevé alors que l'écran en porte un — écran absent, sonde aveugle`];
  }
  if (!fenetre) return [];
  const out = [];
  for (const p of releve.pieds ?? []) {
    if (p.bottom <= fenetre.hauteur + 1 && p.top >= -1) continue;
    out.push(
      `${releve.vue} · ${releve.ecran} : le pied « ${p.sel} » (${p.top}..${p.bottom}) sort de la fenêtre ` +
      `(${fenetre.hauteur}px de haut) — ses gestes ne sont plus à l'écran, et aucun défilement ne les ramène`,
    );
  }
  return out;
}

/**
 * CONTENU SOUS LE BORD D'UN CADRE — un cadre (`.modal-body` d'une `Modal`, voile d'une `ScreenShell`)
 * dont le contenu descend sous son bord doit le porter dans un DÉFILEUR : sinon ce contenu est coupé,
 * et aucun geste du joueur ne l'amène à l'écran. Mesure du juge B6 (#1920), planche de navire à
 * 360×740 : corps borné à 665, contenu jusqu'à 987, aucun défileur. La sonde relève, pour chaque
 * cadre, son bord et le plus bas des éléments qu'aucun défileur (jusqu'au cadre) ne ramène ; le
 * verdict est ici. Tolérance d'UN pixel.
 *
 * `cadreExige` : l'écran jugé est un cadre. Aucun cadre relevé est alors un défaut NOMMÉ.
 *
 * @param {{ vue: string, ecran: string, cadreExige?: boolean,
 *           cadres?: { sel: string, bord: number, sansDefileur?: { sel: string, bas: number } | null }[] }} releve
 * @returns {string[]}
 */
export function contenuSousLeBord(releve) {
  const cadres = releve.cadres ?? [];
  if (releve.cadreExige && !cadres.length) {
    return [`${releve.vue} · ${releve.ecran} : aucun cadre relevé alors que l'écran en est un — écran absent, sonde aveugle`];
  }
  const out = [];
  for (const c of cadres) {
    const e = c.sansDefileur;
    if (!e || e.bas <= c.bord + 1) continue;
    out.push(
      `${releve.vue} · ${releve.ecran} : dans « ${c.sel} » (bord ${c.bord}), « ${e.sel} » descend à ${e.bas} ` +
      `sans défileur — ${+(e.bas - c.bord).toFixed(1)}px de contenu coupés, qu'aucun défilement ne ramène`,
    );
  }
  return out;
}

/**
 * ÉCRAN NOMMÉ ABSENT OU RECOUVERT — le verdict d'un écran porte sur CET écran : son dialogue
 * (`[role=dialog]` dont le nom accessible contient le nom attendu) est monté, et c'est le dialogue du
 * DESSUS — le point de son geste primaire, sinon de sa tête, tombe sur lui (`elementFromPoint`). Un
 * autre cadre présent ne vaut pas preuve : sans ce détecteur, les verdicts de pied et de bord jugeaient
 * le premier cadre venu (juge B8, #1920 : une fenêtre de jet montée de « campagne (exploration) » à
 * « menu système », six écrans jugés `OK` dessous).
 *
 * @param {{ vue: string, ecran: string, nom: string, dialogues?: string[],
 *           dialogue?: { nom: string, dessus: boolean, cible: string } | null }} releve
 * @returns {string[]}
 */
export function ecranNomme(releve) {
  const { dialogue } = releve;
  if (!dialogue) {
    const autres = releve.dialogues?.length ? `dialogues montés : ${releve.dialogues.map((n) => `« ${n} »`).join(', ')}` : 'aucun dialogue monté';
    return [`${releve.vue} · ${releve.ecran} : aucun dialogue nommé « ${releve.nom} » — écran absent, ${autres}`];
  }
  if (dialogue.dessus) return [];
  return [`${releve.vue} · ${releve.ecran} : « ${dialogue.nom} » est monté mais RECOUVERT — son geste tombe sur « ${dialogue.cible} »`];
}

/**
 * ENFANTS QUI SE CHEVAUCHENT dans un cadre — deux frères dans le flux (ni `absolute` ni `fixed`)
 * dont les ÉTENDUES se recouvrent : l'un écrit sur l'autre. L'étendue d'un élément est sa boîte
 * augmentée de ce qui en DÉBORDE sans être tenu par un défileur ou un rognage : une rangée de grille
 * comprimée garde une boîte sage et laisse son contenu passer sous la rangée suivante (juge B9,
 * #1920 : planche à 700×780, colonne `aside` jusqu'à 499 sous des onglets qui commencent à 421).
 * La sonde relève les fratries et leurs étendues, le verdict est ici. Tolérance d'UN pixel.
 *
 * @param {{ vue: string, ecran: string,
 *           cadres?: { sel: string, fratries?: { parent: string,
 *             enfants: { sel: string, left: number, right: number, top: number, bottom: number }[] }[] }[] }} releve
 * @returns {string[]}
 */
export function enfantsQuiSeChevauchent(releve) {
  const out = [];
  for (const c of releve.cadres ?? []) {
    for (const f of c.fratries ?? []) {
      const e = f.enfants;
      for (let i = 0; i < e.length; i++) {
        for (let j = i + 1; j < e.length; j++) {
          const h = Math.min(e[i].right, e[j].right) - Math.max(e[i].left, e[j].left);
          const v = Math.min(e[i].bottom, e[j].bottom) - Math.max(e[i].top, e[j].top);
          if (h <= 1 || v <= 1) continue;
          out.push(
            `${releve.vue} · ${releve.ecran} : dans « ${c.sel} », sous « ${f.parent} », « ${e[i].sel} » ` +
            `(${e[i].top}..${e[i].bottom}) et « ${e[j].sel} » (${e[j].top}..${e[j].bottom}) se CHEVAUCHENT ` +
            `sur ${+v.toFixed(1)}×${+h.toFixed(1)}px — l'un écrit sur l'autre`,
          );
        }
      }
    }
  }
  return out;
}

/**
 * ONGLET CLIQUÉ HORS DE VUE — après le clic d'un onglet de planche, le joueur voit la barre
 * d'onglets et le haut du corps qu'il vient d'ouvrir, jamais la colonne de présence qui les
 * précède. Mesure du juge B10 (#1920), fiche à 360×740 : barre à 416px sous le haut de la planche
 * et 29px du corps d'onglet en vue. Le relevé porte, en coordonnées d'écran, la fenêtre de la planche
 * (`cadre`), la barre d'onglets et le haut du corps d'onglet ; `finDeCourse` dit que la planche ne
 * peut plus descendre. Tolérance d'UN pixel.
 *
 * @param {{ vue: string, ecran: string, onglet: string, finDeCourse?: boolean,
 *           cadre: { top: number, bottom: number }, barre: { top: number, bottom: number },
 *           corps: { top: number } }} releve
 * @returns {string[]}
 */
export function ongletHorsDeVue(releve) {
  const { cadre, barre, corps } = releve;
  const ici = `${releve.vue} · ${releve.ecran} › onglet « ${releve.onglet} »`;
  if (barre.top < cadre.top - 1 || barre.bottom > cadre.bottom + 1) {
    return [`${ici} : la barre d'onglets (${barre.top}..${barre.bottom}) sort de la planche (${cadre.top}..${cadre.bottom})`];
  }
  if (barre.top > cadre.top + 1 && !releve.finDeCourse) {
    return [
      `${ici} : la barre d'onglets est à ${+(barre.top - cadre.top).toFixed(1)}px sous le haut de la planche — ` +
      `la présence reste en vue et ${+Math.max(0, cadre.bottom - corps.top).toFixed(1)}px du corps ouvert`,
    ];
  }
  if (corps.top >= cadre.bottom - 1) {
    return [`${ici} : le haut du corps d'onglet (${corps.top}) est sous le bord de la planche (${cadre.bottom})`];
  }
  return [];
}

/**
 * NOM DE PLANCHE RECOUVERT — le nom d'une planche (`.planche-nom`, nom de son dialogue) n'est jamais
 * sous un élément HORS de ce dialogue : chacun des 5 points relevés (centre, 4 coins rentrés de 3px)
 * tombe dans le dialogue (`elementFromPoint`). Juge B11 (#1920, D2) : planche de navire à 700×780 en
 * combat, le nom sous la bande de groupe (`party-dock`).
 *
 * @param {{ vue: string, ecran: string, nom: { texte: string, couverts: string[] } | null }} releve
 * @returns {string[]}
 */
export function nomRecouvert(releve) {
  const { vue, ecran, nom } = releve;
  if (!nom) return [`${vue} · ${ecran} : aucun nom de planche relevé — sonde aveugle`];
  if (!nom.couverts.length) return [];
  return [`${vue} · ${ecran} : le nom « ${nom.texte} » est RECOUVERT par « ${[...new Set(nom.couverts)].join(', ')} » (${nom.couverts.length}/5 points)`];
}
