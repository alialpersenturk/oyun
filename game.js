const UI = {
  money: document.getElementById("money"),
  happy: document.getElementById("happy"),
  rep: document.getElementById("rep"),
  nextMonth: document.getElementById("nextMonth"),
  tax: document.getElementById("tax"),
  culture: document.getElementById("culture"),
  taxLabel: document.getElementById("taxLabel"),
  cultureLabel: document.getElementById("cultureLabel"),
  poiBox: document.getElementById("poiBox"),
  quests: document.getElementById("quests"),
  badges: document.getElementById("badges"),
};

const STATE = {
  month: 1,
  money: 1000,
  happiness: 70,
  reputation: 50,
  taxRate: 10,
  cultureShare: 25,
  visited: new Set(),
  restored: new Set(),
  badges: new Set(),
  selectedPoiId: null,
  pois: [],
  quests: [],
};

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function fmtMoney(n){
  return n.toLocaleString("tr-TR") + " ₺";
}

function typeLabel(t){
  return ({
    museum: "Müze",
    heritage: "Miras Alanı",
    monument: "Anıt",
    festival: "Festival",
  }[t] || t);
}

function awardBadge(name){
  STATE.badges.add(name);
  renderBadges();
}

function renderBadges(){
  UI.badges.innerHTML = "";
  if (STATE.badges.size === 0){
    UI.badges.innerHTML = `<div class="small">Henüz rozet yok.</div>`;
    return;
  }
  [...STATE.badges].forEach(b => {
    const el = document.createElement("span");
    el.className = "pill";
    el.textContent = b;
    UI.badges.appendChild(el);
  });
}

function recalcBadges(){
  // basit: 3 farklı "era" ziyaret edilirse rozet
  const eras = new Set();
  STATE.pois.forEach(p => { if (STATE.visited.has(p.id)) eras.add(p.era); });
  if (eras.size >= 3) awardBadge("Tarih Katmanları");
}

function updateTopStats(){
  UI.money.textContent = fmtMoney(STATE.money);
  UI.happy.textContent = `${STATE.happiness}%`;
  UI.rep.textContent = `${STATE.reputation}`;
  UI.taxLabel.textContent = `${STATE.taxRate}%`;
  UI.cultureLabel.textContent = `${STATE.cultureShare}%`;
}

function visitPoi(poi){
  STATE.visited.add(poi.id);
  // küçük ödül: bilgi ve ilgi
  STATE.reputation = clamp(STATE.reputation + 1, 0, 100);
  recalcBadges();
  renderPoi(poi);
  renderQuests();
  updateTopStats();
}

function restorePoi(poi){
  // maliyet: varlığın değerine göre
  const cost = Math.round(poi.value * 3);
  if (STATE.money < cost){
    alert("Bütçe yetmedi.");
    return;
  }
  STATE.money -= cost;
  poi.condition = clamp(poi.condition + 20, 0, 100);
  STATE.restored.add(poi.id);
  // etki: memnuniyet + itibar
  STATE.happiness = clamp(STATE.happiness + 2, 0, 100);
  STATE.reputation = clamp(STATE.reputation + 3, 0, 100);
  renderPoi(poi);
  renderQuests();
  updateTopStats();
}

function renderPoi(poi){
  UI.poiBox.innerHTML = `
    <div><b>${poi.name}</b></div>
    <div class="small">${typeLabel(poi.type)} • Dönem: ${poi.era}</div>
    <div class="stat"><span>Değer</span><b>${poi.value}</b></div>
    <div class="stat"><span>Durum</span><b>${poi.condition}%</b></div>

    <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
      <button id="btnVisit">${STATE.visited.has(poi.id) ? "Ziyaret edildi ✓" : "Ziyaret"}</button>
      <button id="btnRestore">Restore et (${fmtMoney(Math.round(poi.value*3))})</button>
    </div>

    <div class="small" style="margin-top:10px;">
      İpucu: Durum düşükse turist memnuniyeti ve itibar düşer.
    </div>
  `;

  const btnVisit = document.getElementById("btnVisit");
  btnVisit.disabled = STATE.visited.has(poi.id);
  btnVisit.onclick = () => visitPoi(poi);

  const btnRestore = document.getElementById("btnRestore");
  btnRestore.onclick = () => restorePoi(poi);
}

function questProgress(q){
  if (q.type === "restore"){
    const eligible = STATE.pois.filter(p => p.condition >= 80);
    // “restore2” gibi görev için: 80+ olanları say (MVP basit)
    return eligible.length;
  }
  if (q.type === "visitType"){
    const visitedType = STATE.pois.filter(p => p.type === q.poiType && STATE.visited.has(p.id));
    return visitedType.length;
  }
  return 0;
}

function isQuestDone(q){
  return questProgress(q) >= q.targetCount;
}

function claimQuest(q){
  if (!isQuestDone(q)) return;
  if (q._claimed) return;
  q._claimed = true;
  STATE.money += q.reward;
  STATE.reputation = clamp(STATE.reputation + 2, 0, 100);
  awardBadge(`Görev: ${q.title}`);
  renderQuests();
  updateTopStats();
}

function renderQuests(){
  UI.quests.innerHTML = "";
  STATE.quests.forEach(q => {
    const prog = questProgress(q);
    const done = isQuestDone(q);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div><b>${q.title}</b></div>
      <div class="small">${q.desc}</div>
      <div class="stat"><span>İlerleme</span><b>${prog}/${q.targetCount}</b></div>
      <div class="stat"><span>Ödül</span><b>${fmtMoney(q.reward)}</b></div>
      <button ${(!done || q._claimed) ? "disabled" : ""}>
        ${q._claimed ? "Alındı ✓" : (done ? "Ödülü al" : "Devam et")}
      </button>
    `;
    const btn = card.querySelector("button");
    btn.onclick = () => claimQuest(q);
    UI.quests.appendChild(card);
  });
}

function endOfMonth(){
  // Basit ekonomi modeli:
  // Turist geliri: itibar + mutluluk - vergi cezası
  const baseTourists = 200 + STATE.reputation * 10;
  const satisfactionFactor = (STATE.happiness / 100);
  const taxPenalty = 1 - (STATE.taxRate / 100) * 0.7; // yüksek vergi turist azaltır
  const tourists = Math.round(baseTourists * satisfactionFactor * taxPenalty);

  // Gelir kişi başı: 8 + vergi etkisi
  const incomePerTourist = 8 + STATE.taxRate * 0.4;
  const income = Math.round(tourists * incomePerTourist);

  // Kültür gideri: bütçenin cultureShare yüzdesi gibi simüle
  const expense = Math.round(income * (STATE.cultureShare / 100));

  // Bakım etkisi: cultureShare yüksekse POI condition yavaş düşer / artar
  const maintenance = (STATE.cultureShare / 100) * 6; // 0..3.6

  STATE.pois.forEach(p => {
    // doğal yıpranma
    p.condition = clamp(p.condition - 3 + maintenance, 0, 100);
  });

  // Memnuniyet: çok vergi düşürür, iyi bakım yükseltir
  const avgCond = STATE.pois.reduce((a,p)=>a+p.condition,0) / STATE.pois.length;
  STATE.happiness = clamp(STATE.happiness + (avgCond - 60)/20 - (STATE.taxRate-10)/10, 0, 100);

  // Hesap
  STATE.money += (income - expense);

  // İtibar: ortalama kondisyon iyi ise artar
  STATE.reputation = clamp(STATE.reputation + (avgCond > 70 ? 1 : -1), 0, 100);

  STATE.month += 1;

  updateTopStats();
  renderQuests();

  alert(
    `Ay ${STATE.month - 1} raporu:\n` +
    `Turist: ${tourists}\n` +
    `Gelir: ${fmtMoney(income)}\n` +
    `Gider: ${fmtMoney(expense)}\n` +
    `Ortalama bakım: ${Math.round(avgCond)}%`
  );
}

async function boot(){
  const res = await fetch("./pois.json");
  const data = await res.json();

  STATE.pois = data.pois;
  STATE.quests = data.quests;

  const map = L.map("map", { zoomControl: true }).setView(data.center, data.zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap katkıcıları'
  }).addTo(map);

  // marker layer
  data.pois.forEach(poi => {
    const marker = L.marker([poi.lat, poi.lng]).addTo(map);
    marker.bindTooltip(poi.name);
    marker.on("click", () => {
      STATE.selectedPoiId = poi.id;
      renderPoi(poi);
    });
  });

  // UI events
  UI.tax.oninput = (e) => { STATE.taxRate = Number(e.target.value); updateTopStats(); };
  UI.culture.oninput = (e) => { STATE.cultureShare = Number(e.target.value); updateTopStats(); };
  UI.nextMonth.onclick = endOfMonth;

  updateTopStats();
  renderQuests();
  renderBadges();
}

boot().catch(err => {
  console.error(err);
  alert("Başlatma hatası: Konsolu kontrol et.");
});
