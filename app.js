// =============================================
//  LÁTÓK PÁRBAJA — ORACLE HELPER
//  app.js  (v2.0 — "Multiverzum" Dedukciós Motor)
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let myCards = [...ALL_CARDS]; 
// ÚJ: Ahelyett, hogy 1 paklit tárolnánk, tároljuk az ÖSSZES lehetséges pakli-kombinációt
let possibleEnemyHands = [ [...ALL_CARDS] ]; 

let selectedMine   = null;   
let selectedEnemy  = null;   
let selectedResult = null;   
let iStarted       = false;  

let history  = [];
let roundNum = 0;

// =============================================
//  INIT
// =============================================
function init() {
  const chk = document.getElementById('chkIStart');
  if (chk) {
    chk.addEventListener('change', () => {
      iStarted = chk.checked;
      updateChips();
    });
  }
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  renderHistory();
}

// =============================================
//  ÚJ: SEGÉDFÜGGVÉNYEK A TÖBBES PAKLIHOZ
// =============================================
// Visszaadja az összes olyan lapot (egyedi listaként), ami BÁRMELYIK lehetséges pakliban benne van
function getPossibleEnemyCards() {
  if (possibleEnemyHands.length === 0) return [];
  return [...new Set(possibleEnemyHands.flat())].sort((a,b) => a - b);
}

// Kiszámolja, hogy az adott lap hány százalékban nyerne az aktuális lehetséges univerzumok ellen
function calcWinChance(myCard) {
  if (possibleEnemyHands.length === 0) return 0;
  let totalWins = 0;
  let totalCardsToFace = 0;

  possibleEnemyHands.forEach(hand => {
    totalWins += hand.filter(ec => ec < myCard).length;
    totalCardsToFace += hand.length;
  });

  return Math.round((totalWins / totalCardsToFace) * 100);
}

// =============================================
//  RENDER MY CARDS 
// =============================================
function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  container.innerHTML = '';

  const oddRow = document.createElement('div');
  oddRow.className = 'cards-sub-row';

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

    if (isEven) evenRow.appendChild(btn);
    else oddRow.appendChild(btn);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);
}

// =============================================
//  RENDER ENEMY CARDS 
// =============================================
function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  container.innerHTML = '';

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

  const currentPossibleCards = getPossibleEnemyCards();

  ALL_CARDS.forEach(n => {
    const isEven   = n % 2 === 0;
    const possible = currentPossibleCards.includes(n);

    const slot = document.createElement('div');
    slot.className = [
      'enemy-card-slot',
      isEven ? 'enemy-even' : 'enemy-odd',
      possible ? 'possible' : 'eliminated'
    ].join(' ');

    slot.textContent = n;

    if (isEven) evenRow.appendChild(slot);
    else oddRow.appendChild(slot);
  });

  container.appendChild(oddLabel);
  container.appendChild(oddRow);
  container.appendChild(evenLabel);
  container.appendChild(evenRow);

  // Mivel minden lehetséges pakli ugyanannyi lapból áll, elég az elsőt megnézni
  const cardsLeftInDeck = possibleEnemyHands.length > 0 ? possibleEnemyHands[0].length : 0;
  document.getElementById('enemyCount').textContent =
    `Pakli: ${cardsLeftInDeck} lap | Univerzumok: ${possibleEnemyHands.length}`;
}

// =============================================
//  ORACLE / HELPER LOGIC
// =============================================
function getBestCard() {
  if (myCards.length === 0) return null;
  let best = null;
  let bestScore = -1;

  myCards.forEach(c => {
    const pct = calcWinChance(c);
    const infoScore = 100 - Math.abs(pct - 50); // 50% körüli lapok adnak legtöbb infót
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
  
  // Veszítés és döntetlen kiszámítása az összes univerzumból
  let totalLose = 0, totalDraw = 0, totalCards = 0;
  possibleEnemyHands.forEach(hand => {
    totalLose += hand.filter(ec => ec > suggestedCard).length;
    totalDraw += hand.filter(ec => ec === suggestedCard).length;
    totalCards += hand.length;
  });
  const losePct = Math.round((totalLose / totalCards) * 100);
  const drawPct = Math.round((totalDraw / totalCards) * 100);

  const cardStats = myCards
    .map(c => ({ card: c, pct: calcWinChance(c) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);

  const reasonText = isFirstMove
    ? `Nyitólap a <strong>${suggestedCard}</strong>-es — ez a mediáns lap, amely információs szempontból a legtökéletesebben felezi meg az ellenfél halmazait.`
    : `A <strong>${suggestedCard}</strong>-es lap nyeri a legtöbb lehetséges ellenfél-lapot (${winPct}% eséllyel).`;

  const winColor = winPct >= 60 ? 'stat-val-green' : winPct >= 40 ? 'stat-val-gold' : 'stat-val-red';
  const currentPossibleCards = getPossibleEnemyCards();

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
        Kombinációk: ${possibleEnemyHands.length} db &nbsp;|&nbsp;
        Fent maradt gyanúsítottak: ${currentPossibleCards.join(', ')} &nbsp;|&nbsp;
        Saját kezem: ${myCards.join(', ')}
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

function updateConfirmBtn() {
  const canConfirm = selectedMine !== null && selectedEnemy !== null && selectedResult !== null;
  document.getElementById('btnConfirm').disabled = !canConfirm;
  const hint = document.getElementById('confirmHint');
  
  if (!selectedMine) hint.innerHTML = 'Kattints egy lapra a sajátjaim közül';
  else if (!selectedEnemy) hint.innerHTML = `Lap <strong style="color:var(--purple-light)">${selectedMine}</strong> kiválasztva — add meg az ellenfél paritását!`;
  else if (!selectedResult) hint.innerHTML = 'Add meg a kör eredményét';
  else hint.innerHTML = `<span style="color:var(--emerald-light)">✓ Kész a megerősítésre</span>`;
}

// =============================================
//  ÚJ DEDUCTION LOGIC — A Multiverzum Létrehozása
// =============================================
function deduceEnemyHands(myCard, enemyType, result) {
  let newHandsSet = new Set();
  const parityOk = enemyType === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);

  // Végigmegyünk minden eddig lehetséges univerzumon (paklin)
  for (let hand of possibleEnemyHands) {
    
    // Mik lehettek az ellenfél kijátszott lapjai ebben a konkrét pakliban?
    let candidates = hand.filter(c => parityOk(c));
    
    if (result === 'win') candidates = candidates.filter(c => c < myCard);
    else if (result === 'lose') candidates = candidates.filter(c => c > myCard);
    else if (result === 'draw') candidates = candidates.filter(c => c === myCard);

    // Minden egyes lehetséges kijátszott laphoz létrehozunk egy új jövőbeli univerzumot
    for (let c of candidates) {
      let newHand = hand.filter(card => card !== c);
      // Stringként mentjük a Set-be, hogy automatikusan kiszűrjük a duplikációkat
      newHandsSet.add(newHand.join(','));
    }
  }

  // Stringek visszaalakítása szám-tömbökké
  let newHands = [...newHandsSet].map(str => str === "" ? [] : str.split(',').map(Number));

  // Biztonsági háló: ha lehetetlent kattintott a felhasználó
  if (newHands.length === 0) {
    alert("Hiba: Ilyen eredmény nem lehetséges a jelenlegi lapok alapján! Kérlek ellenőrizd, mit kattintottál.");
    return possibleEnemyHands; // Nem rontjuk el az eddigi jó adatokat
  }

  return newHands;
}

// =============================================
//  CONFIRM ROUND
// =============================================
function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;

  // Deep copy az univerzumnak a visszavonáshoz
  history.push({
    myCards: [...myCards],
    possibleEnemyHands: possibleEnemyHands.map(h => [...h]),
    selectedMine,
    selectedEnemy,
    selectedResult,
    iStarted,
    roundNum
  });

  // Multiverzum frissítése
  possibleEnemyHands = deduceEnemyHands(selectedMine, selectedEnemy, selectedResult);
  
  // Saját lap eldobása
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
    const labels = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
    const cls = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[h.selectedResult];
    const enemyLabel = (h.selectedEnemy === 'even' ? 'Páros' : 'Páratlan') + (h.iStarted ? ' (Én kezdtem)' : '');
    addHistoryEntry(i + 1, h.selectedMine, enemyLabel, labels[h.selectedResult], cls);
  });
}

// =============================================
//  UNDO — Backspace
// =============================================
function undoLast() {
  if (history.length === 0) return;

  const snap = history.pop();
  myCards = snap.myCards;
  possibleEnemyHands = snap.possibleEnemyHands;
  roundNum = snap.roundNum;

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
  myCards = [...ALL_CARDS];
  possibleEnemyHands = [ [...ALL_CARDS] ];
  history = [];
  roundNum = 0;

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;

  const chk = document.getElementById('chkIStart');
  if (chk) chk.checked = false;
  iStarted = false;

  clearActionButtons();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  updateChips();
  renderHistory();
}

function clearActionButtons() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
}

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

init();
