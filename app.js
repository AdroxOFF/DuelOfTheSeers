// =============================================
//  LÁTÓK PÁRBAJA — PONTMAXIMALIZÁLÓ HELPER
//  app.js (v4.2 Stable - "Final Cut")
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
      autoSelectOracleCard(); 
      refreshAll();
    });
  }
  
  autoSelectOracleCard();
  refreshAll();
  renderHistory();
}

// =============================================
//  LOGIKA (Oracle & Deduction)
// =============================================
function autoSelectOracleCard() {
  if (iStarted) {
      selectedMine = getBestCard();
  }
}

function getBestCard() {
  if (myCards.length === 0) return null;
  
  // Vak kezdés: ha mi kezdünk és még nincs paritás infó, legkisebb lap
  if (iStarted && selectedEnemy === null) return Math.min(...myCards);

  let stats = myCards.map(c => ({ card: c, s: calcRoundStats(c) }));
  
  // 1. Biztos Pontszerzők
  let solidWinners = stats.filter(item => item.s.win >= 60).sort((a, b) => a.card - b.card);
  if (solidWinners.length > 0) return solidWinners[0].card;

  // 2. Kockázatos
  let possibleWinners = stats.filter(item => item.s.win >= 40).sort((a, b) => a.card - b.card);
  if (possibleWinners.length > 0) return possibleWinners[0].card;

  // 3. Döntetlen
  let drawSavers = stats.filter(item => item.s.draw >= 50).sort((a, b) => a.card - b.card);
  if (drawSavers.length > 0) return drawSavers[0].card;

  return Math.min(...myCards);
}

function getActiveEnemyCardProbabilities() {
  let cardCounts = {};
  let total = 0;
  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) :
                   selectedEnemy === 'odd'  ? (c => c % 2 !== 0) :
                   (c => true);

  possibleEnemyHands.forEach(hand => {
    hand.filter(parityOk).forEach(c => {
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
  return newHands.length === 0 ? possibleEnemyHands : newHands;
}

// =============================================
//  UI RENDER
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
  document.getElementById('scoreMine').textContent = myScore;
  document.getElementById('scoreEnemy').textContent = enemyScore;
  let diff = myScore - enemyScore;
  let finalCoins = diff > 0 ? myScore + diff : myScore;
  let diffEl = document.getElementById('scoreDiff');
  let finalProj = document.getElementById('finalScoreProj');

  if (diffEl) {
      diffEl.textContent = diff > 0 ? `Vezetsz: +${diff}` : diff < 0 ? `Hátrány: ${diff}` : 'Döntetlen';
      diffEl.style.color = diff > 0 ? 'var(--emerald-light)' : diff < 0 ? 'var(--crimson-light)' : 'var(--text-dim)';
  }
  if (finalProj) {
      finalProj.innerHTML = myCards.length === 0 ? 
        `Játék vége! Érme: <strong>${finalCoins}</strong>` : 
        (diff > 0 ? `Ha nyernél: <strong>${finalCoins}</strong>` : `Nincs bónusz érme.`);
  }
}

function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  if(!container) return;
  container.innerHTML = '';
  
  const oddRow = document.createElement('div'); oddRow.className = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

  ALL_CARDS.forEach(n => {
    const inHand = myCards.includes(n);
    const stats = inHand ? calcRoundStats(n) : { win: 0 };
    const btn = document.createElement('button');
    btn.className = `card-btn ${n%2===0?'even':'odd'} ${!inHand?'used':''} ${n===selectedMine?'selected-mine':''}`;
    btn.disabled = !inHand;
    btn.innerHTML = `<span class="card-num">${n}</span><div class="badge">${inHand ? stats.win+'%' : '—'}</div>`;
    btn.onclick = () => selectMyCard(n);
    (n%2===0 ? evenRow : oddRow).appendChild(btn);
  });
  container.append(oddRow, evenRow);
}

function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  if(!container) return;
  container.innerHTML = '';
  const { cardCounts, total } = getActiveEnemyCardProbabilities();
  
  const oddRow = document.createElement('div'); oddRow.className = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

  ALL_CARDS.forEach(n => {
    const chance = total > 0 ? Math.round(((cardCounts[n] || 0) / total) * 100) : 0;
    const slot = document.createElement('div');
    slot.className = `enemy-card-slot ${n%2===0?'enemy-even':'enemy-odd'} ${chance > 0 ? 'possible' : 'eliminated'}`;
    slot.innerHTML = `<span>${n}</span>${chance > 0 ? `<div class="enemy-chance">${chance}%</div>` : ''}`;
    (n%2===0 ? evenRow : oddRow).appendChild(slot);
  });
  container.append(oddRow, evenRow);
}

function renderOracle() {
  const body = document.getElementById('oracleBody');
  if (!body || myCards.length === 0) return;
  let suggested = selectedMine !== null ? selectedMine : getBestCard();
  if (suggested === null) return;
  const s = calcRoundStats(suggested);
  body.innerHTML = `<div class="oracle-suggestion"><div class="oracle-card ${suggested%2===0?'oracle-even':'oracle-odd'}">${suggested}</div></div>
                    <div class="oracle-text">Nyerési esély: <strong>${s.win}%</strong></div>`;
}

// =============================================
//  HANDLERS & CONFIRM
// =============================================
function selectMyCard(n) {
  if (!myCards.includes(n)) return;
  selectedMine = (selectedMine === n) ? null : n;
  refreshAll();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');
  
  // Fix: csak ha én kezdtem, akkor írjuk felül a javaslatot
  if (iStarted) autoSelectCard();
  
  refreshAll();
}

function selectResult(res) {
  const av = _getResultAvailability();
  if (!av[res]) return;
  selectedResult = (selectedResult === res) ? null : res;
  document.getElementById('btnWin').classList.toggle('active', selectedResult === 'win');
  document.getElementById('btnLose').classList.toggle('active', selectedResult === 'lose');
  document.getElementById('btnDraw').classList.toggle('active', selectedResult === 'draw');
  updateConfirmBtn();
}

function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;
  if (isConfirming) return;
  isConfirming = true;

  history.push({ myCards: [...myCards], enemyProb: [...enemyProb], myScore, enemyScore, roundNum, iStarted, selectedMine, selectedEnemy, selectedResult });

  if (selectedResult === 'win') myScore++;
  else if (selectedResult === 'lose') enemyScore++;

  updateEnemyProb(selectedMine, selectedEnemy, selectedResult);
  myCards = myCards.filter(c => c !== selectedMine);
  roundNum++;

  // UI Reset
  selectedMine = null; selectedEnemy = null; selectedResult = null;
  clearAllActive();
  autoSelectCard();
  refreshAll();
  isConfirming = false;
}

function _getResultAvailability() {
  const av = { win: true, lose: true, draw: true };
  if (selectedMine === null || selectedEnemy === null) return { win: false, lose: false, draw: false };
  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);
  if (!parityOk(selectedMine)) av.draw = false;
  return av;
}

function updateResultButtons() {
  const av = _getResultAvailability();
  document.getElementById('btnWin').disabled = !av.win;
  document.getElementById('btnLose').disabled = !av.lose;
  document.getElementById('btnDraw').disabled = !av.draw;
}

function updateConfirmBtn() {
  const btn = document.getElementById('btnConfirm');
  const av = _getResultAvailability();
  btn.disabled = !(selectedMine !== null && selectedEnemy !== null && selectedResult !== null && av[selectedResult]);
}

function clearAllActive() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id => document.getElementById(id)?.classList.remove('active'));
}

function undoLast() {
  if (history.length === 0) return;
  const snap = history.pop();
  myCards = snap.myCards; enemyProb = snap.enemyProb; myScore = snap.myScore; enemyScore = snap.enemyScore; roundNum = snap.roundNum; iStarted = snap.iStarted;
  selectedMine = null; selectedEnemy = null; selectedResult = null;
  autoSelectCard();
  refreshAll();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') resetAll();
  else if (e.key === 'Backspace' && document.activeElement.tagName !== 'INPUT') undoLast();
});

init();
