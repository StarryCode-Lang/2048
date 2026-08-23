export const LANGUAGES = [
  { code: "zh", short: "中", nativeName: "中文", dir: "ltr" },
  { code: "en", short: "EN", nativeName: "English", dir: "ltr" },
  { code: "fr", short: "FR", nativeName: "Français", dir: "ltr" },
  { code: "es", short: "ES", nativeName: "Español", dir: "ltr" },
  { code: "ru", short: "РУ", nativeName: "Русский", dir: "ltr" },
  { code: "ar", short: "ع", nativeName: "العربية", dir: "rtl" },
] as const;

export type Language = typeof LANGUAGES[number]["code"];

const zh = {
  eyebrow: "数字合成游戏", score: "分数", best: "最高", boardSize: "棋盘大小", undo: "撤销上一步",
  aiUndoBlocked: "AI 挑战中禁止撤回", soundOff: "关闭背景音乐和音效", soundOn: "开启背景音乐和音效",
  light: "切换浅色", dark: "切换深色", help: "查看玩法", newGame: "新游戏", aiChallenge: "AI 自动挑战",
  aiSpeed: "AI 运行速度", pause: "暂停", start: "开始", routeLabel: "AI 采用左上角保角蛇形路线",
  anchor: "左上锚点", endgame: "残局深算", sequence: "建立序列", lock: "最大块保角", recover: "大数回收",
  preserveSearch: "保角优先 · 全盘搜索", officialFair: "官方随机 · AI 0 撤回", aiMoves: "AI 步数",
  lookahead: "前瞻", levels: "层", movedTiles: "移动块", elapsed: "耗时", currentRound: "当前局",
  record: "历史最高", steps: "步", boardAria: "2048 棋盘，当前最高数字", winAria: "你合成了 2048",
  achieved: "你做到了！", made2048: "成功合成 2048", continueChallenge: "继续挑战", gameOver: "本局结束",
  undoOne: "撤销一步", aiAgain: "AI 再挑战", roundStats: "本局统计", maxTile: "最大方块",
  aiRunning: "AI 正在运行", swipe: "滑动移动", gameplay: "玩法：", gameplayText: "让两个相同数字相撞，它们就会合二为一。",
  musicPrompt: "轻触开启背景音乐", switchPrompt: "切换到", newPrompt: "开始新游戏？",
  replaceProgress: "当前进度会被替换，各模式的最高分仍会保留。", continueRound: "继续本局", switchMode: "切换模式",
  restart: "重新开始", closeHelp: "关闭玩法说明", howTo: "怎么玩", fair: "公平", understood: "知道了",
  help1: "在棋盘上向上、下、左、右滑动。", help2: "相同数字相撞后，会合并并计入分数。",
  help3: "合成 2048 即达成目标，也可以继续挑战更高数字。", helpFair: "有效移动后，空格等概率生成新块：90% 为 2，10% 为 4。",
  helpAi: "AI 不预知随机块、不自动撤回；随时暂停或直接滑动接管。", keyboard: "电脑可使用方向键或 W A S D；⌘/Ctrl + Z 撤销。",
  waiting: "等待开始", paused: "已暂停", takeover: "已由你接管", fairEnd: "挑战结束 · 公平模式不撤回",
  continued: "突破 2048，继续挑战", undoWait: "撤销后等待", modeChanged: "模式已切换", planning: "正在规划左上蛇形链",
  noMoves: "挑战结束 · 已无合法移动", fastDecision: "快速决策", fairForward: "公平前向", nextTarget: "下一个目标",
  language: "语言", chooseLanguage: "选择界面语言", chooseSpeed: "选择 AI 运行速度", exportCurrentHint: "导出当前完整对局日志",
  exportRecordHint: "导出历史最高分完整日志", exportedCurrent: "当前对局日志已导出", exportedRecord: "历史最高分日志已导出", exportFailed: "日志导出失败，请重试",
  scoreLine: (score: number, moves: number) => `得分 ${score} · 共 ${moves} 步`,
  boardLabel: (size: number, max: number) => `${size} 乘 ${size} 的 2048 棋盘，当前最高数字 ${max}`,
  direction: { up: "向上", down: "向下", left: "向左", right: "向右" },
  speeds: ["极速", "100ms", "500ms"],
};

type Translation = {
  [Key in keyof typeof zh]: typeof zh[Key] extends (...args: infer Args) => infer Result
    ? (...args: Args) => Result
    : typeof zh[Key] extends readonly string[]
      ? readonly string[]
      : typeof zh[Key] extends Record<string, string>
        ? Record<keyof typeof zh[Key], string>
        : string;
};

const en: Translation = {
  eyebrow: "NUMBER MERGE GAME", score: "SCORE", best: "BEST", boardSize: "Board size", undo: "Undo last move",
  aiUndoBlocked: "Undo is disabled during AI challenge", soundOff: "Turn off music and sound", soundOn: "Turn on music and sound",
  light: "Use light theme", dark: "Use dark theme", help: "How to play", newGame: "New game", aiChallenge: "AI Challenge",
  aiSpeed: "AI speed", pause: "Pause", start: "Start", routeLabel: "AI top-left anchored snake route",
  anchor: "Top-left anchor", endgame: "Deep endgame", sequence: "Build sequence", lock: "Corner lock", recover: "Large-tile recovery",
  preserveSearch: "Corner first · Full-board search", officialFair: "Official random · AI 0 undos", aiMoves: "AI moves",
  lookahead: "Lookahead", levels: "ply", movedTiles: "Moved", elapsed: "Time", currentRound: "Current",
  record: "Best record", steps: "moves", boardAria: "2048 board, current largest tile", winAria: "You made 2048",
  achieved: "You did it!", made2048: "You created 2048", continueChallenge: "Keep going", gameOver: "Game over",
  undoOne: "Undo one", aiAgain: "AI retry", roundStats: "Game statistics", maxTile: "Largest tile",
  aiRunning: "AI is running", swipe: "Swipe to move", gameplay: "How to play: ", gameplayText: "Join two equal tiles to merge them into one.",
  musicPrompt: "Tap to enable music", switchPrompt: "Switch to", newPrompt: "Start a new game?",
  replaceProgress: "Current progress will be replaced. Best scores for every mode are kept.", continueRound: "Keep playing", switchMode: "Switch mode",
  restart: "Restart", closeHelp: "Close instructions", howTo: "How to play", fair: "Fair", understood: "Got it",
  help1: "Swipe up, down, left, or right on the board.", help2: "Equal tiles merge on contact and add to your score.",
  help3: "Create 2048 to reach the goal, then continue toward larger tiles.", helpFair: "After a valid move, a uniformly chosen empty cell gets a 2 (90%) or 4 (10%).",
  helpAi: "The AI cannot preview random tiles or undo. Pause it or swipe to take control.", keyboard: "On desktop, use arrow keys or W A S D; ⌘/Ctrl + Z undoes a human move.",
  waiting: "Ready", paused: "Paused", takeover: "You took control", fairEnd: "Challenge over · No AI undo",
  continued: "2048 reached — continuing", undoWait: "Waiting after undo", modeChanged: "Mode changed", planning: "Planning the top-left snake chain",
  noMoves: "Challenge over · No legal moves", fastDecision: "Fast decision", fairForward: "Fair forward play", nextTarget: "Next target",
  language: "Language", chooseLanguage: "Choose interface language", chooseSpeed: "Choose AI speed", exportCurrentHint: "Export the complete current-game log",
  exportRecordHint: "Export the best-score game log", exportedCurrent: "Current-game log exported", exportedRecord: "Best-score log exported", exportFailed: "Export failed. Please try again.",
  scoreLine: (score, moves) => `Score ${score} · ${moves} moves`, boardLabel: (size, max) => `${size} by ${size} 2048 board, largest tile ${max}`,
  direction: { up: "Up", down: "Down", left: "Left", right: "Right" }, speeds: ["Fast", "100ms", "500ms"],
};

const fr: Translation = {
  ...en,
  eyebrow: "JEU DE FUSION", score: "SCORE", best: "RECORD", boardSize: "Taille du plateau", undo: "Annuler le dernier coup",
  aiUndoBlocked: "Annulation interdite pendant le défi IA", soundOff: "Couper la musique et les sons", soundOn: "Activer la musique et les sons",
  light: "Thème clair", dark: "Thème sombre", help: "Règles du jeu", newGame: "Nouvelle partie", aiChallenge: "Défi automatique IA",
  aiSpeed: "Vitesse de l’IA", pause: "Pause", start: "Démarrer", routeLabel: "Parcours en serpentin ancré en haut à gauche", anchor: "Ancrage en haut à gauche", endgame: "Finale approfondie",
  sequence: "Construire la suite", lock: "Verrouillage du coin", recover: "Récupération des grandes tuiles", preserveSearch: "Coin prioritaire · Recherche globale",
  officialFair: "Aléatoire officiel · 0 annulation IA", aiMoves: "Coups IA", lookahead: "Anticipation", levels: "plis", movedTiles: "Déplacées",
  elapsed: "Temps", currentRound: "Partie actuelle", record: "Meilleur score", steps: "coups", achieved: "Bravo !", made2048: "Vous avez créé 2048",
  continueChallenge: "Continuer", gameOver: "Partie terminée", undoOne: "Annuler", aiAgain: "Relancer l’IA", roundStats: "Statistiques",
  maxTile: "Tuile maximale", aiRunning: "L’IA joue", swipe: "Glissez pour déplacer", gameplay: "Règle : ", gameplayText: "Fusionnez deux tuiles identiques.",
  musicPrompt: "Touchez pour activer la musique", switchPrompt: "Passer en", newPrompt: "Nouvelle partie ?", replaceProgress: "La progression actuelle sera remplacée. Les records de chaque mode seront conservés.",
  continueRound: "Continuer", switchMode: "Changer de mode", restart: "Recommencer", closeHelp: "Fermer les règles", howTo: "Comment jouer", fair: "Équité", understood: "Compris",
  help1: "Glissez vers le haut, le bas, la gauche ou la droite.", help2: "Deux tuiles égales fusionnent et augmentent le score.", help3: "Créez 2048, puis continuez vers des tuiles plus grandes.",
  helpFair: "Après un coup valide, une case vide uniforme reçoit un 2 (90 %) ou un 4 (10 %).", helpAi: "L’IA ne voit pas les tuiles aléatoires et n’annule jamais. Mettez-la en pause ou glissez pour reprendre la main.",
  keyboard: "Sur ordinateur : flèches ou W A S D ; ⌘/Ctrl + Z annule un coup humain.", waiting: "Prêt", paused: "En pause", takeover: "Vous avez repris la main",
  fairEnd: "Défi terminé · Aucune annulation IA", continued: "2048 atteint — poursuite", undoWait: "En attente après annulation", modeChanged: "Mode modifié",
  planning: "Planification de la chaîne en serpentin", noMoves: "Défi terminé · Aucun coup légal", fastDecision: "Décision rapide", fairForward: "Jeu équitable en avant", nextTarget: "Prochain objectif",
  language: "Langue", chooseLanguage: "Choisir la langue", chooseSpeed: "Choisir la vitesse de l’IA", exportCurrentHint: "Exporter le journal complet de cette partie",
  exportRecordHint: "Exporter le journal du record", exportedCurrent: "Journal de la partie exporté", exportedRecord: "Journal du record exporté", exportFailed: "Échec de l’exportation. Réessayez.",
  scoreLine: (score, moves) => `Score ${score} · ${moves} coups`, boardLabel: (size, max) => `Plateau 2048 ${size} par ${size}, tuile maximale ${max}`,
  direction: { up: "Haut", down: "Bas", left: "Gauche", right: "Droite" }, speeds: ["Rapide", "100ms", "500ms"],
};

const es: Translation = {
  ...en,
  eyebrow: "JUEGO DE FUSIÓN", score: "PUNTOS", best: "RÉCORD", boardSize: "Tamaño del tablero", undo: "Deshacer último movimiento",
  aiUndoBlocked: "No se puede deshacer durante el reto de IA", soundOff: "Desactivar música y sonido", soundOn: "Activar música y sonido",
  light: "Tema claro", dark: "Tema oscuro", help: "Cómo jugar", newGame: "Nueva partida", aiChallenge: "Desafío automático de IA",
  aiSpeed: "Velocidad de IA", pause: "Pausar", start: "Iniciar", routeLabel: "Ruta serpenteante anclada arriba a la izquierda", anchor: "Anclaje superior izquierdo", endgame: "Final profundo",
  sequence: "Crear secuencia", lock: "Bloqueo de esquina", recover: "Recuperar fichas grandes", preserveSearch: "Esquina primero · Búsqueda global",
  officialFair: "Azar oficial · IA sin deshacer", aiMoves: "Mov. IA", lookahead: "Anticipación", levels: "capas", movedTiles: "Movidas", elapsed: "Tiempo",
  currentRound: "Partida actual", record: "Mejor récord", steps: "mov.", achieved: "¡Lo lograste!", made2048: "Has creado 2048", continueChallenge: "Continuar",
  gameOver: "Fin de partida", undoOne: "Deshacer", aiAgain: "Reintentar con IA", roundStats: "Estadísticas", maxTile: "Ficha mayor",
  aiRunning: "La IA está jugando", swipe: "Desliza para mover", gameplay: "Cómo jugar: ", gameplayText: "Une dos fichas iguales para fusionarlas.",
  musicPrompt: "Toca para activar la música", switchPrompt: "Cambiar a", newPrompt: "¿Nueva partida?", replaceProgress: "Se reemplazará el progreso actual. Se conservarán los récords de cada modo.",
  continueRound: "Seguir jugando", switchMode: "Cambiar modo", restart: "Reiniciar", closeHelp: "Cerrar instrucciones", howTo: "Cómo jugar", fair: "Justo", understood: "Entendido",
  help1: "Desliza arriba, abajo, izquierda o derecha.", help2: "Las fichas iguales se fusionan y suman puntos.", help3: "Crea 2048 y sigue hacia fichas más grandes.",
  helpFair: "Tras un movimiento válido, una casilla vacía uniforme recibe un 2 (90 %) o un 4 (10 %).", helpAi: "La IA no ve fichas aleatorias ni deshace. Pausa o desliza para tomar el control.",
  keyboard: "En ordenador: flechas o W A S D; ⌘/Ctrl + Z deshace un movimiento humano.", waiting: "Listo", paused: "Pausado", takeover: "Has tomado el control",
  fairEnd: "Reto terminado · IA sin deshacer", continued: "2048 alcanzado — continuando", undoWait: "Esperando tras deshacer", modeChanged: "Modo cambiado",
  planning: "Planificando la cadena serpenteante", noMoves: "Reto terminado · Sin movimientos legales", fastDecision: "Decisión rápida", fairForward: "Juego justo hacia delante", nextTarget: "Siguiente objetivo",
  language: "Idioma", chooseLanguage: "Elegir idioma", chooseSpeed: "Elegir velocidad de IA", exportCurrentHint: "Exportar el registro completo de esta partida",
  exportRecordHint: "Exportar el registro del récord", exportedCurrent: "Registro de la partida exportado", exportedRecord: "Registro del récord exportado", exportFailed: "Error al exportar. Inténtalo de nuevo.",
  scoreLine: (score, moves) => `Puntos ${score} · ${moves} mov.`, boardLabel: (size, max) => `Tablero 2048 de ${size} por ${size}, ficha mayor ${max}`,
  direction: { up: "Arriba", down: "Abajo", left: "Izquierda", right: "Derecha" }, speeds: ["Rápido", "100ms", "500ms"],
};

const ru: Translation = {
  ...en,
  eyebrow: "ИГРА 2048", score: "СЧЁТ", best: "РЕКОРД", boardSize: "Размер поля", undo: "Отменить последний ход",
  aiUndoBlocked: "Во время игры ИИ отмена запрещена", soundOff: "Выключить музыку и звук", soundOn: "Включить музыку и звук",
  light: "Светлая тема", dark: "Тёмная тема", help: "Как играть", newGame: "Новая игра", aiChallenge: "Автоигра ИИ",
  aiSpeed: "Скорость ИИ", pause: "Пауза", start: "Старт", routeLabel: "Змейка с якорем в левом верхнем углу", anchor: "Якорь слева сверху", endgame: "Глубокий эндшпиль",
  sequence: "Построение цепи", lock: "Фиксация угла", recover: "Сбор крупных плиток", preserveSearch: "Угол прежде всего · Поиск по полю",
  officialFair: "Официальный рандом · 0 отмен ИИ", aiMoves: "Ходы ИИ", lookahead: "Глубина", levels: "сл.", movedTiles: "Сдвинуто", elapsed: "Время",
  currentRound: "Текущая игра", record: "Лучший результат", steps: "ходов", achieved: "Получилось!", made2048: "Вы собрали 2048", continueChallenge: "Продолжить",
  gameOver: "Игра окончена", undoOne: "Отменить", aiAgain: "Повтор ИИ", roundStats: "Статистика", maxTile: "Макс. плитка",
  aiRunning: "ИИ играет", swipe: "Проведите для хода", gameplay: "Правила: ", gameplayText: "Соединяйте две одинаковые плитки.",
  musicPrompt: "Коснитесь, чтобы включить музыку", switchPrompt: "Переключить на", newPrompt: "Начать новую игру?", replaceProgress: "Текущий прогресс будет заменён. Рекорды всех режимов сохранятся.",
  continueRound: "Продолжить", switchMode: "Сменить режим", restart: "Начать заново", closeHelp: "Закрыть правила", howTo: "Как играть", fair: "Честно", understood: "Понятно",
  help1: "Проведите вверх, вниз, влево или вправо.", help2: "Одинаковые плитки объединяются и добавляют очки.", help3: "Соберите 2048 и продолжайте к большим плиткам.",
  helpFair: "После допустимого хода равновероятная пустая клетка получает 2 (90 %) или 4 (10 %).", helpAi: "ИИ не видит случайные плитки и не отменяет ходы. Поставьте на паузу или проведите, чтобы продолжить самому.",
  keyboard: "На компьютере: стрелки или W A S D; ⌘/Ctrl + Z отменяет ход игрока.", waiting: "Готов", paused: "Пауза", takeover: "Вы продолжили игру",
  fairEnd: "Испытание завершено · Без отмен ИИ", continued: "2048 достигнуто — продолжаем", undoWait: "Ожидание после отмены", modeChanged: "Режим изменён",
  planning: "Планирование змейки из левого верхнего угла", noMoves: "Испытание завершено · Нет ходов", fastDecision: "Быстрое решение", fairForward: "Честная игра без возврата", nextTarget: "Следующая цель",
  language: "Язык", chooseLanguage: "Выбрать язык интерфейса", chooseSpeed: "Выбрать скорость ИИ", exportCurrentHint: "Экспортировать полный журнал игры",
  exportRecordHint: "Экспортировать журнал рекорда", exportedCurrent: "Журнал игры экспортирован", exportedRecord: "Журнал рекорда экспортирован", exportFailed: "Не удалось экспортировать. Повторите попытку.",
  scoreLine: (score, moves) => `Счёт ${score} · ${moves} ходов`, boardLabel: (size, max) => `Поле 2048 ${size} на ${size}, макс. плитка ${max}`,
  direction: { up: "Вверх", down: "Вниз", left: "Влево", right: "Вправо" }, speeds: ["Быстро", "100ms", "500ms"],
};

const ar: Translation = {
  ...en,
  eyebrow: "لعبة دمج الأرقام", score: "النقاط", best: "الأفضل", boardSize: "حجم اللوحة", undo: "تراجع عن الحركة الأخيرة",
  aiUndoBlocked: "التراجع ممنوع أثناء تحدي الذكاء الاصطناعي", soundOff: "إيقاف الموسيقى والصوت", soundOn: "تشغيل الموسيقى والصوت",
  light: "المظهر الفاتح", dark: "المظهر الداكن", help: "طريقة اللعب", newGame: "لعبة جديدة", aiChallenge: "تحدي الذكاء الاصطناعي",
  aiSpeed: "سرعة الذكاء الاصطناعي", pause: "إيقاف مؤقت", start: "ابدأ", routeLabel: "مسار متعرج مثبت في أعلى اليسار", anchor: "تثبيت أعلى اليسار", endgame: "حساب عميق للنهاية",
  sequence: "بناء التسلسل", lock: "تثبيت الزاوية", recover: "استعادة القطع الكبيرة", preserveSearch: "الزاوية أولاً · بحث شامل",
  officialFair: "عشوائية رسمية · بلا تراجع للذكاء الاصطناعي", aiMoves: "حركات AI", lookahead: "استباق", levels: "طبقات", movedTiles: "المتحركة", elapsed: "الوقت",
  currentRound: "الجولة الحالية", record: "أفضل سجل", steps: "حركات", achieved: "لقد نجحت!", made2048: "أنشأت 2048", continueChallenge: "متابعة التحدي",
  gameOver: "انتهت اللعبة", undoOne: "تراجع", aiAgain: "إعادة تحدي AI", roundStats: "إحصاءات الجولة", maxTile: "أكبر قطعة",
  aiRunning: "الذكاء الاصطناعي يلعب", swipe: "اسحب للتحريك", gameplay: "طريقة اللعب: ", gameplayText: "ادمج قطعتين متساويتين في قطعة واحدة.",
  musicPrompt: "المس لتشغيل الموسيقى", switchPrompt: "التبديل إلى", newPrompt: "بدء لعبة جديدة؟", replaceProgress: "سيُستبدل التقدم الحالي، مع الاحتفاظ بأفضل نتيجة لكل وضع.",
  continueRound: "متابعة الجولة", switchMode: "تبديل الوضع", restart: "إعادة البدء", closeHelp: "إغلاق التعليمات", howTo: "طريقة اللعب", fair: "عادل", understood: "فهمت",
  help1: "اسحب على اللوحة إلى أعلى أو أسفل أو يسار أو يمين.", help2: "تندمج القطع المتساوية وتُضاف قيمتها إلى النقاط.", help3: "أنشئ 2048 ثم واصل للوصول إلى قطع أكبر.",
  helpFair: "بعد حركة صالحة، تحصل خانة فارغة عشوائية بالتساوي على 2 (90٪) أو 4 (10٪).", helpAi: "لا يرى الذكاء الاصطناعي القطع العشوائية ولا يتراجع. أوقفه أو اسحب لتتولى اللعب.",
  keyboard: "على الكمبيوتر: الأسهم أو W A S D؛ و⌘/Ctrl + Z للتراجع عن حركة بشرية.", waiting: "جاهز", paused: "متوقف مؤقتًا", takeover: "توليت التحكم",
  fairEnd: "انتهى التحدي · بلا تراجع للذكاء الاصطناعي", continued: "تم بلوغ 2048 — متابعة", undoWait: "انتظار بعد التراجع", modeChanged: "تم تغيير الوضع",
  planning: "تخطيط السلسلة المتعرجة من أعلى اليسار", noMoves: "انتهى التحدي · لا حركات صالحة", fastDecision: "قرار سريع", fairForward: "لعب عادل للأمام", nextTarget: "الهدف التالي",
  language: "اللغة", chooseLanguage: "اختر لغة الواجهة", chooseSpeed: "اختر سرعة الذكاء الاصطناعي", exportCurrentHint: "تصدير السجل الكامل للجولة الحالية",
  exportRecordHint: "تصدير سجل أعلى نتيجة", exportedCurrent: "تم تصدير سجل الجولة", exportedRecord: "تم تصدير سجل أعلى نتيجة", exportFailed: "تعذر التصدير. حاول مرة أخرى.",
  scoreLine: (score, moves) => `النقاط ${score} · ${moves} حركات`, boardLabel: (size, max) => `لوحة 2048 بحجم ${size} × ${size}، أكبر قطعة ${max}`,
  direction: { up: "أعلى", down: "أسفل", left: "يسار", right: "يمين" }, speeds: ["فائق", "100ms", "500ms"],
};

export const TRANSLATIONS: Record<Language, Translation> = { zh, en, fr, es, ru, ar };

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language.code === value);
}
