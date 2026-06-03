// =============================================
//  LÁTÓK PÁRBAJA — PONTMAXIMALIZÁLÓ HELPER
//  app.js v10.0
// =============================================
//
//  JAVÍTÁSOK v9.2 → v10.0:
//  [EXACT1] _computeEV mostantól states:[{hand,weight}] listán fut,
//           nem összevont enemyMask bitmaskre. Ez azt jelenti, hogy
//           a Bayes-állapotok végig megmaradnak a teljes jövőfában —
//           az EV számítás pontosan figyelembe veszi, hogy az ellenfél
//           kezéből mely lapok estek már ki melyik állapotvonalban.
//           Korábban a _computeEV egy átlagolt maskre váltott vissza,
//           elveszítve az állapot-specifikus kézkészlet-információt.
//  [EXACT2] Cache kulcs: states "hand|weight" fingerprint alapján épül,
//           így különböző állapoteloszlások soha nem ütköznek egymással.
//  [EXACT3] getAllCardEVs: a pairs lista eltűnt — a számítás közvetlenül
//           _computeEV(states, ...) hívásra épül. A win/lose/draw
//           statisztikák is állapotonként súlyozottan gyűlnek.
//  [EXACT4] Teljesítmény-megjegyzés: a states lista méretével az EV-fa
//           lineárisan skálázódik (states.length × 9 × 8 × ... helyett
//           az összevonás miatt a practice-ban kezelhető marad).
//           Nagyon széles eloszlásnál (>200 kombináció) lassulhat —
//           de a 9 lapos játékban ez ritkán lép fel.
//
//  Korábbi javítások (v8.0–v9.2) változatlanok maradnak:
//  [FIX1–4] [BAY1–5] [HOOK] — ld. korábbi changelog.
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let myCards            = [...ALL_CARDS];

// [BAY1] Súlyozott állapotok: {hand: number[], weight: number}
let possibleEnemyHands = [ { hand: [...ALL_CARDS], weight: 1 } ];

let myScore    = 0;
let enemyScore = 0;

let selectedMine   = null;
let selectedEnemy  = null;
let selectedResult = null;
let iStarted       = false;

let history  = [];
let roundNum = 0;
let isConfirming = false;
let _cardManuallySelected = false;

// =============================================
//  [HOOK] ELLENFÉL PRIOR — egyetlen helyen módosítandó
// =============================================
function enemyPlayWeight(card) {
  return 1; // egyenletes prior — módosítsd ha ellenfél-modellt szeretnél
}

// =============================================
//  EV MOTOR — [EXACT1] states alapú rekurzió
// =============================================
let _evCache = new Map();
let _lastEVList = null;
let _lastValidation = null;

function _maskCount(m) {
  let n = 0; while (m) { n += m & 1; m >>= 1; } return n;
}

function _finalScore(myS, enemyS) {
  const d = myS - enemyS;
  if (d > 0) return myS + d;
  return myS;
}

// [EXACT2] Cache kulcs states fingerprint alapján
function _statesFingerprint(states) {
  // Gyors fingerprint: minden állapot "hand:weight" összefűzve
  // A hand már rendezett (deduceEnemyHands biztosítja)
  return states.map(s => s.hand.join(',') + ':' + s.weight.toFixed(6)).join('|');
}

// [EXACT1] _computeEV mostantól states:[{hand,weight}] listán fut.
// Minden rekurzív hívás az aktuális állapoteloszlást propagálja tovább,
// nem vált vissza összevont maskre.
//
// states: [{hand: number[], weight: number}] — normalizált súlyok
// myMask: a saját megmaradt lapok bitmaskje
// myS, enemyS: aktuális pontállás
function _computeEV(states, myMask, myS, enemyS) {
  if (myMask === 0) return { ev: _finalScore(myS, enemyS), best: -1 };

  // [EXACT2] Cache: állapot fingerprint + saját lapok + pontállás
  const fp  = _statesFingerprint(states);
  const key = `${fp}||${myMask},${myS},${enemyS}`;
  if (_evCache.has(key)) return _evCache.get(key);

  const losePrefer = myS < enemyS;
  let bestEV = -Infinity, bestCard = -1;

  // Teljes súly az ellenfél oldalán (normalizált states esetén = 1,
  // de biztonság kedvéért újra összegzünk)
  const totalStateWeight = states.reduce((s, x) => s + x.weight, 0);
  if (totalStateWeight === 0) {
    const r = { ev: _finalScore(myS, enemyS), best: -1 };
    _evCache.set(key, r);
    return r;
  }

  for (let mc = 0; mc <= 8; mc++) {
    if (!(myMask & (1 << mc))) continue;
    const nextMyMask = myMask ^ (1 << mc);
    let totalEV = 0;

    // Minden Bayes-állapotban az ellenfél lehetséges lapjai
    for (const state of states) {
      const { hand, weight } = state;
      if (hand.length === 0) continue;

      // Prior-súlyozott jelöltek az egyes állapotban
      const rawWeights = hand.map(c => enemyPlayWeight(c));
      const rawTotal   = rawWeights.reduce((s, w) => s + w, 0);
      if (rawTotal === 0) continue;

      for (let i = 0; i < hand.length; i++) {
        const ec       = hand[i];
        const playProb = rawWeights[i] / rawTotal;

        let nm = myS, ne = enemyS;
        if (mc > ec) nm++; else if (mc < ec) ne++;

        // [EXACT1] Rekurzív hívás: az ec lap kiesésével frissített states lista
        // Az adott állapotból az ec kivételével marad a kéz;
        // a többi állapot változatlan, de az ec-t kijátszó állapot
        // új kézzel szerepel.
        const nextStates = _buildNextStates(states, state, ec);

        const subEV = _computeEV(nextStates, nextMyMask, nm, ne).ev;
        // Kombinált súly: state.weight (Bayes prior) × playProb (prior hook)
        // osztva totalStateWeight-tel hogy normált maradjon
        totalEV += (weight / totalStateWeight) * playProb * subEV;
      }
    }

    const isBetter = totalEV > bestEV ||
      (totalEV === bestEV && (losePrefer ? mc > bestCard : mc < bestCard));
    if (isBetter) { bestEV = totalEV; bestCard = mc; }
  }

  const r = { ev: bestEV, best: bestCard };
  _evCache.set(key, r);
  return r;
}

// [EXACT1] Segédfüggvény: az states listából kiveszi az ec lapot
// a megadott állapotból, és az összes többi állapotot változatlanul hagyja.
// Az eredmény újra normalizált állapotlista lesz.
function _buildNextStates(states, playedState, ec) {
  const next = [];
  for (const s of states) {
    if (s === playedState) {
      // Ebből az állapotból kiesik az ec lap
      const newHand = s.hand.filter(c => c !== ec);
      if (newHand.length > 0 || states.length === 1) {
        next.push({ hand: newHand, weight: s.weight });
      }
      // Ha a kéz teljesen kiürül és vannak más állapotok, az állapot megszűnik.
      // (Ez elvileg csak a játék vége felé fordulhat elő.)
    } else {
      next.push(s);
    }
  }
  // Összevonás és normalizálás [BAY3] szerint
  const merged = mergeEquivalentHands(next);
  normalizeWeights(merged);
  return merged;
}

function _parityOk(parity) {
  if (parity === 'even') return c => c % 2 === 0;
  if (parity === 'odd')  return c => c % 2 !== 0;
  return () => true;
}

// [BAY4] weight-tel súlyoz darabszám helyett
function _getWeightedCards(parity) {
  const ok = _parityOk(parity);
  let cardCounts = {}, total = 0;
  for (const state of possibleEnemyHands) {
    const { hand, weight } = state;
    for (const c of hand.filter(ok)) {
      cardCounts[c] = (cardCounts[c] || 0) + weight;
      total += weight;
    }
  }
  return { cardCounts, total };
}

// [EXACT3] getAllCardEVs: közvetlenül _computeEV(states, ...) hívásra épül.
// A win/lose/draw statisztikák az első szint alapján számolódnak
// (az első körös kimenetel valószínűsége × súly), a jövőfa az EV-n belül.
function getAllCardEVs() {
  if (myCards.length === 0) return [];
  if (_lastEVList) return _lastEVList;

  const ok = _parityOk(selectedEnemy);
  const losePrefer = myScore < enemyScore;
  const myMask = myCards.reduce((m, c) => m | (1 << c), 0);

  // Paritás-szűrt states: csak azok az állapotok/lapok jönnek szóba,
  // amelyekben az ellenfélnek van a paritásnak megfelelő lapja
  const filteredStates = possibleEnemyHands
    .map(s => ({ hand: s.hand.filter(ok), weight: s.weight }))
    .filter(s => s.hand.length > 0);

  // Ha nincs szűrt állapot (pl. az ellenfél minden lapja kiesett), fallback
  if (filteredStates.length === 0) {
    _lastEVList = myCards.map(myCard => ({
      card: myCard,
      ev: _finalScore(myScore, enemyScore),
      win: 0, lose: 0, draw: 0
    })).sort((a, b) => b.ev - a.ev);
    return _lastEVList;
  }

  // Normalizálás a szűrt states-re
  const filteredNorm = filteredStates.map(s => ({ ...s }));
  normalizeWeights(filteredNorm);

  // Teljes states (paritás nélkül) az EV rekurzióhoz, de szűrve a paritásra
  // az első körben. A jövőfa az összes megmaradó lapot figyelembe veszi.
  // Ehhez az eredeti possibleEnemyHands kell, de az első lépés szűrt.
  //
  // Technikai megjegyzés: a filteredNorm-t adjuk _computeEV-nek,
  // de a _buildNextStates-ben a jövőbeli körökben már az EC kiesése után
  // az összes lap (páros+páratlan együtt) megmarad — így a jövőfa
  // nem ragad bele a paritás-szűrőbe.

  _lastEVList = myCards.map(myCard => {
    const nextMyMask = myMask ^ (1 << myCard);
    let totalEV = 0;
    let w = 0, l = 0, d = 0;
    const totalStateWeight = filteredNorm.reduce((s, x) => s + x.weight, 0);

    for (const state of filteredNorm) {
      const { hand, weight } = state;
      const rawWeights = hand.map(c => enemyPlayWeight(c));
      const rawTotal   = rawWeights.reduce((s, ww) => s + ww, 0);
      if (rawTotal === 0) continue;

      for (let i = 0; i < hand.length; i++) {
        const ec       = hand[i];
        const playProb = rawWeights[i] / rawTotal;
        const pairWeight = (weight / totalStateWeight) * playProb;

        let nm = myScore, ne = enemyScore;
        if (myCard > ec)      { nm++; w += pairWeight; }
        else if (myCard < ec) { ne++; l += pairWeight; }
        else                  {       d += pairWeight; }

        // [EXACT1] A jövőfa a szűrt állapotból indul, az ec kiesésével
        // Az itt kapott nextStates a következő körre vonatkozik,
        // ahol már nincs paritás-szűrő — az összes megmaradó lapot látjuk.
        // Ezért a _computeEV belső szintjein filteredNorm helyett
        // a full állapotot (paritás nélkül) kellene használni.
        //
        // Megoldás: a _buildNextStates az eredeti possibleEnemyHands-ból
        // épít, nem a filteredNorm-ból, hogy a jövőfa teljes maradjon.
        const nextStates = _buildNextStatesFromFull(ec, state, weight);
        const subEV = _computeEV(nextStates, nextMyMask, nm, ne).ev;
        totalEV += pairWeight * subEV;
      }
    }

    const win  = Math.round(w * 100);
    const lose = Math.round(l * 100);
    const draw = Math.round(d * 100);

    return { card: myCard, ev: totalEV, win, lose, draw };
  }).sort((a, b) =>
    b.ev - a.ev || (losePrefer ? b.card - a.card : a.card - b.card)
  );

  return _lastEVList;
}

// [EXACT3] Segédfüggvény: a teljes possibleEnemyHands-ból épít nextStates-t,
// kivéve az ec lapot az adott állapotból.
// Ez biztosítja, hogy a jövőfa nem ragad bele az első körös paritás-szűrőbe.
function _buildNextStatesFromFull(ec, playedStateRef, playedStateWeight) {
  // Az eredeti possibleEnemyHands-ban megtaláljuk a megfelelő állapotot
  // a hand tartalom alapján (weight egyezés nem elégséges, ha több állapotnak
  // azonos a keze — de a mergeEquivalentHands ezt már összevonta)
  const next = [];
  const totalW = possibleEnemyHands.reduce((s, x) => s + x.weight, 0);

  for (const s of possibleEnemyHands) {
    // Ha ez az állapot tartalmazza az ec lapot és a hand megegyezik
    // az aktuálisan kijátszott állapotéval (filteredNorm-ban a hand szűrt,
    // de az ec lap biztosan benne volt, tehát az eredeti kézben is benne volt)
    const hasEc = s.hand.includes(ec);
    if (hasEc && _handsOverlap(s.hand, playedStateRef.hand, ec)) {
      const newHand = s.hand.filter(c => c !== ec);
      next.push({ hand: newHand, weight: s.weight });
    } else {
      next.push({ hand: s.hand, weight: s.weight });
    }
  }

  const merged = mergeEquivalentHands(next);
  normalizeWeights(merged);
  return merged;
}

// Az eredeti (szűretlen) állapot keze tartalmazza-e a szűrt kéz összes lapját?
function _handsOverlap(fullHand, filteredHand, playedCard) {
  // A filteredHand az eredeti kéz paritás-szűrt változata.
  // Akkor egyeznek, ha a filteredHand összes lapja szerepel a fullHand-ban.
  for (const c of filteredHand) {
    if (!fullHand.includes(c)) return false;
  }
  return true;
}

function _invalidateEVCache() {
  _lastEVList = null;
  _lastValidation = null;
}

function getBestCard() {
  const evs = getAllCardEVs();
  return evs.length > 0 ? evs[0].card : null;
}

// =============================================
//  VALIDÁCIÓ
// =============================================
function _getResultAvailability() {
  // [FIX3] Cache kulcs: possibleEnemyHands.length is benne
  const key = `${selectedMine}|${selectedEnemy}|${possibleEnemyHands.length}`;
  if (_lastValidation && _lastValidation.key === key) return _lastValidation.result;

  const availability = { win: true, lose: true, draw: true };

  if (selectedMine === null || selectedEnemy === null) {
    availability.win = false;
    availability.lose = false;
    availability.draw = false;
    _lastValidation = { key, result: availability };
    return availability;
  }

  const ok = _parityOk(selectedEnemy);

  if (!ok(selectedMine)) {
    availability.draw = false;
  }

  for (const res of ['win', 'lose', 'draw']) {
    if (!availability[res]) continue;
    let found = false;
    for (const state of possibleEnemyHands) {
      let candidates = state.hand.filter(c => ok(c));
      if (res === 'win')       candidates = candidates.filter(c => c < selectedMine);
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
//  [BAY3] SÚLY-SEGÉDEK
// =============================================
function normalizeWeights(states) {
  const total = states.reduce((s, x) => s + x.weight, 0);
  if (total === 0) return;
  for (const s of states) s.weight /= total;
}

function mergeEquivalentHands(states) {
  const map = new Map();
  for (const s of states) {
    const key = s.hand.slice().sort((a, b) => a - b).join(',');
    if (!map.has(key)) {
      map.set(key, { hand: s.hand.slice().sort((a, b) => a - b), weight: s.weight });
    } else {
      map.get(key).weight += s.weight;
    }
  }
  return [...map.values()];
}

// =============================================
//  [BAY2] DEDUKCIÓ — Bayes-es frissítés
// =============================================
function deduceEnemyHands(myCard, enemyType, result) {
  const ok = _parityOk(enemyType);
  const newStates = [];

  for (const state of possibleEnemyHands) {
    const { hand, weight } = state;

    let candidates = hand.filter(c => ok(c));
    if (result === 'win')       candidates = candidates.filter(c => c < myCard);
    else if (result === 'lose') candidates = candidates.filter(c => c > myCard);
    else if (result === 'draw') candidates = candidates.filter(c => c === myCard);

    if (candidates.length === 0) continue;

    const rawWeights = candidates.map(c => enemyPlayWeight(c));
    const rawTotal   = rawWeights.reduce((s, w) => s + w, 0);

    candidates.forEach((playedCard, i) => {
      const playProb = rawWeights[i] / rawTotal;
      const newHand  = hand.filter(c => c !== playedCard).sort((a, b) => a - b);
      newStates.push({
        hand:   newHand,
        weight: weight * playProb
      });
    });
  }

  if (newStates.length === 0) return possibleEnemyHands;

  const merged = mergeEquivalentHands(newStates);
  normalizeWeights(merged);
  return merged;
}

// =============================================
//  AUTOMATA KÁRTYA KIJELÖLŐ
// =============================================
function autoSelectOracleCard() {
  selectedMine = getBestCard();
  _cardManuallySelected = false;
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
//  UI FRISSÍTÉS
// =============================================
function _refreshUI() {
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  updateResultButtons();
  updatePairityButtons();
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
//  EREDMÉNY-GOMBOK
// =============================================
function updateResultButtons() {
  const av = _getResultAvailability();

  const btnWin  = document.getElementById('btnWin');
  const btnLose = document.getElementById('btnLose');
  const btnDraw = document.getElementById('btnDraw');

  btnWin.disabled  = !av.win;
  btnLose.disabled = !av.lose;
  btnDraw.disabled = !av.draw;

  if (selectedResult && !av[selectedResult]) {
    selectedResult = null;
    btnWin.classList.remove('active');
    btnLose.classList.remove('active');
    btnDraw.classList.remove('active');
  }
}

function updatePairityButtons() {
  document.getElementById('btnEven').disabled = false;
  document.getElementById('btnOdd').disabled  = false;
}

// =============================================
//  RENDER — SAJÁT LAPOK
// =============================================
function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  container.innerHTML = '';

  const oddRow  = document.createElement('div'); oddRow.className  = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

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
      if (chance === 100)    chanceDiv.classList.add('sure-chance');
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

  // [FIX1] Kézméret-tartomány számítása
  const uniqueCount = Object.keys(cardCounts).filter(k => cardCounts[k] > 0).length;
  const minHandSize = Math.min(...possibleEnemyHands.map(s => s.hand.length));
  const maxHandSize = Math.max(...possibleEnemyHands.map(s => s.hand.length));
  const handSizeLabel = minHandSize === maxHandSize
    ? `${minHandSize} lap`
    : `${minHandSize}–${maxHandSize} lap`;

  const countEl = document.getElementById('enemyCount');
  if (countEl) {
    const parityLabel = selectedEnemy === 'even' ? ' · páros szűrő'
                      : selectedEnemy === 'odd'  ? ' · páratlan szűrő'
                      : '';
    countEl.textContent = `Kézben: ${handSizeLabel} · ${uniqueCount} féle lap lehetséges${parityLabel}`;
  }

  const comboEl = document.getElementById('comboCount');
  if (comboEl) {
    comboEl.textContent = `Ellenfél lehetséges kombinációi: ${possibleEnemyHands.length}`;
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

  const evList = getAllCardEVs();
  if (evList.length === 0) return;

  const suggestedCard = selectedMine !== null ? selectedMine : evList[0].card;
  const shown = evList.find(x => x.card === suggestedCard) || evList[0];
  const { ev, win, lose, draw } = shown;
  const isEven    = suggestedCard % 2 === 0;
  const diff      = myScore - enemyScore;
  const remaining = myCards.length;

  let strategyDesc = '';
  const evIsApprox = iStarted && selectedEnemy === null;

  if (iStarted) {
    const approxNote = evIsApprox
      ? ` <span style="font-size:9px;color:var(--gold-light);opacity:0.8;">(paritás nélkül becsült — add meg a hátlapot a pontos EV-hez)</span>`
      : '';
    if (win <= 20) {
      strategyDesc = `💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Vak nyitásban a <strong>${suggestedCard}</strong>-es a legoptimálisabb — az ellenfél elpazarol egy nagy lapot ellene. Várható végpont: <strong>${ev.toFixed(2)}</strong>.${approxNote}`;
    } else if (diff >= 2 && remaining <= 4) {
      strategyDesc = `🛡️ <strong>ELŐNY TARTÁSA:</strong> Vezetsz +${diff}-vel. A <strong>${suggestedCard}</strong>-es minimalizálja a kockázatot (EV: <strong>${ev.toFixed(2)}</strong>).${approxNote}`;
    } else if (diff <= -2 && remaining <= 4) {
      strategyDesc = `⚡ <strong>FORDÍTÁS KELL:</strong> Lemaradsz! A <strong>${suggestedCard}</strong>-es adja a legjobb fordulási esélyt (EV: <strong>${ev.toFixed(2)}</strong>).${approxNote}`;
    } else {
      strategyDesc = `🎭 <strong>VAK NYITÁS:</strong> Nem látjuk az ellenfél hátlapját. A <strong>${suggestedCard}</strong>-es a legjobb várható végpontot adja (<strong>${ev.toFixed(2)}</strong>).${approxNote}`;
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
        <span class="stat-label">Nyerési esély (kör)${evIsApprox ? " ≈" : ""}</span>
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
  if (selectedMine === n) {
    _cardManuallySelected = false;
    _invalidateEVCache();
    autoSelectOracleCard();
  } else {
    selectedMine = n;
    _cardManuallySelected = true;
    _invalidateEVCache();
  }
  _refreshUI();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');

  _invalidateEVCache();
  if (!iStarted && !_cardManuallySelected) {
    autoSelectOracleCard();
  }

  _refreshUI();
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
  } else if (iStarted && selectedMine === null) {
    hint.textContent = '🃏 Nézd meg az Oracle javaslatát, válaszd ki a lapot!';
  } else if (selectedEnemy === null) {
    hint.textContent = '⬛⬜ Add meg az ellenfél lapjának paritását!';
  } else if (selectedMine === null) {
    hint.textContent = '🃏 Válaszd ki a javasolt lapot (vagy más lapot)!';
  } else if (!selectedResult) {
    hint.textContent = '🎯 Add meg a kör eredményét!';
  } else if (canConfirm) {
    hint.textContent = '✅ Minden adat megvan — rögzítheted!';
  } else {
    hint.textContent = 'Válassz lapot és eredményt!';
  }
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
    possibleEnemyHands: possibleEnemyHands.map(s => ({ hand: [...s.hand], weight: s.weight })),
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

  if (roundNum === 1) {
    const chk = document.getElementById('chkIStart');
    if (chk) chk.disabled = true;
  }

  selectedMine = null;
  selectedResult = null;
  selectedEnemy = null;
  _cardManuallySelected = false;

  clearActionButtons();

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

  iStarted = snap.iStarted;
  const chkUndo = document.getElementById('chkIStart');
  if (chkUndo) {
    chkUndo.checked = iStarted;
    if (snap.roundNum === 0) chkUndo.disabled = false;
  }

  selectedMine = null; selectedEnemy = null; selectedResult = null;
  _cardManuallySelected = false;
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
  possibleEnemyHands = [ { hand: [...ALL_CARDS], weight: 1 } ];
  history = []; roundNum = 0;
  myScore = 0; enemyScore = 0;
  selectedMine = null; selectedEnemy = null; selectedResult = null;
  isConfirming = false;
  _cardManuallySelected = false;

  const chk = document.getElementById('chkIStart');
  if (chk) { chk.checked = false; chk.disabled = false; }
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
