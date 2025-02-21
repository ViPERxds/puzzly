const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot('7940253060:AAE6HFJGi0tbipn1nxsmnZ8lOk5ykTkK6PI', {polling: true});

const app = express();

app.use(cors({
    origin: 'https://viperxds.github.io'
}));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Проверяем подключение при запуске
pool.connect((err, client, release) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
        process.exit(1);
    }
    console.log('Успешное подключение к базе данных');
    release();
});

// Добавляем обработчик ошибок для пула
pool.on('error', (err) => {
    console.error('Неожиданная ошибка в пуле подключений:', err);
    process.exit(1);
});

// Добавляем обработку статических файлов
app.use(express.static(path.join(__dirname)));

// Базовый маршрут для проверки работы сервера
app.get('/', (req, res) => {
    res.send('Сервер работает');
});

// Маршрут для получения рейтинга пользователя
app.get('/api/user-rating/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const userRating = await getUserRating(username);
        if (!userRating) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }
        res.json(userRating);
    } catch (err) {
        console.error('Ошибка при получении рейтинга:', err);
        res.status(500).json({ error: err.message });
    }
});

// Маршрут для проверки доступа пользователя
app.get('/api/check-access/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const hasAccess = await checkUserAccess(username);
        res.json({ hasAccess });
    } catch (err) {
        console.error('Ошибка при проверке доступа:', err);
        res.status(500).json({ error: err.message });
    }
});

// Маршрут для получения случайной задачи
app.get('/api/random-puzzle/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const puzzle = await findPuzzleForUser(username);
        res.json(puzzle);
    } catch (err) {
        console.error('Ошибка при получении задачи:', err);
        res.status(500).json({ error: err.message });
    }
});

// Маршрут для записи решения
app.post('/api/record-solution', async (req, res) => {
    try {
        const { username, puzzleId, success, time } = req.body;
        const result = await recordPuzzleSolution(username, puzzleId, success, time);
        res.json(result);
    } catch (err) {
        console.error('Ошибка при записи решения:', err);
        res.status(500).json({ error: err.message });
    }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
}).on('error', (err) => {
    console.error('Ошибка запуска сервера:', err);
    process.exit(1);
});

// Добавляем обработку завершения процесса
process.on('SIGTERM', () => {
    console.log('Получен сигнал SIGTERM, закрываем соединения...');
    pool.end(() => {
        console.log('Пул соединений закрыт');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('Получен сигнал SIGINT, закрываем соединения...');
    pool.end(() => {
        console.log('Пул соединений закрыт');
        process.exit(0);
    });
});

// Функция для проверки доступа пользователя
async function checkUserAccess(username) {
    try {
        const result = await pool.query(
            'SELECT username FROM Users WHERE username = $1',
            [username]
        );
        return result.rows.length > 0;
    } catch (err) {
        console.error('Error checking user access:', err);
        return false;
    }
}

const usedPuzzles = new Set();

function generateRandomPuzzle() {
    // Набор шаблонов для разных типов задач
    const puzzleTemplates = [
        // Легкие задачи
        {
            fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1',
            move_1: 'h5f7',
            move_2: 'e8f7',
            solution: 'Good',
            type: 'Mate in 1',
            difficulty: 'easy'
        },
        {
            fen: '2rq1rk1/pb2bppp/1p2pn2/2p5/2P5/2N1P1B1/PP3PPP/R2QKB1R w KQ - 0 1',
            move_1: 'g3d6',
            move_2: 'c5d6',
            solution: 'Blunder',
            type: 'Pin',
            difficulty: 'easy'
        },
        // Средние задачи
        {
            fen: 'r4rk1/ppp2ppp/2n5/2bqp3/8/P1N5/1PP1QPPP/R1B2RK1 b - - 0 1',
            move_1: 'd5e4',
            move_2: 'c3e4',
            solution: 'Blunder',
            type: 'Fork',
            difficulty: 'medium'
        },
        {
            fen: 'r1b2rk1/2q1bppp/p2p1n2/np2p3/3PP3/2P2N2/PPB2PPP/R1BQR1K1 w - - 0 1',
            move_1: 'e4e5',
            move_2: 'd6e5',
            solution: 'Good',
            type: 'Attack',
            difficulty: 'medium'
        },
        // Сложные задачи
        {
            fen: 'r1b1k2r/ppppqppp/2n2n2/2b5/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w kq - 0 1',
            move_1: 'c4f7',
            move_2: 'e7f7',
            solution: 'Good',
            type: 'Sacrifice',
            difficulty: 'hard'
        },
        {
            fen: '2kr3r/ppp2ppp/2n5/1B1P4/4P1b1/2P1B3/P4PPP/R3K2R b KQ - 0 1',
            move_1: 'c6d5',
            move_2: 'e4d5',
            solution: 'Blunder',
            type: 'Trap',
            difficulty: 'hard'
        },
        // Добавляем новые тактические задачи
        {
            fen: '1rr3k1/3b1ppp/4pn2/p2pP3/1P1P4/P1B2N2/5PPP/2R2RK1 w - - 0 1',
            move_1: 'e5e6',
            move_2: 'd7e6',
            solution: 'Good',
            type: 'Discovered Attack',
            difficulty: 'medium'
        },
        {
            fen: 'r3k2r/ppp2ppp/2n5/3q4/2B5/2N5/PPP2PPP/R3K2R w KQkq - 0 1',
            move_1: 'c3e4',
            move_2: 'd5e4',
            solution: 'Good',
            type: 'Fork',
            difficulty: 'medium'
        },
        {
            fen: 'r1bqk2r/ppp2ppp/2n5/2bpP3/8/2N2N2/PPP2PPP/R1BQK2R w KQkq - 0 1',
            move_1: 'f3d4',
            move_2: 'c5d4',
            solution: 'Good',
            type: 'Pin',
            difficulty: 'medium'
        },
        // Добавляем позицию с пешечным шахом
        {
            fen: '1k1r4/ppp2ppp/8/2b1P3/2B5/8/PPP2PPP/2K5 w - - 0 1',
            move_1: 'e5e6',
            move_2: 'c5e3',
            solution: 'Good',
            type: 'Discovered Check',
            difficulty: 'easy'
        },
        // Заменяем на корректную позицию
        {
            fen: 'r1bqk2r/ppp2ppp/2n5/2b1p3/2B5/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1',
            move_1: 'c4f7',
            move_2: 'e8f7',
            solution: 'Good',
            type: 'Fork',
            difficulty: 'medium'
        }
    ];

    // Если все позиции были использованы, очищаем историю
    if (usedPuzzles.size >= puzzleTemplates.length) {
        usedPuzzles.clear();
    }

    // Выбираем случайную неиспользованную позицию
    let position;
    do {
        position = puzzleTemplates[Math.floor(Math.random() * puzzleTemplates.length)];
    } while (usedPuzzles.has(position.fen));

    // Добавляем позицию в использованные
    usedPuzzles.add(position.fen);
    
    // Добавляем цвет в зависимости от того, чей ход
    position.color = position.fen.includes(' w ') ? 'W' : 'B';

    // Добавляем рейтинг в зависимости от сложности
    const ratings = {
        easy: [1000, 1400],
        medium: [1400, 1800],
        hard: [1800, 2200]
    };
    const [min, max] = ratings[position.difficulty];
    position.rating = Math.floor(Math.random() * (max - min)) + min;
    
    return position;
}

// Функция для поиска задачи для пользователя
async function findPuzzleForUser(username) {
    try {
        // Генерируем случайную задачу
        const puzzle = generateRandomPuzzle();
        
        // Сохраняем задачу в базу данных
        const result = await pool.query(
            `INSERT INTO Puzzles (fen, move_1, move_2, solution, type, difficulty) 
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, fen, move_1, move_2, solution, rating, rd, volatility`,
            [
                puzzle.fen,
                puzzle.move_1,
                puzzle.move_2,
                puzzle.solution,
                puzzle.type,
                puzzle.difficulty
            ]
        );

        // Возвращаем сгенерированную задачу с ID из базы данных
        return {
            ...puzzle,
            id: result.rows[0].id,
            rating: result.rows[0].rating,
            rd: result.rows[0].rd,
            volatility: result.rows[0].volatility
        };
    } catch (err) {
        console.error('Error finding puzzle:', err);
        throw err;
    }
}

// Функция для получения рейтинга пользователя
async function getUserRating(username) {
    try {
        const result = await pool.query(
            `SELECT rating, rd, volatility 
             FROM Users 
             WHERE username = $1`,
            [username]
        );
        
        if (result.rows.length === 0) {
            // Если пользователь не найден, создаем его с начальными значениями
            const newUser = await pool.query(
                `INSERT INTO Users (username, rating, rd, volatility) 
                 VALUES ($1, 1500, 350, 0.06) 
                 RETURNING rating, rd, volatility`,
                [username]
            );
            console.log('Created new user with rating:', newUser.rows[0]);
            return newUser.rows[0];
        }
        
        console.log('Found existing user rating:', result.rows[0]);
        return result.rows[0];
    } catch (err) {
        console.error('Error getting user rating:', err);
        throw err;
    }
}

// Функция для получения рейтинга задачи
async function getPuzzleRating(puzzleId) {
    try {
        const result = await pool.query(
            'SELECT rating, rd, volatility FROM Puzzles WHERE id = $1',
            [puzzleId]
        );
        
        if (result.rows.length === 0) {
            throw new Error('Puzzle not found');
        }
        
        return {
            rating: result.rows[0].rating,
            rd: result.rows[0].rd,
            volatility: result.rows[0].volatility
        };
    } catch (err) {
        console.error('Error getting puzzle rating:', err);
        throw err;
    }
}

// Функция для получения настроек
async function getSettings() {
    try {
        const result = await pool.query('SELECT * FROM Settings');
        if (result.rows.length === 0) {
            return {
                normal_time: 60,
                tau: 0.5,
                epsilon: 0.000001
            };
        }
        return result.rows.reduce((acc, row) => {
            acc[row.parameter_name] = row.parameter_value;
            return acc;
        }, {});
    } catch (err) {
        console.error('Error getting settings:', err);
        throw err;
    }
}

// Функция для записи результата решения
async function recordPuzzleSolution(username, puzzleId, success, time) {
    try {
        console.log('Recording solution:', { username, puzzleId, success, time });
        
        // Проверка входных данных
        if (!puzzleId) {
            throw new Error('Puzzle ID is required');
        }
        if (typeof success !== 'boolean') {
            throw new Error('Success must be boolean');
        }
        
        // Убедимся, что время всегда в допустимом диапазоне
        const validTime = Math.max(1, Math.min(time, 180));

        // Получаем настройки
        const settings = await getSettings();
        const normalTime = settings.normal_time || 60;

        // Вычисляем результат
        const R = success * Math.exp(-1/normalTime * Math.log(2) * validTime);
        console.log('Calculated R:', R);

        // Получаем текущие рейтинги
        const userRating = await getUserRating(username);
        const puzzleRating = await getPuzzleRating(puzzleId);
        
        console.log('Current ratings:', { userRating, puzzleRating });
        
        // Вычисляем новые рейтинги
        const newRatings = await calculateNewRatings(userRating, puzzleRating, R);
        console.log('New ratings calculated:', newRatings);
        
        // Обновляем рейтинг пользователя
        await pool.query(
            `UPDATE Users 
             SET rating = $1, rd = $2, volatility = $3 
             WHERE username = $4`,
            [
                newRatings.userRating,
                newRatings.userRD,
                newRatings.userVolatility,
                username
            ]
        );

        // Обновляем рейтинг задачи
        await pool.query(
            `UPDATE Puzzles 
             SET rating = $1, rd = $2, volatility = $3, number = number + 1 
             WHERE id = $4`,
            [
                newRatings.puzzleRating,
                newRatings.puzzleRD,
                newRatings.puzzleVolatility,
                puzzleId
            ]
        );

        // Записываем в журнал
        await pool.query(
            `INSERT INTO Journal 
             (username, puzzle_id, success, time, rating, rd, volatility, date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            [
                username, 
                puzzleId, 
                success, 
                validTime,
                newRatings.userRating,
                newRatings.userRD,
                newRatings.userVolatility
            ]
        );

        console.log('Rating calculation details:', {
            initial: {
                user: {
                    rating: userRating.rating,
                    rd: userRating.rd,
                    volatility: userRating.volatility
                },
                puzzle: {
                    rating: puzzleRating.rating,
                    rd: puzzleRating.rd,
                    volatility: puzzleRating.volatility
                }
            },
            result: R,
            new: newRatings
        });

        return newRatings;
    } catch (err) {
        console.error('Error recording solution:', err);
        throw err;
    }
}

// Функция для вычисления новых рейтингов
async function calculateNewRatings(user, puzzle, R) {
    try {
        // Константы
        const q = Math.log(10) / 400;
        const τ = 0.5;      // Параметр системы (обычно от 0.3 до 1.2)
        const ε = 0.000001; // Точность для сходимости

        // Преобразование в шкалу Glicko-2
        const μ = (user.rating - 1500) / 173.7178;
        const φ = user.rd / 173.7178;
        const σ = user.volatility;
        const μj = (puzzle.rating - 1500) / 173.7178;
        const φj = puzzle.rd / 173.7178;

        // Функция g(φ)
        function g(φ) {
            return 1 / Math.sqrt(1 + 3 * φ * φ / (Math.PI * Math.PI));
        }

        // Функция E(μ, μj, φj)
        function E(μ, μj, φj) {
            return 1 / (1 + Math.exp(-g(φj) * (μ - μj)));
        }

        // Вычисление v
        const gφj = g(φj);
        const E_value = E(μ, μj, φj);
        const v = 1 / (gφj * gφj * E_value * (1 - E_value));

        // Вычисление Δ
        const Δ = v * gφj * (R - E_value);

        // Вычисление новой волатильности
        const a = Math.log(σ * σ);
        const f = (x) => {
            const ex = Math.exp(x);
            const part1 = ex * (Δ * Δ - φ * φ - v - ex);
            const part2 = 2 * (φ * φ + v + ex) * (φ * φ + v + ex);
            return part1 / part2 - (x - a) / (τ * τ);
        };

        // Поиск нового значения волатильности методом половинного деления
        let A = a;
        let B = f(a) < 0 ? a + τ : a - τ;
        while (Math.abs(B - A) > ε) {
            const C = A + (B - A) / 2;
            if (f(C) * f(B) < 0) {
                A = C;
            } else {
                B = C;
            }
        }

        const σ_new = Math.exp(A / 2);

        // Обновление φ и μ
        const φ_star = Math.sqrt(φ * φ + σ_new * σ_new);
        const φ_new = 1 / Math.sqrt(1 / (φ_star * φ_star) + 1 / v);
        const μ_new = μ + φ_new * φ_new * gφj * (R - E_value);

        // Преобразование обратно в оригинальную шкалу
        return {
            userRating: μ_new * 173.7178 + 1500,
            userRD: φ_new * 173.7178,
            userVolatility: σ_new,
            puzzleRating: (μj - Δ) * 173.7178 + 1500,
            puzzleRD: Math.sqrt(1 / (1 / (φj * φj) + 1 / v)) * 173.7178,
            puzzleVolatility: puzzle.volatility
        };
    } catch (err) {
        console.error('Error in rating calculation:', err);
        throw err;
    }
}

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const webAppUrl = 'https://your-domain.com'; // Замените на URL вашего приложения
    
    bot.sendMessage(chatId, 'Добро пожаловать в Chess Puzzles!', {
        reply_markup: {
            inline_keyboard: [[
                {text: 'Открыть приложение', web_app: {url: webAppUrl}}
            ]]
        }
    });
});
