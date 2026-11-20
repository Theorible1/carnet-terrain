"use strict";
/* Carnet de terrain : appli web hors ligne, sans dépendance.
   Données : data/especes.json (fabriqué par outils/construire_appli.py).
   Coches : localStorage, clé "carnet.vus" = { id: { date: "AAAA-MM-JJ", note: "..." } }. */

const CARNETS = [
  { id: "afrique_du_sud", nom: "Afrique du Sud", couleur: "#b5793a", etiquette: "déjà visité" },
  { id: "japon", nom: "Japon", couleur: "#9c4a3a", etiquette: "déjà visité · on y retourne" },
  { id: "france", nom: "France et voisins", couleur: "#4f6f84", etiquette: "à la maison" },
  { id: "thailande", nom: "Thaïlande", couleur: "#5f7a4a", etiquette: "déjà visité · on y retourne" },
  { id: "costa_rica", nom: "Costa Rica", couleur: "#7d8a3a", etiquette: "prochain départ" },
];
const GROUPES = [
  { id: "mammiferes", nom: "Mammifères", emb: "🐾" },
  { id: "oiseaux", nom: "Oiseaux", emb: "🐦" },
  { id: "reptiles_amphibiens", nom: "Reptiles et amphibiens", emb: "🦎" },
  { id: "insectes_araignees", nom: "Insectes et araignées", emb: "🦋" },
  { id: "vie_marine", nom: "Vie marine", emb: "🐠" },
];
const UICN = { LC: "Non menacé", NT: "Quasi menacé", VU: "Vulnérable", EN: "En danger", CR: "En danger critique", DD: "Données insuffisantes" };
const RARETE = { commun: "Commun", peu_commun: "Peu commun", rare: "Rare" };

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

/* ---------- utilitaires ---------- */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nomCarnet = (id) => (CARNETS.find((c) => c.id === id) || {}).nom || id;
const groupeInfo = (id) => GROUPES.find((g) => g.id === id) || { nom: id, emb: "🐾" };
const dateFr = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; } };
const aujourdhui = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const especesDuCarnet = (cid) => ESP.filter((e) => e.pays.includes(cid));
const compteVus = (liste) => liste.filter((e) => vus()[e.id]).length;
const rareteDans = (e, cid) => ((e.par_pays || {})[cid] || (e.par_pays || {})[e.pays[0]] || {}).rarete;
const tri = (a, b) => a.famille_simple.localeCompare(b.famille_simple, "fr") || a.nom_fr.localeCompare(b.nom_fr, "fr");
const sans = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function vignette(e) {
  const g = groupeInfo(e.groupe);
  const p = (e.photos || [])[0];
  return p ? `<img src="${esc(p.f)}" alt="${esc(e.nom_fr)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'embleme',textContent:'${g.emb}'}))">` : `<span class="embleme">${g.emb}</span>`;
}

/* Photos de la fiche : défilement horizontal au doigt, points, auteur de la photo affichée. */
function galerie(e) {
  const ph = e.photos || [];
  if (!ph.length) return { html: `<div class="photo"><span class="coin a"></span><span class="coin b"></span><span class="embleme">${groupeInfo(e.groupe).emb}</span></div><div class="credit"></div>` };
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
  const total = ESP.length;
  const vusTotal = compteVus(ESP);
  const cartes = CARNETS.map((c) => {
    const l = especesDuCarnet(c.id);
    const n = compteVus(l);
    return `<a class="carnet" href="#/carnet/${c.id}"><div class="tranche" style="background:${c.couleur}"></div><div class="corps">
      <h3>${esc(c.nom)}</h3><div class="etiquette">${esc(c.etiquette)}</div>
      <div class="jauge"><i style="width:${pct(n, l.length)}%"></i></div>
      <div class="chiffres">${n} / ${l.length} · ${pct(n, l.length)} %</div></div></a>`;
  }).join("");
  app.innerHTML = `<div class="barre"><div class="gros"><h1>Mes carnets de voyage</h1><div class="sous">toutes les bêtes croisées en route</div></div>
      <a class="rouage" href="#/reglages" aria-label="Réglages">⚙</a></div>
    <div class="total"><b>${vusTotal}</b><span>espèce${vusTotal > 1 ? "s" : ""} observée${vusTotal > 1 ? "s" : ""} sur ${total}</span></div>${cartes}`;
}

function carnet(cid) {
  const c = CARNETS.find((x) => x.id === cid);
  if (!c) return (location.hash = "#/");
  const base = especesDuCarnet(cid);
  const n = compteVus(base);
  const tuiles = GROUPES.map((g) => {
    const l = base.filter((e) => e.groupe === g.id);
    if (!l.length) return "";
    return `<button class="groupe ${etat.groupe === g.id ? "on" : ""}" data-g="${g.id}"><b>${g.emb} ${esc(g.nom)}</b>${compteVus(l)} / ${l.length}
      <div class="jauge"><i style="width:${pct(compteVus(l), l.length)}%"></i></div></button>`;
  }).join("");
  const filtres = [["tous", "Tous"], ["pasvu", "Pas encore vus"], ["vu", "Vus"], ["rare", "Rares"]]
    .map(([k, t]) => `<button class="puce ${etat.filtre === k ? "on" : ""}" data-f="${k}">${t}</button>`).join("");
  app.innerHTML = `<div class="barre"><a class="retour" href="#/" aria-label="Retour">‹</a><div class="gros"><h1>${esc(c.nom)}</h1>
      <div class="sous">${n} sur ${base.length} · ${pct(n, base.length)} %</div></div></div>
    <div class="groupes">${tuiles}</div>
    <div class="puces">${filtres}</div>
    <input class="recherche" type="search" placeholder="Chercher un animal…" value="${esc(etat.q)}" aria-label="Chercher">
    <div id="liste"></div>`;
  app.querySelectorAll(".groupe").forEach((b) => b.onclick = () => { etat.groupe = etat.groupe === b.dataset.g ? "tous" : b.dataset.g; carnet(cid); });
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
  let html = "", fam = null;
  for (const e of l) {
    if (e.famille_simple !== fam) { if (fam !== null) html += "</div>"; fam = e.famille_simple; html += `<div class="famille">${esc(fam)}</div><div class="grille">`; }
    const vu = !!vus()[e.id];
    html += `<a class="esp ${vu ? "" : "pasvu"}" href="#/espece/${e.id}/${cid}"><div class="vignette">${vignette(e)}${vu ? '<span class="tampon">✓</span>' : ""}</div>
      <span class="nom">${esc(e.nom_fr)}</span>${rareteDans(e, cid) === "rare" ? '<span class="rare">rare</span>' : ""}</a>`;
  }
  zone.innerHTML = html + "</div>";
}

function fiche(id, cid) {
  const e = PAR_ID[id];
  if (!e) return (location.hash = "#/");
  if (!etat.pays || !e.pays.includes(etat.pays) || etat.espece !== id) { etat.pays = e.pays.includes(cid) ? cid : e.pays[0]; etat.espece = id; }
  const v = vus()[id];
  const pp = e.par_pays[etat.pays] || {};
  const nbCarnets = e.pays.length;
  const gal = galerie(e);
  const confusions = (e.confusions || []).map((c) => `<div class="conf"><b>${esc(c.nom)}</b> : ${esc(c.difference)}</div>`).join("");
  const onglets = e.pays.length > 1 ? `<div class="pays">${e.pays.map((p) => `<button class="${p === etat.pays ? "on" : ""}" data-p="${p}">${esc(nomCarnet(p))}</button>`).join("")}</div>` : "";
  app.innerHTML = `<div class="barre"><a class="retour" href="#/carnet/${cid}" aria-label="Retour">‹</a><div class="gros"><h1>${esc(e.nom_fr)}</h1>
      <div class="nomsci">${esc(e.nom_scientifique)}</div></div></div>
    ${gal.html}
    <div class="infos"><span class="info">📏 ${esc(e.taille)}</span>
      ${pp.rarete ? `<span class="info ${pp.rarete === "rare" ? "rare-e" : ""}">${esc(RARETE[pp.rarete] || pp.rarete)}</span>` : ""}
      <span class="info">${esc(UICN[e.statut_uicn] || e.statut_uicn)}</span></div>
    ${e.doute ? `<div class="doute">À vérifier : ${esc(e.doute)}</div>` : ""}
    <h4>Pour le reconnaître</h4><ul class="signes">${(e.signes || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    ${confusions ? `<h4>À ne pas confondre avec</h4>${confusions}` : ""}
    <h4>Où le chercher</h4>${onglets}
    <p class="txt"><b>Milieu :</b> ${esc(e.habitat)}</p>
    <p class="txt"><b>Où :</b> ${esc(pp.ou_voir || "")}</p>
    <p class="txt"><b>Quand :</b> ${esc(pp.quand || "")}</p>
    <h4>Le saviez-vous ?</h4><p class="txt">${esc(e.anecdote)}</p>
    <button class="btn ${v ? "vu" : ""}" id="vu">${v ? "✓ Vu !" : "Je l'ai vu"}</button>
    <div class="date">${v ? "le " + esc(dateFr(v.date)) + (nbCarnets > 1 ? ", coché dans " + nbCarnets + " carnets" : "") : ""}</div>
    ${v ? `<h4>Mon mot</h4><textarea class="mot" id="mot" placeholder="Où, quand, avec qui…">${esc(v.note || "")}</textarea>` : ""}`;
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

function reglages() {
  const nb = Object.keys(vus()).length;
  app.innerHTML = `<div class="barre"><a class="retour" href="#/" aria-label="Retour">‹</a><div class="gros"><h1>Réglages</h1></div></div>
    <div class="bloc"><h4>Mes observations</h4><p>${nb} animal${nb > 1 ? "ux" : ""} coché${nb > 1 ? "s" : ""}. Les coches sont gardées sur ce téléphone. Pense à faire une sauvegarde de temps en temps, surtout avant de changer de téléphone ou d'effacer les données du navigateur.</p>
      <button class="btn petit" id="sauve">Sauvegarder mes coches</button>
      <button class="btn petit" id="restaure">Restaurer une sauvegarde</button>
      <input type="file" id="fichier" accept="application/json,.json" hidden>
      <div class="msg" id="msg1"></div></div>
    <div class="bloc"><h4>Hors ligne</h4><p>L'appli marche sans réseau. Pour être sûre d'avoir toutes les photos en voyage, télécharge-les une fois avec le Wi-Fi.</p>
      <button class="btn petit" id="photos">Télécharger toutes les photos</button>
      <progress id="prog" value="0" max="1" hidden></progress><div class="msg" id="msg2"></div></div>
    <div class="bloc"><h4>À propos</h4><p>${ESP.length} animaux, ${CARNETS.length} carnets.</p>
      <p class="petite">Les fiches ont été rédigées sans source vérifiée : elles peuvent contenir des erreurs. Photos : Wikimedia Commons, licences libres, auteurs crédités sous chaque photo. Version ${esc(self.VERSION || "dev")}.</p></div>`;
  document.getElementById("sauve").onclick = () => {
    const blob = new Blob([JSON.stringify({ appli: "carnet", date: aujourdhui(), vus: vus() }, null, 1)], { type: "application/json" });
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
      document.getElementById("msg1").textContent = ajoutes + " observation" + (ajoutes > 1 ? "s" : "") + " récupérée" + (ajoutes > 1 ? "s" : "") + ".";
    } catch (err) { document.getElementById("msg1").textContent = "Ce fichier n'est pas une sauvegarde valide."; }
  };
  document.getElementById("photos").onclick = telechargerPhotos;
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

/* ---------- navigation ---------- */
function route() {
  const p = location.hash.replace(/^#\/?/, "").split("/");
  window.scrollTo(0, 0);
  if (p[0] === "carnet" && p[1]) return carnet(p[1]);
  if (p[0] === "espece" && p[1]) return fiche(p[1], p[2] || "france");
  if (p[0] === "reglages") return reglages();
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
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
demarrer();
