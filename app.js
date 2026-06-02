// =============================================
//  LÁTÓK PÁRBAJA — PONTMAXIMALIZÁLÓ HELPER
//  app.js v5.0 — Helyes játékelmélet + EV motor
// =============================================
//
//  JÁTÉK ELMÉLET:
//  - Mindkét félnek saját, FÜGGETLEN 0-8 lapkészlete van
//  - Páros (0,2,4,6,8) = fekete hátlap
//  - Páratlan (1,3,5,7) = fehér hátlap
//  - Ha ELLENFÉL KEZD: lerakja a lapját, mi LÁTJUK a hátlapot (páros/páratlan),
//    ez alapján döntünk a saját lapunkról, majd kiderül az eredmény
//  - Ha MI KEZDÜNK: vakon rakunk, az ellenfél látja a mi hátlapunkat és
//    válaszol, majd kiderül az eredmény
//  - Minden kör végén csak az eredmény (win/lose/draw) derül ki,
//    az ellenfél pontos lapja nem
//  - A dedukciós motor körről körre szűkíti az ellenfél lehetséges lapjait
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

let myCards            = [...ALL_CARDS];
let possibleEnemyHands = [ [...ALL_CARDS] ];  // lehetséges ellenfél-kézállapotok

let myScore    = 0;
let enemyScore = 0;

let selectedMine   = null;   // saját kiválasztott lap
let selectedEnemy  = null;   // 'even' | 'odd' | null  (az ellenfél hátlapja)
let selectedResult = null;   // 'win' | 'lose' | 'draw' | null
let iStarted       = false;  // ki kezdi a kört (toggle)

let history  = [];
let roundNum = 0;

// =============================================
//  EV MOTOR — HIBRID MEGKÖZELÍTÉS
//  Aktuális kör: pontos, possibleEnemyHands weighted prior
//  Jövőbeli körök: bitmask union közelítés (gyors)
// =============================================
let _evCache = new Map();

function _maskCount(m) {
  let n = 0;
  while (m) { n += m & 1; m >>= 1; }
  return n;
}

function _finalScore(myS, enemyS) {
  const d = myS - enemyS;
  return d > 0 ? myS + d : 0;
}

// Bitmask EV a jövőbeli körökre (gyors közelítő, uniform prior)
function _computeEV(myMask, enemyMask, myS, enemyS) {
  if (myMask === 0) return { ev: _finalScore(myS, enemyS), best: -1 };

  const key = (myMask << 22) | (enemyMask << 13) | (myS << 6) | enemyS;
  if (_evCache.has(key)) return _evCache.get(key);

  const eCnt = _maskCount(enemyMask);
  const losePrefer = myS < enemyS;

  let bestEV = -Infinity, bestCard = -1;

  for (let mc = 0; mc <= 8; mc++) {
    if (!(myMask & (1 << mc))) continue;

    const nextMy = myMask ^ (1 << mc);
    let total = 0;

    if (eCnt === 0) {
      total = _finalScore(myS, enemyS);
    } else {
      for (let ec = 0; ec <= 8; ec++) {
        if (!(enemyMask & (1 << ec))) continue;
        let nm = myS, ne = enemyS;
        if (mc > ec) nm++; else if (mc < ec) ne++;
        total += _computeEV(nextMy, enemyMask ^ (1 << ec), nm, ne).ev;
      }
      total /= eCnt;
    }

    const isBetter = total > bestEV ||
      (total === bestEV && (losePrefer ? mc > bestCard : mc < bestCard));

    if (isBetter) { bestEV = total; bestCard = mc; }
  }

  const r = { ev: bestEV, best: bestCard };
  _evCache.set(key, r);
  return r;
}

// Weighted card distribution az aktuális körre (possibleEnemyHands alapján)
function _getWeightedCards(parity) {
  const parityOk = parity === 'even' ? (c => c % 2 === 0)
                 : parity === 'odd'  ? (c => c % 2 !== 0)
                 : (c => true);

  let cardCounts = {}, total = 0;
  for (const hand of possibleEnemyHands) {
    for (const c of hand.filter(parityOk)) {
      cardCounts[c] = (cardCounts[c] || 0) + 1;
      total++;
    }
  }
  return { cardCounts, total };
}

// Minden kézben lévő laphoz kiszámolja a teljes meccs várható végpontszámát
function getAllCardEVs() {
  if (myCards.length === 0) return [];
  _evCache.clear();

  const { cardCounts, total } = _getWeightedCards(selectedEnemy);
  const losePrefer = myScore < enemyScore;

  const nextMyBase = myCards.reduce((m, c) => m | (1 << c), 0);

  // Ellenfél jövőbeli lapjainak uniója (közelítés a jövőbeli körökre)
  let enemyUnionAll = 0;
  for (const hand of possibleEnemyHands)
    for (const c of hand) enemyUnionAll |= (1 << c);

  return myCards.map(myCard => {
    const nextMyMask = nextMyBase ^ (1 << myCard);
    let totalEV = 0;

    if (total === 0) {
      totalEV = _finalScore(myScore, enemyScore);
    } else {
      for (const [ecStr, weight] of Object.entries(cardCounts)) {
        const ec = parseInt(ecStr);
        let nm = myScore, ne = enemyScore;
        if (myCard > ec) nm++; else if (myCard < ec) ne++;

        // Jövőbeli ellenfél-lapok: union MÍNUSZ a most lerakott
        const futureEnemyMask = enemyUnionAll & ~(1 << ec);
        const { ev: subEV } = _computeEV(nextMyMask, futureEnemyMask, nm, ne);
        totalEV += subEV * weight;
      }
      totalEV /= total;
    }

    // Aktuális kör statisztikák (win/lose/draw %)
    let w = 0, l = 0, d = 0;
    for (const [ecStr, weight] of Object.entries(cardCounts)) {
      const ec = parseInt(ecStr);
      if (myCard > ec) w += weight;
      else if (myCard < ec) l += weight;
      else d += weight;
    }

    const win  = total > 0 ? Math.round(w / total * 100) : 0;
    const lose = total > 0 ? Math.round(l / total * 100) : 0;
    const draw = total > 0 ? Math.round(d / total * 100) : 0;

    return { card: myCard, ev: totalEV, win, lose, draw };
  }).sort((a, b) =>
    b.ev - a.ev || (losePrefer ? b.card - a.card : a.card - b.card)
  );
}

function getBestCard() {
  const evs = getAllCardEVs();
  return evs.length > 0 ? evs[0].card : null;
}

// =============================================
//  AUTOMATA KÁRTYA KIJELÖLŐ
// =============================================
function autoSelectOracleCard() {
  // Ha ellenfél kezd: a paritást LÁTJUK mielőtt döntünk
  //   → azonnal ajánlunk (a selectedEnemy-vel szűrve)
  // Ha mi kezdünk: vak döntés, selectedEnemy=null
  //   → ajánlunk paritás-szűrés nélkül
  selectedMine = getBestCard();
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
        // Ha mi kezdünk: nem látjuk az ellenfél hátlapját előre
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
//  RENDER — SAJÁT LAPOK (EV badge-ekkel)
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
    const isEven    = n % 2 === 0;
    const inHand    = myCards.includes(n);
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
      if (ev === maxEV && maxEV > 0)    badge.classList.add('chance-100');
      else if (ev >= maxEV * 0.9)        badge.classList.add('chance-high');
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
//  RENDER — ELLENFÉL LAPOK (valószínűségekkel)
// =============================================
function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  container.innerHTML = '';

  const oddRow  = document.createElement('div'); oddRow.className  = 'cards-sub-row';
  const evenRow = document.createElement('div'); evenRow.className = 'cards-sub-row';

  // Lehetséges ellenfél-lapok és valószínűségeik (paritás szűrővel)
  const { cardCounts, total } = _getWeightedCards(selectedEnemy);

  ALL_CARDS.forEach(n => {
    const isEven  = n % 2 === 0;
    const count   = cardCounts[n] || 0;
    const chance  = total > 0 ? Math.round(count / total * 100) : 0;
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
      if (chance === 100) {
        chanceDiv.classList.add('sure-chance');
      } else if (chance >= 70) {
        chanceDiv.classList.add('high-chance');
      } else if (chance <= 30) {
        chanceDiv.classList.add('low-chance');
      }
      chanceDiv.textContent = chance + '%';
      slot.appendChild(chanceDiv);
    }

    if (isEven) evenRow.appendChild(slot);
    else        oddRow.appendChild(slot);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);

  // Lehetséges lapok számlálója
  const uniqueCount = Object.keys(cardCounts).filter(k => cardCounts[k] > 0).length;
  const countEl = document.getElementById('enemyCount');
  if (countEl) {
    const parityLabel = selectedEnemy === 'even' ? ' (páros szűrő)'
                      : selectedEnemy === 'odd'  ? ' (páratlan szűrő)'
                      : '';
    countEl.textContent = `Lehetséges: ${uniqueCount} / 9${parityLabel}`;
  }
}

// =============================================
//  RENDER — ORACLE (EV-alapú javaslat)
// =============================================
function renderOracle() {
  const body = document.getElementById('oracleBody');
  if (!body) return;

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">Játék vége!</div></div>`;
    return;
  }

  // Ha ellenfél kezd de még nem adtuk meg a hátlapot: várakozás
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

  const suggestedCard = selectedMine !== null
    ? selectedMine
    : evList[0].card;

  const shown = evList.find(x => x.card === suggestedCard) || evList[0];
  const { ev, win, lose, draw } = shown;
  const isEven = suggestedCard % 2 === 0;
  const diff      = myScore - enemyScore;
  const remaining = myCards.length;

  // Stratégiai szöveg
  let strategyDesc = '';
  if (iStarted) {
    // Mi kezdtünk - vak döntés
    if (win <= 20) {
      strategyDesc = `💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Vak nyitásban a <strong>${suggestedCard}</strong>-es a legoptimálisabb — az ellenfél elpazarol egy nagy lapot ellene. Várható végpont: <strong>${ev.toFixed(2)}</strong>.`;
    } else if (diff >= 2 && remaining <= 4) {
      strategyDesc = `🛡️ <strong>ELŐNY TARTÁSA:</strong> Vezetsz +${diff}-vel. A <strong>${suggestedCard}</strong>-es minimalizálja a kockázatot (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else if (diff <= -2 && remaining <= 4) {
      strategyDesc = `⚡ <strong>FORDÍTÁS KELL:</strong> Lemaradsz! A <strong>${suggestedCard}</strong>-es adja a legjobb fordulási esélyt (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else {
      strategyDesc = `🎭 <strong>VAK NYITÁS:</strong> Nem látjuk az ellenfél hátlapját. A <strong>${suggestedCard}</strong>-es a legjobb várható végpontot adja (<strong>${ev.toFixed(2)}</strong>).`;
    }
  } else {
    // Ellenfél kezdett - látjuk a hátlapot
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
  const top4     = evList.slice(0, 4);
  const maxEV    = evList[0].ev;

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
        <span class="stat-label">Nyerési esély (kör)</span>
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
  selectedMine = (selectedMine === n) ? null : n;
  renderMyCards();
  renderOracle();
  updateChips();
  updateConfirmBtn();
}

function selectEnemyType(type) {
  selectedEnemy = (selectedEnemy === type) ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');

  // Ha ellenfél kezd és megadtuk a paritást: azonnal ajánlunk lapot
  if (!iStarted && selectedEnemy !== null && selectedMine === null) {
    autoSelectOracleCard();
  }

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
  const canConfirm = selectedMine !== null && selectedEnemy !== null && selectedResult !== null;
  document.getElementById('btnConfirm').disabled = !canConfirm;

  const hint = document.getElementById('confirmHint');
  if (!hint) return;

  if (!iStarted && selectedEnemy === null) {
    hint.textContent = 'Nézd meg az ellenfél hátlapját, kattints Páros/Páratlan!';
  } else if (selectedMine === null) {
    hint.textContent = 'Válaszd ki a javasolt lapot (vagy más lapot)!';
  } else if (selectedResult === null) {
    hint.textContent = 'Add meg a kör eredményét!';
  } else if (canConfirm) {
    hint.textContent = 'Minden adat megvan — rögzítheted!';
  } else {
    hint.textContent = 'Válassz lapot és eredményt!';
  }
}

// =============================================
//  DEDUKCIÓS LOGIKA
//  A kör végén szűkíti az ellenfél lehetséges kezét
//  az ismert paritás + eredmény alapján.
// =============================================
function deduceEnemyHands(myCard, enemyType, result) {
  let newHandsSet = new Set();
  const parityOk = enemyType === 'even' ? (c => c % 2 === 0) : (c => c % 2 !== 0);

  for (const hand of possibleEnemyHands) {
    let candidates = hand.filter(c => parityOk(c));

    if (result === 'win')  candidates = candidates.filter(c => c < myCard);
    else if (result === 'lose') candidates = candidates.filter(c => c > myCard);
    else if (result === 'draw') candidates = candidates.filter(c => c === myCard);

    for (const c of candidates) {
      const newHand = hand.filter(card => card !== c);
      newHandsSet.add(newHand.join(','));
    }
  }

  const newHands = [...newHandsSet].map(str =>
    str === '' ? [] : str.split(',').map(Number)
  );

  if (newHands.length === 0) {
    alert('Hiba: Ilyen eredmény nem lehetséges a jelenlegi lapok alapján! Ellenőrizd az adatbevitelt.');
    return possibleEnemyHands;
  }

  return newHands;
}

// =============================================
//  CONFIRM ROUND
// =============================================
function confirmRound() {
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;

  // Snapshot mentése undo-hoz
  history.push({
    myCards: [...myCards],
    possibleEnemyHands: possibleEnemyHands.map(h => [...h]),
    myScore, enemyScore, selectedMine, selectedEnemy, selectedResult, iStarted, roundNum
  });

  // Pontok frissítése
  if (selectedResult === 'win')  myScore++;
  else if (selectedResult === 'lose') enemyScore++;

  // Dedukció: ellenfél lehetséges kezeinek szűkítése
  possibleEnemyHands = deduceEnemyHands(selectedMine, selectedEnemy, selectedResult);

  // Saját lap kizárása
  myCards = myCards.filter(c => c !== selectedMine);

  // History napló bejegyzés
  const labels      = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
  const enemyLabel  = (selectedEnemy === 'even' ? 'Páros ⬛' : 'Páratlan ⬜')
                      + (iStarted ? ' (én kezdtem)' : '');
  const resultClass = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[selectedResult];

  roundNum++;
  addHistoryEntry(roundNum, selectedMine, enemyLabel, labels[selectedResult], resultClass);

  // Reset a következő körre
  selectedMine = null; selectedEnemy = null; selectedResult = null;

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

  selectedMine = null; selectedEnemy = null; selectedResult = null;
  clearActionButtons();

  autoSelectOracleCard();
  updateScoreBoard(); renderHistory();
  renderMyCards(); renderEnemyCards(); renderOracle();
  updateConfirmBtn(); updateChips();
}

function resetAll() {
  myCards = [...ALL_CARDS];
  possibleEnemyHands = [ [...ALL_CARDS] ];
  history = []; roundNum = 0;
  myScore = 0; enemyScore = 0;
  selectedMine = null; selectedEnemy = null; selectedResult = null;

  const chk = document.getElementById('chkIStart');
  if (chk) chk.checked = false;
  iStarted = false;

  clearActionButtons();
  autoSelectOracleCard();
  updateScoreBoard();
  renderMyCards(); renderEnemyCards(); renderOracle();
  updateConfirmBtn(); updateChips(); renderHistory();
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
