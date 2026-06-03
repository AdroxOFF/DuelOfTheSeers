// =============================================
//  LÁTÓK PÁRBAJA — ORACLE HELPER
//  app.js v2.1 (1-lépés előre, gyors, pontos)
// =============================================
//
//  Architektúra:
//  - Ellenfél modell: float[9] valószínűség tömb
//  - EV: 1 lépés előre (csak a JELENlegi kör), NINCS recursion
//  - Bayes-update a kör eredménye alapján
//  - Gyors: O(81) minden körben, azonnal számol
//
//  MIT JELENT AZ 1 LÉPÉS:
//  - Nem számoljuk végig a teljes játékot
//  - Csak a JELENLEGI kör nyerési esélyét nézzük
//  - Ha a körben 80% az esély, az jó lap
//  - Ez ELEGEDŐ a jó döntéshez
// =============================================

const ALL_CARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// ── Játékállapot ──────────────────────────────
let myCards = [];
let enemyProb = [];       // float[9]: P(ellenfél még tartja a lapot)
let myScore = 0;
let enemyScore = 0;
let roundNum = 0;

// ── Kör állapot ──────────────────────────────
let selectedMine = null;
let selectedEnemy = null;  // 'even' | 'odd' | null
let selectedResult = null; // 'win' | 'lose' | 'draw' | null
let iStarted = false;

// ── History (undo-hoz) ────────────────────────
let history = [];

// ============================================================
//  INICIALIZÁLÁS
// ============================================================

function init() {
  myCards = [...ALL_CARDS];
  enemyProb = new Array(9).fill(1.0);
  myScore = 0;
  enemyScore = 0;
  roundNum = 0;
  selectedMine = null;
  selectedEnemy = null;
  selectedResult = null;
  iStarted = false;
  history = [];

  const chk = document.getElementById('chkIStart');
  if (chk) {
    chk.checked = false;
    chk.disabled = false;
    chk.addEventListener('change', onToggleStart);
  }

  refreshAll();
  renderHistory();
}

function onToggleStart() {
  const chk = document.getElementById('chkIStart');
  iStarted = chk.checked;
  document.getElementById('toggleText').textContent = iStarted ? 'Én kezdem' : 'Ellenfél kezd';
  selectedEnemy = null;
  clearPairityActive();
  autoSelectCard();
  refreshAll();
}

// ============================================================
//  ELLENFÉL MODELL — float[9] valószínűség
// ============================================================

function getEnemyDist(parity) {
  const dist = enemyProb.slice();
  for (let i = 0; i < 9; i++) {
    if (parity === 'even' && i % 2 !== 0) dist[i] = 0;
    if (parity === 'odd'  && i % 2 === 0) dist[i] = 0;
  }
  const total = dist.reduce((s, v) => s + v, 0);
  if (total === 0) return dist;
  return dist.map(v => v / total);
}

function updateEnemyProb(myCard, parity, result) {
  const dist = getEnemyDist(parity);

  const possible = [];
  for (let ec = 0; ec < 9; ec++) {
    if (dist[ec] === 0) continue;
    const res = myCard > ec ? 'win' : myCard < ec ? 'lose' : 'draw';
    if (res === result) possible.push(ec);
  }

  if (possible.length === 0) return;

  let total = 0;
  for (let i = 0; i < 9; i++) {
    if (possible.includes(i)) {
      total += enemyProb[i];
    }
  }
  for (let i = 0; i < 9; i++) {
    if (!possible.includes(i)) {
      enemyProb[i] = 0;
    }
  }

  if (possible.length === 1) {
    enemyProb[possible[0]] = 0;
  } else {
    const maxP = Math.max(...possible.map(i => enemyProb[i]));
    const played = possible.find(i => enemyProb[i] === maxP);
    if (played !== undefined) enemyProb[played] = 0;
  }

  const newTotal = enemyProb.reduce((s, v) => s + v, 0);
  if (newTotal > 0) {
    for (let i = 0; i < 9; i++) enemyProb[i] /= newTotal;
  }
}

// ============================================================
//  EV SZÁMÍTÁS — 1 LÉPÉS ELŐRE (GYORS)
// ============================================================

function calculateFinalCoins(myS, enemyS) {
  const d = myS - enemyS;
  return d > 0 ? myS + d : myS;
}

// 1 LÉPÉS EV: csak a JELENLEGI kör nyerési esélyét nézzük
// NEM számoljuk végig a teljes játékot — EZ A GYORSÍTÁS
function cardEV(myCard, parity) {
  const dist = getEnemyDist(parity);
  let winProb = 0, loseProb = 0, drawProb = 0;

  for (let ec = 0; ec < 9; ec++) {
    if (dist[ec] === 0) continue;
    if (myCard > ec)      winProb  += dist[ec];
    else if (myCard < ec) loseProb += dist[ec];
    else                  drawProb += dist[ec];
  }

  // Ha veszítünk, az ellenfél kap pontot
  // Ha nyerünk, mi kapunk pontot + esetleg bónuszt
  // EV = várható pontváltozás a JELENLEGI körben

  const diff = myScore - enemyScore;
  const remaining = myCards.length - 1;

  // Ha most nyerünk:
  // - mi kapunk 1 pontot
  // - ha vezettünk, a bónusz növekszik
  // Ha most veszítünk:
  // - ellenfél kap 1 pontot
  // - ha vezettünk, a bónusz csökkenhet

  // EGYSZERŰSÍTETT EV: csak a nyerési esélyt nézzük
  // 0-100 skála, minél magasabb, annál jobb
  let ev = winProb * 100;

  // Ha nagyon vezetünk (+2 vagy több), a kis lap is jó (kockázatmentes)
  // Ha nagyon lemaradunk (-2 vagy több), a nagy lap kell (fordítás)
  if (diff >= 2) {
    // Vezetünk — kis lapok biztonságosak
    if (myCard <= 3) ev += 10;
  } else if (diff <= -2) {
    // Lemaradunk — nagy lap kell a fordításhoz
    if (myCard >= 5) ev += 15;
  }

  // Ha döntetlenre állunk, a közepes lap is jó
  if (diff === 0) {
    if (myCard >= 3 && myCard <= 5) ev += 5;
  }

  return ev;
}

function cardWinLoseDraw(myCard, parity) {
  const dist = getEnemyDist(parity);
  let win = 0, lose = 0, draw = 0;

  for (let ec = 0; ec < 9; ec++) {
    if (dist[ec] === 0) continue;
    if (myCard > ec)      win  += dist[ec];
    else if (myCard < ec) lose += dist[ec];
    else                  draw += dist[ec];
  }

  return {
    win:  Math.round(win  * 100),
    lose: Math.round(lose * 100),
    draw: Math.round(draw * 100)
  };
}

function getAllCardEVs(parity) {
  const losePrefer = myScore < enemyScore;

  return myCards
    .map(c => ({
      card: c,
      ev: cardEV(c, parity),
      ...cardWinLoseDraw(c, parity)
    }))
    .sort((a, b) => {
      const diff = b.ev - a.ev;
      if (Math.abs(diff) > 0.001) return diff;
      return losePrefer ? b.card - a.card : a.card - b.card;
    });
}

// ============================================================
//  AUTO-SELECT — Oracle automatikusan kiválaszt
// ============================================================

function autoSelectCard() {
  const evs = getAllCardEVs(selectedEnemy);
  if (evs.length > 0) {
    selectedMine = evs[0].card;
  }
}

// ============================================================
//  EREDMÉNY GOMBOK ELÉRHETŐSÉGE
// ============================================================

function getResultAvailability() {
  if (selectedMine === null || selectedEnemy === null) {
    return { win: false, lose: false, draw: false };
  }

  const dist = getEnemyDist(selectedEnemy);
  const av = { win: false, lose: false, draw: false };

  for (let ec = 0; ec < 9; ec++) {
    if (dist[ec] === 0) continue;
    if (ec < selectedMine) av.win  = true;
    if (ec > selectedMine) av.lose = true;
    if (ec === selectedMine) av.draw = true;
  }

  return av;
}

// ============================================================
//  RENDER FÜGGVÉNYEK — UGYANAZ, MINT V2.0-BAN
// ============================================================

function refreshAll() {
  renderScoreBoard();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  renderActionButtons();
  updateChips();
  updateConfirmBtn();
}

function renderScoreBoard() {
  document.getElementById('scoreMine').textContent  = myScore;
  document.getElementById('scoreEnemy').textContent = enemyScore;

  const diff = myScore - enemyScore;
  const coins = calculateFinalCoins(myScore, enemyScore);
  const diffEl = document.getElementById('scoreDiff');
  const projEl = document.getElementById('finalScoreProj');

  if (diff > 0) {
    diffEl.textContent = `Vezetsz: +${diff}`;
    diffEl.style.color = 'var(--emerald-light)';
    diffEl.style.borderColor = 'var(--emerald)';
  } else if (diff < 0) {
    diffEl.textContent = `Hátrány: ${diff}`;
    diffEl.style.color = 'var(--crimson-light)';
    diffEl.style.borderColor = 'var(--crimson)';
  } else {
    diffEl.textContent = 'Döntetlen';
    diffEl.style.color = 'var(--text-dim)';
    diffEl.style.borderColor = 'var(--border)';
  }

  if (myCards.length === 0) {
    if (myScore > enemyScore) {
      projEl.innerHTML = `🏆 Játék vége! Győzelem! Végső érme: <strong style="color:var(--emerald-light);font-size:16px;">${coins}</strong>`;
    } else if (enemyScore > myScore) {
      projEl.innerHTML = `💀 Játék vége! Vereség. Megszerzett érme: ${coins}`;
    } else {
      projEl.innerHTML = `🤝 Játék vége! Döntetlen. Megszerzett érme: ${coins}`;
    }
  } else {
    if (diff > 0) {
      projEl.innerHTML = `Ha most nyernél, a végső érme: <strong style="color:var(--gold-light);font-size:15px;">${coins}</strong> lenne.`;
    } else {
      projEl.innerHTML = `Várható végeredmény: <span style="color:var(--text-dim)">Jelenleg nincs bónusz pont. (Alap: ${myScore})</span>`;
    }
  }
}

function renderMyCards() {
  const container = document.getElementById('myCardsRow');
  container.innerHTML = '';

  const oddRow  = document.createElement('div');
  oddRow.className  = 'cards-sub-row';
  const evenRow = document.createElement('div');
  evenRow.className = 'cards-sub-row';

  const evs = getAllCardEVs(selectedEnemy);
  const evMap = {};
  evs.forEach(x => { evMap[x.card] = x; });
  const maxEV = evs.length > 0 ? evs[0].ev : 0;

  ALL_CARDS.forEach(n => {
    const isEven  = n % 2 === 0;
    const inHand  = myCards.includes(n);
    const isSel   = n === selectedMine;

    const btn = document.createElement('button');
    btn.className = [
      'card-btn',
      isEven ? 'even' : 'odd',
      !inHand ? 'used' : '',
      isSel   ? 'selected-mine' : ''
    ].filter(Boolean).join(' ');
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
      if (Math.abs(ev - maxEV) < 0.001) badge.classList.add('chance-100');
      else if (ev >= maxEV * 0.92)      badge.classList.add('chance-high');
    } else {
      badge.textContent  = '—';
      badge.style.opacity = '0.3';
    }
    btn.appendChild(badge);

    if (inHand) btn.onclick = () => selectMyCard(n);

    if (isEven) evenRow.appendChild(btn);
    else         oddRow.appendChild(btn);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);
}

function renderEnemyCards() {
  const container = document.getElementById('enemyCardsRow');
  container.innerHTML = '';

  const oddRow  = document.createElement('div');
  oddRow.className  = 'cards-sub-row';
  const evenRow = document.createElement('div');
  evenRow.className = 'cards-sub-row';

  const dist = getEnemyDist(selectedEnemy);

  ALL_CARDS.forEach(n => {
    const isEven  = n % 2 === 0;
    const chance  = Math.round(dist[n] * 100);
    const possible = chance > 0;

    const slot = document.createElement('div');
    slot.className = [
      'enemy-card-slot',
      isEven ? 'enemy-even' : 'enemy-odd',
      possible ? 'possible' : 'eliminated'
    ].join(' ');

    const numSpan = document.createElement('span');
    numSpan.textContent = n;
    slot.appendChild(numSpan);

    if (possible) {
      const chanceDiv = document.createElement('div');
      chanceDiv.className = 'enemy-chance';
      if (chance === 100)     chanceDiv.classList.add('sure-chance');
      else if (chance >= 70)  chanceDiv.classList.add('high-chance');
      else if (chance <= 30)  chanceDiv.classList.add('low-chance');
      chanceDiv.textContent = chance + '%';
      slot.appendChild(chanceDiv);
    }

    if (isEven) evenRow.appendChild(slot);
    else         oddRow.appendChild(slot);
  });

  container.appendChild(oddRow);
  container.appendChild(evenRow);

  const possibleCount = dist.filter(v => v > 0).length;
  const countEl = document.getElementById('enemyCount');
  if (countEl) {
    const pLabel = selectedEnemy === 'even' ? ' · páros szűrő'
                 : selectedEnemy === 'odd'  ? ' · páratlan szűrő' : '';
    countEl.textContent = `Lehetséges: ${possibleCount} / 9${pLabel}`;
  }

  const comboEl = document.getElementById('comboCount');
  if (comboEl) {
    comboEl.textContent = `Ismert eloszlás alapján ${possibleCount} lap lehetséges`;
  }
}

function renderOracle() {
  const body = document.getElementById('oracleBody');
  if (!body) return;

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">Játék vége!</div></div>`;
    return;
  }

  const evs = getAllCardEVs(selectedEnemy);
  if (evs.length === 0) return;

  const shown = selectedMine !== null
    ? (evs.find(x => x.card === selectedMine) || evs[0])
    : evs[0];

  const { card, ev, win, lose, draw } = shown;
  const isEven = card % 2 === 0;
  const diff = myScore - enemyScore;
  const remaining = myCards.length;

  let stratText = '';
  const parLabel = selectedEnemy === 'even' ? 'PÁROS' : selectedEnemy === 'odd' ? 'PÁRATLAN' : '?';

  if (selectedEnemy === null) {
    stratText = `🎭 <strong>Paritást még nem adtál meg.</strong> Válaszd ki az ellenfél lapjának paritását a pontos javaslathoz.`;
  } else if (iStarted) {
    if (win <= 20) {
      stratText = `💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Vak nyitásban a <strong>${card}</strong>-es a legoptimálisabb — az ellenfél elpazarol egy nagy lapot. EV: <strong>${ev.toFixed(2)}</strong>.`;
    } else if (diff >= 2 && remaining <= 4) {
      stratText = `🛡️ <strong>ELŐNY TARTÁSA:</strong> Vezetsz +${diff}-vel. A <strong>${card}</strong>-es minimalizálja a kockázatot (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else if (diff <= -2 && remaining <= 4) {
      stratText = `⚡ <strong>FORDÍTÁS KELL:</strong> Lemaradsz! A <strong>${card}</strong>-es adja a legjobb fordulási esélyt (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else {
      stratText = `🎭 <strong>VAK NYITÁS (${parLabel}):</strong> A <strong>${card}</strong>-es a legjobb várható végpontot adja (EV: <strong>${ev.toFixed(2)}</strong>).`;
    }
  } else {
    if (win >= 80) {
      stratText = `🔥 <strong>BIZTOS PONT:</strong> ${parLabel} ellen a <strong>${card}</strong>-es <strong>${win}%</strong> eséllyel nyer. EV: <strong>${ev.toFixed(2)}</strong>.`;
    } else if (win >= 50) {
      stratText = `⚔️ <strong>ELŐNYÖS:</strong> ${parLabel} ellen a <strong>${card}</strong>-es <strong>${win}%</strong> nyerési eséllyel a legjobb (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else if (diff >= 2 && remaining <= 3) {
      stratText = `🛡️ <strong>VÉDEKEZÉS:</strong> Vezetsz +${diff}-vel, ${remaining} kör van hátra. A <strong>${card}</strong>-es óvja az előnyt (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else if (diff <= -2 && remaining <= 4) {
      stratText = `⚡ <strong>VISSZATÁMADÁS:</strong> Lemaradsz ${Math.abs(diff)}-vel! A <strong>${card}</strong>-es adja a maximális fordulási esélyt (EV: <strong>${ev.toFixed(2)}</strong>).`;
    } else {
      stratText = `⚖️ <strong>OPTIMÁLIS (${parLabel}):</strong> A <strong>${card}</strong>-es a legjobb választás (EV: <strong>${ev.toFixed(2)}</strong>).`;
    }
  }

  const winColor = win >= 60 ? 'stat-val-green' : win >= 35 ? 'stat-val-gold' : 'stat-val-red';
  const top4 = evs.slice(0, 4);
  const maxEV = evs.length > 0 ? evs[0].ev : 1;

  body.innerHTML = `
    <div class="oracle-suggestion">
      <div>
        <div class="oracle-card ${isEven ? 'oracle-even' : 'oracle-odd'}"
             style="${!isEven ? 'color:#1a1400;' : ''}">${card}</div>
      </div>
    </div>
    <div class="oracle-text">
      <div class="oracle-main-text" style="font-size:11.5px;">${stratText}</div>
    </div>
    <div class="oracle-stats">
      <div class="oracle-stat-row">
        <span class="stat-label">EV (egyszerűsített)</span>
        <span class="stat-val-green" style="font-weight:700;">${ev.toFixed(1)}</span>
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
        LAP RANGSOR — 1 lépés előre
      </div>
      ${top4.map(item => {
        const isSel   = item.card === card;
        const itemEven = item.card % 2 === 0;
        const barW = maxEV > 0 ? Math.max(4, Math.round((item.ev / maxEV) * 60)) : 4;
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
                  style="${isSel ? 'font-weight:700;' : ''}">${item.ev.toFixed(1)}</span>
          </span>
        </div>`;
      }).join('')}
    </div>`;
}

function renderActionButtons() {
  const av = getResultAvailability();

  document.getElementById('btnWin').disabled  = !av.win;
  document.getElementById('btnLose').disabled = !av.lose;
  document.getElementById('btnDraw').disabled = !av.draw;

  if (selectedResult && !av[selectedResult]) {
    selectedResult = null;
    document.getElementById('btnWin').classList.remove('active');
    document.getElementById('btnLose').classList.remove('active');
    document.getElementById('btnDraw').classList.remove('active');
  }
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
  const btn  = document.getElementById('btnConfirm');
  const hint = document.getElementById('confirmHint');

  const av = getResultAvailability();
  const canConfirm =
    selectedMine   !== null &&
    selectedEnemy  !== null &&
    selectedResult !== null &&
    av[selectedResult];

  btn.disabled = !canConfirm;

  if (!hint) return;

  if (selectedEnemy === null) {
    hint.textContent = '⬛⬜ Add meg az ellenfél lapjának paritását!';
  } else if (selectedMine === null) {
    hint.textContent = '🃏 Válassz lapot (vagy fogadd el az Oracle javaslatát)!';
  } else if (!selectedResult) {
    hint.textContent = '🎯 Add meg a kör eredményét!';
  } else if (canConfirm) {
    hint.textContent = '✅ Minden adat megvan — rögzítheted!';
  } else {
    hint.textContent = 'Válassz lapot és eredményt!';
  }
}

// ============================================================
//  EVENT HANDLEREK — UGYANAZ, MINT V2.0-BAN
// ============================================================

function selectMyCard(n) {
  if (!myCards.includes(n)) return;
  selectedMine = n;
  refreshAll();
}

function selectEnemyType(type) {
  selectedEnemy = selectedEnemy === type ? null : type;
  document.getElementById('btnEven').classList.toggle('active', selectedEnemy === 'even');
  document.getElementById('btnOdd').classList.toggle('active',  selectedEnemy === 'odd');

  autoSelectCard();
  refreshAll();
}

function selectResult(res) {
  const av = getResultAvailability();
  if (!av[res]) return;

  selectedResult = selectedResult === res ? null : res;
  document.getElementById('btnWin').classList.toggle('active',  selectedResult === 'win');
  document.getElementById('btnLose').classList.toggle('active', selectedResult === 'lose');
  document.getElementById('btnDraw').classList.toggle('active', selectedResult === 'draw');

  updateChips();
  updateConfirmBtn();
}

function confirmRound() {
  const av = getResultAvailability();
  if (selectedMine === null || selectedEnemy === null || selectedResult === null) return;
  if (!av[selectedResult]) return;

  history.push({
    myCards:      [...myCards],
    enemyProb:    [...enemyProb],
    myScore,
    enemyScore,
    roundNum,
    iStarted,
    selectedMine,
    selectedEnemy,
    selectedResult
  });

  if (selectedResult === 'win')  myScore++;
  else if (selectedResult === 'lose') enemyScore++;

  updateEnemyProb(selectedMine, selectedEnemy, selectedResult);

  myCards = myCards.filter(c => c !== selectedMine);

  const labels    = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
  const cls       = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' };
  const parLabel  = (selectedEnemy === 'even' ? 'Páros ⬛' : 'Páratlan ⬜')
                  + (iStarted ? ' (én)' : '');
  roundNum++;
  addHistoryEntry(roundNum, selectedMine, parLabel, labels[selectedResult], cls[selectedResult]);

  if (roundNum === 1) {
    const chk = document.getElementById('chkIStart');
    if (chk) chk.disabled = true;
  }

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;
  clearAllActive();

  autoSelectCard();
  refreshAll();
}

// ============================================================
//  HISTORY / UNDO / RESET — UGYANAZ, MINT V2.0-BAN
// ============================================================

function addHistoryEntry(round, mine, enemy, result, cls) {
  const list = document.getElementById('historyList');
  const empty = list.querySelector('.history-empty');
  if (empty) list.innerHTML = '';

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
    const labels   = { win: 'Nyertem', lose: 'Vesztettem', draw: 'Döntetlen' };
    const cls      = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' };
    const parLabel = (h.selectedEnemy === 'even' ? 'Páros ⬛' : 'Páratlan ⬜')
                   + (h.iStarted ? ' (én)' : '');
    addHistoryEntry(i + 1, h.selectedMine, parLabel, labels[h.selectedResult], cls[h.selectedResult]);
  });
}

function undoLast() {
  if (history.length === 0) return;
  const snap = history.pop();

  myCards    = snap.myCards;
  enemyProb  = snap.enemyProb;
  myScore    = snap.myScore;
  enemyScore = snap.enemyScore;
  roundNum   = snap.roundNum;
  iStarted   = snap.iStarted;

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;
  clearAllActive();

  const chk = document.getElementById('chkIStart');
  if (chk) {
    chk.checked  = iStarted;
    chk.disabled = snap.roundNum === 0 ? false : true;
    document.getElementById('toggleText').textContent = iStarted ? 'Én kezdem' : 'Ellenfél kezd';
  }

  autoSelectCard();
  renderHistory();
  refreshAll();
}

function resetAll() {
  myCards    = [...ALL_CARDS];
  enemyProb  = new Array(9).fill(1.0);
  myScore    = 0;
  enemyScore = 0;
  roundNum   = 0;
  history    = [];

  selectedMine   = null;
  selectedEnemy  = null;
  selectedResult = null;
  iStarted       = false;
  clearAllActive();

  const chk = document.getElementById('chkIStart');
  if (chk) {
    chk.checked  = false;
    chk.disabled = false;
    document.getElementById('toggleText').textContent = 'Ellenfél kezd';
  }

  autoSelectCard();
  renderHistory();
  refreshAll();
}

function clearAllActive() {
  ['btnEven', 'btnOdd', 'btnWin', 'btnLose', 'btnDraw'].forEach(id =>
    document.getElementById(id).classList.remove('active')
  );
}

function clearPairityActive() {
  ['btnEven', 'btnOdd'].forEach(id =>
    document.getElementById(id).classList.remove('active')
  );
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    resetAll();
  } else if (e.key === 'Backspace' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    undoLast();
  }
});

init();
