// =============================================
//  LÁTÓK PÁRBAJA — AUTOMATA PONTMAXIMALIZÁLÓ
//  app.js (v4.4 - Kéz-előfordulás Alapú Súlyozás)
// =============================================

// =============================================
//  FORDÍTÁSI RENDSZER (HU / EN)
// =============================================
let currentLang = 'hu';

const TRANSLATIONS = {
  hu: {
    title:          'Látók Párbaja',
    subtitle:       'Pontmaximalizáló AI Rendszer v4.4',
    ownScore:       'Saját Pont',
    enemyScore:     'Ellenfél Pont',
    draw:           'Döntetlen',
    leading:        'Vezetsz',
    trailing:       'Hátrány',
    finalWin:       '🏆 Játék vége! Győzelem! Végső pontszám:',
    finalLose:      '💀 Játék vége! Vereség.',
    finalDraw:      '🤝 Játék vége! Döntetlen.',
    projWin:        'Ha most nyernél, a végső pontod:',
    projWinSuffix:  'lenne.',
    projNone:       'Várható végeredmény: Jelenleg nincs bónusz pont.',
    chipMine:       'Lapom',
    chipEnemy:      'Ellenfél',
    chipResult:     'Eredmény',
    chipEven:       'Páros',
    chipOdd:        'Páratlan',
    resWin:         'Nyertem',
    resLose:        'Vesztettem',
    resDraw:        'Döntetlen',
    step0:          '⓪ Ki kezdi a kört?',
    enemyStarts:    'Ellenfél kezd',
    iStart:         'Én kezdem',
    step1:          '① Ellenfél lépése',
    btnEven:        '⬛ Páros',
    btnOdd:         '⬜ Páratlan',
    step2:          '② Kör eredménye',
    btnWin:         '✦ Nyertem',
    btnLose:        '✧ Vesztettem',
    btnDraw:        '◈ Döntetlen',
    step3:          '③ Megerősítés',
    btnConfirm:     '⟳ Rögzítés',
    confirmHint:    'Válassz lapot és eredményt!',
    myCards:        'Saját lapjaim',
    enemyCards:     'Ellenfél lehetséges lapjai',
    possible:       'Lehetséges',
    combos:         'Ellenfél lehetséges kombinációi',
    oracleTitle:    'Taktikai Javaslat',
    oracleWait:     'Várom, hogy az ellenfél lapot tegyen...',
    oracleEnd:      'Játék vége!',
    historyTitle:   'Kör Napló',
    historyEmpty:   'Még nincs lejátszott kör.',
    strAttack:      '🔥 <strong>BIZTOS PONT:</strong> A <strong>$c</strong>-es lappal <strong>$w%</strong> eséllyel nyered a kört, és ez adja a legjobb várható végpontot (EV: <strong>$ev</strong>).',
    strBalance:     '⚖️ <strong>LEGJOBB KOMPROMISSZUM:</strong> A <strong>$c</strong>-es lap nyerési esélye <strong>$w%</strong>, és a 2 körös előretekintés szerint ez maximalizálja a várható végső pontot (EV: <strong>$ev</strong>).',
    strDefend:      '🛡️ <strong>DÖNTETLEN MENTÉS:</strong> Nyerni nehéz, de a <strong>$c</strong>-es lappal <strong>$d%</strong> eséllyel kimentünk egy döntetlent. Az EV-keresés szerint ez a legjobb hosszú távú döntés (EV: <strong>$ev</strong>).',
    strSacrifice:   '💀 <strong>TAKTIKAI ÁLDOZAT:</strong> Nincs jó lapod ebben a körben. A <strong>$c</strong>-es a legkisebb veszteség — az EV-keresés szerint ez áldozza el a legkevesebb pontot hosszú távon (EV: <strong>$ev</strong>).',
    statWin:        'Nyerési esély',
    statLose:       'Veszítési esély',
    statDraw:       'Döntetlen esély',
    statEVLabel:    '— Lap EV (várható végpont) —',
    cardLabel:      'Lap',
  },
  en: {
    title:          'Seers\' Duel',
    subtitle:       'Score Maximizer AI System v4.4',
    ownScore:       'My Score',
    enemyScore:     'Enemy Score',
    draw:           'Tied',
    leading:        'Leading',
    trailing:       'Behind',
    finalWin:       '🏆 Game over! Victory! Final score:',
    finalLose:      '💀 Game over! Defeat.',
    finalDraw:      '🤝 Game over! Draw.',
    projWin:        'If you win now, your final score would be:',
    projWinSuffix:  '',
    projNone:       'Projection: No bonus points at the moment.',
    chipMine:       'My card',
    chipEnemy:      'Enemy',
    chipResult:     'Result',
    chipEven:       'Even',
    chipOdd:        'Odd',
    resWin:         'Won',
    resLose:        'Lost',
    resDraw:        'Draw',
    step0:          '⓪ Who starts?',
    enemyStarts:    'Enemy starts',
    iStart:         'I start',
    step1:          '① Enemy\'s move',
    btnEven:        '⬛ Even',
    btnOdd:         '⬜ Odd',
    step2:          '② Round result',
    btnWin:         '✦ I won',
    btnLose:        '✧ I lost',
    btnDraw:        '◈ Draw',
    step3:          '③ Confirm',
    btnConfirm:     '⟳ Confirm',
    confirmHint:    'Select a card and a result!',
    myCards:        'My Cards',
    enemyCards:     'Enemy\'s possible cards',
    possible:       'Possible',
    combos:         'Enemy possible combinations',
    oracleTitle:    'Tactical Suggestion',
    oracleWait:     'Waiting for enemy to play a card...',
    oracleEnd:      'Game over!',
    historyTitle:   'Round Log',
    historyEmpty:   'No rounds played yet.',
    strAttack:      '🔥 <strong>SURE POINT:</strong> Card <strong>$c</strong> wins the round with <strong>$w%</strong> probability and gives the best expected final score (EV: <strong>$ev</strong>).',
    strBalance:     '⚖️ <strong>BEST COMPROMISE:</strong> Card <strong>$c</strong> has a <strong>$w%</strong> win chance, and the 2-round lookahead says this maximizes expected final score (EV: <strong>$ev</strong>).',
    strDefend:      '🛡️ <strong>DRAW SAVE:</strong> Winning is unlikely, but card <strong>$c</strong> saves a draw with <strong>$d%</strong> probability. EV search confirms this is the best long-term play (EV: <strong>$ev</strong>).',
    strSacrifice:   '💀 <strong>TACTICAL SACRIFICE:</strong> No good card this round. Card <strong>$c</strong> is the smallest loss — EV search confirms this wastes the least points long-term (EV: <strong>$ev</strong>).',
    statWin:        'Win chance',
    statLose:       'Loss chance',
    statDraw:       'Draw chance',
    statEVLabel:    '— Card EV (expected final score) —',
    cardLabel:      'Card',
  }
};

function T(key) {
  return (TRANSLATIONS[currentLang] || TRANSLATIONS['hu'])[key] || key;
}

function setLang(lang) {
  currentLang = lang;
  document.getElementById('langHU').classList.toggle('lang-active', lang === 'hu');
  document.getElementById('langEN').classList.toggle('lang-active', lang === 'en');
  // Statikus szövegek frissítése
  document.querySelector('.title-rune').textContent  = `⚔ ${T('title')} ⚔`;
  document.querySelector('.title-sub').textContent   = T('subtitle');
  document.getElementById('scoreMine').previousElementSibling.textContent   = T('ownScore');
  document.getElementById('scoreEnemy').previousElementSibling.textContent  = T('enemyScore');
  document.querySelector('.step-title:nth-of-type(1)') // ne törjük el, inkább querySelectorAll
  document.querySelectorAll('.step-title')[0].textContent = T('step0');
  document.querySelectorAll('.step-title')[1].textContent = T('step1');
  document.querySelectorAll('.step-title')[2].textContent = T('step2');
  document.querySelectorAll('.step-title')[3].textContent = T('step3');
  document.getElementById('btnEven').textContent    = T('btnEven');
  document.getElementById('btnOdd').textContent     = T('btnOdd');
  document.getElementById('btnWin').textContent     = T('btnWin');
  document.getElementById('btnLose').textContent    = T('btnLose');
  document.getElementById('btnDraw').textContent    = T('btnDraw');
  document.getElementById('btnConfirm').textContent = T('btnConfirm');
  document.getElementById('confirmHint').textContent = T('confirmHint');
  document.querySelector('.panel-title').textContent; // ne törd el
  document.querySelectorAll('.panel-title')[0].innerHTML = `<span style="color:var(--purple-light);font-size:8px;">◆</span> ${T('myCards')}`;
  document.querySelectorAll('.panel-title')[1].innerHTML = `<span style="color:var(--purple-light);font-size:8px;">◆</span> ${T('enemyCards')}`;
  document.querySelectorAll('.panel-title')[2].innerHTML = `<span style="color:var(--purple-light);font-size:8px;">◆</span> ${T('historyTitle')}`;
  document.querySelector('.oracle-title').textContent = T('oracleTitle');
  const toggleText = document.getElementById('toggleText');
  if (toggleText) toggleText.textContent = document.getElementById('chkIStart').checked ? T('iStart') : T('enemyStarts');
  // Dinamikus részek újrarenderelése
  updateScoreBoard();
  updateChips();
  renderMyCards();
  renderEnemyCards();
  renderOracle();
  renderHistory();
}

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
    diffEl.textContent = `${T('leading')}: +${diff}`;
    diffEl.style.color = 'var(--emerald-light)';
    diffEl.style.borderColor = 'var(--emerald)';
  } else if (diff < 0) {
    diffEl.textContent = `${T('trailing')}: ${diff}`;
    diffEl.style.color = 'var(--crimson-light)';
    diffEl.style.borderColor = 'var(--crimson)';
  } else {
    diffEl.textContent = T('draw');
    diffEl.style.color = 'var(--text-dim)';
    diffEl.style.borderColor = 'var(--border)';
  }

  let finalProj = document.getElementById('finalScoreProj');
  if (myCards.length === 0) {
    if (myScore > enemyScore) {
       let final = myScore + diff;
       finalProj.innerHTML = `${T('finalWin')} <strong style="color:var(--emerald-light); font-size:16px;">${final}</strong>`;
    } else if (enemyScore > myScore) {
       finalProj.innerHTML = T('finalLose');
    } else {
       finalProj.innerHTML = T('finalDraw');
    }
  } else {
    if (myScore > enemyScore) {
       let projected = myScore + diff;
       finalProj.innerHTML = `${T('projWin')} <strong style="color:var(--gold-light); font-size:15px;">${projected}</strong> ${T('projWinSuffix')}`;
    } else {
       finalProj.innerHTML = `<span style="color:var(--text-dim)">${T('projNone')}</span>`;
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

  // Ha ki van választva paritás, a NEM megfelelő színű lapok elhalványulnak
  const paritySelected = (!iStarted && selectedEnemy !== null) ? selectedEnemy : null;

  ALL_CARDS.forEach(n => {
    const isEven = n % 2 === 0;
    const chance = calcEnemyCardChance(n);
    const possible = chance > 0;

    // Paritás-eltérés: ha párost nyomtak, a páratlan lapok kiszürkülnek (és fordítva)
    const parityMismatch = paritySelected !== null && (
      (paritySelected === 'even' && !isEven) ||
      (paritySelected === 'odd'  &&  isEven)
    );

    const slot = document.createElement('div');
    slot.className = [
      'enemy-card-slot',
      isEven ? 'enemy-even' : 'enemy-odd',
      possible ? 'possible' : 'eliminated',
      parityMismatch ? 'parity-out' : ''
    ].filter(Boolean).join(' ');

    const numSpan = document.createElement('span');
    numSpan.textContent = n;
    slot.appendChild(numSpan);

    if (possible && !parityMismatch) {
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

  // Státuszsor frissítése
  const remaining = ALL_CARDS.filter(n => calcEnemyCardChance(n) > 0);
  const possibleEl = document.getElementById('enemyCount');
  if (possibleEl) possibleEl.textContent = `${T('possible')}: ${remaining.length} / 9`;
  const comboEl = document.getElementById('comboCount');
  if (comboEl) comboEl.textContent = `${T('combos')}: ${possibleEnemyHands.length}`;
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
  const evStr = ev.toFixed(2);
  if (s.win >= 70)
    return T('strAttack').replace('$c', card).replace('$w', s.win).replace('$ev', evStr);
  if (s.win >= 45)
    return T('strBalance').replace('$c', card).replace('$w', s.win).replace('$ev', evStr);
  if (s.draw >= 50)
    return T('strDefend').replace('$c', card).replace('$d', s.draw).replace('$ev', evStr);
  return T('strSacrifice').replace('$c', card).replace('$ev', evStr);
}

function renderOracle() {
  const body = document.getElementById('oracleBody');

  if (myCards.length === 0) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text">${T('oracleEnd')}</div></div>`;
    return;
  }

  const result = getBestCardEV();
  if (!result || result.bestCard === null) {
    body.innerHTML = `<div class="oracle-text"><div class="oracle-main-text" style="color:var(--text-dim);">${T('oracleWait')}</div></div>`;
    return;
  }

  const { bestCard, bestEv, allEvs, currentRoundStats } = result;
  const isEven = bestCard % 2 === 0;
  const s = currentRoundStats[bestCard];

  const sortedEvs = [...allEvs].sort((a, b) => b.ev - a.ev);
  const secondBestEv = sortedEvs.length > 1 ? sortedEvs[1].ev : bestEv;

  const strategyDesc = getStrategyLabel(bestCard, bestEv, s, secondBestEv);
  const winColor = s.win >= 60 ? 'stat-val-green' : s.win >= 40 ? 'stat-val-gold' : 'stat-val-red';
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
        <span class="stat-label">${T('statWin')}</span>
        <span class="${winColor}">${s.win}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">${T('statLose')}</span>
        <span class="stat-val-red">${s.lose}%</span>
      </div>
      <div class="oracle-stat-row">
        <span class="stat-label">${T('statDraw')}</span>
        <span class="stat-val-purple">${s.draw}%</span>
      </div>
      <div style="height:1px; background:var(--border); margin:6px 0;"></div>
      <div class="oracle-stat-row" style="opacity:0.5; font-size:10px;">
        <span class="stat-label">${T('statEVLabel')}</span>
      </div>
      ${topCards.map(({ card, ev }) => {
        const isBest = card === bestCard;
        const cls = isBest ? 'stat-val-green' : ev >= bestEv - 0.3 ? 'stat-val-gold' : 'stat-val-red';
        return `
        <div class="oracle-stat-row">
          <span class="stat-label">${isBest ? '★ ' : ''}${T('cardLabel')} ${card}</span>
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

  cm.textContent = selectedMine !== null ? `${T('chipMine')}: ${selectedMine}` : `${T('chipMine')}: —`;
  cm.className   = selectedMine !== null ? 'status-chip chip-mine' : 'status-chip chip-none';

  ce.textContent = selectedEnemy
    ? `${T('chipEnemy')}: ${selectedEnemy === 'even' ? T('chipEven') : T('chipOdd')}`
    : `${T('chipEnemy')}: —`;
  ce.className   = selectedEnemy ? 'status-chip chip-enemy' : 'status-chip chip-none';

  if (selectedResult) {
    const labels = { win: T('resWin'), lose: T('resLose'), draw: T('resDraw') };
    const cls    = { win: 'chip-result-win', lose: 'chip-result-lose', draw: 'chip-result-draw' };
    cr.textContent = `${T('chipResult')}: ${labels[selectedResult]}`;
    cr.className   = `status-chip ${cls[selectedResult]}`;
  } else {
    cr.textContent = `${T('chipResult')}: —`;
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

  const labels = { win: T('resWin'), lose: T('resLose'), draw: T('resDraw') };
  const enemyLabel = (selectedEnemy === 'even' ? T('chipEven') : T('chipOdd')) + (iStarted ? ` (${T('iStart')})` : '');
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
  const meLabel = currentLang === 'en' ? 'Me' : 'Én';
  const enLabel = currentLang === 'en' ? 'En' : 'Ell';
  entry.innerHTML = `<span class="h-round">#${round}</span> <span class="h-mine">${meLabel}: ${mine}</span> <span class="h-enemy">${enLabel}: ${enemy}</span> <span class="${cls}">${result}</span>`;
  list.appendChild(entry);
}

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = `<div class="history-empty">${T('historyEmpty')}</div>`;
    return;
  }
  history.forEach((h, i) => {
    const labels = { win: T('resWin'), lose: T('resLose'), draw: T('resDraw') };
    const cls = { win: 'h-win', lose: 'h-lose', draw: 'h-draw' }[h.selectedResult];
    const enemyLabel = (h.selectedEnemy === 'even' ? T('chipEven') : T('chipOdd')) + (h.iStarted ? ` (${T('iStart')})` : '');
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
