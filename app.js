// =============================================
//  LÁTÓK PÁRBAJA — AUTOMATA PONTMAXIMALIZÁLÓ
//  app.js (v4.1 STABLE - Visszatérés a jól működő alapokhoz)
// =============================================
//
//  MIÉRT EZ A LEGJOBB?
//  - Tökéletesen vezeti a megmaradt kártyakombinációkat (nincs fals matek).
//  - 0 milliszekundum alatt lefut, sosem fagy le a böngésző.
//  - JAVÍTVA: Vak Kezdésnél most már kőkeményen be van égetve, 
//    hogy MINDIG a legkisebb lapot kell beáldozni.
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
let isConfirming = false; 

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
      
      autoSelectOracleCard(); 
      updateChips();
      updateConfirmBtn();
      renderMyCards();
      renderEnemyCards();
      renderOracle();
      updateResultButtons();
    });
  }
  
  autoSelectOracleCard();
  updateScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  renderHistory();
  updateResultButtons();
}

// =============================================
//  AUTOMATA KÁRTYA KIJELÖLŐ LOGIKA
// =============================================
function autoSelectOracleCard() {
  if (iStarted || selectedEnemy !== null) {
      selectedMine = getBestCard();
  } else {
      selectedMine = null; 
  }
}

// =============================================
//  HAJSZÁLPONTOS VALÓSZÍNŰSÉG SZÁMÍTÓ MOTOR
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
//  VALIDÁCIÓ (UX: Hibás gombok letiltása)
// =============================================
function _getResultAvailability() {
  const availability = { win: true, lose: true, draw: true };

  if (selectedMine === null || selectedEnemy === null) {
    availability.win = false;
    availability.lose = false;
    availability.draw = false;
    return availability;
  }

  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);

  if (!parityOk(selectedMine)) {
    availability.draw = false;
  }

  for (const res of ['win', 'lose', 'draw']) {
    if (!availability[res]) continue;
    let found = false;
    for (const hand of possibleEnemyHands) {
      let candidates = hand.filter(c => parityOk(c));
      if (res === 'win')       candidates = candidates.filter(c => c < selectedMine);
      else if (res === 'lose') candidates = candidates.filter(c => c > selectedMine);
      else if (res === 'draw') candidates = candidates.filter(c => c === selectedMine);
      if (candidates.length > 0) { found = true; break; }
    }
    if (!found) availability[res] = false;
  }
  return availability;
}

function updateResultButtons() {
  const av = _getResultAvailability();
  const btnWin  = document.getElementById('btnWin');
  const btnLose = document.getElementById('btnLose');
  const btnDraw = document.getElementById('btnDraw');

  if(btnWin) btnWin.disabled  = !av.win;
  if(btnLose) btnLose.disabled = !av.lose;
  if(btnDraw) btnDraw.disabled = !av.draw;

  if (selectedResult && !av[selectedResult]) {
    selectedResult = null;
    if(btnWin) btnWin.classList.remove('active');
    if(btnLose) btnLose.classList.remove('active');
    if(btnDraw) btnDraw.classList.remove('active');
  }
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

  // Pontozás Metin2 szabályok szerint
  const finalCoins = diff > 0 ? myScore + diff : myScore;
  let finalProj = document.getElementById('finalScoreProj');
  
  if (myCards.length === 0) {
    if (diff > 0) {
       finalProj.innerHTML = `🏆 Játék vége! Győzelem! Végső érme: <strong style="color:var(--emerald-light); font-size:16px;">${finalCoins}</strong>`;
    } else if (diff < 0) {
       finalProj.innerHTML = `💀 Játék vége! Vereség. Megszerzett érme: ${finalCoins}`;
    } else {
       finalProj.innerHTML = `🤝 Játék vége! Döntetlen. Megszerzett érme: ${finalCoins}`;
    }
  } else {
    if (diff > 0) {
       finalProj.innerHTML = `Ha most nyernél, a végső érméd: <strong style="color:var(--gold-light); font-size:15px;">${finalCoins}</strong> lenne.`;
    } else {
       finalProj.innerHTML = `Várható végeredmény: <span style="color:var(--text-dim)">Jelenleg nincs bónusz. (Alap: ${myScore})</span>`;
    }
  }
}

function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  container.innerHTML = '';

  const oddRow = document.createElement('div'); oddRow.className = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

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
    
    const stats = calcRoundStats(n);
    const pct = stats.win;

    if (inHand) {
      badge.textContent = pct + '%';
      if (pct === 100) badge.classList.add('chance-100');
      else if (pct >= 60) badge.classList.add('chance-high');
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
//  ORACLE AI - AGRESSZÍV PONTMAXIMALIZÁLÓ
// =============================================
function getBestCard() {
  if (myCards.length === 0) return null;
  
  // ==========================================
  // JAVÍTÁS: KŐKEMÉNY VAK KEZDÉS VÉDELEM
  // Ha nem látjuk az ellenfél színét, nem gondolkodunk, azonnal beáldozzuk a legkisebb lapot!
  // ==========================================
  if (selectedEnemy === null) {
      return Math.min(...myCards);
  }

  let stats = myCards.map(c => ({ card: c, s: calcRoundStats(c) }));
  
  // 1. Biztos Pontszerzők (Nyerési esély >= 60%)
  let solidWinners = stats.filter(item => item.s.win >= 60);
  if (solidWinners.length > 0) {
      solidWinners.sort((a, b) => a.card - b.card); // Legkisebbet választja a nyerők közül
      return solidWinners[0].card;
  }

  // 2. Kockázatos, de esélyes (Nyerési esély >= 40%)
  let possibleWinners = stats.filter(item => item.s.win >= 40);
  if (possibleWinners.length > 0) {
      possibleWinners.sort((a, b) => a.card - b.card);
      return possibleWinners[0].card;
  }

  // 3. Döntetlen kimentése
  let drawSavers = stats.filter(item => item.s.draw >= 50);
  if (drawSavers.length > 0) {
      drawSavers.sort((a, b) => a.card - b.card);
      return drawSavers[0].card;
  }

  // 4. Taktikai Áldozat (Minden kötél szakad: Legkisebb lap)
  return Math.min(...myCards);
}

function renderOracle() {
  const body = document.getElementById('oracleBody');

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">Játék vége!</div></div>`;
    return;
  }

  let suggestedCard = selectedMine !== null ? selectedMine : getBestCard();
  if (suggestedCard === null) {
      body.innerHTML = `
      <div class="oracle-text">
        <div class="oracle-main-text">
          ⏳ <strong>Várakozás...</strong><br>
          <span style="font-size:10px;color:var(--text-dim);">
            Kattints a <strong>⬛ Páros</strong> vagy <strong>⬜ Páratlan</strong> gombra a hátlap alapján!
          </span>
        </div>
      </div>`;
      return;
  }

  const isEven = suggestedCard % 2 === 0;
  const s = calcRoundStats(suggestedCard);
  
  let strategyDesc = "";
  if (selectedEnemy === null) {
      strategyDesc = `💀 <strong>VAK NYITÁS:</strong> Nem tudjuk az ellenfél lapját. Az Oracle a <strong>${suggestedCard}</strong>-est (a legkisebb lapodat) áldozza be információszerzés céljából!`;
  } else if (s.win >= 60) {
      strategyDesc = `🔥 <strong>TÁMADÁS:</strong> A <strong>${suggestedCard}</strong>-es a legkisebb lapod, amivel már magas (<strong>${s.win}%</strong>) eséllyel pontot szerzel. A nagyobb lapjaidat megspórolod!`;
  } else if (s.win >= 40) {
      strategyDesc = `⚖️ <strong>KIEGYENLÍTETT:</strong> A <strong>${suggestedCard}</strong>-es lap a legjobb kompromisszum. Van esély a pontra (<strong>${s.win}%</strong>), de nem fáj annyira, ha elbukjuk.`;
  } else if (s.draw >= 50) {
      strategyDesc = `🛡️ <strong>VÉDEKEZÉS:</strong> A <strong>${suggestedCard}</strong>-es lappal jó eséllyel (<strong>${s.draw}%</strong>) kimentünk egy döntetlent.`;
  } else {
      strategyDesc = `💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Nincs jó nyerő lapod. Dobd be a <strong>${suggestedCard}</strong>-est (a legkisebbet), hogy az ellenfél elpazarolja az egyik nagy lapját!`;
  }

  const winColor = s.win >= 60 ? 'stat-val-green' : s.win >= 40 ? 'stat-val-gold' : 'stat-val-red';
  const cardStats = myCards.map(c => ({ card: c, s: calcRoundStats(c) })).sort((a, b) => b.s.win - a.s.win).slice(0, 4);

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
        <span class="stat-label">Nyerési esély</span>
        <span class="${winColor}">${s.win}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Veszítési esély</span>
        <span class="stat-val-red">${s.lose}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Döntetlen esély</span>
        <span class="stat-val-purple">${s.draw}%</span>
      </div>
      <div style="height:1px; background:var(--border); margin:6px 0;"></div>
      ${cardStats.map(stat => `
        <div class="oracle-stat-row">
          <span class="stat-label">Lap ${stat.card}</span>
          <span class="${stat.s.win === 100 ? 'stat-val-red' : stat.s.win >= 50 ? 'stat-val-green' : 'stat-val-gold'}">${stat.s.win}%</span>
        </div>
      `).join('')}
    </div>
  `;
}

// =============================================
//  SELECTION HANDLERS
// =============================================
function selectMyCard(n) {
  if (!myCards.includes(n)) return;
  selectedMine = (selectedMine === n) ? null : n; 
  renderMyCards();
  renderOracle();
  updateChips();
  updateConfirmBtn();
  updateResultButtons();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');
  
  autoSelectOracleCard();
  
  updateChips();
  updateConfirmBtn();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateResultButtons();
}

function selectResult(res) {
  const av = _getResultAvailability();
  if (!av[res]) return;

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

  ce.textContent = selectedEnemy ? (selectedEnemy === 'even' ? 'Ellenfél: Páros ⬛' : 'Ellenfél: Páratlan ⬜') : 'Ellenfél: —';
  ce.className   = selectedEnemy ? 'status-chip chip-enemy' : 'status-chip chip-none';

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
  const av = _getResultAvailability();
  const resultValid = selectedResult && av[selectedResult];

  const canConfirm = selectedMine !== null && selectedEnemy !== null && resultValid && !isConfirming;
  const btn = document.getElementById('btnConfirm');
  if(btn) btn.disabled = !canConfirm;
}

// =============================================
//  DEDUCTION LOGIC (Tökéletes Kombináció Követő)
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
      let newHand = hand.filter(card => card !== c).sort((a,b)=>a-b);
      newHandsSet.add(newHand.join(','));
    }
  }

  let newHands = [...newHandsSet].map(str => str === "" ? [] : str.split(',').map(Number));

  if (newHands.length === 0) {
    return possibleEnemyHands; // Hiba esetén megtartjuk az előző állapotot
  }

  return newHands;
}

// =============================================
//  CONFIRM ROUND
// =============================================
function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;
  if (isConfirming) return;

  isConfirming = true;
  const confirmBtn = document.getElementById('btnConfirm');
  if(confirmBtn) confirmBtn.textContent = '⏳';

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
  const enemyLabel = (selectedEnemy === 'even' ? 'Páros ⬛' : 'Páratlan ⬜') + (iStarted ? ' (én kezdem)' : '');
  const resultClass = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[selectedResult];

  roundNum++;
  addHistoryEntry(roundNum, selectedMine, enemyLabel, labels[selectedResult], resultClass);

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;

  clearActionButtons();
  
  autoSelectOracleCard(); 
  
  updateScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateResultButtons();
  updateConfirmBtn();
  updateChips();

  setTimeout(() => {
     isConfirming = false;
     if(confirmBtn) confirmBtn.textContent = '✦ Rögzítés';
  }, 50);
}

// =============================================
//  HISTORY & UNDO
// =============================================
function addHistoryEntry(round, mine, enemy, result, cls) {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (list.querySelector('.history-empty')) list.innerHTML = '';

  const entry = document.createElement('div');
  entry.className = 'history-entry';
  entry.innerHTML = `<span class="h-round">#${round}</span> <span class="h-mine">Én: ${mine}</span> <span class="h-enemy">Ell: ${enemy}</span> <span class="${cls}">${result}</span>`;
  list.appendChild(entry);
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = '<div class="history-empty">Még nincs lejátszott kör.</div>';
    return;
  }
  history.forEach((h, i) => {
    const labels = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
    const cls = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[h.selectedResult];
    const enemyLabel = (h.selectedEnemy === 'even' ? 'Páros ⬛' : 'Páratlan ⬜') + (h.iStarted ? ' (én kezdem)' : '');
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
  
  autoSelectOracleCard(); 
  
  updateScoreBoard(); renderHistory(); renderMyCards(); renderEnemyCards(); renderOracle(); updateResultButtons(); updateConfirmBtn(); updateChips();
}

function resetAll() {
  myCards = [...ALL_CARDS]; possibleEnemyHands = [ [...ALL_CARDS] ]; history = []; roundNum = 0;
  myScore = 0; enemyScore = 0;
  selectedMine = null; selectedEnemy = null; selectedResult = null;

  const chk = document.getElementById('chkIStart'); if (chk) chk.checked = false; iStarted = false;
  clearActionButtons(); 
  
  autoSelectOracleCard();
  
  updateScoreBoard(); renderMyCards(); renderEnemyCards(); renderOracle(); updateResultButtons(); updateConfirmBtn(); updateChips(); renderHistory();
}

function clearActionButtons() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.remove('active');
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); resetAll(); }
  else if (e.key === 'Backspace' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); undoLast(); }
});

init();
