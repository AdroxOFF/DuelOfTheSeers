// =============================================
//  LÁTÓK PÁRBAJA — AUTOMATA PONTMAXIMALIZÁLÓ
//  app.js (v4.0)
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let myCards = [...ALL_CARDS]; 
let possibleEnemyHands = [ [...ALL_CARDS] ]; 

let myScore = 0;
let enemyScore = 0;

let selectedMine   = null;   
let selectedEnemy  = null;   
let selectedResult = null;   
let iStarted       = false;  

let history  = [];
let roundNum = 0;

function init() {
  const chk = document.getElementById('chkIStart');
  if (chk) {
    chk.addEventListener('change', () => {
      iStarted = chk.checked;
      
      // Ha mi kezdünk, lenullázzuk az ellenfél tippjét, és AUTOMATIKUSAN vak ajánlást kérünk
      if (iStarted) {
        selectedEnemy = null;
        document.getElementById('btnEven').classList.remove('active');
        document.getElementById('btnOdd').classList.remove('active');
      }
      
      autoSelectOracleCard(); // <-- AZ ÚJ AUTOMATA KIJELÖLŐ
      
      updateChips();
      updateConfirmBtn();
      renderMyCards();
      renderEnemyCards();
      renderOracle();
    });
  }
  
  autoSelectOracleCard();
  updateScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  renderHistory();
}

// =============================================
//  AUTOMATA KÁRTYA KIJELÖLŐ LOGIKA
// =============================================
function autoSelectOracleCard() {
  // Csak akkor jelöl ki automatikusan, ha:
  // 1. Én kezdek (vakon kell dönteni)
  // 2. VAGY az ellenfél kezd, DE már megadtuk, hogy milyen színt tett.
  if (iStarted || selectedEnemy !== null) {
      selectedMine = getBestCard();
  } else {
      selectedMine = null; // Várunk az ellenfél lépésére
  }
}

// =============================================
//  DINAMIKUS VALÓSZÍNŰSÉG SZÁMÍTÓ MOTOR
// =============================================
function getActiveEnemyCardProbabilities() {
  let cardCounts = {};
  let total = 0;
  
  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) :
                   selectedEnemy === 'odd'  ? (c => c % 2 !== 0) :
                   (c => true);

  possibleEnemyHands.forEach(hand => {
    let candidates = hand.filter(parityOk);
    candidates.forEach(c => {
       cardCounts[c] = (cardCounts[c] || 0) + 1;
       total++;
    });
  });
  return { cardCounts, total };
}

function calcRoundStats(myCard) {
  let { cardCounts, total } = getActiveEnemyCardProbabilities();
  if (total === 0) return { win: 0, lose: 0, draw: 0 };
  
  let w = 0, l = 0, d = 0;
  for (let c in cardCounts) {
    c = parseInt(c);
    if (myCard > c) w += cardCounts[c];
    else if (myCard < c) l += cardCounts[c];
    else d += cardCounts[c];
  }
  return {
    win: Math.round((w/total)*100),
    lose: Math.round((l/total)*100),
    draw: Math.round((d/total)*100)
  };
}

function calcEnemyCardChance(card) {
  let { cardCounts, total } = getActiveEnemyCardProbabilities();
  if (total === 0) return 0;
  return Math.round(((cardCounts[card] || 0) / total) * 100);
}

// =============================================
//  RENDER FUNCTIONS
// =============================================
function updateScoreBoard() {
  document.getElementById('scoreMine').textContent = myScore;
  document.getElementById('scoreEnemy').textContent = enemyScore;

  let diff = myScore - enemyScore;
  let diffEl = document.getElementById('scoreDiff');

  if (diff > 0) {
    diffEl.textContent = `Vezetsz: +${diff}`;
    diffEl.style.color = 'var(--emerald-light)';
    diffEl.style.borderColor = 'var(--emerald)';
  } else if (diff < 0) {
    diffEl.textContent = `Hátrány: ${diff}`;
    diffEl.style.color = 'var(--crimson-light)';
    diffEl.style.borderColor = 'var(--crimson)';
  } else {
    diffEl.textContent = `Döntetlen`;
    diffEl.style.color = 'var(--text-dim)';
    diffEl.style.borderColor = 'var(--border)';
  }

  let finalProj = document.getElementById('finalScoreProj');
  if (myCards.length === 0) {
    if (myScore > enemyScore) {
       let final = myScore + diff;
       finalProj.innerHTML = `🏆 Játék vége! Győzelem! Végső pontszám: <strong style="color:var(--emerald-light); font-size:16px;">${final}</strong>`;
    } else if (enemyScore > myScore) {
       finalProj.innerHTML = `💀 Játék vége! Vereség.`;
    } else {
       finalProj.innerHTML = `🤝 Játék vége! Döntetlen.`;
    }
  } else {
    if (myScore > enemyScore) {
       let projected = myScore + diff;
       finalProj.innerHTML = `Ha most nyernél, a végső pontod: <strong style="color:var(--gold-light); font-size:15px;">${projected}</strong> lenne.`;
    } else {
       finalProj.innerHTML = `Várható végeredmény: <span style="color:var(--text-dim)">Jelenleg nincs bónusz pont.</span>`;
    }
  }
}

function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  container.innerHTML = '';

  const oddRow = document.createElement('div'); oddRow.className = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

  // EV számítás az összes lapra (cache-elt)
  const allEVs = getAllCardEVs();
  const evMap = {};
  const maxEV = allEVs.length > 0 ? Math.max(...allEVs.map(x => x.ev)) : 0;
  allEVs.forEach(x => { evMap[x.card] = x; });

  ALL_CARDS.forEach(n => {
    const isEven = n % 2 === 0;
    const inHand = myCards.includes(n);
    const isSelected = n === selectedMine;

    const btn = document.createElement('button');
    btn.className = ['card-btn', isEven ? 'even' : 'odd', !inHand ? 'used' : '', isSelected ? 'selected-mine' : ''].join(' ').trim();
    btn.disabled = !inHand;

    const numSpan = document.createElement('span');
    numSpan.className = 'card-num';
    numSpan.textContent = n;
    btn.appendChild(numSpan);

    const badge = document.createElement('div');
    badge.className = 'badge';

    if (inHand && evMap[n] !== undefined) {
      const ev = evMap[n].ev;
      const isOptimal = maxEV > 0 && ev === maxEV;
      badge.textContent = ev.toFixed(1);
      if (isOptimal) badge.classList.add('chance-100');
      else if (ev >= maxEV * 0.85) badge.classList.add('chance-high');
    } else if (inHand) {
      const pct = calcRoundStats(n).win;
      badge.textContent = pct + '%';
    } else {
      badge.textContent = '—';
      badge.style.opacity = '0.3';
    }
    btn.appendChild(badge);

    if (inHand) btn.onclick = () => selectMyCard(n);

    if (isEven) evenRow.appendChild(btn);
    else oddRow.appendChild(btn);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);
}

function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  container.innerHTML = '';

  const oddRow  = document.createElement('div'); oddRow.className = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

  ALL_CARDS.forEach(n => {
    const isEven = n % 2 === 0;
    const chance = calcEnemyCardChance(n);
    const possible = chance > 0;

    const slot = document.createElement('div');
    slot.className = ['enemy-card-slot', isEven ? 'enemy-even' : 'enemy-odd', possible ? 'possible' : 'eliminated'].join(' ');

    const numSpan = document.createElement('span');
    numSpan.textContent = n;
    slot.appendChild(numSpan);

    if (possible) {
      const chanceDiv = document.createElement('div');
      chanceDiv.className = 'enemy-chance';
      if (chance === 100) {
        chanceDiv.classList.add('sure-chance');
        chanceDiv.textContent = '100%';
      } else {
        if (chance >= 70) chanceDiv.classList.add('high-chance');
        else if (chance <= 30) chanceDiv.classList.add('low-chance');
        chanceDiv.textContent = chance + '%';
      }
      slot.appendChild(chanceDiv);
    }

    if (isEven) evenRow.appendChild(slot);
    else oddRow.appendChild(slot);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);
}

// =============================================
//  ORACLE AI v5.0 — BITMASK EXPECTED VALUE ENGINE
//  Teljes játék-aware minimax + memoizáció
//  Bitmask state: minden lap = 1 bit (0..8 = 9 bit)
// =============================================

/**
 * Bitmask segédeszközök
 */
const FULL_MASK = (1 << 9) - 1; // 0b111111111 = 511

function maskToArray(mask) {
  const arr = [];
  for (let i = 0; i <= 8; i++) { if (mask & (1 << i)) arr.push(i); }
  return arr;
}

function arrayToMask(arr) {
  return arr.reduce((m, c) => m | (1 << c), 0);
}

function maskCount(mask) {
  let n = 0, tmp = mask;
  while (tmp) { n += tmp & 1; tmp >>= 1; }
  return n;
}

/**
 * Memoizációs cache.
 * Key: integer = myMask * 2^18 + enemyMask * 2^8 + myS * 16 + enemyS
 * (myS, enemyS max 9 → belefér 4 bitbe)
 */
let evCache = new Map();

function makeKey(myMask, enemyMask, myS, enemyS) {
  // myMask: 9 bit (0-511), enemyMask: 9 bit, myS: 4 bit (0-9), enemyS: 4 bit
  return (myMask << 22) | (enemyMask << 13) | (myS << 6) | (enemyS << 0);
}

function clearEvCache() {
  evCache.clear();
}

/**
 * Várható saját végső pontszám kiszámítása.
 *
 * Modell: az ellenfél minden lehetséges lapját egyenlő valószínűséggel
 * feltételezzük (uniform prior a fennmaradó lapokon belül).
 * Mi optimálisan (EV-maximalizálva) választunk.
 *
 * @param {number} myMask     - Saját kézben lévő lapok bitmaskja
 * @param {number} enemyMask  - Ellenfél lehetséges lapjainak bitmaskja
 * @param {number} myS        - Jelenlegi saját pontszám
 * @param {number} enemyS     - Jelenlegi ellenfél pontszám
 * @returns {{ ev: number, bestCard: number }}
 */
function computeEV(myMask, enemyMask, myS, enemyS) {
  // Bázis eset: nincs több saját lap
  if (myMask === 0) {
    const diff = myS - enemyS;
    return { ev: diff > 0 ? myS + diff : 0, bestCard: -1 };
  }

  const key = makeKey(myMask, enemyMask, myS, enemyS);
  if (evCache.has(key)) return evCache.get(key);

  const enemyCount = maskCount(enemyMask);
  let bestEV = -Infinity;
  let bestCard = -1;

  for (let myCard = 0; myCard <= 8; myCard++) {
    if (!(myMask & (1 << myCard))) continue;
    const nextMyMask = myMask ^ (1 << myCard);

    let totalEV = 0;

    if (enemyCount === 0) {
      // Nincs ellenfél lap — a mostani állás a végső
      const diff = myS - enemyS;
      totalEV = diff > 0 ? myS + diff : 0;
    } else {
      // Átlagolunk az összes lehetséges ellenfél-lapra (uniform)
      for (let ec = 0; ec <= 8; ec++) {
        if (!(enemyMask & (1 << ec))) continue;
        let newMyS = myS, newEnemyS = enemyS;
        if (myCard > ec) newMyS++;
        else if (myCard < ec) newEnemyS++;
        const nextEnemyMask = enemyMask ^ (1 << ec);
        const { ev: subEV } = computeEV(nextMyMask, nextEnemyMask, newMyS, newEnemyS);
        totalEV += subEV;
      }
      totalEV /= enemyCount;
    }

    if (totalEV > bestEV || (totalEV === bestEV && myCard < bestCard)) {
      bestEV = totalEV;
      bestCard = myCard;
    }
  }

  const result = { ev: bestEV, bestCard };
  evCache.set(key, result);
  return result;
}

/**
 * Az aktuális game state-ből kiszámolja minden kézben lévő lapunkhoz
 * a várható végpontszámot (EV), figyelembe véve a selectedEnemy paritást.
 *
 * @returns {Array<{ card, ev, win, lose, draw }>} — EV szerint csökkentően rendezve
 */
function getAllCardEVs() {
  if (myCards.length === 0) return [];

  const myMask = arrayToMask(myCards);

  // Ellenfél lehetséges lapjainak bitmask-ja, paritás-szűréssel
  let rawEnemyMask = 0;
  for (const hand of possibleEnemyHands) {
    for (const c of hand) rawEnemyMask |= (1 << c);
  }

  // Paritás-szűrés
  let enemyMask = rawEnemyMask;
  if (selectedEnemy === 'even') {
    // Csak páros bitek (0,2,4,6,8)
    enemyMask &= (1<<0)|(1<<2)|(1<<4)|(1<<6)|(1<<8);
  } else if (selectedEnemy === 'odd') {
    // Csak páratlan bitek (1,3,5,7)
    enemyMask &= (1<<1)|(1<<3)|(1<<5)|(1<<7);
  }

  return myCards.map(card => {
    const cardBit = 1 << card;
    const nextMyMask = myMask ^ cardBit;

    // Kör-szintű statisztikák (UI-hoz)
    const roundStats = calcRoundStats(card);

    // EV: mi a legjobb várható végpont, ha ezt a lapot dobjuk?
    // Átlagolunk az összes lehetséges ellenfél-lapra
    const enemyCount = maskCount(enemyMask);
    let totalEV = 0;

    if (enemyCount === 0) {
      const diff = myScore - enemyScore;
      totalEV = diff > 0 ? myScore + diff : 0;
    } else {
      for (let ec = 0; ec <= 8; ec++) {
        if (!(enemyMask & (1 << ec))) continue;
        let newMyS = myScore, newEnemyS = enemyScore;
        if (card > ec) newMyS++;
        else if (card < ec) newEnemyS++;
        const nextEnemyMask = enemyMask ^ (1 << ec);
        const { ev: subEV } = computeEV(nextMyMask, nextEnemyMask, newMyS, newEnemyS);
        totalEV += subEV;
      }
      totalEV /= enemyCount;
    }

    return { card, ev: totalEV, ...roundStats };
  }).sort((a, b) => b.ev - a.ev || a.card - b.card);
}

/**
 * Visszaadja a legjobb lapot EV alapján.
 */
function getBestCard() {
  if (myCards.length === 0) return null;
  clearEvCache();
  const cardEVs = getAllCardEVs();
  if (cardEVs.length === 0) return myCards[0];
  return cardEVs[0].card;
}

/**
 * Részletes EV-elemzés a renderOracle()-hoz.
 */
function getBestCardWithAnalysis() {
  if (myCards.length === 0) return null;
  clearEvCache();
  const cardEVs = getAllCardEVs();
  if (cardEVs.length === 0) return { card: myCards[0], ev: 0, win: 0, lose: 0, draw: 0, allEVs: [] };
  return {
    card:    cardEVs[0].card,
    ev:      cardEVs[0].ev,
    win:     cardEVs[0].win,
    lose:    cardEVs[0].lose,
    draw:    cardEVs[0].draw,
    allEVs:  cardEVs
  };
}

function renderOracle() {
  const body = document.getElementById('oracleBody');

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">Játék vége!</div></div>`;
    return;
  }

  const analysis = getBestCardWithAnalysis();
  if (!analysis) return;

  const { card: suggestedCard, ev, win, lose, draw, allEVs } = analysis;
  const isEven = suggestedCard % 2 === 0;

  // ── Stratégiai leírás EV-alapon ──
  const remainingRounds = myCards.length;
  const scoreDiff = myScore - enemyScore;

  let strategyDesc = "";

  if (iStarted && !selectedEnemy) {
    // Vak nyitás
    if (ev > myScore + 2) {
      strategyDesc = `🎯 <strong>VAK NYITÁS:</strong> A <strong>${suggestedCard}</strong>-es a legmagasabb várható végpontszámot (<strong>${ev.toFixed(2)}</strong>) adja vak nyitásnál. Az ellenfél valószínűleg elpazarol erre egy erős lapot.`;
    } else {
      strategyDesc = `🎭 <strong>VAK TAKTIKA:</strong> Teljes bizonytalanság — a <strong>${suggestedCard}</strong>-es adja a legjobb várható végeredményt (<strong>${ev.toFixed(2)} pont</strong>) az összes lehetséges ellenfél-lapra nézve.`;
    }
  } else if (win >= 80) {
    strategyDesc = `🔥 <strong>BIZTOS PONT:</strong> A <strong>${suggestedCard}</strong>-es <strong>${win}%</strong> eséllyel nyer, és a várható végpontszámod <strong>${ev.toFixed(2)}</strong>. Ezt a kört elviszed.`;
  } else if (scoreDiff >= 2 && remainingRounds <= 3) {
    // Vezet, kevés kör van — védekező stratégia
    strategyDesc = `🛡️ <strong>ELŐNY MEGTARTÁSA:</strong> Vezetsz +${scoreDiff}-vel, ${remainingRounds} kör van hátra. A <strong>${suggestedCard}</strong>-es minimalizálja a kockázatot, várható pontod: <strong>${ev.toFixed(2)}</strong>.`;
  } else if (scoreDiff <= -2 && remainingRounds <= 3) {
    // Lemarad, kevés kör — kockázatos, de szükséges
    strategyDesc = `⚡ <strong>VISSZATÁMADÁS:</strong> Lemaradsz ${Math.abs(scoreDiff)}-vel, csak ${remainingRounds} kör maradt! A <strong>${suggestedCard}</strong>-es adja a legjobb esélyt a fordulatra (<strong>${ev.toFixed(2)} várható pont</strong>).`;
  } else if (win >= 50) {
    strategyDesc = `⚔️ <strong>ELŐNYÖS ÁLLÁS:</strong> A <strong>${suggestedCard}</strong>-es <strong>${win}%</strong> nyerési eséllyel a legjobb várható végpontszámot (<strong>${ev.toFixed(2)}</strong>) hozza.`;
  } else if (draw >= 40 && scoreDiff > 0) {
    strategyDesc = `🤝 <strong>DÖNTETLEN VÉD:</strong> Vezetsz, ezért a <strong>${suggestedCard}</strong>-es döntetlennel való kimentése (<strong>${draw}%</strong>) is értékes — várható pont: <strong>${ev.toFixed(2)}</strong>.`;
  } else if (win < 30 && lose > 50) {
    strategyDesc = `💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Nincs nyerő lapod. A <strong>${suggestedCard}</strong>-est vesd oda — az ellenfél elpazarol egy nagy lapot, várható végponted: <strong>${ev.toFixed(2)}</strong>.`;
  } else {
    strategyDesc = `⚖️ <strong>OPTIMÁLIS:</strong> A <strong>${suggestedCard}</strong>-es adja a legjobb várható végpontszámot (<strong>${ev.toFixed(2)}</strong>) a teljes meccs figyelembevételével.`;
  }

  const winColor = win >= 60 ? 'stat-val-green' : win >= 40 ? 'stat-val-gold' : 'stat-val-red';

  // EV rangsor (top 4 lap)
  const topEVs = allEVs.slice(0, 4);
  const maxEV = topEVs.length > 0 ? topEVs[0].ev : 1;

  body.innerHTML = `
    <div class="oracle-suggestion">
      <div>
        <div class="oracle-card ${isEven ? 'oracle-even' : 'oracle-odd'}" style="${!isEven ? 'color:#1a1400;' : ''}">${suggestedCard}</div>
      </div>
    </div>
    <div class="oracle-text">
      <div class="oracle-main-text" style="font-size: 11.5px;">${strategyDesc}</div>
    </div>
    <div class="oracle-stats">
      <div class="oracle-stat-row">
        <span class="stat-label">Várható végpont (EV)</span>
        <span class="stat-val-green" style="font-weight:700;">${ev.toFixed(2)}</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Nyerési esély</span>
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
      <div style="height:1px; background:var(--border); margin:6px 0;"></div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:9px;color:var(--text-dim);margin-bottom:4px;">EV RANGSOR (Várható Végpont)</div>
      ${topEVs.map((item, i) => {
        const evBarWidth = maxEV > 0 ? Math.max(0, Math.round((item.ev / maxEV) * 100)) : 0;
        const isSelected = item.card === suggestedCard;
        const itemIsEven = item.card % 2 === 0;
        return `
          <div class="oracle-stat-row" style="${isSelected ? 'background:rgba(99,60,180,0.18);border-radius:4px;padding:1px 3px;' : ''}">
            <span class="stat-label" style="${isSelected ? 'color:var(--purple-light);font-weight:700;' : ''}">
              ${isSelected ? '▶ ' : ''}Lap <span style="font-size:11px;padding:0 3px;border-radius:3px;background:${itemIsEven ? 'rgba(30,30,80,0.7)' : 'rgba(80,60,10,0.7)'};">${item.card}</span>
            </span>
            <span style="display:flex;align-items:center;gap:6px;">
              <span style="width:${Math.max(6, evBarWidth * 0.6)}px;height:4px;background:${isSelected ? 'var(--purple-light)' : 'var(--border-glow)'};border-radius:2px;display:inline-block;"></span>
              <span class="${isSelected ? 'stat-val-green' : 'stat-val-gold'}" style="${isSelected ? 'font-weight:700;' : ''}">${item.ev.toFixed(2)}</span>
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// =============================================
//  SELECTION HANDLERS
// =============================================
function selectMyCard(n) {
  if (!myCards.includes(n)) return;
  selectedMine = (selectedMine === n) ? null : n; // Kézi felülbírálás engedélyezése
  renderMyCards();
  updateChips();
  updateConfirmBtn();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');
  
  autoSelectOracleCard(); // <-- AZ ÚJ AUTOMATA KIJELÖLŐ
  
  updateChips();
  updateConfirmBtn();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
}

function selectResult(res) {
  selectedResult = (selectedResult === res) ? null : res;
  document.getElementById('btnWin').classList.toggle('active',  selectedResult === 'win');
  document.getElementById('btnLose').classList.toggle('active', selectedResult === 'lose');
  document.getElementById('btnDraw').classList.toggle('active', selectedResult === 'draw');
  updateChips();
  updateConfirmBtn();
}

function updateChips() {
  const cm = document.getElementById('chip-mine');
  const ce = document.getElementById('chip-enemy');
  const cr = document.getElementById('chip-result');

  cm.textContent = selectedMine !== null ? `Lapom: ${selectedMine}` : 'Lapom: —';
  cm.className   = selectedMine !== null ? 'status-chip chip-mine' : 'status-chip chip-none';

  ce.textContent = selectedEnemy ? (selectedEnemy === 'even' ? 'Ellenfél: Páros' : 'Ellenfél: Páratlan') : 'Ellenfél: —';
  ce.className   = selectedEnemy ? 'status-chip chip-enemy' : 'status-chip chip-none';

  if (selectedResult) {
    const labels = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
    const cls    = { win: 'chip-result-win', lose: 'chip-result-lose', draw: 'chip-result-draw' };
    cr.textContent = `Eredmény: ${labels[selectedResult]}`;
    cr.className   = `status-chip ${cls[selectedResult]}`;
  } else {
    cr.textContent = 'Eredmény: —';
    cr.className   = 'status-chip chip-none';
  }
}

function updateConfirmBtn() {
  const canConfirm = selectedMine !== null && selectedEnemy !== null && selectedResult !== null;
  document.getElementById('btnConfirm').disabled = !canConfirm;
}

// =============================================
//  DEDUCTION LOGIC
// =============================================
function deduceEnemyHands(myCard, enemyType, result) {
  let newHandsSet = new Set();
  const parityOk = enemyType === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);

  for (let hand of possibleEnemyHands) {
    let candidates = hand.filter(c => parityOk(c));
    
    if (result === 'win') candidates = candidates.filter(c => c < myCard);
    else if (result === 'lose') candidates = candidates.filter(c => c > myCard);
    else if (result === 'draw') candidates = candidates.filter(c => c === myCard);

    for (let c of candidates) {
      let newHand = hand.filter(card => card !== c);
      newHandsSet.add(newHand.join(','));
    }
  }

  let newHands = [...newHandsSet].map(str => str === "" ? [] : str.split(',').map(Number));

  if (newHands.length === 0) {
    alert("Hiba: Ilyen eredmény nem lehetséges a jelenlegi lapok alapján!");
    return possibleEnemyHands; 
  }

  return newHands;
}

// =============================================
//  CONFIRM ROUND
// =============================================
function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;

  history.push({
    myCards: [...myCards],
    possibleEnemyHands: possibleEnemyHands.map(h => [...h]),
    myScore,
    enemyScore,
    selectedMine,
    selectedEnemy,
    selectedResult,
    iStarted,
    roundNum
  });

  if (selectedResult === 'win') myScore++;
  else if (selectedResult === 'lose') enemyScore++;

  possibleEnemyHands = deduceEnemyHands(selectedMine, selectedEnemy, selectedResult);
  myCards = myCards.filter(c => c !== selectedMine);

  const labels = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
  const enemyLabel = (selectedEnemy === 'even' ? 'Páros' : 'Páratlan') + (iStarted ? ' (Én kezdtem)' : '');
  const resultClass = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[selectedResult];

  roundNum++;
  addHistoryEntry(roundNum, selectedMine, enemyLabel, labels[selectedResult], resultClass);

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;

  clearActionButtons();
  clearEvCache();
  
  autoSelectOracleCard(); // <-- AZ ÚJ AUTOMATA KIJELÖLŐ (Következő körhöz)
  
  updateScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  updateChips();
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
    const labels = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
    const cls = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[h.selectedResult];
    const enemyLabel = (h.selectedEnemy === 'even' ? 'Páros' : 'Páratlan') + (h.iStarted ? ' (Én kezdtem)' : '');
    addHistoryEntry(i + 1, h.selectedMine, enemyLabel, labels[h.selectedResult], cls);
  });
}

function undoLast() {
  if (history.length === 0) return;
  const snap = history.pop();
  myCards = snap.myCards;
  possibleEnemyHands = snap.possibleEnemyHands;
  myScore = snap.myScore;
  enemyScore = snap.enemyScore;
  roundNum = snap.roundNum;

  selectedMine = null; selectedEnemy = null; selectedResult = null;
  clearActionButtons();
  clearEvCache();
  
  autoSelectOracleCard(); // Visszavonás után is automatikusan bejelöl!
  
  updateScoreBoard(); renderHistory(); renderMyCards(); renderEnemyCards(); renderOracle(); updateConfirmBtn(); updateChips();
}

function resetAll() {
  myCards = [...ALL_CARDS]; possibleEnemyHands = [ [...ALL_CARDS] ]; history = []; roundNum = 0;
  myScore = 0; enemyScore = 0;
  selectedMine = null; selectedEnemy = null; selectedResult = null;

  const chk = document.getElementById('chkIStart'); if (chk) chk.checked = false; iStarted = false;
  clearActionButtons();
  clearEvCache();
  
  autoSelectOracleCard();
  
  updateScoreBoard(); renderMyCards(); renderEnemyCards(); renderOracle(); updateConfirmBtn(); updateChips(); renderHistory();
}

function clearActionButtons() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id => document.getElementById(id).classList.remove('active'));
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); resetAll(); }
  else if (e.key === 'Backspace' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); undoLast(); }
});

init();
