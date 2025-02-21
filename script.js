const tg = window.Telegram.WebApp;

document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем Telegram Mini App
    tg.ready();
    tg.expand(); // Раскрываем на весь экран

    // Получаем данные пользователя из Telegram
    const currentUsername = tg.initDataUnsafe?.user?.username || 'test_user';

    const startPage = document.getElementById('startPage');
    const puzzlePage = document.getElementById('puzzlePage');
    const resultPage = document.getElementById('resultPage');
    const startButton = document.querySelector('.start-btn');
    const resultText = document.getElementById('resultText');
    const ratingElements = document.querySelectorAll('.rating');
    const goodButton = document.querySelector('.good-btn');
    const blunderButton = document.querySelector('.blunder-btn');
    
    // Проверяем, найдены ли элементы
    console.log('Elements found:', {
        goodButton,
        blunderButton,
        startButton,
        puzzlePage,
        resultPage
    });

    let currentPuzzle = null;
    let timer = null;
    let startTime = null;
    let seconds = 180; // 3 минуты

    const API_URL = 'http://localhost:3000/api';

    // Функция для обновления отображения рейтинга
    async function updateRatingDisplay() {
        try {
            const response = await fetch(`${API_URL}/user-rating/${currentUsername}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const userRating = await response.json();
            console.log('Received user rating:', userRating);
            
            if (userRating && typeof userRating.rating === 'number') {
                const displayRating = Math.round(userRating.rating);
                ratingElements.forEach(el => {
                    el.textContent = displayRating;
                    // Добавляем цветовую индикацию изменения рейтинга
                    if (displayRating > 1500) {
                        el.style.color = '#4CAF50'; // зеленый
                    } else if (displayRating < 1500) {
                        el.style.color = '#FF5722'; // красный
                    } else {
                        el.style.color = '#000000'; // черный
                    }
                });
            }
        } catch (err) {
            console.error('Error updating rating:', err);
        }
    }

    // Вызываем обновление рейтинга при загрузке страницы
    updateRatingDisplay();
    
    // Обновляем рейтинг каждые 5 секунд
    setInterval(updateRatingDisplay, 5000);

    function updateTimer() {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const display = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        document.querySelector('.timer').textContent = display;
    }

    function startTimer() {
        if (timer) {
            clearInterval(timer);
        }
        
        startTime = Date.now();
        timer = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            seconds = Math.max(180 - elapsed, 0); // Обратный отсчет от 3 минут
            
            updateTimer();
            
            if (seconds <= 0) {
                clearInterval(timer);
                // Время вышло - отмечаем как неудачную попытку
                handlePuzzleResult(false);
            }
        }, 1000);
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        return Math.floor((Date.now() - startTime) / 1000);
    }

    async function showResult(isCorrect) {
        clearInterval(timer);
        resultText.textContent = isCorrect ? 'Right!' : 'Wrong!';
        puzzlePage.classList.add('hidden');
        resultPage.classList.remove('hidden');
        
        // Ждем обновления рейтинга
        await new Promise(resolve => setTimeout(resolve, 500));
        await updateRatingDisplay();
    }

    // Добавьте обработку ошибок в fetch запросы
    async function fetchWithError(url, options = {}) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (err) {
            console.error('Fetch error:', err);
            throw err;
        }
    }

    // Обработчик кнопки START
    startButton.addEventListener('click', async () => {
        try {
            // Получаем новую задачу
            const puzzleResponse = await fetch(`${API_URL}/random-puzzle/${currentUsername}`);
            currentPuzzle = await puzzleResponse.json();
            
            if (!currentPuzzle) {
                alert('Ошибка загрузки задачи');
                return;
            }

            // Обновляем конфигурацию
            puzzleConfig.initialFen = currentPuzzle.fen;
            puzzleConfig.preMove = currentPuzzle.move_1;
            puzzleConfig.evaluatedMove = currentPuzzle.move_2;
            puzzleConfig.orientation = currentPuzzle.color === 'W' ? 'white' : 'black';
            puzzleConfig.solution = currentPuzzle.solution;

            // Показываем страницу с задачей
            startPage.classList.add('hidden');
            puzzlePage.classList.remove('hidden');
            initializeBoard();
        } catch (err) {
            console.error('Error starting puzzle:', err);
            alert('Произошла ошибка при загрузке задачи');
        }
    });

    // Инициализация кнопок
    function initializeButtons() {
        if (goodButton) {
            goodButton.addEventListener('click', () => {
                showResultPage(true);  // Просто показываем страницу с результатом
            });
        } else {
            console.error('Good button not found!');
        }

        if (blunderButton) {
            blunderButton.addEventListener('click', () => {
                showResultPage(false);  // Просто показываем страницу с результатом
            });
        } else {
            console.error('Blunder button not found!');
        }
    }

    // Вызываем инициализацию кнопок после загрузки DOM
    initializeButtons();

    document.querySelector('.next-btn').addEventListener('click', async () => {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        
        try {
            const puzzleResponse = await fetch(`${API_URL}/random-puzzle/${currentUsername}`);
            currentPuzzle = await puzzleResponse.json();
            
            if (!currentPuzzle) {
                alert('Ошибка загрузки задачи');
                return;
            }

            // Обновляем конфигурацию
            puzzleConfig.initialFen = currentPuzzle.fen;
            puzzleConfig.preMove = currentPuzzle.move_1;
            puzzleConfig.evaluatedMove = currentPuzzle.move_2;
            puzzleConfig.orientation = currentPuzzle.color === 'W' ? 'white' : 'black';
            puzzleConfig.solution = currentPuzzle.solution;

            // Показываем страницу с задачей
            resultPage.classList.add('hidden');
            puzzlePage.classList.remove('hidden');
            initializeBoard();
        } catch (err) {
            console.error('Error loading next puzzle:', err);
            alert('Ошибка при загрузке следующей задачи');
        }
    });

    document.querySelector('.analyze-btn').addEventListener('click', () => {
        // Используем FEN позиции после предварительного хода
        const [from, to] = puzzleConfig.preMove.match(/.{2}/g);
        game.load(puzzleConfig.initialFen); // Загружаем начальную позицию
        game.move({ from, to, promotion: 'q' }); // Делаем предварительный ход
        
        // Получаем FEN после предварительного хода и форматируем его для URL
        const fen = game.fen().replace(/ /g, '_');
        const color = puzzleConfig.orientation;
        
        // Открываем страницу анализа на lichess
        window.open(`https://lichess.org/analysis/${fen}?color=${color}`, '_blank');
        
        // Возвращаем доску к текущей позиции
        game.load(puzzleConfig.initialFen);
        game.move({ from, to, promotion: 'q' });
    });

    // Конфигурация шахматной задачи
    const puzzleConfig = {
        initialFen: '8/1pBrR3/p1bP4/P6p/5k2/7p/5K2/8 w - - 0 1', // Пример FEN
        preMove: 'e7d7', // Предварительный ход
        evaluatedMove: 'c7b6', // Оцениваемый ход
        orientation: 'white', // Ориентация доски
        preMoveDelay: 2000, // Задержка перед предварительным ходом в мс
        solution: 'Good' // Предполагаемый правильный ответ
    };

    let board = null;
    let game = new Chess();
    let arrow = null;

    function initializeBoard() {
        // Очищаем предыдущий таймер если есть
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        
        // Сбрасываем время
        seconds = 180;
        startTime = null; // Сбрасываем стартовое время
        updateTimer();
        
        // Очищаем предыдущую стрелку
        const oldArrow = document.querySelector('.arrow');
        if (oldArrow) {
            oldArrow.remove();
        }
        
        // Настройка начальной позиции
        game.load(puzzleConfig.initialFen);
        
        // Инициализация доски
        if (board) {
            board.destroy();
        }
        
        // Оборачиваем доску в контейнер
        const boardElement = document.getElementById('board');
        if (!boardElement.parentElement.classList.contains('board-container')) {
            const container = document.createElement('div');
            container.className = 'board-container';
            boardElement.parentElement.insertBefore(container, boardElement);
            container.appendChild(boardElement);
        }
        
        board = Chessboard('board', {
            position: game.fen(),
            orientation: puzzleConfig.orientation,
            pieceTheme: 'https://lichess1.org/assets/piece/cburnett/{piece}.svg',
            moveSpeed: 800, // Значительно увеличиваем время анимации
            snapSpeed: 100,
            snapbackSpeed: 200,
            appearSpeed: 200,
            trashSpeed: 100,
            animation: true // Явно включаем анимацию
        });

        // Анимация предварительного хода
        setTimeout(() => {
            const [from, to] = puzzleConfig.preMove.match(/.{2}/g);
            
            // Создаем промис для анимации
            const animateMove = () => new Promise(resolve => {
                const piece = document.querySelector(`[data-square="${from}"] .piece-417db`);
                if (piece) {
                    const fromSquare = document.querySelector(`[data-square="${from}"]`);
                    const toSquare = document.querySelector(`[data-square="${to}"]`);
                    const fromRect = fromSquare.getBoundingClientRect();
                    const toRect = toSquare.getBoundingClientRect();
                    
                    // Добавляем CSS transition
                    piece.style.transition = 'transform 0.8s ease-in-out';
                    piece.style.transform = `translate(${toRect.left - fromRect.left}px, ${toRect.top - fromRect.top}px)`;
                    
                    // После завершения анимации
                    piece.addEventListener('transitionend', () => {
                        game.move({ from, to, promotion: 'q' });
                        board.position(game.fen(), false);
                        resolve();
                    }, { once: true });
                } else {
                    game.move({ from, to, promotion: 'q' });
                    board.position(game.fen(), false);
                    resolve();
                }
            });

            // Выполняем анимацию и показываем стрелку
            animateMove().then(() => {
                setTimeout(() => {
                    drawArrow();
                    startTimer();
                }, 100);
            });
        }, puzzleConfig.preMoveDelay);
    }

    function drawArrow() {
        console.log('Drawing arrow for move:', puzzleConfig.evaluatedMove); // Добавляем лог
        
        const [from, to] = puzzleConfig.evaluatedMove.match(/.{2}/g);
        
        // Удаляем старую стрелку
        const oldArrow = document.querySelector('.arrow');
        if (oldArrow) oldArrow.remove();

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "arrow");
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '1000';
        
        const board = document.querySelector('#board');
        if (!board) {
            console.error('Board element not found');
            return;
        }
        
        const fromSquare = document.querySelector(`[data-square="${from}"]`);
        const toSquare = document.querySelector(`[data-square="${to}"]`);
        const boardRect = board.getBoundingClientRect();
        const fromRect = fromSquare.getBoundingClientRect();
        const toRect = toSquare.getBoundingClientRect();
        const squareSize = boardRect.width / 8;

        // Координаты
        const x1 = fromRect.left - boardRect.left + fromRect.width/2;
        const y1 = fromRect.top - boardRect.top + fromRect.height/2;
        const x2 = toRect.left - boardRect.left + toRect.width/2;
        const y2 = toRect.top - boardRect.top + toRect.height/2;

        // Вычисляем угол и размеры
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const width = squareSize * 0.15;
        const headWidth = squareSize * 0.3;
        const headLength = squareSize * 0.3;

        // Точки для стрелки
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        const length = Math.sqrt((x2-x1)**2 + (y2-y1)**2) - headLength;

        // Создаем путь для стрелки
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `
            M ${x1 - width*dy} ${y1 + width*dx}
            L ${x1 + length*dx - width*dy} ${y1 + length*dy + width*dx}
            L ${x1 + length*dx - headWidth*dy} ${y1 + length*dy + headWidth*dx}
            L ${x2} ${y2}
            L ${x1 + length*dx + headWidth*dy} ${y1 + length*dy - headWidth*dx}
            L ${x1 + length*dx + width*dy} ${y1 + length*dy - width*dx}
            L ${x1 + width*dy} ${y1 - width*dx}
            Z
        `);
        path.setAttribute("fill", "#00ff00");
        path.setAttribute("opacity", "0.5");

        svg.appendChild(path);
        board.appendChild(svg);
    }

    // Вспомогательная функция для получения координат клетки
    function getSquareCoords(square) {
        const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
        const rank = 8 - parseInt(square[1]);
        return { x: file, y: rank };
    }

    // Обработчик клика по доске для показа/скрытия стрелки
    $('#board').on('click', function() {
        const arrow = document.querySelector('.arrow');
        if (arrow) {
            arrow.style.display = arrow.style.display === 'none' ? 'block' : 'none';
        }
    });

    // Инициализация при загрузке
    initializeBoard();

    // Функции для модального окна
    function showErrorModal() {
        document.getElementById('errorModal').classList.remove('hidden');
    }

    function hideErrorModal() {
        document.getElementById('errorModal').classList.add('hidden');
    }

    // Добавляем обработчик для кнопки OK
    document.querySelector('.ok-btn').addEventListener('click', hideErrorModal);

    function showResultPage(success) {
        // Останавливаем таймер
        clearInterval(timer);
        
        // Вычисляем затраченное время
        const timeSpent = Math.max(0, 180 - seconds);
        
        // Скрываем страницу с задачей и показываем результат
        document.getElementById('puzzlePage').classList.add('hidden');
        document.getElementById('resultPage').classList.remove('hidden');
        
        // Определяем правильность ответа
        const isCorrect = (success && currentPuzzle.solution === 'Good') || 
                         (!success && currentPuzzle.solution === 'Blunder');
        
        // Обновляем рейтинг локально
        let currentRating = parseInt(document.querySelector('.rating').textContent);
        if (isCorrect) {
            currentRating += 15;  // Увеличиваем рейтинг при правильном ответе
        } else {
            currentRating -= 10;  // Уменьшаем рейтинг при неправильном ответе
        }
        
        // Обновляем отображение рейтинга на всех страницах
        document.querySelectorAll('.rating, .result-rating').forEach(el => {
            el.textContent = currentRating;
        });
        
        // Обновляем текст результата
        document.querySelector('.result-text').textContent = isCorrect ? 'Correct!' : 'Wrong!';
        document.querySelector('.result-text').style.color = isCorrect ? '#4CAF50' : '#FF0000';
    }
}); 