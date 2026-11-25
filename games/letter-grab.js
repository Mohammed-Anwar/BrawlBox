/* Letter Grab (shared board). Everyone shares one 10x10 letter grid.
   Drag a straight line across or down to spell a word. A found word is replaced on the shared board.
   Each board has a category: its hidden category words are easy to spot, and they earn a bonus.
   Score = letters + bonus for long words + bonus for category words. */
(() => {
  // ---- Tuning (change these) ----
  const BOARD_SIZE = 10;
  const MIN_WORD_LENGTH = 3;          // shortest word you can submit
  const PLANTED_WORDS = 6;            // category words hidden in each new board
  const PLACE_TRIES = 60;             // attempts to fit each hidden word
  const LONG_WORD_FROM = 5;           // words this long or longer get the long-word bonus
  const LONG_BONUS_PER_LETTER = 2;    // extra points per letter past the 4th
  const CATEGORY_BONUS = 3;           // extra points for a word in the board's category

  const LETTER_POOL =
    'EEEEEEEEAAAAAAAIIIIIIIOOOOOO' +
    'NNNNNNRRRRRRSSSSSSTTTTTLLLLL' +
    'DDDDGGGBBBCCCMMPPFFHHVVWWYYKJXQZ';

  const CATEGORIES = {
    animals: {
      name: '🐾 Animals',
      words: ['cat', 'dog', 'cow', 'pig', 'hen', 'bee', 'ant', 'owl', 'bat', 'fox', 'elk', 'bear',
        'lion', 'duck', 'frog', 'goat', 'seal', 'wolf', 'crab', 'deer', 'mole', 'mouse', 'horse', 'tiger', 'zebra', 'camel'],
    },
    fruits: {
      name: '🍎 Fruits',
      words: ['apple', 'pear', 'lime', 'plum', 'peach', 'grape', 'mango', 'melon', 'cherry', 'lemon',
        'olive', 'fig', 'kiwi', 'date', 'guava', 'berry'],
    },
    colors: {
      name: '🎨 Colors',
      words: ['red', 'blue', 'pink', 'gold', 'teal', 'gray', 'navy', 'rose', 'tan', 'aqua', 'ruby', 'jade', 'lime', 'plum'],
    },
    home: {
      name: '🏠 Home',
      words: ['table', 'chair', 'door', 'lamp', 'sofa', 'bed', 'desk', 'rug', 'sink', 'oven', 'bath',
        'vase', 'clock', 'couch', 'shelf', 'stool'],
    },
  };
  const CATEGORY_KEYS = Object.keys(CATEGORIES);
  const CATEGORY_SETS = Object.fromEntries(CATEGORY_KEYS.map(k => [k, new Set(CATEGORIES[k].words)]));

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const getRandomLetter = () => LETTER_POOL[randInt(0, LETTER_POOL.length - 1)];
  const shuffled = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randInt(0, i);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const isBoardValid = v => typeof v === 'string' && v.length === BOARD_SIZE * BOARD_SIZE;

  // Hide category words in the grid, straight across or down. Words may cross
  // if the letters match. Empty cells get random letters.
  function createBoard(categoryKey) {
    const grid = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    const words = shuffled(CATEGORIES[categoryKey].words).slice(0, PLANTED_WORDS);

    words.forEach(word => {
      const up = word.toUpperCase();
      for (let t = 0; t < PLACE_TRIES; t++) {
        const vertical = Math.random() < 0.5;
        const r0 = vertical ? randInt(0, BOARD_SIZE - up.length) : randInt(0, BOARD_SIZE - 1);
        const c0 = vertical ? randInt(0, BOARD_SIZE - 1) : randInt(0, BOARD_SIZE - up.length);
        const cells = [...up].map((_, k) => vertical
          ? (r0 + k) * BOARD_SIZE + c0
          : r0 * BOARD_SIZE + c0 + k);
        if (cells.every((cell, k) => grid[cell] === null || grid[cell] === up[k])) {
          cells.forEach((cell, k) => { grid[cell] = up[k]; });
          return;
        }
      }
    });

    return grid.map(c => c ?? getRandomLetter()).join('');
  }

  // Build a straight horizontal or vertical selection path.
  const getSelectionPath = (startIndex, endIndex) => {
    const startRow = Math.floor(startIndex / BOARD_SIZE);
    const startColumn = startIndex % BOARD_SIZE;
    const endRow = Math.floor(endIndex / BOARD_SIZE);
    const endColumn = endIndex % BOARD_SIZE;

    if (startRow !== endRow && startColumn !== endColumn) return [startIndex];

    const distance = Math.max(Math.abs(endRow - startRow), Math.abs(endColumn - startColumn));
    const rowDirection = Math.sign(endRow - startRow);
    const columnDirection = Math.sign(endColumn - startColumn);

    return Array.from({ length: distance + 1 }, (_, step) =>
      (startRow + rowDirection * step) * BOARD_SIZE + startColumn + columnDirection * step);
  };

  BrawlBox.registerGame('letter-grab', {
    start(stage, api) {
      const room = api.room;
      const categoryKey = CATEGORY_KEYS[Math.floor(room.epoch) % CATEGORY_KEYS.length];
      const category = CATEGORIES[categoryKey];

      let board = null;
      let selectedCells = [];
      let dragStart = null;
      let score = 0;
      let isCheckingWord = false;
      let isStopped = false;
      const cellElements = [];

      stage.innerHTML = `
        <style>
          .lg-game { width: 100%; max-width: 680px; margin: 0 auto; padding: 14px; color: #f1f5ff; box-sizing: border-box; }
          .lg-game * { box-sizing: border-box; }
          .lg-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
          .lg-title { margin: 0; font-size: clamp(1.3rem, 4vw, 1.8rem); font-weight: 950; letter-spacing: .06em; color: #fff; }
          .lg-cat { margin: 4px 0 0; color: #8997b5; font-size: .85rem; font-weight: 800; }
          .lg-cat b { color: #ffe27a; }
          .lg-score { flex-shrink: 0; text-align: center; padding: 8px 16px; border: 1px solid #303d5b; border-radius: 14px; background: #192239; }
          .lg-score-label { display: block; color: #8997b5; font-size: .65rem; font-weight: 800; letter-spacing: .12em; }
          .lg-score-value { display: block; color: #ffe27a; font-size: 1.5rem; font-weight: 950; font-variant-numeric: tabular-nums; }
          .lg-board-wrap { padding: 7px; border-radius: 18px; background: linear-gradient(135deg, #6577ff, #35d6d0); box-shadow: 0 12px 35px #0005; }
          .lg-board { display: grid; grid-template-columns: repeat(${BOARD_SIZE}, minmax(0, 1fr)); gap: clamp(2px, .7vw, 5px);
            width: 100%; aspect-ratio: 1; padding: 5px; border-radius: 13px; background: #101526; touch-action: none; user-select: none; -webkit-user-select: none; }
          .lg-cell { display: grid; place-items: center; min-width: 0; min-height: 0; border-radius: clamp(3px, .8vw, 8px);
            background: linear-gradient(145deg, #263451, #1b263e); border: 1px solid #3b4b6b; color: #e7edff;
            font-size: clamp(11px, 3.1vw, 23px); font-weight: 950; text-shadow: 0 2px 3px #0006; pointer-events: none;
            transition: background .12s, transform .12s, color .12s; }
          .lg-cell.selected { background: linear-gradient(145deg, #555de8, #3846a8); border-color: #a4adff; color: #fff; transform: scale(.94); }
          .lg-cell.last-selected { background: linear-gradient(145deg, #ffe58a, #ffbd45); border-color: #fff1bd; color: #372b13; transform: scale(.9); }
          .lg-info { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; margin-top: 14px; padding: 12px 16px;
            border: 1px solid #303d5b; border-radius: 14px; background: #192239; }
          .lg-label { color: #8997b5; font-size: .65rem; font-weight: 800; letter-spacing: .12em; }
          .lg-preview { min-height: 30px; margin-top: 4px; color: #40e0d0; font-size: clamp(1.1rem, 4vw, 1.5rem); font-weight: 950; letter-spacing: .16em; overflow-wrap: anywhere; }
          .lg-count { color: #8997b5; font-size: .75rem; font-weight: 800; white-space: nowrap; }
          .lg-msg { min-height: 24px; margin: 12px 0 0; text-align: center; font-size: .9rem; font-weight: 800; color: #8997b5; }
          .lg-msg.success { color: #65e6a5; }
          .lg-msg.error { color: #ff858f; }
          .lg-help { margin-top: 10px; text-align: center; color: #8997b5; font-size: .75rem; }
          @media (max-width: 420px) { .lg-game { padding: 6px; } .lg-board-wrap { padding: 4px; } .lg-board { padding: 3px; } }
        </style>
        <div class="lg-game">
          <div class="lg-header">
            <div>
              <h2 class="lg-title">LETTER GRAB</h2>
              <p class="lg-cat">Category: <b>${esc(category.name)}</b> · category words +${CATEGORY_BONUS}</p>
            </div>
            <div class="lg-score">
              <span class="lg-score-label">YOUR SCORE</span>
              <span class="lg-score-value" id="lg-score">0</span>
            </div>
          </div>
          <div class="lg-board-wrap"><div class="lg-board" id="lg-board"></div></div>
          <div class="lg-info">
            <div>
              <div class="lg-label">CURRENT WORD</div>
              <div class="lg-preview" id="lg-preview">—</div>
            </div>
            <div class="lg-count" id="lg-count">0 LETTERS</div>
          </div>
          <p class="lg-msg" id="lg-msg">Drag across or down to spell a word.</p>
          <p class="lg-help">Minimum ${MIN_WORD_LENGTH} letters · Longer words earn more points</p>
        </div>`;

      const boardEl = stage.querySelector('#lg-board');
      const previewEl = stage.querySelector('#lg-preview');
      const countEl = stage.querySelector('#lg-count');
      const msgEl = stage.querySelector('#lg-msg');
      const scoreEl = stage.querySelector('#lg-score');

      for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'lg-cell';
        boardEl.appendChild(cell);
        cellElements.push(cell);
      }

      const showMessage = (text, type = '') => {
        msgEl.textContent = text;
        msgEl.className = `lg-msg ${type}`;
      };

      const renderBoard = () => {
        cellElements.forEach((cell, index) => {
          const letter = board ? board[index] : '';
          if (cell.textContent !== letter) cell.textContent = letter;
          const isSelected = selectedCells.includes(index);
          const isLast = selectedCells[selectedCells.length - 1] === index;
          cell.classList.toggle('selected', isSelected);
          cell.classList.toggle('last-selected', isSelected && isLast);
        });
        previewEl.textContent = board ? selectedCells.map(i => board[i]).join('') : '—';
        countEl.textContent = `${selectedCells.length} LETTERS`;
      };

      const getCellAtPosition = event => {
        const bounds = boardEl.getBoundingClientRect();
        const x = event.clientX - bounds.left;
        const y = event.clientY - bounds.top;
        if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) return -1;
        const column = Math.floor(x / (bounds.width / BOARD_SIZE));
        const row = Math.floor(y / (bounds.height / BOARD_SIZE));
        return row * BOARD_SIZE + column;
      };

      const submitWord = async path => {
        if (isCheckingWord || isStopped || !board) return;
        const word = path.map(i => board[i]).join('');
        if (word.length < MIN_WORD_LENGTH) return;

        isCheckingWord = true;
        showMessage(`Checking "${word}"...`);

        let isValidWord;
        try {
          isValidWord = await Words.isWord(word);
        } catch {
          isCheckingWord = false;
          return showMessage('Dictionary unavailable. Try again.', 'error');
        }
        if (isStopped) return;

        if (!isValidWord) {
          isCheckingWord = false;
          return showMessage(`"${word}" is not a valid word.`, 'error');
        }

        // Replace letters only if the shared board still has them.
        const updatedBoard = await room.update('board', currentBoard => {
          if (!isBoardValid(currentBoard)) return undefined;
          const letters = currentBoard.split('');
          if (path.some((index, position) => letters[index] !== word[position])) return undefined;
          path.forEach(index => { letters[index] = getRandomLetter(); });
          return letters.join('');
        });

        isCheckingWord = false;
        if (isStopped) return;
        if (!updatedBoard) return showMessage('The board changed. Try another word.', 'error');

        const wordLength = path.length;
        const isCategoryWord = CATEGORY_SETS[categoryKey].has(word.toLowerCase());
        const longBonus = Math.max(0, wordLength - (LONG_WORD_FROM - 1)) * LONG_BONUS_PER_LETTER;
        const points = wordLength + longBonus + (isCategoryWord ? CATEGORY_BONUS : 0);

        score += points;
        api.setScore(score);
        scoreEl.textContent = score.toLocaleString();
        api.sfx('good');
        showMessage(`+${points} points! "${word}"${isCategoryWord ? ' Category bonus!' : ''}`, 'success');

        const last = cellElements[path[path.length - 1]].getBoundingClientRect();
        api.burst(last.left + last.width / 2, last.top + last.height / 2, 24);
      };

      const applyBoard = newBoardValue => {
        if (!isBoardValid(newBoardValue) || newBoardValue === board) return;
        board = newBoardValue;
        renderBoard();
      };

      const handlePointerDown = event => {
        const index = getCellAtPosition(event);
        if (index < 0 || !board || isCheckingWord) return;
        dragStart = index;
        selectedCells = [index];
        boardEl.setPointerCapture(event.pointerId);
        renderBoard();
      };

      const handlePointerMove = event => {
        if (dragStart === null) return;
        const index = getCellAtPosition(event);
        if (index < 0) return;
        const newPath = getSelectionPath(dragStart, index);
        if (newPath.length !== selectedCells.length || newPath.some((c, p) => c !== selectedCells[p])) {
          selectedCells = newPath;
          renderBoard();
        }
      };

      const handlePointerUp = () => {
        if (dragStart === null) return;
        const completedPath = selectedCells.slice();
        dragStart = null;
        selectedCells = [];
        renderBoard();
        if (completedPath.length >= MIN_WORD_LENGTH) submitWord(completedPath);
      };

      // First client to see a bad board writes a new one. Later clients see it and do nothing.
      room.update('board', current => isBoardValid(current) ? undefined : createBoard(categoryKey));

      api.onStop(room.on('board', applyBoard));

      boardEl.addEventListener('pointerdown', handlePointerDown);
      boardEl.addEventListener('pointermove', handlePointerMove);
      boardEl.addEventListener('pointerup', handlePointerUp);
      boardEl.addEventListener('pointercancel', handlePointerUp);

      api.onStop(() => {
        isStopped = true;
        boardEl.removeEventListener('pointerdown', handlePointerDown);
        boardEl.removeEventListener('pointermove', handlePointerMove);
        boardEl.removeEventListener('pointerup', handlePointerUp);
        boardEl.removeEventListener('pointercancel', handlePointerUp);
      });

      renderBoard();
    },
  });
})();
