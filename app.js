// =============================================
//  LÁTÓK PÁRBAJA — PONTMAXIMALIZÁLÓ HELPER
//  app.js v7.0
// =============================================
//
//  JAVÍTÁSOK v6.0 → v7.0:
//  [PERF1] _evCache.clear() áthelyezve confirmRound()-ba — nem minden getAllCardEVs()-be
//  [PERF2] getAllCardEVs() eredménye cachelve körön belül (_lastEVList),
//          renderMyCards + renderOracle + autoSelect mind ebből olvas
//  [PERF3] _validateResult() eredménye cachelve (_lastValidation), nem számolja újra
//  [BUG6]  ecToHands súlyozás javítva: (handEVSum/len)*len = handEVSum volt, weight elveszett
//  [BUG7]  selectMyCard() frissíti az eredmény-gombok tiltott állapotát is
//  [UX2]   Eredmény-gombok (Win/Lose/Draw) csak akkor kattinthatók ha az adott
//          eredmény lehetséges a jelenlegi saját lap + ellenfél paritás alapján
//          — hibaüzenet helyett a gomb el van szürkítve
//  [UX3]   Páros/Páratlan gombok mindig engedélyezve — ha mi kezdünk, a paritást
//          a kör UTÁN látjuk az ellenfél kezéből (melyik szín fogyott), ezért
//          a rögzítés előtt bármikor megadható
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let myCards            = [...ALL_CARDS];
let possibleEnemyHands = [ [...ALL_CARDS] ];

let myScore    = 0;
let enemyScore = 0;

let selectedMine   = null;
let selectedEnemy  = null;
let selectedResult = null;
let iStarted       = false;

let history  = [];
let roundNum = 0;
let isConfirming = false;

// =============================================
//  EV MOTOR
// =============================================
let _evCache = new Map();
let _lastEVList = null;          // [PERF2] kör-szintű EV cache
let _lastValidation = null;      // [PERF3] validáció cache

function _maskCount(m) {
  let n = 0; while (m) { n += m & 1; m >>= 1; } return n;
}

function _finalScore(myS, enemyS) {
  const d = myS - enemyS;
  return d > 0 ? myS + d : 0;
}

function _computeEV(myMask, enemyMask, myS, enemyS) {
  if (myMask === 0) return { ev: _finalScore(myS, enemyS), best: -1 };

  const key = `${myMask},${enemyMask},${myS},${enemyS}`;
  if (_evCache.has(key)) return _evCache.get(key);

  const eCnt = _maskCount(enemyMask);
  const losePrefer = myS < enemyS;
  let bestEV = -Infinity, bestCard = -1;

  for (let mc = 0; mc <= 8; mc++) {
    if (!(myMask & (1 << mc))) continue;
    const nextMy = myMask ^ (1 << mc);
    let total = 0;

    if (eCnt === 0) {
      total = _finalScore(myS, enemyS);
    } else {
      for (let ec = 0; ec <= 8; ec++) {
        if (!(enemyMask & (1 << ec))) continue;
        let nm = myS, ne = enemyS;
        if (mc > ec) nm++; else if (mc < ec) ne++;
        total += _computeEV(nextMy, enemyMask ^ (1 << ec), nm, ne).ev;
      }
      total /= eCnt;
    }

    const isBetter = total > bestEV ||
      (total === bestEV && (losePrefer ? mc > bestCard : mc < bestCard));
    if (isBetter) { bestEV = total; bestCard = mc; }
  }

  const r = { ev: bestEV, best: bestCard };
  _evCache.set(key, r);
  return r;
}

function _getWeightedCards(parity) {
  const parityOk = parity === 'even' ? (c => c % 2 === 0)
                 : parity === 'odd'  ? (c => c % 2 !== 0)
                 : (c => true);
  let cardCounts = {}, total = 0;
  for (const hand of possibleEnemyHands) {
    for (const c of hand.filter(parityOk)) {
      cardCounts[c] = (cardCounts[c] || 0) + 1;
      total++;
    }
  }
  return { cardCounts, total };
}

// [PERF2] Kör-szintű EV cache: csak akkor számol újra, ha az input változott
// [BUG6]  Súlyozás javítva: minden (ec, hand) párhoz 1 szavazat,
//         az átlagolás a total (összes szavazat) alapján történik
function getAllCardEVs() {
  if (myCards.length === 0) return [];

  // [PERF2] Ha semmi nem változott, visszaadjuk a cached listát
  if (_lastEVList) return _lastEVList;

  const { cardCounts, total } = _getWeightedCards(selectedEnemy);
  const losePrefer = myScore < enemyScore;
  const nextMyBase = myCards.reduce((m, c) => m | (1 << c), 0);

  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0)
                 : selectedEnemy === 'odd'  ? (c => c % 2 !== 0)
                 : (c => true);

  // [BUG6 FIX] ecToHands: minden (ec, hand) párt külön tárolunk
  // Súly = 1 per (ec, hand) pár, az összes szavazat = total
  const ecToHands = {};
  for (const hand of possibleEnemyHands) {
    for (const ec of hand.filter(parityOk)) {
      if (!ecToHands[ec]) ecToHands[ec] = [];
      const futureMask = hand.reduce((m, c) => m | (1 << c), 0) ^ (1 << ec);
      ecToHands[ec].push(futureMask);
    }
  }

  _lastEVList = myCards.map(myCard => {
    const nextMyMask = nextMyBase ^ (1 << myCard);
    let totalEV = 0;

    if (total === 0) {
      totalEV = _finalScore(myScore, enemyScore);
    } else {
      // [BUG6 FIX] Minden (ec, futureMask) pár egyenlő súlyú (1/total)
      for (const [ecStr, futureMasks] of Object.entries(ecToHands)) {
        const ec = parseInt(ecStr);
        let nm = myScore, ne = enemyScore;
        if (myCard > ec) nm++; else if (myCard < ec) ne++;

        for (const futureMask of futureMasks) {
          const { ev: subEV } = _computeEV(nextMyMask, futureMask, nm, ne);
          totalEV += subEV;
        }
      }
      totalEV /= total;
    }

    let w = 0, l = 0, d = 0;
    for (const [ecStr, weight] of Object.entries(cardCounts)) {
      const ec = parseInt(ecStr);
      if (myCard > ec) w += weight;
      else if (myCard < ec) l += weight;
      else d += weight;
    }

    const win  = total > 0 ? Math.round(w / total * 100) : 0;
    const lose = total > 0 ? Math.round(l / total * 100) : 0;
    const draw = total > 0 ? Math.round(d / total * 100) : 0;

    return { card: myCard, ev: totalEV, win, lose, draw };
  }).sort((a, b) =>
    b.ev - a.ev || (losePrefer ? b.card - a.card : a.card - b.card)
  );

  return _lastEVList;
}

// [PERF2] EV lista invalidálása: hívd minden állapotváltozáskor
function _invalidateEVCache() {
  _lastEVList = null;
  _lastValidation = null;
}

function getBestCard() {
  const evs = getAllCardEVs();
  return evs.length > 0 ? evs[0].card : null;
}

// =============================================
//  VALIDÁCIÓ — CACHELVE
//  [PERF3] Csak akkor számol újra, ha input változott
//  [UX2]   Visszaadja melyik eredmény-gombok engedélyezhetők
// =============================================
function _getResultAvailability() {
  // Cache key: mi függ tőle
  const key = `${selectedMine}|${selectedEnemy}`;
  if (_lastValidation && _lastValidation.key === key) return _lastValidation.result;

  const availability = { win: true, lose: true, draw: true };

  if (selectedMine === null || selectedEnemy === null) {
    // Ha nincs lap vagy paritás: minden tiltott
    availability.win = false;
    availability.lose = false;
    availability.draw = false;
    _lastValidation = { key, result: availability };
    return availability;
  }

  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);

  // Döntetlen: csak ha a saját lap paritása egyezik az ellenfél paritásával
  // (különben nem lehet azonos a két lap értéke)
  if (!parityOk(selectedMine)) {
    availability.draw = false;
  }

  // Minden eredményt ellenőrzünk a possibleEnemyHands alapján
  for (const res of ['win', 'lose', 'draw']) {
    if (!availability[res]) continue; // már kizárva paritás alapján
    let found = false;
    for (const hand of possibleEnemyHands) {
      let candidates = hand.filter(c => parityOk(c));
      if (res === 'win')  candidates = candidates.filter(c => c < selectedMine);
      else if (res === 'lose') candidates = candidates.filter(c => c > selectedMine);
      else if (res === 'draw') candidates = candidates.filter(c => c === selectedMine);
      if (candidates.length > 0) { found = true; break; }
    }
    if (!found) availability[res] = false;
  }

  _lastValidation = { key, result: availability };
  return availability;
}

// =============================================
//  AUTOMATA KÁRTYA KIJELÖLŐ
// =============================================
function autoSelectOracleCard() {
  selectedMine = getBestCard();
}

// =============================================
//  INIT
// =============================================
function init() {
  const chk = document.getElementById('chkIStart');
  if (chk) {
    chk.addEventListener('change', () => {
      iStarted = chk.checked;
      if (iStarted) {
        selectedEnemy = null;
        document.getElementById('btnEven').classList.remove('active');
        document.getElementById('btnOdd').classList.remove('active');
      }
      _invalidateEVCache();
      autoSelectOracleCard();
      _refreshUI();
    });
  }

  autoSelectOracleCard();
  updateScoreBoard();
  _refreshUI();
  renderHistory();
}

// =============================================
//  UI FRISSÍTÉS — EGYSÉGES BELÉPÉSI PONT
//  [PERF2] Egyszer invalidál, majd minden renderelő
//          funkció az ugyanazon _lastEVList-ből olvas
// =============================================
function _refreshUI() {
  // EV lista egyszer számolódik, mind a három render ebből olvas
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateResultButtons(); // [UX2]
  updatePairityButtons(); // [UX3]
  updateConfirmBtn();
  updateChips();
}

// =============================================
//  SCORE BOARD
// =============================================
function updateScoreBoard() {
  document.getElementById('scoreMine').textContent  = myScore;
  document.getElementById('scoreEnemy').textContent = enemyScore;

  const diff   = myScore - enemyScore;
  const diffEl = document.getElementById('scoreDiff');

  if (diff > 0) {
    diffEl.textContent       = `Vezetsz: +${diff}`;
    diffEl.style.color       = 'var(--emerald-light)';
    diffEl.style.borderColor = 'var(--emerald)';
  } else if (diff < 0) {
    diffEl.textContent       = `Hátrány: ${diff}`;
    diffEl.style.color       = 'var(--crimson-light)';
    diffEl.style.borderColor = 'var(--crimson)';
  } else {
    diffEl.textContent       = 'Döntetlen';
    diffEl.style.color       = 'var(--text-dim)';
    diffEl.style.borderColor = 'var(--border)';
  }

  const finalProj = document.getElementById('finalScoreProj');
  if (myCards.length === 0) {
    if (myScore > enemyScore) {
      finalProj.innerHTML = `🏆 Játék vége! Győzelem! Végső pontszám: <strong style="color:var(--emerald-light);font-size:16px;">${myScore + diff}</strong>`;
    } else if (enemyScore > myScore) {
      finalProj.innerHTML = `💀 Játék vége! Vereség.`;
    } else {
      finalProj.innerHTML = `🤝 Játék vége! Döntetlen.`;
    }
  } else {
    if (myScore > enemyScore) {
      finalProj.innerHTML = `Ha most nyernél, a végső pontod: <strong style="color:var(--gold-light);font-size:15px;">${myScore + diff}</strong> lenne.`;
    } else {
      finalProj.innerHTML = `Várható végeredmény: <span style="color:var(--text-dim)">Jelenleg nincs bónusz pont.</span>`;
    }
  }
}

// =============================================
//  [UX2] EREDMÉNY-GOMBOK TILTÁSA
//  Win/Lose/Draw csak akkor kattintható, ha az
//  adott eredmény lehetséges a jelenlegi állapotban
// =============================================
function updateResultButtons() {
  const av = _getResultAvailability();

  const btnWin  = document.getElementById('btnWin');
  const btnLose = document.getElementById('btnLose');
  const btnDraw = document.getElementById('btnDraw');

  btnWin.disabled  = !av.win;
  btnLose.disabled = !av.lose;
  btnDraw.disabled = !av.draw;

  // Ha a kijelölt eredmény érvénytelenné vált (pl. lapot váltottunk)
  if (selectedResult && !av[selectedResult]) {
    selectedResult = null;
    btnWin.classList.remove('active');
    btnLose.classList.remove('active');
    btnDraw.classList.remove('active');
  }
}

// =============================================
//  PARITÁS-GOMBOK — mindig kattinthatók
//  Ha ellenfél kezd: a kör előtt látjuk a hátlapot → adjuk meg előre
//  Ha mi kezdünk: a kör UTÁN látjuk az ellenfél kezéből melyik paritás fogyott
//  → mindkét esetben a rögzítés előtt kell megadni, mindig engedélyezett
// =============================================
function updatePairityButtons() {
  document.getElementById('btnEven').disabled = false;
  document.getElementById('btnOdd').disabled  = false;
}

// =============================================
//  RENDER — SAJÁT LAPOK (EV badge-ekkel)
// =============================================
function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  container.innerHTML = '';

  const oddRow  = document.createElement('div'); oddRow.className  = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

  // [PERF2] getAllCardEVs() itt nem számol újra, a _lastEVList-ből ad vissza
  const evList = getAllCardEVs();
  const evMap  = {};
  evList.forEach(x => { evMap[x.card] = x; });
  const maxEV = evList.length > 0 ? evList[0].ev : 0;

  ALL_CARDS.forEach(n => {
    const isEven     = n % 2 === 0;
    const inHand     = myCards.includes(n);
    const isSelected = n === selectedMine;

    const btn = document.createElement('button');
    btn.className = ['card-btn', isEven ? 'even' : 'odd',
                     !inHand ? 'used' : '', isSelected ? 'selected-mine' : '']
                   .filter(Boolean).join(' ');
    btn.disabled = !inHand;

    const numSpan = document.createElement('span');
    numSpan.className   = 'card-num';
    numSpan.textContent = n;
    btn.appendChild(numSpan);

    const badge = document.createElement('div');
    badge.className = 'badge';

    if (inHand && evMap[n] !== undefined) {
      const ev = evMap[n].ev;
      badge.textContent = ev.toFixed(1);
      if (ev === maxEV && maxEV > 0)  badge.classList.add('chance-100');
      else if (ev >= maxEV * 0.9)      badge.classList.add('chance-high');
    } else {
      badge.textContent   = '—';
      badge.style.opacity = '0.3';
    }
    btn.appendChild(badge);

    if (inHand) btn.onclick = () => selectMyCard(n);

    if (isEven) evenRow.appendChild(btn);
    else        oddRow.appendChild(btn);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);
}

// =============================================
//  RENDER — ELLENFÉL LAPOK
// =============================================
function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  container.innerHTML = '';

  const oddRow  = document.createElement('div'); oddRow.className  = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

  const { cardCounts, total } = _getWeightedCards(selectedEnemy);

  ALL_CARDS.forEach(n => {
    const isEven   = n % 2 === 0;
    const count    = cardCounts[n] || 0;
    const chance   = total > 0 ? Math.round(count / total * 100) : 0;
    const possible = chance > 0;

    const slot = document.createElement('div');
    slot.className = ['enemy-card-slot', isEven ? 'enemy-even' : 'enemy-odd',
                      possible ? 'possible' : 'eliminated'].join(' ');

    const numSpan = document.createElement('span');
    numSpan.textContent = n;
    slot.appendChild(numSpan);

    if (possible) {
      const chanceDiv = document.createElement('div');
      chanceDiv.className = 'enemy-chance';
      if (chance === 100)  chanceDiv.classList.add('sure-chance');
      else if (chance >= 70) chanceDiv.classList.add('high-chance');
      else if (chance <= 30) chanceDiv.classList.add('low-chance');
      chanceDiv.textContent = chance + '%';
      slot.appendChild(chanceDiv);
    }

    if (isEven) evenRow.appendChild(slot);
    else        oddRow.appendChild(slot);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);

  const uniqueCount = Object.keys(cardCounts).filter(k => cardCounts[k] > 0).length;
  const countEl = document.getElementById('enemyCount');
  if (countEl) {
    const parityLabel = selectedEnemy === 'even' ? ' (páros szűrő)'
                      : selectedEnemy === 'odd'  ? ' (páratlan szűrő)'
                      : '';
    countEl.textContent = `Lehetséges: ${uniqueCount} / 9${parityLabel}`;
  }
}

// =============================================
//  RENDER — ORACLE
// =============================================
function renderOracle() {
  const body = document.getElementById('oracleBody');
  if (!body) return;

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">Játék vége!</div></div>`;
    return;
  }

  if (!iStarted && selectedEnemy === null) {
    body.innerHTML = `
      <div class="oracle-text">
        <div class="oracle-main-text">
          ⏳ <strong>Várakozás...</strong><br>
          <span style="font-size:10px;color:var(--text-dim);">
            Az ellenfél lerakta a lapját.<br>
            Kattints a <strong>⬛ Páros</strong> vagy <strong>⬜ Páratlan</strong> gombra a hátlap alapján!
          </span>
        </div>
      </div>`;
    return;
  }

  // [PERF2] Nem hív getAllCardEVs()-t újra, _lastEVList már megvan renderMyCards() után
  const evList = getAllCardEVs();
  if (evList.length === 0) return;

  const suggestedCard = selectedMine !== null ? selectedMine : evList[0].card;
  const shown = evList.find(x => x.card === suggestedCard) || evList[0];
  const { ev, win, lose, draw } = shown;
  const isEven    = suggestedCard % 2 === 0;
  const diff      = myScore - enemyScore;
  const remaining = myCards.length;

  let strategyDesc = '';
  if (iStarted) {
    if (win <= 20) {
      strategyDesc = `💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Vak nyitásban a <strong>${suggestedCard}</strong>-es a legoptimálisabb — az ellenfél elpazarol egy nagy lapot ellene. Várható végpont: <strong>${ev.toFixed(2)}</strong>.`;
    } else if (diff >= 2 && remaining <= 4) {
      strategyDesc = `🛡️ <strong>ELŐNY TARTÁSA:</strong> Vezetsz +${diff}-vel. A <strong>${suggestedCard}</strong>-es minimalizálja a kockázatot (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else if (diff <= -2 && remaining <= 4) {
      strategyDesc = `⚡ <strong>FORDÍTÁS KELL:</strong> Lemaradsz! A <strong>${suggestedCard}</strong>-es adja a legjobb fordulási esélyt (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else {
      strategyDesc = `🎭 <strong>VAK NYITÁS:</strong> Nem látjuk az ellenfél hátlapját. A <strong>${suggestedCard}</strong>-es a legjobb várható végpontot adja (<strong>${ev.toFixed(2)}</strong>).`;
    }
  } else {
    const parityLabel = selectedEnemy === 'even' ? 'PÁROS' : 'PÁRATLAN';
    if (win >= 80) {
      strategyDesc = `🔥 <strong>BIZTOS PONT:</strong> Az ellenfél ${parityLabel} lapja ellen a <strong>${suggestedCard}</strong>-es <strong>${win}%</strong> eséllyel nyer. EV: <strong>${ev.toFixed(2)}</strong>.`;
    } else if (win >= 50) {
      strategyDesc = `⚔️ <strong>ELŐNYÖS:</strong> ${parityLabel} ellen a <strong>${suggestedCard}</strong>-es <strong>${win}%</strong> nyerési eséllyel a legjobb végpontot adja (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else if (diff >= 2 && remaining <= 3) {
      strategyDesc = `🛡️ <strong>VÉDEKEZÉS:</strong> Vezetsz +${diff}-vel, ${remaining} kör van hátra. A <strong>${suggestedCard}</strong>-es óvja az előnyt (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else if (diff <= -2 && remaining <= 4) {
      strategyDesc = `⚡ <strong>VISSZATÁMADÁS:</strong> Lemaradsz ${Math.abs(diff)}-vel! A <strong>${suggestedCard}</strong>-es a maximális fordulási esélyt adja (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else {
      strategyDesc = `⚖️ <strong>OPTIMÁLIS:</strong> ${parityLabel} ellen a <strong>${suggestedCard}</strong>-es a teljes meccsre számított legjobb választás (EV: <strong>${ev.toFixed(2)}</strong>).`;
    }
  }

  const winColor = win >= 60 ? 'stat-val-green' : win >= 35 ? 'stat-val-gold' : 'stat-val-red';
  const top4  = evList.slice(0, 4);
  const maxEV = evList[0].ev;

  body.innerHTML = `
    <div class="oracle-suggestion">
      <div>
        <div class="oracle-card ${isEven ? 'oracle-even' : 'oracle-odd'}"
             style="${!isEven ? 'color:#1a1400;' : ''}">${suggestedCard}</div>
      </div>
    </div>
    <div class="oracle-text">
      <div class="oracle-main-text" style="font-size:11.5px;">${strategyDesc}</div>
    </div>
    <div class="oracle-stats">
      <div class="oracle-stat-row">
        <span class="stat-label">Várható végpont (EV)</span>
        <span class="stat-val-green" style="font-weight:700;">${ev.toFixed(2)}</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Nyerési esély (kör)</span>
        <span class="${winColor}">${win}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Veszítési esély</span>
        <span class="stat-val-red">${lose}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Döntetlen esély</span>
        <span class="stat-val-purple">${draw}%</span>
      </div>
      <div style="height:1px;background:var(--border);margin:6px 0;"></div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);margin-bottom:4px;">
        EV RANGSOR — teljes meccs várható végpontja
      </div>
      ${top4.map(item => {
        const isSel    = item.card === suggestedCard;
        const itemEven = item.card % 2 === 0;
        const barW     = maxEV > 0 ? Math.max(4, Math.round((item.ev / maxEV) * 60)) : 4;
        return `
        <div class="oracle-stat-row"
             style="${isSel ? 'background:rgba(99,60,180,0.18);border-radius:4px;padding:1px 3px;' : ''}">
          <span class="stat-label" style="${isSel ? 'color:var(--purple-light);font-weight:700;' : ''}">
            ${isSel ? '▶ ' : ''}Lap
            <span style="font-size:11px;padding:0 3px;border-radius:3px;
              background:${itemEven ? 'rgba(30,30,80,0.7)' : 'rgba(80,60,10,0.7)'};">${item.card}</span>
          </span>
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="width:${barW}px;height:4px;
              background:${isSel ? 'var(--purple-light)' : 'var(--border-glow)'};
              border-radius:2px;display:inline-block;"></span>
            <span class="${isSel ? 'stat-val-green' : 'stat-val-gold'}"
                  style="${isSel ? 'font-weight:700;' : ''}">${item.ev.toFixed(2)}</span>
          </span>
        </div>`;
      }).join('')}
    </div>`;
}

// =============================================
//  SELECTION HANDLERS
// =============================================
function selectMyCard(n) {
  if (!myCards.includes(n)) return;
  selectedMine = (selectedMine === n) ? null : n;
  // [BUG7] Lapváltáskor az EV lista és validáció invalidálódik
  _invalidateEVCache();
  _refreshUI();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');

  if (!iStarted && selectedEnemy !== null && selectedMine === null) {
    // Ellenfél kezdett, most látjuk a paritást: autoselect
    _invalidateEVCache();
    autoSelectOracleCard();
  } else {
    _invalidateEVCache();
  }

  _refreshUI();
}

function selectResult(res) {
  // [UX2] Csak engedélyezett eredményt fogadunk el
  const av = _getResultAvailability();
  if (!av[res]) return; // tiltott gomb — nem csinálunk semmit

  selectedResult = (selectedResult === res) ? null : res;
  document.getElementById('btnWin').classList.toggle('active',  selectedResult === 'win');
  document.getElementById('btnLose').classList.toggle('active', selectedResult === 'lose');
  document.getElementById('btnDraw').classList.toggle('active', selectedResult === 'draw');

  updateChips();
  updateConfirmBtn();
}

// =============================================
//  GOMB ÁLLAPOT FRISSÍTŐK
// =============================================
function updateChips() {
  const cm = document.getElementById('chip-mine');
  const ce = document.getElementById('chip-enemy');
  const cr = document.getElementById('chip-result');

  cm.textContent = selectedMine !== null ? `Lapom: ${selectedMine}` : 'Lapom: —';
  cm.className   = selectedMine !== null ? 'status-chip chip-mine' : 'status-chip chip-none';

  ce.textContent = selectedEnemy
    ? (selectedEnemy === 'even' ? 'Ellenfél: Páros ⬛' : 'Ellenfél: Páratlan ⬜')
    : 'Ellenfél: —';
  ce.className = selectedEnemy ? 'status-chip chip-enemy' : 'status-chip chip-none';

  if (selectedResult) {
    const labels = { win: 'Nyertem ✦', lose: 'Vesztettem ✧', draw: 'Döntetlen ◈' };
    const cls    = { win: 'chip-result-win', lose: 'chip-result-lose', draw: 'chip-result-draw' };
    cr.textContent = `Eredmény: ${labels[selectedResult]}`;
    cr.className   = `status-chip ${cls[selectedResult]}`;
  } else {
    cr.textContent = 'Eredmény: —';
    cr.className   = 'status-chip chip-none';
  }
}

function updateConfirmBtn() {
  const btn  = document.getElementById('btnConfirm');
  const hint = document.getElementById('confirmHint');

  const av = _getResultAvailability();
  const resultValid = selectedResult && av[selectedResult];

  const canConfirm = selectedMine !== null
    && selectedEnemy !== null
    && resultValid
    && !isConfirming;

  btn.disabled = !canConfirm;

  if (!hint) return;

  if (!iStarted && selectedEnemy === null) {
    hint.textContent = '⬛⬜ Nézd meg az ellenfél hátlapját, kattints Páros/Páratlan!';
  } else if (selectedMine === null) {
    hint.textContent = '🃏 Válaszd ki a javasolt lapot (vagy más lapot)!';
  } else if (iStarted && selectedEnemy === null) {
    hint.textContent = '⬛⬜ Add meg az ellenfél lapjának paritását!';
  } else if (!selectedResult) {
    hint.textContent = '🎯 Add meg a kör eredményét!';
  } else if (canConfirm) {
    hint.textContent = '✅ Minden adat megvan — rögzítheted!';
  } else {
    hint.textContent = 'Válassz lapot és eredményt!';
  }
}

// =============================================
//  DEDUKCIÓS LOGIKA
// =============================================
function deduceEnemyHands(myCard, enemyType, result) {
  const parityOk = enemyType === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);
  let newHandsSet = new Set();

  for (const hand of possibleEnemyHands) {
    let candidates = hand.filter(c => parityOk(c));
    if (result === 'win')       candidates = candidates.filter(c => c < myCard);
    else if (result === 'lose') candidates = candidates.filter(c => c > myCard);
    else if (result === 'draw') candidates = candidates.filter(c => c === myCard);

    for (const c of candidates) {
      newHandsSet.add(hand.filter(card => card !== c).join(','));
    }
  }

  const newHands = [...newHandsSet].map(str =>
    str === '' ? [] : str.split(',').map(Number)
  );

  // Ha üres: az [UX2] elvileg megakadályozza ezt, de biztonság kedvéért
  return newHands.length > 0 ? newHands : possibleEnemyHands;
}

// =============================================
//  CONFIRM ROUND
// =============================================
function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;
  if (isConfirming) return;

  isConfirming = true;
  const confirmBtn = document.getElementById('btnConfirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳ Rögzítés...'; }

  history.push({
    myCards: [...myCards],
    possibleEnemyHands: possibleEnemyHands.map(h => [...h]),
    myScore, enemyScore, selectedMine, selectedEnemy, selectedResult, iStarted, roundNum
  });

  if (selectedResult === 'win')       myScore++;
  else if (selectedResult === 'lose') enemyScore++;

  possibleEnemyHands = deduceEnemyHands(selectedMine, selectedEnemy, selectedResult);
  myCards = myCards.filter(c => c !== selectedMine);

  const labels     = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
  const enemyLabel = (selectedEnemy === 'even' ? 'Páros ⬛' : 'Páratlan ⬜')
                     + (iStarted ? ' (én kezdtem)' : '');
  const resultClass = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[selectedResult];

  roundNum++;
  addHistoryEntry(roundNum, selectedMine, enemyLabel, labels[selectedResult], resultClass);

  selectedMine = null;
  selectedResult = null;
  selectedEnemy = null;

  clearActionButtons();

  // [PERF1] EV cache törlése csak itt, körváltáskor
  _evCache.clear();
  _invalidateEVCache();

  setTimeout(() => {
    isConfirming = false;
    if (confirmBtn) confirmBtn.textContent = '✦ Rögzítés';
    autoSelectOracleCard();
    updateScoreBoard();
    _refreshUI();
  }, 80);
}

// =============================================
//  HISTORY & UNDO
// =============================================
function addHistoryEntry(round, mine, enemy, result, cls) {
  const list = document.getElementById('historyList');
  if (list.querySelector('.history-empty')) list.innerHTML = '';
  const entry = document.createElement('div');
  entry.className = 'history-entry';
  entry.innerHTML = `<span class="h-round">#${round}</span> <span class="h-mine">Én: ${mine}</span> <span class="h-enemy">Ell: ${enemy}</span> <span class="${cls}">${result}</span>`;
  list.appendChild(entry);
}

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty">Még nincs lejátszott kör.</div>';
    return;
  }
  history.forEach((h, i) => {
    const labels     = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
    const cls        = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[h.selectedResult];
    const enemyLabel = (h.selectedEnemy === 'even' ? 'Páros ⬛' : 'Páratlan ⬜')
                       + (h.iStarted ? ' (én kezdtem)' : '');
    addHistoryEntry(i + 1, h.selectedMine, enemyLabel, labels[h.selectedResult], cls);
  });
}

function undoLast() {
  if (history.length === 0) return;
  const snap = history.pop();
  myCards            = snap.myCards;
  possibleEnemyHands = snap.possibleEnemyHands;
  myScore            = snap.myScore;
  enemyScore         = snap.enemyScore;
  roundNum           = snap.roundNum;

  selectedMine = null; selectedEnemy = null; selectedResult = null;
  clearActionButtons();

  _evCache.clear();
  _invalidateEVCache();

  autoSelectOracleCard();
  updateScoreBoard();
  renderHistory();
  _refreshUI();
}

function resetAll() {
  myCards = [...ALL_CARDS];
  possibleEnemyHands = [ [...ALL_CARDS] ];
  history = []; roundNum = 0;
  myScore = 0; enemyScore = 0;
  selectedMine = null; selectedEnemy = null; selectedResult = null;
  isConfirming = false;

  const chk = document.getElementById('chkIStart');
  if (chk) chk.checked = false;
  iStarted = false;

  clearActionButtons();
  _evCache.clear();
  _invalidateEVCache();

  autoSelectOracleCard();
  updateScoreBoard();
  _refreshUI();
  renderHistory();
}

function clearActionButtons() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id =>
    document.getElementById(id).classList.remove('active')
  );
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); resetAll(); }
  else if (e.key === 'Backspace' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault(); undoLast();
  }
});

init();
