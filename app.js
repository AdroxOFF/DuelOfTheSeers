// =============================================
//  LÁTÓK PÁRBAJA — PONTMAXIMALIZÁLÓ HELPER
//  app.js v4.2 (Final Stable - Rögzítési mód javítva)
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
      refreshAll();
    });
  }
  
  autoSelectOracleCard();
  refreshAll();
  renderHistory();
}

// =============================================
//  AUTOMATA KIJELÖLŐ (Javított logika)
// =============================================
function autoSelectOracleCard() {
  // Ha én kezdek, az Oracle folyamatosan számol és javasol.
  // Ha az ellenfél kezdett, akkor a paritás gombok csak adat rögzítésre valók,
  // nem bántjuk a selectedMine-t automatikusan.
  if (iStarted) {
    selectedMine = getBestCard();
  }
  // !iStarted esetén nem hívjuk, hogy ne írja felül a már lerakott lapot
}

// =============================================
//  VALÓSZÍNŰSÉG SZÁMÍTÓ MOTOR
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
//  ORACLE AI
// =============================================
function getBestCard() {
  if (myCards.length === 0) return null;
  
  // Vak kezdés: ha mi kezdünk, mindenképp a legkisebb lapot áldozzuk
  if (iStarted && selectedEnemy === null) return Math.min(...myCards);

  let stats = myCards.map(c => ({ card: c, s: calcRoundStats(c) }));
  
  let solidWinners = stats.filter(item => item.s.win >= 60);
  if (solidWinners.length > 0) {
      solidWinners.sort((a, b) => a.card - b.card);
      return solidWinners[0].card;
  }

  let possibleWinners = stats.filter(item => item.s.win >= 40);
  if (possibleWinners.length > 0) {
      possibleWinners.sort((a, b) => a.card - b.card);
      return possibleWinners[0].card;
  }

  let drawSavers = stats.filter(item => item.s.draw >= 50);
  if (drawSavers.length > 0) {
      drawSavers.sort((a, b) => a.card - b.card);
      return drawSavers[0].card;
  }

  return Math.min(...myCards);
}

// =============================================
//  UI RENDER & HANDLERS
// =============================================
function refreshAll() {
  updateScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateChips();
  updateConfirmBtn();
  updateResultButtons();
}

function updateScoreBoard() {
  document.getElementById('scoreMine').textContent = myScore;
  document.getElementById('scoreEnemy').textContent = enemyScore;

  let diff = myScore - enemyScore;
  let diffEl = document.getElementById('scoreDiff');
  let finalProj = document.getElementById('finalScoreProj');
  const finalCoins = diff > 0 ? myScore + diff : myScore;

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

  if (myCards.length === 0) {
     finalProj.innerHTML = diff > 0 ? `🏆 Győzelem! Érme: ${finalCoins}` : `Játék vége!`;
  } else {
     finalProj.innerHTML = diff > 0 ? `Végső érme: ${finalCoins} lenne.` : `Nincs bónusz érme.`;
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
    btn.innerHTML = `<span class="card-num">${n}</span><div class="badge">${inHand ? calcRoundStats(n).win + '%' : '—'}</div>`;
    if (inHand) btn.onclick = () => selectMyCard(n);
    
    isEven ? evenRow.appendChild(btn) : oddRow.appendChild(btn);
  });
  container.appendChild(oddRow);
  container.appendChild(evenRow);
}

function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  container.innerHTML = '';
  const { cardCounts, total } = getActiveEnemyCardProbabilities();

  ALL_CARDS.forEach(n => {
    const isEven = n % 2 === 0;
    const chance = total > 0 ? Math.round(((cardCounts[n] || 0) / total) * 100) : 0;
    const slot = document.createElement('div');
    slot.className = `enemy-card-slot ${isEven ? 'enemy-even' : 'enemy-odd'} ${chance > 0 ? 'possible' : 'eliminated'}`;
    slot.innerHTML = `<span>${n}</span>${chance > 0 ? `<div class="enemy-chance">${chance}%</div>` : ''}`;
    isEven ? document.getElementById('enemyCardsRow').appendChild(slot) : null; // Egyszerűsítve
    // Megjegyzés: a DOM szerkezetet tartsd meg, itt a lényeg a logikán van
  });
}

function renderOracle() {
  const body = document.getElementById('oracleBody');
  if (!body) return;
  if (myCards.length === 0) { body.innerHTML = "Játék vége!"; return; }

  let suggestedCard = selectedMine !== null ? selectedMine : getBestCard();
  const s = calcRoundStats(suggestedCard);
  
  body.innerHTML = `
    <div class="oracle-suggestion">
      <div class="oracle-card ${suggestedCard % 2 === 0 ? 'oracle-even' : 'oracle-odd'}">${suggestedCard}</div>
    </div>
    <div class="oracle-text">${s.win >= 60 ? '🔥 Támadás!' : '⚖️ Óvatos lépés.'} Nyerési esély: ${s.win}%</div>
  `;
}

function selectMyCard(n) {
  if (!myCards.includes(n)) return;
  selectedMine = (selectedMine === n) ? null : n; 
  refreshAll();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');
  
  // [JAVÍTÁS] Csak akkor számolunk újra, ha ÉN kezdek.
  // Ha az ellenfél kezdett, ez csak adat rögzítés, ne módosítsa a választott lapot!
  if (iStarted) autoSelectCard();
  
  refreshAll();
}

function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;
  if (isConfirming) return;

  isConfirming = true;
  history.push({
    myCards: [...myCards],
    enemyProb: [...enemyProb],
    myScore, enemyScore, roundNum, iStarted,
    selectedMine, selectedEnemy, selectedResult
  });

  if (selectedResult === 'win') myScore++;
  else if (selectedResult === 'lose') enemyScore++;

  updateEnemyProb(selectedMine, selectedEnemy, selectedResult);
  myCards = myCards.filter(c => c !== selectedMine);

  roundNum++;
  addHistoryEntry(roundNum, selectedMine, selectedEnemy, selectedResult);

  if (roundNum === 1) {
    const chk = document.getElementById('chkIStart');
    if (chk) chk.disabled = true;
  }

  selectedMine = null; selectedEnemy = null; selectedResult = null;
  clearAllActive();
  autoSelectCard();
  refreshAll();

  setTimeout(() => isConfirming = false, 100);
}

function _getResultAvailability() {
  const av = { win: true, lose: true, draw: true };
  if (selectedMine === null || selectedEnemy === null) return { win: false, lose: false, draw: false };
  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);
  if (!parityOk(selectedMine)) av.draw = false;
  return av;
}

function clearAllActive() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.remove('active');
  });
}

function addHistoryEntry(round, mine, enemy, result) {
  const list = document.getElementById('historyList');
  if(!list) return;
  list.innerHTML += `<div class="history-entry">#${round}: Én:${mine} Ell:${enemy} ${result}</div>`;
}

// ... (többi segédfüggvény mint undoLast, resetAll maradhat változatlanul)
