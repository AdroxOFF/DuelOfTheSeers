// =============================================
//  LÁTÓK PÁRBAJA — AUTOMATA PONTMAXIMALIZÁLÓ
//  app.js (v4.4 - Kéz-előfordulás Alapú Súlyozás)
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
  if (iStarted || selectedEnemy !== null) {
      selectedMine = getBestCard();
  } else {
      selectedMine = null;
  }
}

// =============================================
//  KÉZELŐFORDULÁS-ALAPÚ VALÓSZÍNŰSÉG MOTOR (v4.4)
//
//  Alapelv: egy ellenfél-lap annál valószínűbb,
//  ahány különböző lehetséges kézben szerepel.
//
//  Ez torzítatlan (nem feltételez semmit a botról),
//  és a dedukciós rendszer közvetlen folytatása:
//  ha egy lap minden megmaradt kézben benne van
//  → biztosan az ellenféleél van → 100% súly.
//  Ha csak néhány kézben szerepel → kisebb esély.
//
//  A paraméter-bug javítva: calcRoundStats(myCard)
//  saját myCard-ját adja át, nem a globális selectedMine-t.
//  A calcEnemyCardChance() paritás-szűréssel, de
//  súlyozáshoz nincs szüksége külső referenciára.
// =============================================

// Összeszámolja, hány lehetséges kézben szerepel
// minden ellenfél-lap (opcionális paritásszűréssel).
// Visszaad: { cardWeights, totalWeight }
// ahol cardWeights[lap] = előfordulások száma a kezekben.
function getEnemyCardOccurrences(parityFilter) {
  const parityOk = parityFilter
    ? (parityFilter === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0))
    : (c => true);

  let cardWeights = {};
  let totalWeight = 0;

  possibleEnemyHands.forEach(hand => {
    const candidates = hand.filter(parityOk);
    candidates.forEach(c => {
      cardWeights[c] = (cardWeights[c] || 0) + 1;
      totalWeight += 1;
    });
  });

  return { cardWeights, totalWeight };
}

// Az aktív paritásszűrőt adja vissza (vagy null-t ha nem szűrünk).
// Csak akkor szűrünk, ha a GÉP kezdett ÉS már bejelöltük a színét.
function getActiveParity() {
  return (!iStarted && selectedEnemy !== null) ? selectedEnemy : null;
}

// Win/lose/draw valószínűségek egy adott saját lapra.
// A saját lap (myCard) a referencia — ez dönti el ki nyer,
// de a súlyok kizárólag az ellenfél kézelőfordulásaiból jönnek.
function calcRoundStats(myCard) {
  const { cardWeights, totalWeight } = getEnemyCardOccurrences(getActiveParity());
  if (totalWeight === 0) return { win: 0, lose: 0, draw: 0 };

  let w = 0, l = 0, d = 0;
  for (let c in cardWeights) {
    c = parseInt(c);
    const weight = cardWeights[c];
    if      (myCard > c) w += weight;
    else if (myCard < c) l += weight;
    else                 d += weight;
  }
  return {
    win:  Math.round((w / totalWeight) * 100),
    lose: Math.round((l / totalWeight) * 100),
    draw: Math.round((d / totalWeight) * 100)
  };
}

// Az ellenfél egy adott lapjának valószínűsége (UI megjelenítéshez).
// Paritásszűréssel, de referenceCard nélkül — itt nem kell saját lap.
function calcEnemyCardChance(card) {
  const { cardWeights, totalWeight } = getEnemyCardOccurrences(getActiveParity());
  if (totalWeight === 0) return 0;
  return Math.round(((cardWeights[card] || 0) / totalWeight) * 100);
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
//  ORACLE AI v4.4 — VÁRHATÓ ÉRTÉK (EV) KERESŐ
//
//  Nem heurisztika, hanem 2 kör mélységű keresés.
//
//  Végső pontképlet (amit maximalizálunk):
//    Ha győzök:  myScore + (myScore - enemyScore)
//    Ha vesztek: myScore
//    Ha döntetlen: myScore  (nincs győztes bónusz)
//
//  Minden lehetséges saját lapra kiszámítja a
//  várható végső pontszámot a P(hand) eloszlás alapján,
//  2 kör mélységben, majd a legmagasabb EV-s lapot javasolja.
// =============================================

// A végső pontszámot számolja ki az állás alapján.
// roundsLeft: még hátralévő körök száma.
// Ha 0 kör van hátra, ez a tényleges végeredmény.
function finalScore(sc, ec) {
  if (sc > ec) return sc + (sc - ec); // győzelem + bónusz
  return sc;                           // vereség vagy döntetlen: csak saját pont
}

// Egy kör összes lehetséges kimenetelére súlyozott EV.
// myCard:          az én kijátszott lapom
// enemyHands:      lehetséges ellenfél-kezek (possibleEnemyHands pillanatképe)
// sc, ec:          jelenlegi pontok
// myRem:           megmaradt saját lapok (myCard nélkül)
// depth:           még hány kört nézünk előre (0 = csak ezt a kört)
// parityFilter:    'even'/'odd'/null — az ellenfél színe (ha ismert)
function evOneRound(myCard, enemyHands, sc, ec, myRem, depth, parityFilter) {
  const parityOk = parityFilter === 'even' ? (c => c % 2 === 0)
                 : parityFilter === 'odd'  ? (c => c % 2 !== 0)
                 : (c => true);

  // 1. Egyedi lapok kigyűjtése súlyokkal (max 9 egyedi lap, nem kézenként iterálunk)
  let cardWeights = {};
  let totalWeight = 0;

  enemyHands.forEach(hand => {
    hand.filter(parityOk).forEach(c => {
      cardWeights[c] = (cardWeights[c] || 0) + 1;
      totalWeight += 1;
    });
  });

  if (totalWeight === 0) return finalScore(sc, ec);

  let weightedEV = 0;

  // 2. Csak az egyedi lapokon iterálunk — a rekurzió max 9-szer fut, nem százszor
  for (let cStr in cardWeights) {
    const enemyCard = parseInt(cStr);
    const weight = cardWeights[enemyCard];

    let newSc = sc, newEc = ec;
    if      (myCard > enemyCard) newSc++;
    else if (myCard < enemyCard) newEc++;
    // draw: pont nem változik

    const newEnemyHands = enemyHands
      .filter(h => h.includes(enemyCard))
      .map(h => h.filter(c => c !== enemyCard));

    let ev;
    if (depth <= 0 || myRem.length === 0 || newEnemyHands.length === 0) {
      ev = finalScore(newSc, newEc);
    } else {
      const rec = bestEV(myRem, newEnemyHands, newSc, newEc, depth - 1, null);
      ev = rec.bestEv;
    }

    // Az EV-t egyszer számítjuk, de a súlyával szorozzuk be
    weightedEV += weight * ev;
  }

  return weightedEV / totalWeight;
}

// A megmaradt saját lapok közül kiválasztja a legjobb EV-t adó lapot.
// Visszaad: { bestCard, bestEv, allEvs: [{card, ev}, ...] }
function bestEV(myRemaining, enemyHands, sc, ec, depth, parityFilter) {
  let best = null;
  let bestEvVal = -Infinity;
  let allEvs = [];

  myRemaining.forEach(myCard => {
    const myRem = myRemaining.filter(c => c !== myCard);
    const ev = evOneRound(myCard, enemyHands, sc, ec, myRem, depth, parityFilter);
    allEvs.push({ card: myCard, ev });
    if (ev > bestEvVal) {
      bestEvVal = ev;
      best = myCard;
    }
  });

  // Ha csak EV értéket kérünk (rekurzív hívásból), skalárként adjuk vissza
  return { bestCard: best, bestEv: bestEvVal, allEvs };
}

// Nyilvános belépési pont — a globális állapotból dolgozik.
// Visszaad: { bestCard, bestEv, allEvs, currentRoundStats }
function getBestCardEV() {
  if (myCards.length === 0) return null;

  const parity = getActiveParity();
  const result = bestEV(myCards, possibleEnemyHands, myScore, enemyScore, 1, parity);

  // Az aktuális kör win/lose/draw %-ait is mellékeljük (UI-hoz)
  result.currentRoundStats = {};
  myCards.forEach(c => {
    result.currentRoundStats[c] = calcRoundStats(c);
  });

  return result;
}

// Megtartjuk kompatibilitás miatt (autoSelectOracleCard hívja)
function getBestCard() {
  const r = getBestCardEV();
  return r ? r.bestCard : null;
}

// Stratégiai címke az EV és a körstatisztika alapján
function getStrategyLabel(card, ev, roundStat, baseEv) {
  const s = roundStat;
  const evGain = ev - baseEv; // mennyivel jobb a legjobb alternatívánál

  if (s.win >= 70)
    return `🔥 <strong>BIZTOS PONT:</strong> A <strong>${card}</strong>-es lappal <strong>${s.win}%</strong> eséllyel nyered a kört, és ez adja a legjobb várható végpontot (EV: <strong>${ev.toFixed(2)}</strong>).`;
  if (s.win >= 45)
    return `⚖️ <strong>LEGJOBB KOMPROMISSZUM:</strong> A <strong>${card}</strong>-es lap nyerési esélye <strong>${s.win}%</strong>, és a 2 körös előretekintés szerint ez maximalizálja a várható végső pontot (EV: <strong>${ev.toFixed(2)}</strong>).`;
  if (s.draw >= 50)
    return `🛡️ <strong>DÖNTETLEN MENTÉS:</strong> Nyerni nehéz, de a <strong>${card}</strong>-es lappal <strong>${s.draw}%</strong> eséllyel kimentünk egy döntetlent. Az EV-keresés szerint ez a legjobb hosszú távú döntés (EV: <strong>${ev.toFixed(2)}</strong>).`;
  return `💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Nincs jó lapod ebben a körben. A <strong>${card}</strong>-es a legkisebb veszteség — az EV-keresés szerint ez áldozza el a legkevesebb pontot hosszú távon (EV: <strong>${ev.toFixed(2)}</strong>).`;
}

function renderOracle() {
  const body = document.getElementById('oracleBody');

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">Játék vége!</div></div>`;
    return;
  }

  const result = getBestCardEV();
  if (!result || result.bestCard === null) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text" style="color:var(--text-dim);">Várom, hogy az ellenfél lapot tegyen...</div></div>`;
    return;
  }

  const { bestCard, bestEv, allEvs, currentRoundStats } = result;
  const isEven = bestCard % 2 === 0;
  const s = currentRoundStats[bestCard];

  // A második legjobb EV (összehasonlításhoz)
  const sortedEvs = [...allEvs].sort((a, b) => b.ev - a.ev);
  const secondBestEv = sortedEvs.length > 1 ? sortedEvs[1].ev : bestEv;

  const strategyDesc = getStrategyLabel(bestCard, bestEv, s, secondBestEv);
  const winColor = s.win >= 60 ? 'stat-val-green' : s.win >= 40 ? 'stat-val-gold' : 'stat-val-red';

  // Top 4 lap EV szerint rendezve
  const topCards = sortedEvs.slice(0, 4);

  body.innerHTML = `
    <div class="oracle-suggestion">
      <div>
        <div class="oracle-card ${isEven ? 'oracle-even' : 'oracle-odd'}" style="${!isEven ? 'color:#1a1400;' : ''}">${bestCard}</div>
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
      <div class="oracle-stat-row" style="opacity:0.5; font-size:10px;">
        <span class="stat-label">— Lap EV (várható végpont) —</span>
      </div>
      ${topCards.map(({ card, ev }) => {
        const isBest = card === bestCard;
        const cls = isBest ? 'stat-val-green' : ev >= bestEv - 0.3 ? 'stat-val-gold' : 'stat-val-red';
        return `
        <div class="oracle-stat-row">
          <span class="stat-label">${isBest ? '★ ' : ''}Lap ${card}</span>
          <span class="${cls}">${ev.toFixed(2)}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

// =============================================
//  SELECTION HANDLERS & OKOS HIBAKEZELÉS
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
  
  autoSelectOracleCard();
  
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

// =============================================
//  OKOS HIBAKEZELÉS (PREDIKTÍV GOMB TILTÁS)
//  Ez a rész változatlan marad — kemény dedukció alapján működik.
// =============================================
function checkPossibleResults() {
  const btnWin = document.getElementById('btnWin');
  const btnLose = document.getElementById('btnLose');
  const btnDraw = document.getElementById('btnDraw');

  btnWin.disabled = false;
  btnLose.disabled = false;
  btnDraw.disabled = false;

  if (selectedMine === null || selectedEnemy === null) return;

  const parityOk = selectedEnemy === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);
  let canWin = false, canLose = false, canDraw = false;

  for (let hand of possibleEnemyHands) {
    let candidates = hand.filter(parityOk);
    if (candidates.some(c => c < selectedMine)) canWin = true;
    if (candidates.some(c => c > selectedMine)) canLose = true;
    if (candidates.some(c => c === selectedMine)) canDraw = true;
  }

  if (!canWin) btnWin.disabled = true;
  if (!canLose) btnLose.disabled = true;
  if (!canDraw) btnDraw.disabled = true;

  if ((!canWin && selectedResult === 'win') || 
      (!canLose && selectedResult === 'lose') || 
      (!canDraw && selectedResult === 'draw')) {
      
      selectedResult = null;
      btnWin.classList.remove('active');
      btnLose.classList.remove('active');
      btnDraw.classList.remove('active');
      updateChips();
  }
}

function updateConfirmBtn() {
  checkPossibleResults();
  const canConfirm = selectedMine !== null && selectedEnemy !== null && selectedResult !== null;
  document.getElementById('btnConfirm').disabled = !canConfirm;
}

// =============================================
//  DEDUCTION LOGIC — VÁLTOZATLAN
//  (Kemény kizárás, súlyozástól független)
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

  return [...newHandsSet].map(str => str === "" ? [] : str.split(',').map(Number));
}

// =============================================
//  CONFIRM ROUND — VÁLTOZATLAN
// =============================================
function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;

  let nextEnemyHands = deduceEnemyHands(selectedMine, selectedEnemy, selectedResult);

  if (nextEnemyHands.length === 0) {
    alert("⚠️ HIBA: Ez az eredmény matematikailag lehetetlen az eddigi lapok alapján!\nKérlek, ellenőrizd az adatokat.");
    
    selectedResult = null;
    document.getElementById('btnWin').classList.remove('active');
    document.getElementById('btnLose').classList.remove('active');
    document.getElementById('btnDraw').classList.remove('active');
    updateChips();
    updateConfirmBtn();
    
    return;
  }

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

  possibleEnemyHands = nextEnemyHands;
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
  
  autoSelectOracleCard(); 
  
  updateScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateConfirmBtn();
  updateChips();
}

// =============================================
//  HISTORY & UNDO — VÁLTOZATLAN
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
  
  autoSelectOracleCard();
  
  updateScoreBoard(); renderHistory(); renderMyCards(); renderEnemyCards(); renderOracle(); updateConfirmBtn(); updateChips();
}

function resetAll() {
  myCards = [...ALL_CARDS]; possibleEnemyHands = [ [...ALL_CARDS] ]; history = []; roundNum = 0;
  myScore = 0; enemyScore = 0;
  selectedMine = null; selectedEnemy = null; selectedResult = null;

  const chk = document.getElementById('chkIStart'); if (chk) chk.checked = false; iStarted = false;
  clearActionButtons(); 
  
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
