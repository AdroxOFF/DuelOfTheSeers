// =============================================
//  LÁTÓK PÁRBAJA — ORACLE HELPER
//  app.js
// =============================================

// =============================================
//  STATE
// =============================================
const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let myCards    = [...ALL_CARDS]; // Cards still in my hand
let enemyCards = [...ALL_CARDS]; // Possible enemy cards

let selectedMine   = null; // My card I just picked
let selectedEnemy  = null; // 'even' | 'odd'
let selectedResult = null; // 'win' | 'lose' | 'draw'

let history  = []; // Snapshot array for undo
let roundNum = 0;

// =============================================
//  INIT
// =============================================
function init() {
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  renderHistory();
}

// =============================================
//  RENDER MY CARDS
// =============================================
function renderMyCards() {
  const row = document.getElementById('myCardsRow');
  row.innerHTML = '';

  ALL_CARDS.forEach(n => {
    const isEven    = n % 2 === 0;
    const inHand    = myCards.includes(n);
    const isSelected = n === selectedMine;

    const btn = document.createElement('button');
    btn.className = [
      'card-btn',
      isEven ? 'even' : 'odd',
      !inHand    ? 'used' : '',
      isSelected ? 'selected-mine' : ''
    ].join(' ').trim();

    btn.setAttribute('data-num', n);
    btn.disabled = !inHand;

    // Card number span
    const numSpan = document.createElement('span');
    numSpan.className = 'card-num';
    numSpan.textContent = n;
    btn.appendChild(numSpan);

    // Win-chance badge
    const badge = document.createElement('div');
    badge.className = 'badge';
    const pct = calcWinChance(n);

    if (inHand) {
      badge.textContent = pct !== null ? pct + '%' : '?';
      if (pct === 100)   badge.classList.add('chance-100');
      else if (pct >= 60) badge.classList.add('chance-high');
    } else {
      badge.textContent  = '—';
      badge.style.opacity = '0.3';
    }
    btn.appendChild(badge);

    if (inHand) {
      btn.onclick = () => selectMyCard(n);
    }

    row.appendChild(btn);
  });
}

// =============================================
//  RENDER ENEMY CARDS
// =============================================
function renderEnemyCards() {
  const row = document.getElementById('enemyCardsRow');
  row.innerHTML = '';

  ALL_CARDS.forEach(n => {
    const isEven   = n % 2 === 0;
    const possible = enemyCards.includes(n);

    const slot = document.createElement('div');
    slot.className = [
      'enemy-card-slot',
      isEven ? 'enemy-even' : 'enemy-odd',
      possible ? 'possible' : 'eliminated'
    ].join(' ');

    slot.textContent = n;
    row.appendChild(slot);
  });

  document.getElementById('enemyCount').textContent =
    `Lehetséges: ${enemyCards.length} / ${ALL_CARDS.length}`;
}

// =============================================
//  WIN CHANCE CALCULATION
//  Formula: (enemy cards smaller than myCard) / total possible enemy cards * 100
// =============================================
function calcWinChance(myCard) {
  if (enemyCards.length === 0) return 0;
  const beating = enemyCards.filter(ec => ec < myCard).length;
  return Math.round((beating / enemyCards.length) * 100);
}

// =============================================
//  ORACLE / HELPER LOGIC
// =============================================
function getBestCard() {
  if (myCards.length === 0) return null;

  let best      = null;
  let bestScore = -1;

  myCards.forEach(c => {
    const pct = calcWinChance(c);
    // Secondary tiebreak: card closest to 50% is most informative (binary search logic)
    const infoScore = 100 - Math.abs(pct - 50);
    const score = pct * 10 + infoScore; // Win% weighted more heavily
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  });

  return best;
}

function renderOracle() {
  const body = document.getElementById('oracleBody');

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">Nincs több lap a kezedben.</div></div>`;
    return;
  }

  const isFirstMove = roundNum === 0 && selectedMine === null;

  // First move: always suggest 4 or 5 (median binary search)
  let suggestedCard;
  if (isFirstMove) {
    suggestedCard = myCards.includes(4) ? 4 : (myCards.includes(5) ? 5 : getBestCard());
  } else {
    suggestedCard = getBestCard();
  }

  if (suggestedCard === null) { body.innerHTML = ''; return; }

  const isEven    = suggestedCard % 2 === 0;
  const winPct    = calcWinChance(suggestedCard);
  const losePct   = Math.round((enemyCards.filter(ec => ec > suggestedCard).length / enemyCards.length) * 100);
  const drawPct   = Math.round((enemyCards.filter(ec => ec === suggestedCard).length / enemyCards.length) * 100);

  // Top 4 cards by win chance for the stats sidebar
  const cardStats = myCards
    .map(c => ({ card: c, pct: calcWinChance(c) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  const reasonText = isFirstMove
    ? `Nyitólap a <strong>${suggestedCard}</strong>-es — ez a mediáns lap, amely a legjobban szeli ketté az ellenfél lehetséges lapjait.`
    : `A <strong>${suggestedCard}</strong>-es lap nyeri a legtöbb lehetséges ellenfél-lapot (${winPct}% eséllyel). ${winPct === 100 ? '⚡ Garantált győzelem!' : ''}`;

  const winColor = winPct >= 60 ? 'stat-val-green' : winPct >= 40 ? 'stat-val-gold' : 'stat-val-red';

  body.innerHTML = `
    <div class="oracle-suggestion">
      <div>
        <div class="oracle-label" style="margin-bottom:6px;">Javasolt lap</div>
        <div class="oracle-card ${isEven ? 'oracle-even' : 'oracle-odd'}"
             style="${!isEven ? 'color:#1a1400;' : ''}">${suggestedCard}</div>
      </div>
    </div>
    <div class="oracle-text">
      <div class="oracle-main-text">${reasonText}</div>
      <div class="oracle-sub-text">
        Ellenfél lapjai: ${enemyCards.join(', ')} (${enemyCards.length} db) &nbsp;|&nbsp;
        Saját kezem: ${myCards.join(', ')} (${myCards.length} db)
      </div>
    </div>
    <div class="oracle-stats">
      <div class="oracle-stat-row">
        <span class="stat-label">Nyerési esély</span>
        <span class="${winColor}">${winPct}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Veszítési esély</span>
        <span class="stat-val-red">${losePct}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">Döntetlen esély</span>
        <span class="stat-val-purple">${drawPct}%</span>
      </div>
      <div style="height:1px; background:var(--border); margin:6px 0;"></div>
      ${cardStats.map(s => `
        <div class="oracle-stat-row">
          <span class="stat-label">Lap ${s.card}</span>
          <span class="${s.pct === 100 ? 'stat-val-red' : s.pct >= 50 ? 'stat-val-green' : 'stat-val-gold'}">${s.pct}%</span>
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
  updateChips();
  updateConfirmBtn();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active', selectedEnemy === 'odd');
  updateChips();
  updateConfirmBtn();
}

function selectResult(res) {
  selectedResult = (selectedResult === res) ? null : res;
  document.getElementById('btnWin').classList.toggle('active',  selectedResult === 'win');
  document.getElementById('btnLose').classList.toggle('active', selectedResult === 'lose');
  document.getElementById('btnDraw').classList.toggle('active', selectedResult === 'draw');
  updateChips();
  updateConfirmBtn();
}

// =============================================
//  STATUS CHIPS
// =============================================
function updateChips() {
  const cm = document.getElementById('chip-mine');
  const ce = document.getElementById('chip-enemy');
  const cr = document.getElementById('chip-result');

  if (selectedMine !== null) {
    cm.textContent = `Lapom: ${selectedMine}`;
    cm.className   = 'status-chip chip-mine';
  } else {
    cm.textContent = 'Lapom: —';
    cm.className   = 'status-chip chip-none';
  }

  if (selectedEnemy) {
    ce.textContent = selectedEnemy === 'even' ? 'Ellenfél: Páros' : 'Ellenfél: Páratlan';
    ce.className   = 'status-chip chip-enemy';
  } else {
    ce.textContent = 'Ellenfél: —';
    ce.className   = 'status-chip chip-none';
  }

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

// =============================================
//  CONFIRM BUTTON STATE
// =============================================
function updateConfirmBtn() {
  const canConfirm = selectedMine !== null && selectedEnemy !== null && selectedResult !== null;
  document.getElementById('btnConfirm').disabled = !canConfirm;

  const hint = document.getElementById('confirmHint');
  if (!selectedMine) {
    hint.innerHTML = 'Kattints egy lapra a sajátjaim közül';
  } else if (!selectedEnemy) {
    hint.innerHTML = `Lap <strong style="color:var(--purple-light)">${selectedMine}</strong> kiválasztva — adj meg ellenfél lépést`;
  } else if (!selectedResult) {
    hint.innerHTML = 'Adj meg kör eredményt';
  } else {
    hint.innerHTML = `<span style="color:var(--emerald-light)">✓ Kész a megerősítésre</span>`;
  }
}

// =============================================
//  DEDUCTION LOGIC — core brain
//
//  After each round we know:
//    - My card (selectedMine)
//    - Enemy card colour (even/odd)
//    - Round result (win/lose/draw)
//
//  We narrow enemyCards using strict exclusion:
//    WIN  → enemy card is same-parity AND < myCard
//    LOSE → enemy card is same-parity AND > myCard
//    DRAW → enemy card is same-parity AND = myCard
// =============================================
function deduceEnemyCards(myCard, enemyType, result) {
  let newEnemy = [...enemyCards];

  const parityFilter = enemyType === 'even'
    ? (c => c % 2 === 0)
    : (c => c % 2 !== 0);

  if (result === 'win') {
    newEnemy = newEnemy.filter(c => parityFilter(c) && c < myCard);

  } else if (result === 'lose') {
    newEnemy = newEnemy.filter(c => parityFilter(c) && c > myCard);

  } else if (result === 'draw') {
    newEnemy = newEnemy.filter(c => parityFilter(c) && c === myCard);
    // Fallback: if draw is impossible (parity mismatch), keep the parity side
    if (newEnemy.length === 0) {
      newEnemy = enemyCards.filter(parityFilter);
    }
  }

  // Safety fallback — should not happen with valid game input
  if (newEnemy.length === 0) {
    newEnemy = enemyCards.filter(parityFilter);
  }

  return newEnemy;
}

// =============================================
//  CONFIRM ROUND
// =============================================
function confirmRound() {
  if (selectedMine === null || !selectedEnemy || !selectedResult) return;

  // Save full state snapshot for undo
  history.push({
    myCards:       [...myCards],
    enemyCards:    [...enemyCards],
    selectedMine,
    selectedEnemy,
    selectedResult,
    roundNum
  });

  // Run deduction
  enemyCards = deduceEnemyCards(selectedMine, selectedEnemy, selectedResult);

  // Remove played card from hand
  myCards = myCards.filter(c => c !== selectedMine);

  // Add entry to history log
  const labels      = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
  const enemyLabel  = selectedEnemy === 'even' ? 'Páros' : 'Páratlan';
  const resultClass = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[selectedResult];

  roundNum++;
  addHistoryEntry(roundNum, selectedMine, enemyLabel, labels[selectedResult], resultClass);

  // Reset round selections
  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;

  clearActionButtons();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  updateChips();
}

// =============================================
//  HISTORY LOG
// =============================================
function addHistoryEntry(round, mine, enemy, result, cls) {
  const list  = document.getElementById('historyList');
  const empty = list.querySelector('.history-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'history-entry';
  entry.innerHTML = `
    <span class="h-round">#${round}</span>
    <span class="h-mine">Én: ${mine}</span>
    <span class="h-enemy">Ell: ${enemy}</span>
    <span class="${cls}">${result}</span>
  `;
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
    const enemyLabel = h.selectedEnemy === 'even' ? 'Páros' : 'Páratlan';
    addHistoryEntry(i + 1, h.selectedMine, enemyLabel, labels[h.selectedResult], cls);
  });
}

// =============================================
//  UNDO — Backspace
// =============================================
function undoLast() {
  if (history.length === 0) return;

  const snap  = history.pop();
  myCards     = snap.myCards;
  enemyCards  = snap.enemyCards;
  roundNum    = snap.roundNum;

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;

  clearActionButtons();
  renderHistory();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  updateChips();
}

// =============================================
//  FULL RESET — ESC
// =============================================
function resetAll() {
  myCards    = [...ALL_CARDS];
  enemyCards = [...ALL_CARDS];
  history    = [];
  roundNum   = 0;

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;

  clearActionButtons();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  updateChips();
  renderHistory();
}

// =============================================
//  HELPERS
// =============================================
function clearActionButtons() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
}

// =============================================
//  KEYBOARD SHORTCUTS
// =============================================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    resetAll();
  } else if (e.key === 'Backspace') {
    if (document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      undoLast();
    }
  }
});

// =============================================
//  START
// =============================================
init();
