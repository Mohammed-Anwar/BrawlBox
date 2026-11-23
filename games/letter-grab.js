
/* Letter Grab: 10x10 shared-board word game. */
(() => {
    const BOARD_SIZE = 10;
    const MIN_WORD_LENGTH = 3;

    const LETTER_POOL =
        'EEEEEEEEAAAAAAAIIIIIIIOOOOOO' +
        'NNNNNNRRRRRRSSSSSSTTTTTLLLLL' +
        'DDDDGGGBBBCCCMMPPFFHHVVWWYYKJXQZ';

    const getRandomLetter = () =>
        LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];

    const createBoard = () =>
        Array.from({ length: BOARD_SIZE * BOARD_SIZE }, getRandomLetter).join('');

    // Generate every horizontal and vertical word window.
    const wordWindows = [];

    for (let row = 0; row < BOARD_SIZE; row++) {
        const rowCells = Array.from(
            { length: BOARD_SIZE },
            (_, column) => row * BOARD_SIZE + column
        );

        for (let length = MIN_WORD_LENGTH; length <= BOARD_SIZE; length++) {
            for (let start = 0; start + length <= BOARD_SIZE; start++) {
                wordWindows.push(rowCells.slice(start, start + length));
            }
        }
    }

    for (let column = 0; column < BOARD_SIZE; column++) {
        const columnCells = Array.from(
            { length: BOARD_SIZE },
            (_, row) => row * BOARD_SIZE + column
        );

        for (let length = MIN_WORD_LENGTH; length <= BOARD_SIZE; length++) {
            for (let start = 0; start + length <= BOARD_SIZE; start++) {
                wordWindows.push(columnCells.slice(start, start + length));
            }
        }
    }

    const hasPlayableWord = async (board) => {
        const results = await Promise.all(
            wordWindows.map(async (window) => {
                const word = window.map(index => board[index]).join('').toLowerCase();

                try {
                    return await Words.isWord(word) ||
                        await Words.isWord([...word].reverse().join(''));
                } catch {
                    return true;
                }
            })
        );

        return results.some(Boolean);
    };

    // Build a straight horizontal or vertical selection path.
    const getSelectionPath = (startIndex, endIndex) => {
        const startRow = Math.floor(startIndex / BOARD_SIZE);
        const startColumn = startIndex % BOARD_SIZE;

        const endRow = Math.floor(endIndex / BOARD_SIZE);
        const endColumn = endIndex % BOARD_SIZE;

        if (startRow !== endRow && startColumn !== endColumn) {
            return [startIndex];
        }

        const distance = Math.max(
            Math.abs(endRow - startRow),
            Math.abs(endColumn - startColumn)
        );

        const rowDirection = Math.sign(endRow - startRow);
        const columnDirection = Math.sign(endColumn - startColumn);

        return Array.from({ length: distance + 1 }, (_, step) =>
            (startRow + rowDirection * step) * BOARD_SIZE +
            startColumn + columnDirection * step
        );
    };

    BrawlBox.registerGame('letter-grab', {
        start(stage, api) {
            const room = api.room;

            let board = null;
            let selectedCells = [];
            let dragStart = null;
            let score = 0;
            let isCheckingWord = false;
            let isStopped = false;

            const checkedBoards = new Set();
            const cellElements = [];

            stage.innerHTML = `
                <style>
                    .letter-game {
                        --game-bg: #101526;
                        --game-panel: #192239;
                        --game-border: #303d5b;
                        --game-accent: #7c83ff;
                        --game-cyan: #40e0d0;
                        --game-text: #f1f5ff;
                        --game-muted: #8997b5;

                        width: 100%;
                        max-width: 680px;
                        margin: 0 auto;
                        padding: 18px;
                        color: var(--game-text);
                        font-family: inherit;
                        box-sizing: border-box;
                    }

                    .letter-game * {
                        box-sizing: border-box;
                    }

                    .game-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 12px;
                        margin-bottom: 18px;
                    }

                    .game-title {
                        margin: 0;
                        font-size: clamp(1.3rem, 4vw, 1.8rem);
                        font-weight: 950;
                        letter-spacing: .06em;
                        background: linear-gradient(100deg, #fff, #8c9aff);
                        background-clip: text;
                        -webkit-background-clip: text;
                        color: transparent;
                    }

                    .game-subtitle {
                        margin: 5px 0 0;
                        color: var(--game-muted);
                        font-size: .85rem;
                    }

                    .score-panel {
                        flex-shrink: 0;
                        text-align: center;
                        padding: 9px 17px;
                        border: 1px solid var(--game-border);
                        border-radius: 14px;
                        background: var(--game-panel);
                    }

                    .score-label {
                        display: block;
                        color: var(--game-muted);
                        font-size: .65rem;
                        font-weight: 800;
                        letter-spacing: .12em;
                    }

                    .score-value {
                        display: block;
                        color: #ffe27a;
                        font-size: 1.5rem;
                        font-weight: 950;
                        font-variant-numeric: tabular-nums;
                    }

                    .game-board-wrapper {
                        position: relative;
                        padding: 7px;
                        border-radius: 18px;
                        background: linear-gradient(135deg, #6577ff, #35d6d0);
                        box-shadow: 0 12px 35px #0005,
                                    0 0 25px #6577ff20;
                    }

                    .game-board {
                        display: grid;
                        grid-template-columns: repeat(10, minmax(0, 1fr));
                        gap: clamp(2px, .7vw, 5px);
                        width: 100%;
                        aspect-ratio: 1;
                        padding: 5px;
                        border-radius: 13px;
                        background: var(--game-bg);
                        touch-action: none;
                        user-select: none;
                        -webkit-user-select: none;
                    }

                    .game-cell {
                        display: grid;
                        place-items: center;
                        min-width: 0;
                        min-height: 0;
                        border-radius: clamp(3px, .8vw, 8px);
                        background: linear-gradient(145deg, #263451, #1b263e);
                        border: 1px solid #3b4b6b;
                        color: #e7edff;
                        font-size: clamp(11px, 3.1vw, 23px);
                        font-weight: 950;
                        text-shadow: 0 2px 3px #0006;
                        cursor: crosshair;
                        transition: background .12s, border-color .12s,
                                    transform .12s, color .12s;
                        pointer-events: none;
                    }

                    .game-cell.selected {
                        background: linear-gradient(145deg, #555de8, #3846a8);
                        border-color: #a4adff;
                        color: white;
                        transform: scale(.94);
                        box-shadow: inset 0 0 12px #aab3ff44;
                    }

                    .game-cell.last-selected {
                        background: linear-gradient(145deg, #ffe58a, #ffbd45);
                        border-color: #fff1bd;
                        color: #372b13;
                        transform: scale(.90);
                        box-shadow: 0 0 12px #ffce5d99;
                    }

                    .game-information {
                        display: grid;
                        grid-template-columns: 1fr auto;
                        align-items: center;
                        gap: 12px;
                        margin-top: 16px;
                        padding: 13px 16px;
                        border: 1px solid var(--game-border);
                        border-radius: 14px;
                        background: var(--game-panel);
                    }

                    .word-information {
                        min-width: 0;
                    }

                    .word-label {
                        color: var(--game-muted);
                        font-size: .65rem;
                        font-weight: 800;
                        letter-spacing: .12em;
                    }

                    .word-preview {
                        min-height: 30px;
                        margin-top: 4px;
                        color: var(--game-cyan);
                        font-size: clamp(1.1rem, 4vw, 1.5rem);
                        font-weight: 950;
                        letter-spacing: .16em;
                        overflow-wrap: anywhere;
                    }

                    .word-length {
                        color: var(--game-muted);
                        font-size: .75rem;
                        font-weight: 800;
                        white-space: nowrap;
                    }

                    .game-message {
                        min-height: 24px;
                        margin: 12px 0 0;
                        text-align: center;
                        font-size: .85rem;
                        font-weight: 800;
                        color: var(--game-muted);
                    }

                    .game-message.success {
                        color: #65e6a5;
                    }

                    .game-message.error {
                        color: #ff858f;
                    }

                    .game-instructions {
                        margin-top: 12px;
                        text-align: center;
                        color: var(--game-muted);
                        font-size: .75rem;
                    }

                    @media (max-width: 420px) {
                        .letter-game {
                            padding: 8px;
                        }

                        .game-board-wrapper {
                            padding: 4px;
                        }

                        .game-board {
                            padding: 3px;
                        }

                        .game-header {
                            margin-bottom: 12px;
                        }
                    }
                </style>

                <div class="letter-game">
                    <div class="game-header">
                        <div>
                            <h2 class="game-title">LETTER GRAB</h2>
                            <p class="game-subtitle">Find words. Score points. Dominate!</p>
                        </div>

                        <div class="score-panel">
                            <span class="score-label">YOUR SCORE</span>
                            <span class="score-value" id="game-score">0</span>
                        </div>
                    </div>

                    <div class="game-board-wrapper">
                        <div class="game-board" id="game-board"></div>
                    </div>

                    <div class="game-information">
                        <div class="word-information">
                            <div class="word-label">CURRENT WORD</div>
                            <div class="word-preview" id="word-preview">—</div>
                        </div>

                        <div class="word-length" id="word-length">0 LETTERS</div>
                    </div>

                    <p class="game-message" id="game-message">
                        Drag across or down to find a word.
                    </p>

                    <p class="game-instructions">
                        Minimum 3 letters · Longer words earn more points
                    </p>
                </div>
            `;

            const boardElement = stage.querySelector('#game-board');
            const previewElement = stage.querySelector('#word-preview');
            const lengthElement = stage.querySelector('#word-length');
            const messageElement = stage.querySelector('#game-message');
            const scoreElement = stage.querySelector('#game-score');

            // Create the 100 cells once.
            for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index++) {
                const cell = document.createElement('div');
                cell.className = 'game-cell';

                boardElement.appendChild(cell);
                cellElements.push(cell);
            }

            const showMessage = (message, type = '') => {
                messageElement.textContent = message;
                messageElement.className = `game-message ${type}`;
            };

            const renderBoard = () => {
                cellElements.forEach((cell, index) => {
                    const letter = board ? board[index] : '';

                    if (cell.textContent !== letter) {
                        cell.textContent = letter;
                    }

                    const isSelected = selectedCells.includes(index);
                    const isLastSelected =
                        selectedCells[selectedCells.length - 1] === index;

                    cell.classList.toggle('selected', isSelected);
                    cell.classList.toggle(
                        'last-selected',
                        isSelected && isLastSelected
                    );
                });

                previewElement.textContent = board
                    ? selectedCells.map(index => board[index]).join('')
                    : '—';

                lengthElement.textContent =
                    `${selectedCells.length} LETTERS`;
            };

            const getCellAtPosition = (event) => {
                const bounds = boardElement.getBoundingClientRect();

                const x = event.clientX - bounds.left;
                const y = event.clientY - bounds.top;

                if (
                    x < 0 || y < 0 ||
                    x >= bounds.width || y >= bounds.height
                ) {
                    return -1;
                }

                const column = Math.floor(
                    x / (bounds.width / BOARD_SIZE)
                );

                const row = Math.floor(
                    y / (bounds.height / BOARD_SIZE)
                );

                return row * BOARD_SIZE + column;
            };

            const submitWord = async (path) => {
                if (isCheckingWord || isStopped || !board) return;

                const word = path.map(index => board[index]).join('');

                if (word.length < MIN_WORD_LENGTH) return;

                isCheckingWord = true;

                showMessage(`Checking "${word}"...`);

                let isValidWord;

                try {
                    isValidWord = await Words.isWord(word);
                } catch {
                    isCheckingWord = false;
                    return showMessage(
                        'Dictionary unavailable. Try again.',
                        'error'
                    );
                }

                if (isStopped) return;

                if (!isValidWord) {
                    isCheckingWord = false;
                    return showMessage(`"${word}" is not a valid word.`, 'error');
                }

                // Replace letters only if the shared board is unchanged.
                const updatedBoard = await room.update('board', currentBoard => {
                    if (
                        typeof currentBoard !== 'string' ||
                        currentBoard.length !== BOARD_SIZE * BOARD_SIZE
                    ) {
                        return undefined;
                    }

                    const letters = currentBoard.split('');

                    if (path.some((index, position) =>
                        letters[index] !== word[position]
                    )) {
                        return undefined;
                    }

                    path.forEach(index => {
                        letters[index] = getRandomLetter();
                    });

                    return letters.join('');
                });

                isCheckingWord = false;

                if (isStopped) return;

                if (!updatedBoard) {
                    return showMessage(
                        'The board changed. Try another word.',
                        'error'
                    );
                }

                // Longer words receive a bonus.
                const wordLength = path.length;
                const points = wordLength + Math.max(0, wordLength - 4) * 2;

                score += points;

                api.setScore(score);
                scoreElement.textContent = score.toLocaleString();

                api.sfx('good');

                showMessage(`+${points} points! "${word}"`, 'success');

                const lastCell = cellElements[path[path.length - 1]];
                const bounds = lastCell.getBoundingClientRect();

                api.burst(
                    bounds.left + bounds.width / 2,
                    bounds.top + bounds.height / 2,
                    24
                );
            };

            const ensurePlayableBoard = (currentBoard) => {
                if (checkedBoards.has(currentBoard)) return;

                checkedBoards.add(currentBoard);

                hasPlayableWord(currentBoard)
                    .then(hasWord => {
                        if (hasWord || isStopped || board !== currentBoard) {
                            return;
                        }

                        return room.update('board', latestBoard =>
                            latestBoard === currentBoard
                                ? createBoard()
                                : undefined
                        );
                    })
                    .catch(() => {});
            };

            const applyBoard = (newBoardValue) => {
                if (
                    typeof newBoardValue !== 'string' ||
                    newBoardValue.length !== BOARD_SIZE * BOARD_SIZE ||
                    newBoardValue === board
                ) {
                    return;
                }

                board = newBoardValue;
                renderBoard();
                ensurePlayableBoard(newBoardValue);
            };

            const handlePointerDown = (event) => {
                const index = getCellAtPosition(event);

                if (index < 0 || !board || isCheckingWord) return;

                dragStart = index;
                selectedCells = [index];

                boardElement.setPointerCapture(event.pointerId);

                renderBoard();
            };

            const handlePointerMove = (event) => {
                if (dragStart === null) return;

                const index = getCellAtPosition(event);

                if (index < 0) return;

                const newPath = getSelectionPath(dragStart, index);

                if (
                    newPath.length !== selectedCells.length ||
                    newPath.some((cell, position) =>
                        cell !== selectedCells[position]
                    )
                ) {
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

                if (completedPath.length >= MIN_WORD_LENGTH) {
                    submitWord(completedPath);
                }
            };

            // Initialize the shared board.
            room.update('board', currentBoard =>
                typeof currentBoard === 'string' &&
                currentBoard.length === BOARD_SIZE * BOARD_SIZE
                    ? undefined
                    : createBoard()
            );

            api.onStop(room.on('board', applyBoard));

            boardElement.addEventListener('pointerdown', handlePointerDown);
            boardElement.addEventListener('pointermove', handlePointerMove);
            boardElement.addEventListener('pointerup', handlePointerUp);
            boardElement.addEventListener('pointercancel', handlePointerUp);

            api.onStop(() => {
                isStopped = true;

                boardElement.removeEventListener(
                    'pointerdown', handlePointerDown
                );

                boardElement.removeEventListener(
                    'pointermove', handlePointerMove
                );

                boardElement.removeEventListener(
                    'pointerup', handlePointerUp
                );

                boardElement.removeEventListener(
                    'pointercancel', handlePointerUp
                );
            });

            renderBoard();
        }
    });
})();
