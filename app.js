// =============================================
//  LÁTÓK PÁRBAJA — ORACLE HELPER
//  app.js  (v1.1 — kétsoroslapok + én-kezdem logika)
// =============================================

// =============================================
//  STATE
// =============================================
const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Páros (fekete): 0, 2, 4, 6, 8  →  alsó sor
// Páratlan (fehér): 1, 3, 5, 7   →  felső sor
const ODD_CARDS  = [1, 3, 5, 7];
const EVEN_CARDS = [0, 2, 4, 6, 8];

let myCards    = [...ALL_CARDS]; // Kézben lévő lapok
let enemyCards = [...ALL_CARDS]; // Ellenfél lehetséges lapjai

let selectedMine   = null;   // Saját kijátszott lap
let selectedEnemy  = null;   // 'even' | 'odd' | null
let selectedResult = null;   // 'win' | 'lose' | 'draw'
let iStarted       = false;  // Igaz, ha én kezdem a kört

let history  = [];
let roundNum = 0;

// =============================================
//  INIT
// =============================================
function init() {
  // Checkbox eseménykezelő
  const chk = document.getElementById('chkIStart');
  if (chk) {
    chk.addEventListener('change', () => {
      iStarted = chk.checked;
      updateEnemyTypeButtons();
      updateConfirmBtn();
    });
  }

  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  renderHistory();
}

// =============================================
//  RENDER MY CARDS — kétsorosrács (páratlan fent, páros lent)
// =============================================
function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  container.innerHTML = '';

  // Felső sor — páratlan (fehér) lapok
  const oddRow = document.createElement('div');
  oddRow.className = 'cards-sub-row';

  // Alsó sor — páros (fekete) lapok
  const evenRow = document.createElement('div');
  evenRow.className = 'cards-sub-row';

  ALL_CARDS.forEach(n => {
    const isEven     = n % 2 === 0;
    const inHand     = myCards.includes(n);
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

    const numSpan = document.createElement('span');
    numSpan.className = 'card-num';
    numSpan.textContent = n;
    btn.appendChild(numSpan);

    // Nyerési esély jelvény
    const badge = document.createElement('div');
    badge.className = 'badge';
    const pct = calcWinChance(n);

    if (inHand) {
      badge.textContent = pct !== null ? pct + '%' : '?';
      if (pct === 100)    badge.classList.add('chance-100');
      else if (pct >= 60) badge.classList.add('chance-high');
    } else {
      badge.textContent   = '—';
      badge.style.opacity = '0.3';
    }
    btn.appendChild(badge);

    if (inHand) {
      btn.onclick = () => selectMyCard(n);
    }

    if (isEven) {
      evenRow.appendChild(btn);
    } else {
      oddRow.appendChild(btn);
    }
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);
}

// =============================================
//  RENDER ENEMY CARDS — kétsorosrács (páratlan fent, páros lent)
// =============================================
function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  container.innerHTML = '';

  // Sor-feliratok
  const oddLabel  = document.createElement('div');
  oddLabel.className = 'cards-row-label';
  oddLabel.textContent = '⬜ Páratlan';

  const evenLabel = document.createElement('div');
  evenLabel.className = 'cards-row-label';
  evenLabel.textContent = '⬛ Páros';

  const oddRow  = document.createElement('div');
  oddRow.className = 'cards-sub-row';

  const evenRow = document.createElement('div');
  evenRow.className = 'cards-sub-row';

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

    if (isEven) {
      evenRow.appendChild(slot);
    } else {
      oddRow.appendChild(slot);
    }
  });

  container.appendChild(oddLabel);
  container.appendChild(oddRow);
  container.appendChild(evenLabel);
  container.appendChild(evenRow);

  document.getElementById('enemyCount').textContent =
    `Lehetséges: ${enemyCards.length} / ${ALL_CARDS.length}`;
}

// =============================================
//  WIN CHANCE CALCULATION
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
    const infoScore = 100 - Math.abs(pct - 50);
    const score = pct * 10 + infoScore;
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

  let suggestedCard;
  if (isFirstMove) {
    suggestedCard = myCards.includes(4) ? 4 : (myCards.includes(5) ? 5 : getBestCard());
  } else {
    suggestedCard = getBestCard();
  }

  if (suggestedCard === null) { body.innerHTML = ''; return; }

  const isEven  = suggestedCard % 2 === 0;
  const winPct  = calcWinChance(suggestedCard);
  const losePct = Math.round((enemyCards.filter(ec => ec > suggestedCard).length / enemyCards.length) * 100);
  const drawPct = Math.round((enemyCards.filter(ec => ec === suggestedCard).length / enemyCards.length) * 100);

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
  if (iStarted) return; // Ha én kezdem, a gomb inaktív — ne csináljon semmit
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');
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
//  "ÉN KEZDEM" ÁLLAPOT — gombok inaktivitásának frissítése
// =============================================
function updateEnemyTypeButtons() {
  const btnEven = document.getElementById('btnEven');
  const btnOdd  = document.getElementById('btnOdd');

  if (iStarted) {
    // Letiltjuk és alaphelyzetbe hozzuk a paritásgombokat
    btnEven.disabled = true;
    btnOdd.disabled  = true;
    btnEven.classList.remove('active');
    btnOdd.classList.remove('active');
    selectedEnemy = null;
    // Chip frissítés
    const ce = document.getElementById('chip-enemy');
    ce.textContent = 'Ellenfél: ?';
    ce.className   = 'status-chip chip-none';
  } else {
    btnEven.disabled = false;
    btnOdd.disabled  = false;
  }
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

  if (iStarted) {
    ce.textContent = 'Ellenfél: (én kezdtem)';
    ce.className   = 'status-chip chip-none';
  } else if (selectedEnemy) {
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
  // Ha én kezdtem: nem kell ellenfél-paritás
  const enemyOk  = iStarted ? true : selectedEnemy !== null;
  const canConfirm = selectedMine !== null && enemyOk && selectedResult !== null;
  document.getElementById('btnConfirm').disabled = !canConfirm;

  const hint = document.getElementById('confirmHint');
  if (!selectedMine) {
    hint.innerHTML = 'Kattints egy lapra a sajátjaim közül';
  } else if (!iStarted && !selectedEnemy) {
    hint.innerHTML = `Lap <strong style="color:var(--purple-light)">${selectedMine}</strong> kiválasztva — add meg az ellenfél paritását`;
  } else if (!selectedResult) {
    hint.innerHTML = 'Add meg a kör eredményét';
  } else {
    hint.innerHTML = `<span style="color:var(--emerald-light)">✓ Kész a megerősítésre</span>`;
  }
}

// =============================================
//  DEDUCTION LOGIC — javított logika
//
//  Ha ÉN KEZDTEM (iStarted = true):
//    Csak az eredmény alapján szűrünk, paritás figyelmen kívül
//    WIN  → ellenfél lapja < saját lapom
//    LOSE → ellenfél lapja > saját lapom
//    DRAW → ellenfél lapja = saját lapom
//
//  Ha AZ ELLENFÉL KEZDETT (iStarted = false):
//    Paritás ÉS eredmény alapján szűrünk
//    WIN  → páros/páratlan ÉS < saját lapom
//    LOSE → páros/páratlan ÉS > saját lapom
//    DRAW → páros/páratlan ÉS = saját lapom
// =============================================
function deduceEnemyCards(myCard, enemyType, result) {
  let newEnemy = [...enemyCards];

  if (iStarted) {
    // --- Én kezdtem: csak értékszűrés, paritás ismeretlen ---
    if (result === 'win') {
      newEnemy = newEnemy.filter(c => c < myCard);
    } else if (result === 'lose') {
      newEnemy = newEnemy.filter(c => c > myCard);
    } else if (result === 'draw') {
      newEnemy = newEnemy.filter(c => c === myCard);
      // Biztonsági fallback: ha a draw lehetetlen (pl. a lap már ki lett játszva)
      if (newEnemy.length === 0) newEnemy = [...enemyCards];
    }
  } else {
    // --- Ellenfél kezdett: paritás + értékszűrés ---
    const parityFilter = enemyType === 'even'
      ? (c => c % 2 === 0)
      : (c => c % 2 !== 0);

    if (result === 'win') {
      newEnemy = newEnemy.filter(c => parityFilter(c) && c < myCard);
    } else if (result === 'lose') {
      newEnemy = newEnemy.filter(c => parityFilter(c) && c > myCard);
    } else if (result === 'draw') {
      newEnemy = newEnemy.filter(c => parityFilter(c) && c === myCard);
      if (newEnemy.length === 0) {
        newEnemy = enemyCards.filter(parityFilter);
      }
    }
  }

  // Biztonsági fallback — érvénytelen bemenetnél ne nullázódjon ki teljesen
  if (newEnemy.length === 0) {
    newEnemy = [...enemyCards];
  }

  return newEnemy;
}

// =============================================
//  CONFIRM ROUND
// =============================================
function confirmRound() {
  const enemyOk = iStarted ? true : selectedEnemy !== null;
  if (selectedMine === null || !enemyOk || !selectedResult) return;

  // Pillanatkép mentése visszavonáshoz
  history.push({
    myCards:       [...myCards],
    enemyCards:    [...enemyCards],
    selectedMine,
    selectedEnemy,
    selectedResult,
    iStarted,
    roundNum
  });

  // Dedukció futtatása
  enemyCards = deduceEnemyCards(selectedMine, selectedEnemy, selectedResult);

  // Kijátszott lap eltávolítása a kézből
  myCards = myCards.filter(c => c !== selectedMine);

  // Napló bejegyzés
  const labels     = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
  const enemyLabel = iStarted
    ? '(én kezdtem)'
    : (selectedEnemy === 'even' ? 'Páros' : 'Páratlan');
  const resultClass = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[selectedResult];

  roundNum++;
  addHistoryEntry(roundNum, selectedMine, enemyLabel, labels[selectedResult], resultClass);

  // Kör-szelekciók törlése
  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;
  // iStarted-t NEM töröljük — a checkbox állapota marad

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
    const enemyLabel = h.iStarted
      ? '(én kezdtem)'
      : (h.selectedEnemy === 'even' ? 'Páros' : 'Páratlan');
    addHistoryEntry(i + 1, h.selectedMine, enemyLabel, labels[h.selectedResult], cls);
  });
}

// =============================================
//  UNDO — Backspace
// =============================================
function undoLast() {
  if (history.length === 0) return;

  const snap = history.pop();
  myCards    = snap.myCards;
  enemyCards = snap.enemyCards;
  roundNum   = snap.roundNum;

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;
  // iStarted-t a checkbox aktuális állapota határozza meg — nem állítjuk vissza

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

  // Checkbox reset
  const chk = document.getElementById('chkIStart');
  if (chk) chk.checked = false;
  iStarted = false;
  updateEnemyTypeButtons();

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
  // Paritásgombok engedélyezési állapota is frissüljön
  updateEnemyTypeButtons();
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
