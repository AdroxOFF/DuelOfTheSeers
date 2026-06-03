// =============================================
//  LÁTÓK PÁRBAJA — PONTMAXIMALIZÁLÓ HELPER
//  app.js v4.3 (Hibatűrő verzió)
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
let myCards = [...ALL_CARDS]; 
let possibleEnemyHands = [ [...ALL_CARDS] ]; 
let myScore = 0; let enemyScore = 0;
let selectedMine = null; let selectedEnemy = null; let selectedResult = null; let iStarted = false;
let history = []; let roundNum = 0; let isConfirming = false; 

// =============================================
//  SEGÉD: Biztonságos DOM elérés
// =============================================
function safeGet(id) {
    const el = document.getElementById(id);
    if (!el) console.warn("Elem nem található: " + id);
    return el;
}

function init() {
  const chk = safeGet('chkIStart');
  if (chk) {
    chk.addEventListener('change', () => {
      iStarted = chk.checked;
      if (iStarted) {
        selectedEnemy = null;
        safeGet('btnEven')?.classList.remove('active');
        safeGet('btnOdd')?.classList.remove('active');
      }
      autoSelectOracleCard(); 
      refreshAll();
    });
  }
  autoSelectOracleCard();
  refreshAll();
  renderHistory();
}

// =============================================
//  MATEMATIKAI MAG
// =============================================
function autoSelectOracleCard() {
  if (iStarted) selectedMine = getBestCard();
  else selectedMine = null;
}

function getActiveEnemyCardProbabilities() {
  let cardCounts = {}; let total = 0;
  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) : (selectedEnemy === 'odd' ? (c => c % 2 !== 0) : (c => true));
  possibleEnemyHands.forEach(hand => {
    hand.filter(parityOk).forEach(c => { cardCounts[c] = (cardCounts[c] || 0) + 1; total++; });
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
  return { win: Math.round((w/total)*100), lose: Math.round((l/total)*100), draw: Math.round((d/total)*100) };
}

function getBestCard() {
  if (myCards.length === 0) return null;
  if (iStarted && selectedEnemy === null) return Math.min(...myCards);
  let stats = myCards.map(c => ({ card: c, s: calcRoundStats(c) }));
  let solid = stats.filter(i => i.s.win >= 60).sort((a,b)=>a.card-b.card);
  if(solid.length) return solid[0].card;
  let possible = stats.filter(i => i.s.win >= 40).sort((a,b)=>a.card-b.card);
  if(possible.length) return possible[0].card;
  return Math.min(...myCards);
}

// =============================================
//  UI FRISSÍTÉS
// =============================================
function refreshAll() {
  updateScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  renderActionButtons();
  updateChips();
  updateConfirmBtn();
}

function updateScoreBoard() {
  const sm = safeGet('scoreMine'); const se = safeGet('scoreEnemy');
  if(sm) sm.textContent = myScore;
  if(se) se.textContent = enemyScore;
  
  let diffEl = safeGet('scoreDiff');
  let projEl = safeGet('finalScoreProj');
  if(diffEl) {
      let diff = myScore - enemyScore;
      diffEl.textContent = diff > 0 ? `Vezetsz: +${diff}` : diff < 0 ? `Hátrány: ${diff}` : 'Döntetlen';
  }
}

function renderMyCards() {
  const container = safeGet('myCardsRow');
  if (!container) return;
  container.innerHTML = '';
  
  // Grid létrehozása
  ALL_CARDS.forEach(n => {
    const inHand = myCards.includes(n);
    const btn = document.createElement('button');
    btn.className = `card-btn ${n%2===0?'even':'odd'} ${!inHand?'used':''} ${n===selectedMine?'selected-mine':''}`;
    btn.textContent = n;
    btn.disabled = !inHand;
    btn.onclick = () => selectMyCard(n);
    container.appendChild(btn);
  });
}

function renderOracle() {
  const body = safeGet('oracleBody');
  if (!body) return;
  let card = selectedMine !== null ? selectedMine : getBestCard();
  if (card !== null) {
      body.innerHTML = `<div>Javaslat: <strong>${card}</strong></div>`;
  }
}

// =============================================
//  EVENT HANDLERS
// =============================================
function selectMyCard(n) {
  selectedMine = (selectedMine === n) ? null : n;
  refreshAll();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  safeGet('btnEven')?.classList.toggle('active', selectedEnemy === 'even');
  safeGet('btnOdd')?.classList.toggle('active', selectedEnemy === 'odd');
  refreshAll();
}

function selectResult(res) {
  selectedResult = (selectedResult === res) ? null : res;
  safeGet('btnWin')?.classList.toggle('active', selectedResult === 'win');
  safeGet('btnLose')?.classList.toggle('active', selectedResult === 'lose');
  safeGet('btnDraw')?.classList.toggle('active', selectedResult === 'draw');
  updateConfirmBtn();
}

function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;
  
  // Logika
  if (selectedResult === 'win') myScore++;
  else if (selectedResult === 'lose') enemyScore++;
  
  myCards = myCards.filter(c => c !== selectedMine);
  selectedMine = null; selectedEnemy = null; selectedResult = null;
  
  clearAllActive();
  refreshAll();
}

function clearAllActive() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id => safeGet(id)?.classList.remove('active'));
}

// Init
init();
