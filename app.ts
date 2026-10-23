// import express from "express";
// import { createServer } from "http";
// import { Server } from "socket.io";

// const app = express();
// const httpServer = createServer(app);

// // Настраиваем CORS, чтобы фронтенд (например, на порту 5173) мог подключаться
// const io = new Server(httpServer, {
//   cors: {
//     origin: "*", // Во время разработки разрешаем любые подключения
//     methods: ["GET", "POST"],
//   },
// });

// // Хранилище всех подключенных игроков в памяти сервера
// const players: { [id: string]: any } = {};

// io.on("connection", (socket) => {
//   console.log(`Игрок подключился: ${socket.id}`);

//   // 1. Ждем, когда клиент отправит событие готовности к игре и свое имя
//   socket.on("joinGame", (data: { name: string }) => {
//     // Создаем начальные параметры танка для нового игрока на дороге (в углу карты)
//     players[socket.id] = {
//       id: socket.id,
//       name: data.name || `Игрок_${socket.id.substring(0, 4)}`,
//       x: 1150,
//       y: 700,
//       rotation: 0,
//       hp: 100,
//     };

//     // Отправляем текущему (только что вошедшему) игроку список ВСЕХ КТО УЖЕ ИГРАЕТ
//     socket.emit("currentPlayers", players);

//     // Рассылаем ВСЕМ ОСТАЛЬНЫМ игрокам информацию о том, что зашел НОВЫЙ участник
//     socket.broadcast.emit("newPlayer", players[socket.id]);
//   });

//   // 2. Синхронизация перемещения: получаем новые координаты от игрока и пересылаем остальным
//   socket.on(
//     "playerMovement",
//     (movementData: { x: number; y: number; rotation: number }) => {
//       if (players[socket.id]) {
//         players[socket.id].x = movementData.x;
//         players[socket.id].y = movementData.y;
//         players[socket.id].rotation = movementData.rotation;

//         // Говорим всем остальным обновить координаты этого танка
//         socket.broadcast.emit("playerMoved", players[socket.id]);
//       }
//     },
//   );

//   // 3. Синхронизация стрельбы: когда кто-то выстрелил, создаем пулю у всех
//   socket.on(
//     "playerFire",
//     (fireData: { x: number; y: number; rotation: number }) => {
//       // Сервер просто ретранслирует выстрел всем остальным в реальном времени
//       socket.broadcast.emit("enemyFired", {
//         playerId: socket.id,
//         x: fireData.x,
//         y: fireData.y,
//         rotation: fireData.rotation,
//       });
//     },
//   );

//   // 4. Синхронизация урона: когда пуля попадает в танк
//   socket.on("hitPlayer", (data: { targetId: string; damage: number }) => {
//     const target = players[data.targetId];
//     if (target) {
//       target.hp -= data.damage;

//       // Рассылаем всем информацию об изменении здоровья игрока
//       io.emit("playerHealthChanged", {
//         id: data.targetId,
//         hp: target.hp,
//         attackerId: socket.id,
//       });

//       // Если здоровье упало до 0 — игрок уничтожен
//       if (target.hp <= 0) {
//         io.emit("playerDestroyed", { id: data.targetId, killedBy: socket.id });
//         delete players[data.targetId]; // Удаляем его с сервера
//       }
//     }
//   });

//   // 5. Обработка отключения (закрыл вкладку, пропал интернет или нажал Выход)
//   socket.on("disconnect", () => {
//     console.log(`Игрок отключился: ${socket.id}`);
//     if (players[socket.id]) {
//       delete players[socket.id];
//       // Сообщаем всем, чтобы они удалили этот танк со своих экранов
//       io.emit("playerDisconnected", socket.id);
//     }
//   });
// });

// const PORT = 3000;
// httpServer.listen(PORT, () => {
//   console.log(`Игровой сервер запущен на http://localhost:${PORT}`);
// });

// ЛОББИ
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// Храним игроков в лобби
let lobbyPlayers: Array<{ id: string; name: string; isHost: boolean }> = [];
const activePlayersInGame: { [id: string]: any } = {};

io.on("connection", (socket) => {
  // 1. Игрок запрашивает вход в лобби
  socket.on("joinLobby", (data: { name: string }) => {
    // Если игроков нет, первый становится хостом
    const isHost = lobbyPlayers.length === 0;

    const newPlayer = {
      id: socket.id,
      name: data.name || `Игрок_${socket.id.substring(0, 4)}`,
      isHost: isHost,
    };

    lobbyPlayers.push(newPlayer);

    // Рассылаем всем обновленный список лобби
    io.emit("lobbyUpdate", lobbyPlayers);
  });

  // 2. Хост нажал кнопку "В бой"
  socket.on("startNetworkGame", () => {
    // Инициализируем позиции для всех участников лобби
    lobbyPlayers.forEach((p, index) => {
      activePlayersInGame[p.id] = {
        id: p.id,
        name: p.name,
        x: 200 + index * 150, // Распределяем по карте
        y: 600,
        rotation: 0,
        hp: 100,
      };
    });

    // Отправляем всем команду начать игру
    io.emit("gameStartedByHost");
  });

  // 3. Запрос сцены Phaser на получение участников боя (вызывается из create)
  socket.on("requestActivePlayers", () => {
    socket.emit("currentPlayers", activePlayersInGame);
    socket.broadcast.emit("newPlayer", activePlayersInGame[socket.id]);
  });

  // Игровой цикл перемещения и стрельбы (остается из прошлого шага)
  socket.on("playerMovement", (mov) => {
    if (activePlayersInGame[socket.id]) {
      activePlayersInGame[socket.id].x = mov.x;
      activePlayersInGame[socket.id].y = mov.y;
      activePlayersInGame[socket.id].rotation = mov.rotation;
      socket.broadcast.emit("playerMoved", activePlayersInGame[socket.id]);
    }
  });

  socket.on("playerFire", (data) => {
    socket.broadcast.emit("enemyFired", {
      playerId: socket.id,
      x: data.x,
      y: data.y,
      rotation: data.rotation,
    });
  });

  socket.on("disconnect", () => {
    // Удаляем из лобби
    lobbyPlayers = lobbyPlayers.filter((p) => p.id !== socket.id);

    // Если вышел хост, назначаем нового
    if (lobbyPlayers.length > 0 && !lobbyPlayers.some((p) => p.isHost)) {
      lobbyPlayers[0].isHost = true;
    }
    io.emit("lobbyUpdate", lobbyPlayers);

    // Удаляем из игры
    if (activePlayersInGame[socket.id]) {
      delete activePlayersInGame[socket.id];
      io.emit("playerDisconnected", socket.id);
    }
  });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Игровой сервер запущен на http://localhost:${PORT}`);
});
