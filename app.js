"use strict";
/* Carnet de terrain : appli web hors ligne, sans dépendance.
   Données : data/especes.json (fabriqué par outils/construire_appli.py).
   Coches : localStorage, clé "carnet.vus" = { id: { date: "AAAA-MM-JJ", note: "..." } }. */

const CARNETS = [
  { id: "afrique_du_sud", nom: "Afrique du Sud", couleur: "#b5793a" },
  { id: "japon", nom: "Japon", couleur: "#9c4a3a" },
  { id: "france", nom: "France et voisins", couleur: "#4f6f84" },
  { id: "thailande", nom: "Thaïlande", couleur: "#5f7a4a" },
  { id: "costa_rica", nom: "Costa Rica", couleur: "#7d8a3a" },
  { id: "royaume_uni", nom: "Royaume-Uni", couleur: "#3f5a7a" },
  { id: "irlande", nom: "Irlande", couleur: "#3f7a4f" },
  { id: "etats_unis", nom: "États-Unis", couleur: "#9a4a4a" },
];
const GROUPES = [
  { id: "mammiferes", nom: "Mammifères", court: "Mammifères" },
  { id: "oiseaux", nom: "Oiseaux", court: "Oiseaux" },
  { id: "reptiles_amphibiens", nom: "Reptiles et amphibiens", court: "Reptiles" },
  { id: "insectes_araignees", nom: "Insectes et araignées", court: "Insectes" },
  { id: "vie_marine", nom: "Vie marine", court: "Vie marine" },
];
const UICN = { LC: "Non menacé", NT: "Quasi menacé", VU: "Vulnérable", EN: "En danger", CR: "En danger critique", DD: "Données insuffisantes", NE: "Non évalué" };
const RARETE = { commun: "Commun", peu_commun: "Peu commun", rare: "Rare" };
/* Indice de danger (noms choisis par Quentin le 20/11/2026), avec une pastille de couleur. */
const DANGER = { 1: "À papouiller sans retenue", 2: "Ouch, attention ça pique", 3: "En photo, c'était bien quand même", 4: "Fuis, cours pour ta vie" };

let ESP = [];
let PAR_ID = {};
const etat = { filtre: "tous", groupe: "tous", q: "", pays: null };
const app = document.getElementById("app");

/* ---------- stockage ---------- */
function lireVus() {
  try { return JSON.parse(localStorage.getItem("carnet.vus") || "{}") || {}; } catch (e) { return mem; }
}
let mem = {};
function ecrireVus(v) {
  mem = v;
  try { localStorage.setItem("carnet.vus", JSON.stringify(v)); } catch (e) { /* stockage indisponible : on garde en mémoire */ }
}
mem = lireVus();
const vus = () => mem;
let enCours = "";
try { enCours = localStorage.getItem("carnet.encours") || ""; } catch (e) { /* stockage indisponible */ }
function definirEnCours(id) {
  enCours = enCours === id ? "" : id;
  try { localStorage.setItem("carnet.encours", enCours); } catch (e) { /* pas grave : gardé en mémoire */ }
}

/* ---------- thème ---------- */
function themeChoisi() { try { return localStorage.getItem("carnet.theme") || "carnet"; } catch (e) { return "carnet"; } }
function appliquerTheme() {
  const t = themeChoisi();
  const r = document.documentElement;
  const connu = t !== "carnet" && typeof THEMES !== "undefined" && THEMES[t];
  if (connu) r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
  const info = connu && CATALOGUE_THEMES.themes.find((x) => x.id === t);
  r.style.colorScheme = info && info.mode === "sombre" ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(r).getPropertyValue(connu ? "--page" : "--papier").trim() || "#f4ecd8";
}
appliquerTheme();

/* ---------- utilitaires ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nomCarnet = (id) => (CARNETS.find((c) => c.id === id) || {}).nom || id;
const groupeInfo = (id) => GROUPES.find((g) => g.id === id) || { id: "mammiferes", nom: id };
/* Icônes : pastilles plates en SVG (dossier icones, fabriquées par outils/fabriquer_icones_svg.py). alt vide : le texte à côté dit déjà la même chose. */
const ico = (nom, classe = "") => `<img class="ico ${classe}" src="icones/${nom}.svg" alt="" aria-hidden="true">`;
/* Fond de page : un paysage plat par carnet (dossier fonds), posé derrière tout l'écran. Le décalage horizontal garde le sujet visible sur un écran étroit. */
const FOND_POS = { afrique_du_sud: "50%", japon: "78%", france: "50%", thailande: "55%", costa_rica: "68%", royaume_uni: "50%", irlande: "50%", etats_unis: "50%", accueil: "50%" };
function fond(id) {
  // Voyage en cours : tout l'habillage (paysage et couleurs) prend celui du pays coché, sur tous les écrans.
  const pays = enCours && CARNETS.some((c) => c.id === enCours) ? enCours : "";
  if (pays) id = pays;
  const racine = document.documentElement;
  racine.style.setProperty("--fond-img", `url(fonds/${id}.webp)`);
  racine.style.setProperty("--fond-pos", (FOND_POS[id] || "50%") + " 50%");
  if (pays) racine.setAttribute("data-pays", pays); else racine.removeAttribute("data-pays");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && !racine.hasAttribute("data-theme")) meta.content = getComputedStyle(racine).getPropertyValue("--papier").trim() || "#f4ecd8";
}
const RETOUR = ico("retour", "fleche");
const dateFr = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; } };
const aujourdhui = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const ratio = (a, b) => (b ? (100 * a) / b : 0);
const pct = (a, b) => Math.round(ratio(a, b));
/* Texte du pourcentage : une décimale sous 10 %, pour que les premières coches se voient. */
const pctAff = (a, b) => { const r = ratio(a, b); return (r > 0 && r < 10 ? (Math.round(r * 10) / 10).toString().replace(".", ",") : String(Math.round(r))); };
const especesDuCarnet = (cid) => ESP.filter((e) => e.pays.includes(cid));
const compteVus = (liste) => liste.filter((e) => vus()[e.id]).length;
const rareteDans = (e, cid) => ((e.par_pays || {})[cid] || (e.par_pays || {})[e.pays[0]] || {}).rarete;
const tri = (a, b) => a.famille_simple.localeCompare(b.famille_simple, "fr") || a.nom_fr.localeCompare(b.nom_fr, "fr");
const sans = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function vignette(e) {
  const g = groupeInfo(e.groupe);
  const p = (e.photos || [])[0];
  return p ? `<img src="${esc(p.f)}" alt="${esc(e.nom_fr)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('img'),{className:'embleme',src:'icones/${g.id}.svg',alt:''}))">` : `<img class="embleme" src="icones/${g.id}.svg" alt="">`;
}

/* Photos de la fiche : défilement horizontal au doigt, points, auteur de la photo affichée. */
function galerie(e) {
  const ph = e.photos || [];
  if (!ph.length) return { html: `<div class="photo"><span class="coin a"></span><span class="coin b"></span><img class="embleme" src="icones/${groupeInfo(e.groupe).id}.svg" alt=""></div><div class="credit"></div>` };
  const imgs = ph.map((p, i) => `<img src="${esc(p.f)}" alt="${esc(e.nom_fr)}, photo ${i + 1}" ${i ? 'loading="lazy"' : ""}>`).join("");
  const points = ph.length > 1 ? `<div class="points">${ph.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : "";
  return { html: `<div class="photo"><span class="coin a"></span><span class="coin b"></span><div class="defile" id="defile">${imgs}</div>${points}</div>
    <div class="credit" id="credit">photo : ${esc(ph[0].c)}${ph.length > 1 ? " · 1/" + ph.length : ""}</div>`, ph };
}
function brancherGalerie(ph) {
  const d = document.getElementById("defile");
  if (!d || !ph || ph.length < 2) return;
  d.addEventListener("scroll", () => {
    const i = Math.max(0, Math.min(ph.length - 1, Math.round(d.scrollLeft / d.clientWidth)));
    document.querySelectorAll(".points i").forEach((p, k) => p.classList.toggle("on", k === i));
    document.getElementById("credit").textContent = "photo : " + ph[i].c + " · " + (i + 1) + "/" + ph.length;
  }, { passive: true });
}

/* ---------- écrans ---------- */
function accueil() {
  fond("accueil");
  const total = ESP.length;
  const vusTotal = compteVus(ESP);
  // Voyage en cours d'abord, puis par complétion décroissante (à égalité : ordre d'origine).
  const lignes = CARNETS.map((c, i) => {
    const l = especesDuCarnet(c.id);
    const n = compteVus(l);
    return { c, i, l, n, p: l.length ? n / l.length : 0 };
  }).sort((x, y) => (y.c.id === enCours) - (x.c.id === enCours) || y.p - x.p || x.i - y.i);
  const cartes = lignes.map(({ c, l, n }) => {
    const cours = c.id === enCours;
    return `<div class="carnet ${cours ? "cours" : ""}"><div class="tranche" style="background:${c.couleur}"></div>
      <a class="corps" href="#/carnet/${c.id}"><h3>${ico(c.id, "drap")}${esc(c.nom)}</h3>
      ${cours ? `<div class="etiquette">${ico("voyage", "mini")} voyage en cours</div>` : ""}
      <div class="jauge"><i style="width:${ratio(n, l.length)}%"></i></div>
      <div class="chiffres">${n} / ${l.length} · ${pctAff(n, l.length)} %</div></a>
      <button class="vol ${cours ? "on" : ""}" data-c="${c.id}" aria-pressed="${cours}" aria-label="Voyage en cours : ${esc(c.nom)}" title="Voyage en cours">${ico("voyage")}</button></div>`;
  }).join("");
  app.innerHTML = `<div class="barre"><div class="gros"><h1>${ico("rose_des_vents", "rose")}Mes carnets de voyage</h1><div class="sous manu">toutes les bêtes croisées en route</div></div>
      <a class="rouage" href="#/reglages" aria-label="Réglages">${ico("reglages")}</a></div>
    <div class="total"><b>${pctAff(vusTotal, total)} %</b><span>${vusTotal} espèce${vusTotal > 1 ? "s" : ""} observée${vusTotal > 1 ? "s" : ""} sur ${total}</span></div>
    <div class="jauge grande"><i style="width:${ratio(vusTotal, total)}%"></i></div>
    <div class="aide">Touche ${ico("voyage", "mini")} sur un carnet pour dire que tu y voyages : il passe en haut.</div><div data-inst></div>${cartes}`;
  app.querySelectorAll(".vol").forEach((b) => b.onclick = () => { definirEnCours(b.dataset.c); accueil(); });
  afficherInstall();
}

function carnet(cid) {
  const c = CARNETS.find((x) => x.id === cid);
  if (!c) return (location.hash = "#/");
  fond(cid);
  const base = especesDuCarnet(cid);
  const n = compteVus(base);
  // 6 boutons (Tous + 5 groupes) sur 2 lignes de 3 ; un groupe vide reste affiché (grisé) pour garder la grille.
  const tuiles = [{ id: "tous", court: "Tous" }, ...GROUPES].map((g) => {
    const l = g.id === "tous" ? base : base.filter((e) => e.groupe === g.id);
    return `<button class="groupe ${etat.groupe === g.id ? "on" : ""}" data-g="${g.id}" ${l.length ? "" : "disabled"}><span class="emo">${ico(g.id)}</span><b>${esc(g.court)}</b>${compteVus(l)} / ${l.length}
      <div class="jauge"><i style="width:${ratio(compteVus(l), l.length)}%"></i></div></button>`;
  }).join("");
  const filtres = [["tous", "Tous"], ["pasvu", "Pas encore vus"], ["vu", "Vus"], ["rare", "Rares"]]
    .map(([k, t]) => `<button class="puce ${etat.filtre === k ? "on" : ""}" data-f="${k}">${t}</button>`).join("");
  app.innerHTML = `<div class="barre"><a class="retour" href="#/" aria-label="Retour">${RETOUR}</a><div class="gros"><h1>${ico(c.id, "drap")}${esc(c.nom)}</h1>
      <div class="sous">${n} sur ${base.length} · ${pctAff(n, base.length)} %</div></div>
      <button class="vol ${enCours === cid ? "on" : ""}" id="encours" aria-pressed="${enCours === cid}" title="Voyage en cours">${ico("voyage")}</button></div>
    <div class="jauge grande"><i style="width:${ratio(n, base.length)}%"></i></div>
    <div class="groupes">${tuiles}</div>
    <div class="puces">${filtres}</div>
    <input class="recherche" type="search" placeholder="Chercher un animal…" value="${esc(etat.q)}" aria-label="Chercher">
    <div id="liste"></div>`;
  document.getElementById("encours").onclick = () => { definirEnCours(cid); carnet(cid); };
  // Choix d'une catégorie : la grille des catégories remonte en haut de l'écran, la liste est juste dessous.
  app.querySelectorAll(".groupe").forEach((b) => b.onclick = () => {
    etat.groupe = b.dataset.g; carnet(cid);
    const g = app.querySelector(".groupes"); if (g && window.scrollY > 0) g.scrollIntoView({ block: "start" });
  });
  app.querySelectorAll(".puce").forEach((b) => b.onclick = () => { etat.filtre = b.dataset.f; carnet(cid); });
  app.querySelector(".recherche").oninput = (ev) => { etat.q = ev.target.value; liste(cid); };
  liste(cid);
}

function liste(cid) {
  const q = sans(etat.q.trim());
  let l = especesDuCarnet(cid).filter((e) => etat.groupe === "tous" || e.groupe === etat.groupe);
  if (etat.filtre === "vu") l = l.filter((e) => vus()[e.id]);
  if (etat.filtre === "pasvu") l = l.filter((e) => !vus()[e.id]);
  if (etat.filtre === "rare") l = l.filter((e) => rareteDans(e, cid) === "rare");
  if (q) l = l.filter((e) => sans(e.nom_fr + " " + e.nom_scientifique + " " + e.nom_en + " " + e.famille_simple).includes(q));
  l.sort(tri);
  const zone = document.getElementById("liste");
  if (!l.length) { zone.innerHTML = `<div class="vide">Rien à montrer ici pour l'instant.</div>`; return; }
  const g = etat.groupe === "tous" ? { id: "tous", nom: "Tous les animaux" } : groupeInfo(etat.groupe);
  const cartes = l.map((e) => {
    const vu = !!vus()[e.id];
    return `<a class="esp ${vu ? "" : "pasvu"}" href="#/espece/${e.id}/${cid}"><div class="vignette">${vignette(e)}${vu ? `<span class="tampon">${ico("vu")}</span>` : ""}${rareteDans(e, cid) === "rare" ? '<span class="rare">rare</span>' : ""}${e.danger && DANGER[e.danger.niveau] ? `<span class="pastille d${e.danger.niveau}" title="${DANGER[e.danger.niveau]}"></span>` : ""}</div>
      <div class="txt"><span class="nom">${esc(e.nom_fr)}</span><span class="fam">${esc(e.famille_simple)}</span></div></a>`;
  }).join("");
  zone.innerHTML = `<h2 class="titre-liste">${ico(g.id, "titre")} ${esc(g.nom)}</h2><div class="compte">${l.length} espèce${l.length > 1 ? "s" : ""} · touche une photo pour la fiche</div><div class="grille">${cartes}</div>`;
}

function fiche(id, cid) {
  const e = PAR_ID[id];
  if (!e) return (location.hash = "#/");
  fond(e.pays.includes(cid) ? cid : e.pays[0]);
  if (!etat.pays || !e.pays.includes(etat.pays) || etat.espece !== id) { etat.pays = e.pays.includes(cid) ? cid : e.pays[0]; etat.espece = id; }
  const v = vus()[id];
  const pp = e.par_pays[etat.pays] || {};
  const nbCarnets = e.pays.length;
  const gal = galerie(e);
  const confusions = (e.confusions || []).map((c) => `<div class="conf"><b>${esc(c.nom)}</b><span>${esc(c.difference)}</span></div>`).join("");
  const ligne = (ico, titre, texte) => texte ? `<div class="ligne-info"><span class="ico">${ico}</span><small>${titre}</small><span>${esc(texte)}</span></div>` : "";
  const onglets = e.pays.length > 1 ? `<div class="pays">${e.pays.map((p) => `<button class="${p === etat.pays ? "on" : ""}" data-p="${p}">${esc(nomCarnet(p))}</button>`).join("")}</div>` : "";
  app.innerHTML = `<div class="barre"><a class="retour" href="#/carnet/${cid}" aria-label="Retour">${RETOUR}</a><div class="gros"><h1>${esc(e.nom_fr)}</h1>
      <div class="nomsci">${esc(e.nom_scientifique)}</div></div></div>
    ${gal.html}
    <div class="infos"><span class="info">${ico("taille", "mini")} ${esc(e.taille)}</span>
      ${pp.rarete ? `<span class="info ${pp.rarete === "rare" ? "rare-e" : ""}">${esc(RARETE[pp.rarete] || pp.rarete)}</span>` : ""}
      <span class="info">${esc(UICN[e.statut_uicn] || e.statut_uicn)}</span></div>
    ${e.doute ? `<div class="doute">À vérifier : ${esc(e.doute)}</div>` : ""}
    ${e.danger && DANGER[e.danger.niveau] ? `<div class="danger d${e.danger.niveau}"><span class="pastille"></span><div><b>${DANGER[e.danger.niveau]}</b><i>${esc(e.danger.raison)}</i></div></div>` : ""}
    <button class="btn ${v ? "vu" : ""}" id="vu">${v ? "✓ Vu !" : "Je l'ai vu"}</button>
    <div class="date">${v ? "le " + esc(dateFr(v.date)) + (nbCarnets > 1 ? ", coché dans " + nbCarnets + " carnets" : "") : ""}</div>
    ${v ? `<div class="cadre"><h4>Mon mot</h4><textarea class="mot" id="mot" placeholder="Où, quand, avec qui…">${esc(v.note || "")}</textarea></div>` : ""}
    <div class="cadre"><h4>${ico("reconnaitre", "t")} Pour le reconnaître</h4><ul class="signes">${(e.signes || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div>
    ${confusions ? `<div class="cadre"><h4>${ico("confondre", "t")} À ne pas confondre avec</h4>${confusions}</div>` : ""}
    <div class="cadre"><h4>${ico("ou_chercher", "t")} Où le chercher</h4>${onglets}
      ${ligne(ico("milieu"), "Milieu", e.habitat)}${ligne(ico("lieu"), "Où", pp.ou_voir)}${ligne(ico("quand"), "Quand", pp.quand)}</div>
    ${e.anecdote ? `<div class="note"><h4>${ico("saviez_vous", "t")} Le saviez-vous ?</h4><p>${esc(e.anecdote)}</p></div>` : ""}
    ${sourcesHtml(e)}`;
  brancherGalerie(gal.ph);
  app.querySelectorAll(".pays button").forEach((b) => b.onclick = () => { etat.pays = b.dataset.p; fiche(id, cid); });
  document.getElementById("vu").onclick = () => {
    const m = { ...vus() };
    if (m[id]) { if (!confirm("Décocher cet animal ?")) return; delete m[id]; } else m[id] = { date: aujourdhui(), note: "" };
    ecrireVus(m); fiche(id, cid);
  };
  const mot = document.getElementById("mot");
  if (mot) mot.oninput = () => { const m = { ...vus() }; if (m[id]) { m[id] = { ...m[id], note: mot.value }; ecrireVus(m); } };
}

function sourcesHtml(e) {
  if (!(e.src || []).length) return "";
  const liens = e.src.map((x) => `<a href="${esc(x.u)}" target="_blank" rel="noopener">${esc(x.n)}</a>`).join(" · ");
  const etat = e.ver === "ok" ? "✓ Nom scientifique, présence dans les pays et statut de conservation contrôlés sur des bases publiques."
    : e.ver === "remarque" ? "✓ Contrôlé sur des bases publiques, avec une remarque : " + (e.alertes || []).join(" ; ") + "."
    : "⚠ À vérifier : " + (e.alertes || []).join(" ; ") + ".";
  return `<details class="cadre sources-bloc"><summary>Sources et vérification</summary><p class="txt sources">${liens}</p>
    <p class="petite">${esc(etat)} Les tailles et les signes de reconnaissance ne sont pas encore vérifiés.</p></details>`;
}

function reglages() {
  fond("accueil");
  const nb = Object.keys(vus()).length;
  app.innerHTML = `<div class="barre"><a class="retour" href="#/" aria-label="Retour">${RETOUR}</a><div class="gros"><h1>Réglages</h1></div></div>
    <div class="bloc"><h4>Mes observations</h4><p>${nb} animal${nb > 1 ? "ux" : ""} coché${nb > 1 ? "s" : ""}. Les coches sont gardées sur ce téléphone. Pense à faire une sauvegarde de temps en temps, surtout avant de changer de téléphone ou d'effacer les données du navigateur.</p>
      <button class="btn petit" id="sauve">Sauvegarder mes coches</button>
      <button class="btn petit" id="restaure">Restaurer une sauvegarde</button>
      <input type="file" id="fichier" accept="application/json,.json" hidden>
      <div class="msg" id="msg1"></div></div>
    <div class="bloc"><h4>Hors ligne</h4><p>L'appli marche sans réseau. Pour être sûre d'avoir toutes les photos en voyage, télécharge-les une fois avec le Wi-Fi.</p>
      <button class="btn petit" id="photos">Télécharger toutes les photos</button>
      <progress id="prog" value="0" max="1" hidden></progress><div class="msg" id="msg2"></div></div>
    <div class="bloc"><h4>Tri des photos (temporaire)</h4><p>Pour repérer les photos qui ne vont pas.</p>
      <a class="btn petit" href="#/tri-photos" style="text-align:center;text-decoration:none">Ouvrir le tri des photos</a></div>
    <div class="bloc" data-inst-bloc><h4>Installer l'appli</h4><div data-inst></div></div>
    <div class="bloc"><h4>Thème</h4><p>Change l'ambiance de l'appli. « Carnet de naturaliste » est le style d'origine.</p>
      <select class="choix" id="theme" aria-label="Thème"></select></div>
    <div class="bloc"><h4>Mise à jour</h4><p>L'appli cherche toute seule une nouvelle version quand tu l'ouvres, et te prévient. Tu peux aussi la chercher toi-même.</p>
      <button class="btn petit" id="maj">Chercher une mise à jour</button><div class="msg" id="msg3"></div>
      <p class="petite">Version installée : <span id="vinst">${esc(self.VERSION || "dev")}</span></p></div>
    <div class="bloc"><h4>À propos</h4><p>${ESP.length} animaux, ${CARNETS.length} carnets.</p>
      <p class="petite">Les fiches ont été rédigées sans source vérifiée : elles peuvent contenir des erreurs. Photos : iNaturalist, licences libres, auteurs crédités sous chaque photo. Version ${esc(self.VERSION || "dev")}.</p></div>`;
  document.getElementById("sauve").onclick = () => {
    const blob = new Blob([JSON.stringify({ appli: "carnet", date: aujourdhui(), vus: vus(), encours: enCours }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mes-observations-" + aujourdhui() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    document.getElementById("msg1").textContent = "Sauvegarde téléchargée.";
  };
  const fic = document.getElementById("fichier");
  document.getElementById("restaure").onclick = () => fic.click();
  fic.onchange = async () => {
    try {
      const d = JSON.parse(await fic.files[0].text());
      if (!d || d.appli !== "carnet" || typeof d.vus !== "object") throw new Error("format");
      const m = { ...vus() };
      let ajoutes = 0;
      for (const [id, x] of Object.entries(d.vus)) if (PAR_ID[id] && !m[id]) { m[id] = x; ajoutes++; }
      ecrireVus(m);
      if (d.encours && !enCours && CARNETS.some((c) => c.id === d.encours)) definirEnCours(d.encours);
      document.getElementById("msg1").textContent = ajoutes + " observation" + (ajoutes > 1 ? "s" : "") + " récupérée" + (ajoutes > 1 ? "s" : "") + ".";
    } catch (err) { document.getElementById("msg1").textContent = "Ce fichier n'est pas une sauvegarde valide."; }
  };
  document.getElementById("photos").onclick = telechargerPhotos;
  afficherInstall();
  const blocInst = document.querySelector("[data-inst-bloc]");
  if (blocInst && dejaInstallee()) blocInst.remove();   // installée : on n'en parle plus
  remplirThemes(document.getElementById("theme"));
  document.getElementById("maj").onclick = () => {
    const b = document.getElementById("maj"); b.textContent = "Vérification…";
    chercherMaj(true).then(() => { const x = document.getElementById("maj"); if (x) x.textContent = "Chercher une mise à jour"; });
  };
  versionInstallee().then((v) => { const e = document.getElementById("vinst"); if (e && v) e.textContent = v; });
}

function remplirThemes(sel) {
  const actuel = themeChoisi();
  const groupes = typeof CATEGORIES_THEMES !== "undefined" ? CATEGORIES_THEMES : [];
  sel.innerHTML = `<option value="carnet"${actuel === "carnet" ? " selected" : ""}>Carnet de naturaliste (par défaut)</option>` +
    groupes.map(([cat, ts]) => `<optgroup label="${esc(cat)}">${Object.entries(ts).filter(([k]) => k !== "auto")
      .map(([k, l]) => `<option value="${k}"${k === actuel ? " selected" : ""}>${esc(l)}</option>`).join("")}</optgroup>`).join("");
  sel.onchange = () => { try { localStorage.setItem("carnet.theme", sel.value); } catch (e) { /* tant pis : valable pour cette page */ } appliquerTheme(); };
}

async function telechargerPhotos() {
  const urls = ESP.flatMap((e) => (e.photos || []).map((p) => p.f));
  const prog = document.getElementById("prog"), msg = document.getElementById("msg2");
  if (!urls.length) { msg.textContent = "Il n'y a pas encore de photos."; return; }
  prog.hidden = false; prog.max = urls.length; prog.value = 0;
  let ok = 0;
  for (const u of urls) { try { const r = await fetch(u); if (r.ok) ok++; } catch (e) { /* réseau coupé */ } prog.value++; }
  msg.textContent = ok === urls.length ? "Toutes les photos sont sur le téléphone." : ok + " photos sur " + urls.length + " (réessaie avec du réseau).";
}

/* ---------- TEMPORAIRE : tri des photos (à retirer avant le 25/12) ----------
   Marque les mauvaises photos, clé "carnet.triphotos" = { "photos/xxx.jpg": true }, et télécharge la liste. */
const triLire = () => { try { return JSON.parse(localStorage.getItem("carnet.triphotos2") || "{}"); } catch (e) { return {}; } };
const triEcrire = (m) => { try { localStorage.setItem("carnet.triphotos2", JSON.stringify(m)); } catch (e) { /* tant pis */ } };

function triPhotos() {
  fond("accueil");
  const marques = triLire();
  // Seulement les photos ajoutées depuis le dernier tri (marquées "v" à la construction), tous carnets confondus.
  const liste = ESP.filter((e) => (e.photos || []).some((p) => p.v)).sort((a, b) => a.nom_fr.localeCompare(b.nom_fr, "fr"));
  const nbMarques = Object.keys(marques).length;
  const cartes = liste.length ? liste.map((e) => {
    const ph = (e.photos || []).filter((p) => p.v);
    const imgs = ph.map((p) => `<button class="tri-ph${marques[p.f] ? " mauvaise" : ""}" data-f="${esc(p.f)}" aria-label="Photo à changer"><img src="${esc(p.f)}" loading="lazy" alt=""><span class="tri-x">✗</span></button>`).join("");
    return `<div class="tri-esp"><div class="tri-nom">${esc(e.nom_fr)} <small>${esc(e.nom_scientifique)}</small></div><div class="tri-liste">${imgs}</div></div>`;
  }).join("") : `<div class="bloc"><p>Aucune photo à vérifier.</p></div>`;
  app.innerHTML = `<div class="barre"><a class="retour" href="#/reglages" aria-label="Retour">${RETOUR}</a><div class="gros"><h1>Tri des photos</h1></div></div>
    <div class="bloc"><p>Seulement les nouvelles photos à vérifier (${liste.length} espèces). Touche une photo qui ne va pas : elle passe en rouge. Retouche-la pour annuler. Quand tu as fini, télécharge la liste.</p>
      <button class="btn petit" id="tri-dl">Télécharger les photos cochées (<span id="tri-n">${nbMarques}</span>)</button>
      <div class="msg" id="tri-msg"></div></div>
    <div class="tri-grille">${cartes}</div>`;
  app.querySelectorAll(".tri-ph").forEach((b) => {
    b.onclick = () => {
      const m = triLire(), f = b.dataset.f;
      if (m[f]) delete m[f]; else m[f] = true;
      triEcrire(m);
      b.classList.toggle("mauvaise", !!m[f]);
      document.getElementById("tri-n").textContent = Object.keys(m).length;
    };
  });
  document.getElementById("tri-dl").onclick = () => {
    const m = triLire();
    const mauvaises = ESP.map((e) => ({ e, ph: (e.photos || []).filter((p) => m[p.f]) })).filter((x) => x.ph.length)
      .map(({ e, ph }) => ({ id: e.id, nom_fr: e.nom_fr, nom_scientifique: e.nom_scientifique, pays: e.pays, photos_mauvaises: ph.map((p) => p.f), photos_restantes: (e.photos || []).length - ph.length }));
    const sans = ESP.filter((e) => !(e.photos || []).length).map((e) => e.id);
    const blob = new Blob([JSON.stringify({ appli: "tri-photos", date: aujourdhui(), mauvaises, sans_photo: sans }, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "photos-a-changer-" + aujourdhui() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    document.getElementById("tri-msg").textContent = "Liste téléchargée : " + mauvaises.length + " espèce(s) avec au moins une mauvaise photo.";
  };
}

/* ---------- navigation ---------- */
function route() {
  const p = location.hash.replace(/^#\/?/, "").split("/");
  window.scrollTo(0, 0);
  if (p[0] === "carnet" && p[1]) return carnet(p[1]);
  if (p[0] === "espece" && p[1]) return fiche(p[1], p[2] || "france");
  if (p[0] === "reglages") return reglages();
  if (p[0] === "tri-photos") return triPhotos();
  accueil();
}
window.addEventListener("hashchange", route);

async function demarrer() {
  try {
    const r = await fetch("data/especes.json");
    ESP = await r.json();
  } catch (e) {
    app.innerHTML = `<div class="vide">Impossible de charger le carnet.<br>Ouvre l'appli une fois avec du réseau.</div>`;
    return;
  }
  PAR_ID = Object.fromEntries(ESP.map((e) => [e.id, e]));
  route();
}
/* ---------- installation sur le téléphone ---------- */
let invitInstall = null;   // événement « beforeinstallprompt » de Chrome, quand il juge l'appli installable
const dejaInstallee = () => {
  const lancee = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  try { if (lancee) localStorage.setItem("carnet.installee", "1"); return lancee || localStorage.getItem("carnet.installee") === "1"; } catch (e) { return lancee; }
};
let aideInstallOuverte = false, messageInstall = "";
function etapesInstall() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return ["Touche le bouton Partager (le carré avec une flèche vers le haut).", "Choisis « Sur l'écran d'accueil », puis « Ajouter »."];
  if (/android/i.test(ua)) return ["Touche le menu ⋮ (en haut à droite de Chrome).", "Choisis « Installer l'application » (ou « Ajouter à l'écran d'accueil »), puis confirme."];
  return ["Cherche l'icône d'installation à droite de la barre d'adresse (un écran avec une flèche, ou ⊕).", "Sinon, menu ⋮ > « Enregistrer et partager » > « Installer… » (Chrome), ou menu ⋯ > « Applications » > « Installer ce site » (Edge)."];
}
function afficherInstall() {
  document.querySelectorAll("[data-inst]").forEach((zone) => {
    if (dejaInstallee()) { zone.innerHTML = ""; return; }   // installée : plus de bouton
    const etapes = etapesInstall();
    const detail = aideInstallOuverte || !invitInstall
      ? `<ol class="etapes">${etapes.map((e) => `<li>${esc(e)}</li>`).join("")}</ol>
         <span class="petite">Si rien ne s'affiche, ton navigateur ne propose pas l'installation automatique : utilise ces étapes.</span>` : "";
    zone.innerHTML = `<div class="installer col"><div class="ligne"><div><b>📲 Installer sur le téléphone</b>
      <span>${invitInstall ? "L'appli aura son icône et marchera sans réseau." : "Pour avoir l'icône et le mode sans réseau."}</span></div>
      <button class="btn petit" data-act="installer">Installer</button></div>
      ${messageInstall ? `<div class="msg">${esc(messageInstall)}</div>` : ""}${detail}</div>`;
    zone.querySelector('[data-act="installer"]').onclick = async () => {
      const inv = invitInstall;
      if (!inv) { aideInstallOuverte = true; messageInstall = "Ton navigateur n'a pas encore proposé l'installation : voici comment faire à la main."; afficherInstall(); return; }
      inv.prompt();
      let choix = null;
      try { choix = await inv.userChoice; } catch (e) { /* fermé */ }
      invitInstall = null;   // une invitation ne sert qu'une fois
      if (choix && choix.outcome === "accepted") messageInstall = "Installation en cours…";
      else { aideInstallOuverte = true; messageInstall = "Pas installée. Tu peux le faire à la main :"; }
      afficherInstall();
    };
  });
}
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); invitInstall = e; afficherInstall(); });
window.addEventListener("appinstalled", () => { try { localStorage.setItem("carnet.installee", "1"); } catch (e) { /* tant pis */ } invitInstall = null; messageInstall = ""; afficherInstall(); });

/* ---------- mises à jour : la nouvelle version s'installe en fond, l'utilisatrice redémarre quand elle veut ---------- */
let enregistrement = null, majDemandee = false;
function bandeauMaj(w) {
  if (document.querySelector(".bandeau-maj")) return;
  const d = document.createElement("div");
  d.className = "bandeau-maj";
  d.innerHTML = `<span><b>Nouvelle version disponible</b>Redémarre l'appli pour l'avoir.</span><button id="redem">Redémarrer</button>`;
  document.body.appendChild(d);
  d.querySelector("#redem").onclick = () => {
    majDemandee = true;
    d.querySelector("#redem").textContent = "…";
    const cible = w || (enregistrement && enregistrement.waiting);
    if (cible) cible.postMessage({ type: "MAJ" });
    setTimeout(() => location.reload(), 4000);   // filet de sécurité si le nouveau service worker tarde
  };
}
function suivreInstallation(w) {
  if (!w) return;
  const verif = () => { if (w.state === "installed" && navigator.serviceWorker.controller) bandeauMaj(w); };
  verif(); w.addEventListener("statechange", verif);
}
function versionInstallee() {
  return new Promise((ok) => {
    const c = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!c) return ok(null);
    const canal = new MessageChannel();
    canal.port1.onmessage = (e) => ok(e.data);
    c.postMessage({ type: "VERSION" }, [canal.port2]);
    setTimeout(() => ok(null), 1500);
  });
}
function messageMaj(t) { const m = document.getElementById("msg3"); if (m) m.textContent = t; }
function chercherMaj(manuel) {
  if (!enregistrement) { if (manuel) messageMaj("Vérification impossible ici (appli pas ouverte depuis internet)."); return Promise.resolve(); }
  return enregistrement.update().then(() => {
    if (!manuel) return;
    if (enregistrement.waiting) { bandeauMaj(enregistrement.waiting); messageMaj("Mise à jour trouvée : touche « Redémarrer »."); }
    else if (enregistrement.installing) messageMaj("Mise à jour trouvée : téléchargement en cours…");
    else messageMaj("Tu as déjà la dernière version.");
  }).catch(() => { if (manuel) messageMaj("Pas de connexion internet : réessaie plus tard."); });
}
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    enregistrement = reg;
    if (reg.waiting && navigator.serviceWorker.controller) bandeauMaj(reg.waiting);
    reg.addEventListener("updatefound", () => suivreInstallation(reg.installing));
    reg.update().catch(() => {});   // à chaque ouverture
  }).catch(() => {});
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (majDemandee) location.reload(); });
  let derniere = 0;   // et à chaque retour dans l'appli (au plus une fois toutes les 10 min)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - derniere > 600000) { derniere = Date.now(); chercherMaj(false); }
  });
}
demarrer();
