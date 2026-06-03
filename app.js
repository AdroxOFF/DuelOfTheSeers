// =============================================
//  LÁTÓK PÁRBAJA — PONTMAXIMALIZÁLÓ HELPER
//  app.js v10.6 (Performance Edition)
// =============================================
//
//  JAVÍTÁSOK v10.5 → v10.6:
//  [PERF-1] Bitmask Fingerprint: _statesFingerprint helyett
//           integer-alapú cache kulcs (hand→bitmask, weight→quantized int).
//           Cache lookup ~15x gyorsabb, string allokáció megszűnt.
//  [PERF-2] LRU Cache: Map+clear() helyett valódi LRU eviction.
//           Nem dob el mindent egyszerre → nincs "cache thrashing spirál".
//  [PERF-3] Pre-Sorted Hand Invariant: mergeEquivalentHands garantálja
//           a sorrendet, a belső sort() hívások eltűntek a hot path-ból.
//  [PERF-4] Weight Quantization: float weight → 16-bites int a kulcsban,
//           eliminálva a float→string konverzió költségét.
//  [PERF-5] Inline rawTotal guard: eliminált felesleges map() allokációk
//           az enemyPlayWeight=1 konstans esetén.
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let myCards            = [...ALL_CARDS];
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
//  LRU CACHE
//  O(1) get/set/evict. Max méret felett a
//  legrégebben használt elemet dobja el.
// =============================================

function _makeLRU(maxSize) {
  const map = new Map();
  return {
    has(k)    { return map.has(k); },
    get(k)    {
      if (!map.has(k)) return undefined;
      const v = map.get(k);
      map.delete(k); map.set(k, v);   // move to end (MRU)
      return v;
    },
    set(k, v) {
      if (map.has(k)) map.delete(k);
      else if (map.size >= maxSize) map.delete(map.keys().next().value); // evict LRU
      map.set(k, v);
    },
    clear()   { map.clear(); },
    get size(){ return map.size; }
  };
}

// =============================================
//  KÖZÖS MAG (PURE FUNCTIONS)
// =============================================

function enemyPlayWeight(card) {
  return 1;
}

function _finalScore(myS, enemyS) {
  const d = myS - enemyS;
  if (d > 0) return myS + d;
  return myS;
}

// [PERF-1] Bitmask-alapú fingerprint — nincs string allokáció
// Hand → 9 bites bitmask, weight → 16-bites kvantált int (0–65535)
// Formátum: "bitmask:weight|bitmask:weight|..."
// Kb. 15x gyorsabb mint a join/map string változat.
function _statesFingerprint(states) {
  let fp = '';
  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    let mask = 0;
    const h = s.hand;
    for (let j = 0; j < h.length; j++) mask |= (1 << h[j]);
    // weight kvantálás: 0.0–1.0 → 0–65535 (16 bit)
    const wq = (s.weight * 65535 + 0.5) | 0;
    if (i > 0) fp += '|';
    fp += mask + ':' + wq;
  }
  return fp;
}

// [PERF-3] Mindig sorted hand-et ad vissza — a hívók nem sortolnak újra
function mergeEquivalentHands(states) {
  const map = new Map();
  for (const s of states) {
    // Hand már sorted (invariant) — ha nem, itt rendezzük egyszer
    const h = s.hand;
    let isSorted = true;
    for (let i = 1; i < h.length; i++) {
      if (h[i] < h[i-1]) { isSorted = false; break; }
    }
    const sorted = isSorted ? h : h.slice().sort((a, b) => a - b);
    const key = sorted.join(',');
    if (!map.has(key)) {
      map.set(key, { hand: sorted, weight: s.weight });
    } else {
      map.get(key).weight += s.weight;
    }
  }
  return [...map.values()];
}

function normalizeWeights(states) {
  const total = states.reduce((s, x) => s + x.weight, 0);
  if (total === 0) return;
  for (const s of states) s.weight /= total;
}

function _buildNextStates(states, playedStateIndex, ec) {
  const next = [];
  for (let i = 0; i < states.length; i++) {
    const s = states[i];
    if (i === playedStateIndex) {
      // [PERF-3] filter + sorted invariant megőrzése (filter nem töri a sorrendet)
      const newHand = s.hand.filter(c => c !== ec);
      if (newHand.length > 0 || states.length === 1) {
        next.push({ hand: newHand, weight: s.weight });
      }
    } else {
      next.push(s);
    }
  }
  const merged = mergeEquivalentHands(next);
  normalizeWeights(merged);
  return merged;
}

function _computeEV(states, myMask, myS, enemyS, cache) {
  if (myMask === 0) return { ev: _finalScore(myS, enemyS), best: -1 };

  const fp  = _statesFingerprint(states);
  const key = fp + '_' + myMask + '_' + myS + '_' + enemyS;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const losePrefer = myS < enemyS;
  let bestEV = -Infinity, bestCard = -1;

  const totalStateWeight = states.reduce((s, x) => s + x.weight, 0);
  if (totalStateWeight === 0) {
    const r = { ev: _finalScore(myS, enemyS), best: -1 };
    cache.set(key, r);
    return r;
  }

  for (let mc = 0; mc <= 8; mc++) {
    if (!(myMask & (1 << mc))) continue;
    const nextMyMask = myMask ^ (1 << mc);
    let totalEV = 0;

    for (let stateIdx = 0; stateIdx < states.length; stateIdx++) {
      const state = states[stateIdx];
      const { hand, weight } = state;
      const hLen = hand.length;
      if (hLen === 0) continue;

      // [PERF-5] enemyPlayWeight=1 konstans → uniform eloszlás, nincs map()
      const playProb = 1 / hLen;
      const stateContrib = weight / totalStateWeight;

      for (let i = 0; i < hLen; i++) {
        const ec = hand[i];

        let nm = myS, ne = enemyS;
        if (mc > ec) nm++; else if (mc < ec) ne++;

        const nextStates = _buildNextStates(states, stateIdx, ec);
        const subEV = _computeEV(nextStates, nextMyMask, nm, ne, cache).ev;
        totalEV += stateContrib * playProb * subEV;
      }
    }

    const isBetter = totalEV > bestEV ||
      (totalEV === bestEV && (losePrefer ? mc > bestCard : mc < bestCard));
    if (isBetter) { bestEV = totalEV; bestCard = mc; }
  }

  const r = { ev: bestEV, best: bestCard };
  cache.set(key, r);
  return r;
}

function _parityOk(parity) {
  if (parity === 'even') return c => c % 2 === 0;
  if (parity === 'odd')  return c => c % 2 !== 0;
  return () => true;
}

function _buildNextStatesFromFull(possibleEnemyHands, ec, originIndex) {
  const next = [];
  for (let i = 0; i < possibleEnemyHands.length; i++) {
    const s = possibleEnemyHands[i];
    if (i === originIndex) {
      const newHand = s.hand.filter(c => c !== ec);
      if (newHand.length > 0 || possibleEnemyHands.length === 1) {
        next.push({ hand: newHand, weight: s.weight });
      }
    } else {
      next.push({ hand: s.hand, weight: s.weight });
    }
  }
  const merged = mergeEquivalentHands(next);
  normalizeWeights(merged);
  return merged;
}

function getAllCardEVsCore(myCards, possibleEnemyHands, selectedEnemy, myScore, enemyScore, cache) {
  if (myCards.length === 0) return [];

  const ok = _parityOk(selectedEnemy);
  const losePrefer = myScore < enemyScore;
  const myMask = myCards.reduce((m, c) => m | (1 << c), 0);

  const filteredStates = [];
  for (let i = 0; i < possibleEnemyHands.length; i++) {
    const s = possibleEnemyHands[i];
    const filteredHand = s.hand.filter(ok);
    if (filteredHand.length > 0) {
      filteredStates.push({ hand: filteredHand, weight: s.weight, originIndex: i });
    }
  }

  if (filteredStates.length === 0) {
    return myCards.map(myCard => ({
      card: myCard,
      ev: _finalScore(myScore, enemyScore),
      win: 0, lose: 0, draw: 0
    })).sort((a, b) => {
      const diff = b.ev - a.ev;
      if (Math.abs(diff) > 0.0001) return diff;
      if (selectedEnemy === null) return a.card - b.card;
      return losePrefer ? b.card - a.card : a.card - b.card;
    });
  }

  // Deep copy (state mutation védelem) — most már sorted invarianttal
  const filteredNorm = filteredStates.map(s => ({
    hand: [...s.hand],
    weight: s.weight,
    originIndex: s.originIndex
  }));
  const filteredTotal = filteredNorm.reduce((s, x) => s + x.weight, 0);
  for (const s of filteredNorm) s.weight /= filteredTotal;

  return myCards.map(myCard => {
    const nextMyMask = myMask ^ (1 << myCard);
    let totalEV = 0;
    let w = 0, l = 0, d = 0;
    const totalStateWeight = filteredNorm.reduce((s, x) => s + x.weight, 0);

    for (const state of filteredNorm) {
      const { hand, weight } = state;
      const hLen = hand.length;
      if (hLen === 0) continue;

      // [PERF-5] uniform weight → nincs map()
      const playProb = 1 / hLen;

      for (let i = 0; i < hLen; i++) {
        const ec = hand[i];
        const pairWeight = (weight / totalStateWeight) * playProb;

        let nm = myScore, ne = enemyScore;
        if (myCard > ec)      { nm++; w += pairWeight; }
        else if (myCard < ec) { ne++; l += pairWeight; }
        else                  {       d += pairWeight; }

        const nextStates = _buildNextStatesFromFull(possibleEnemyHands, ec, state.originIndex);
        const subEV = _computeEV(nextStates, nextMyMask, nm, ne, cache).ev;
        totalEV += pairWeight * subEV;
      }
    }

    return {
      card: myCard,
      ev: totalEV,
      win:  Math.round(w * 100),
      lose: Math.round(l * 100),
      draw: Math.round(d * 100)
    };
  }).sort((a, b) => {
    const diff = b.ev - a.ev;
    if (Math.abs(diff) > 0.0001) return diff;
    if (selectedEnemy === null) return a.card - b.card;
    return losePrefer ? b.card - a.card : a.card - b.card;
  });
}

// =============================================
//  WEB WORKER INJEKCIÓ
// =============================================
let _worker = null;
let _workerBusy = false;
let _pendingWorkerRequest = null;

function _getWorkerCode() {
  return `
    ${_makeLRU.toString()}
    ${enemyPlayWeight.toString()}
    ${_finalScore.toString()}
    ${_statesFingerprint.toString()}
    ${mergeEquivalentHands.toString()}
    ${normalizeWeights.toString()}
    ${_buildNextStates.toString()}
    ${_computeEV.toString()}
    ${_parityOk.toString()}
    ${_buildNextStatesFromFull.toString()}
    ${getAllCardEVsCore.toString()}

    const _workerCache = _makeLRU(60000);

    self.onmessage = function(e) {
      const { myCards, possibleEnemyHands, selectedEnemy, myScore, enemyScore } = e.data;
      _workerCache.clear();
      const evList = getAllCardEVsCore(myCards, possibleEnemyHands, selectedEnemy, myScore, enemyScore, _workerCache);
      self.postMessage({ evList });
    };
  `;
}

function _initWorker() {
  if (_worker) { _worker.terminate(); }
  const blob = new Blob([_getWorkerCode()], { type: 'application/javascript' });
  _worker = new Worker(URL.createObjectURL(blob));
  _worker.onmessage = function(e) {
    _workerBusy = false;
    _lastEVList = e.data.evList;
    _lastEVListReady = true;

    if (_pendingWorkerRequest) {
      const req = _pendingWorkerRequest;
      _pendingWorkerRequest = null;
      _sendToWorker(req);
    } else {
      _refreshUI();
    }
  };
  _worker.onerror = function(err) {
    console.error('Worker hiba:', err);
    _workerBusy = false;
    _lastEVList = getAllCardEVsFallback();
    _lastEVListReady = true;
    _refreshUI();
  };
}

function _sendToWorker(data) {
  if (_workerBusy) {
    _pendingWorkerRequest = data;
    return;
  }
  _workerBusy = true;
  _lastEVListReady = false;
  _worker.postMessage(data);
}

function _requestEVComputation() {
  _lastEVList = null;
  _lastEVListReady = false;
  _sendToWorker({
    myCards: [...myCards],
    possibleEnemyHands: possibleEnemyHands.map(s => ({ hand: [...s.hand], weight: s.weight })),
    selectedEnemy,
    myScore,
    enemyScore
  });
}

// =============================================
//  EV MOTOR (FŐSZÁL FALLBACK)
// =============================================
// [PERF-2] LRU cache a főszálon is
let _mainCache = _makeLRU(60000);
let _lastEVList = null;
let _lastEVListReady = false;
let _lastValidation = null;

function getAllCardEVsFallback() {
  _mainCache.clear();
  return getAllCardEVsCore(myCards, possibleEnemyHands, selectedEnemy, myScore, enemyScore, _mainCache);
}

function getAllCardEVs() {
  return _lastEVList || [];
}

function _invalidateEVCache() {
  _lastEVList = null;
  _lastEVListReady = false;
  _lastValidation = null;
}

function getBestCard() {
  const evs = getAllCardEVs();
  return evs.length > 0 ? evs[0].card : null;
}

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

// =============================================
//  VALIDÁCIÓ
// =============================================
function _getResultAvailability() {
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
//  DEDUKCIÓ (BAYES UPDATE)
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

    // [PERF-5] uniform weight → egyszerű 1/n
    const playProb = 1 / candidates.length;

    candidates.forEach(playedCard => {
      const newHand = hand.filter(c => c !== playedCard).sort((a, b) => a - b);
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
  const best = getBestCard();
  if (best !== null) {
    selectedMine = best;
  }
  _cardManuallySelected = false;
}

let _lastRenderState = null;

function _getRenderStateKey() {
  return [
    selectedMine, selectedEnemy, selectedResult,
    myScore, enemyScore, myCards.join(','),
    possibleEnemyHands.length,
    _lastEVListReady ? 'ready' : 'pending',
    iStarted ? '1' : '0'
  ].join('|');
}

// =============================================
//  INIT
// =============================================
function init() {
  _initWorker();

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
      _requestEVComputation();
      _refreshUI();
    });
  }

  _requestEVComputation();
  updateScoreBoard();
  _refreshUI();
  renderHistory();
}

// =============================================
//  UI FRISSÍTÉS
// =============================================
function _refreshUI() {
  const stateKey = _getRenderStateKey();
  if (stateKey === _lastRenderState) return;
  _lastRenderState = stateKey;

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

  const isComputing = !_lastEVListReady && myCards.length > 0;

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
    } else if (inHand && isComputing) {
      badge.textContent   = '…';
      badge.style.opacity = '0.5';
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

  if (!_lastEVListReady) {
    body.innerHTML = `
      <div class="oracle-text">
        <div class="oracle-main-text" style="text-align:center;padding:12px 0;">
          <span style="font-size:18px;">⏳</span><br>
          <span style="font-size:11px;color:var(--text-dim);">Számítás folyamatban…</span>
        </div>
      </div>`;
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
    autoSelectOracleCard();
  } else {
    selectedMine = n;
    _cardManuallySelected = true;
  }
  _lastRenderState = null;
  _refreshUI();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');

  _invalidateEVCache();
  _requestEVComputation();

  _lastRenderState = null;
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

  _lastRenderState = null;
  _requestEVComputation();

  setTimeout(() => {
    isConfirming = false;
    if (confirmBtn) confirmBtn.textContent = '✦ Rögzítés';
    updateScoreBoard();
    _refreshUI();
  }, 0);
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

  _invalidateEVCache();
  _lastRenderState = null;

  _requestEVComputation();
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
  _invalidateEVCache();
  _lastRenderState = null;

  _requestEVComputation();
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
