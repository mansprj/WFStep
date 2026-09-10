# WF Step — Стратегия: Как стать лучше самых популярных

Дата: 31 августа 2026

> Статус (2 сентября 2026): Фаза 1 почти завершена. Закоммичено и запушено в
> `mansprj/WFStep` (main): рекордер на koffi (низкоуровневые хуки, без uiohook),
> SendInput-плеер с интерполяцией движения, вкладки UI, 4 темы (по умолчанию
> Midnight Blue), журнал событий макросов, команды-горячие клавиши
> (переопределяемые: start/stop/discard/play/stop playback). Остаток Фазы 1 и
> планы Фаз 2–5 — см. раздел «Фазы» ниже. Явный TODO: ручная проверка
> запись/сохранение/воспроизведение/пере-запись, Discard-хоткей, ребайнды,
> логи, тема по умолчанию.
>
> Обновление (тот же день): Фаза 2 (оконно-зависимые действия) — ПЕРВЫЙ СЛЕШ
> реализован и проверен живьём (PowerShell/.NET UIAutomation, без внешних
> зависимостей). Добавлены 3 действия в workflow:
> `activateWindow` (SetForegroundWindow по хендлу окна — проверено), `waitForWindow`
> (опрос с таймаутом), `clickText` (UIA: поиск по тексту через FromHandle +
> Invoke/Select — проверено на реальном клике меню «Файл» в Блокноте). Модуль
> `src/main/windowActions.ts`. UI-иконки/формы добавлены. Остаётся в Фазе 2:
> выбор окна пикером (listWindows по IPC), условные действия, детальные настройки
> таймаутов/области окна в UI.
>
> Выпущен релиз **v1.0.8** (коммиты запушены в main, тег v1.0.8 на GitHub).
> Автообновление работает: `latest.yml` + установщик + blockmap на релизе,
> `autoUpdater.checkForUpdates()` (github provider). Важно по упаковке koffi:
> нативный бинарь — в опциональном пакете `@koromix/koffi-win32-x64` (а НЕ в
> `koffi/vendor`); его распаковка вне asar задаётся `asarUnpack: **/node_modules/@koromix/**`.
> Заложник в `scripts/publish.ps1`: `$tag:` в Write-Host надо писать `${tag}:`
> (иначе ParseException); фикс уже в main. Fallback-загрузка через curl иногда
> «Bad hostname» — надёжнее грузить ассеты через
> `Invoke-RestMethod`/`curl` с `[uri]::EscapeDataString($name)`.
>
> Обновление (позже): добавлен ПИКЕР ОКНА. IPC `windows:list` (listWindows),
> общий тип `WindowInfo` в `src/shared/windows.ts`, кнопка «Window…» в редакторе
> шагов workflow для типов activateWindow/waitForWindow/clickText (список окон +
> выбор по номеру/имени через prompt). Закоммичено (9595756) и запушено.
>
> Обновление: ФАЗА 2 ЗАВЕРШЕНА. Условные действия: ifWindowExists/ifWindowMissing/
> ifProcessRunning/ifProcessStopped с полем `skipOnFail` (сколько следующих шагов
> пропустить, если условие ложно; 0 = остановить workflow) — даёт if/else через
> противоположное условие без нодов. Runner (workflowRunner.ts): при неуспехе
> условия с skipOnFail>0 пропускает шаги и продолжает. Добавлены windowExists/
> processRunning (PowerShell) в windowActions.ts. UI шага: поле «Skip next» для
> условий, «Window»+«Timeout» для clickText, «Timeout» для waitForWindow; пикер
> Window заполняет extras.window для clickText. Ядро: shared/actions.ts
> (типы+валидация+describe), actionForm.ts (ActionExtras, actionFromInput/
> inputFromAction с extras), StepRow в Workflows.tsx теперь {kind,value,extras}.
> Коммит `a6a6d91`.
>
> Релиз **v1.0.10** (коммит бампа `b7a096d`, тег v1.0.10, release id 384247154):
> ассеты latest.yml + wfstep-Setup-1.0.10.exe + .blockmap залиты с именами
> ровно из latest.yml, HEAD на exe = 200. ЗАЛОЖНИК ИМЁН АССЕТОВ (из 1.0.9, для
> всех будущих релизов): GitHub при `name`, где пробелы→%20, нормализует имя в
> `wfstep.Setup.<ver>.exe` (точки) — РАЗНОГЛАСИЕ с latest.yml ломает
> автообновление. Всегда передавать `name=wfstep-Setup-<ver>.exe` (= ровно то,
> что в latest.yml), затем сверять список ассетов == имена из latest.yml и
> HEAD на `.../download/v<ver>/wfstep-Setup-<ver>.exe` = 200.
> Создание release с кириллицей в body иногда ловит 400 «Problems parsing
> JSON» — ретраить с ASCII-body.
>
> Компактная запись движений мыши (коммит `61ece0f`): новый шаг макроса
> `mousePath` (массив точек) — рекордер при stop() сводит серии подряд идущих
> `mouseMove` в один mousePath (coalesceMouseMoves в macroRecorder.ts; прогон из
> 7 шагов→5, сумма delayMs сохраняется). Плеер: sweepPath идёт по сегментам
> (каждый сегмент = point.delayMs/скорость, плюс лидирующий delay). Редактор
> (Macros.tsx): серии движения — одна сворачиваемая строка «Move (N points)»,
> раскрытие показывает X/Y/Wait каждой точки (правка + удаление точки), кнопка
> удаления всего движения, drag целой группы; старые макросы с кучей mouseMove
> группируются так же при отображении. Типы/валидация/описание/длительность в
> shared/macros.ts.
> Далее: ФАЗА 3 (планировщик: cron/startup/file watcher/clipboard trigger),
> затем Фазы 4–5 — см. ниже.

---

## Ключевой вывод из исследования

На рынке автоматизации существует **дыра**, которую не закрывает ни один продукт:

| Инструмент | Простота | Мощность | Запись макросов | Редактирование | Планировщик | Процессы |
|-----------|----------|----------|----------------|---------------|-------------|----------|
| TinyTask | ★★★★★ | ★☆☆☆☆ | ✅ | ❌ | ❌ | ❌ |
| AutoHotkey | ★★☆☆☆ | ★★★★★ | ❌ | ✅ (код) | ❌ | ❌ |
| Keybind | ★★★★☆ | ★★★★☆ | ❌ | ✅ (KSL) | ✅ | ❌ |
| Loopi | ★★★☆☆ | ★★★★★ | ❌ | ✅ (ноды) | ✅ | ❌ |
| **WF Step** | **★★★★★** | **★★☆☆☆** | **❌** | **✅** | **❌** | **✅** |

**Ни один инструмент не сочетает:**
1. Простоту TinyTask (ноль настройки)
2. Запись + редактирование макросов
3. Умные действия (окна, процессы, не координаты)
4. Планировщик
5. Горячие клавиши

WF Step может занять эту нишу.

---

## Почему популярные продукты популярны

### TinyTask (миллионы скачиваний)
- **36 KB**, портативный, zero-install
- Записал → воспроизвёл → готово
- Компилирует макросы в .exe
- Бесплатный

**Почему people его обожают:** "I press record, do my thing, press stop, press play. That's it."

**Почему people от него уходят:** "If your recording has a mistake at step 15 of 20, you cannot edit step 15. You must re-record the entire macro from scratch." + Нет условий, нет расписания, координаты ломаются при смене окна.

### AutoHotkey (20+ лет, огромное сообщество)
- Максимальная гибкость
- Тысячи готовых скриптов
- Бесплатный, open-source

**Почему people его ненавидят:** "Learning AutoHotkey properly takes weeks." "I tried, gave up after ten minutes." "AHK scripts break when apps update."

**Ключевая цитата из Reddit:** "I feel your pain. I've made 860 posts on the forum over 8 or 9 years. I bet the first 500 posts and first 5 years were 100% me asking for help."

### Keybind (набирает популярность)
- Free + Pro ($4.99/мес)
- Собственный язык KSL (скрипты)
- Голосовое управление, OCR, маркетплейс

**Почему растёт:** Позиционируется как "AutoHotkey, но лучше". Все-в-одном.

**Почему может проиграть:** Слишком много функций = сложность. KSL = всё ещё скриптовый язык.

---

## Почему провальные продукты провальные

| Продукт | Звёзды | Причина провала |
|---------|--------|-----------------|
| ForgeFlow | 9 | Go+React стек, node-based (сложно), нет tray |
| Loopi | 190 | Много фич, но node-based = сложность для обычных людей |
| Macronaut | 2 | 77 MB exe, проприетарный, не open-source |
| Clickweave | ? | В разработке, не выпущен |
| Prism | ? | AI-dependent, нужен API ключ |
| CORTEX | ? | Enterprise-level, multi-agent, overkill |

**Паттерн:** Продукты с node-based редактором набирают звёзды у разработчиков, но **не привлекают обычных пользователей**. TinyTask побеждает за счёт простоты.

---

## Стратегия WF Step: 5 фаз

### Фаза 1: Запись + Редактирование (MVP Killer Feature)
**Цель:** Заменить TinyTask для тех, кому нужно больше.

**Что делать:**
1. **Record mouse + keyboard** — запись действий пользователя
2. **Macro Editor** — редактирование отдельных шагов (при TinyTask это невозможно!)
3. **Replay** — воспроизведение с горячей клавишей
4. **Speed control** — 0.5x - 10x скорость
5. **Loop** — количество повторов или бесконечный цикл

**Почему это убьёт TinyTask:**
- TinyTask: "Записал → ошибка → перезаписывай всё заново"
- WF Step: "Записал → отредактировал шаг 15 → готово"

**Ключевое:** Это самая частая жалоба на TinyTask в Reddit (5+ упоминаний в каждом сравнительном обзоре).

**Срок:** 2-3 недели

---

### Фаза 2: Умные действия (Window-Aware Automation)
**Цель:** Заменить AutoHotkey для 90% задач без скриптов.

**Что делать:**
1. **Find window by name** — "Найди окно 'Chrome'" вместо координат
2. **Click element by name** — "Нажми кнопку 'OK'" через UIA (не координаты!)
3. **Conditional actions** — "Если окно X открыто, сделай Y"
4. **Wait for window** — "Жди пока появится окно Chrome"
5. **Shell commands** — выполнение команд (уже есть)

**Почему это убьёт AHK для обычных людей:**
- AHK: "Напиши 20 строк кода с WinActivate, ControlClick, IfWinExist"
- WF Step: "Выбери из списка: Найти окно → Нажми элемент → Жди 2 сек"

**Ключевой инсайт из исследования:** "UIA-first makes the assistant feel less like a demo and more like an operator." — Агенты, использующие UIA вместо координат, работают надёжнее в 10 раз.

**Срок:** 3-4 недели

---

### Фаза 3: Планировщик (Scheduler)
**Цель:** Заменить Clockwork + Windows Task Scheduler.

**Что делать:**
1. **Cron/schedule** — запуск по расписанию
2. **Startup trigger** — запуск при входе в Windows
3. **File watcher** — запуск при изменении файла
4. **Clipboard trigger** — запуск при копировании текста
5. **Hotkey trigger** — запуск по горячей клавише (уже есть)

**Почему это важно:**
- "No scheduling built in. You need Windows Task Scheduler or a third-party tool." — жалоба на TinyTask
- Keybind имеет планировщик, WF Step — нет

**Срок:** 2 недели

---

### Фаза 4: Визуальный редактор (Simple Flow Editor)
**Цель:** Сделать воркфлоу доступным без нод.

**Что делать:**
1. **Список действий** (не ноды!) — простой список с drag-and-drop
2. **Условия** — если/точка-иначе через визуальный интерфейс
3. **Переменные** — передача данных между шагами
4. **Undo/Redo** — отмена изменений
5. **Import/Export** — JSON формат

**Ключевой дизайн-принцип:**
- Loopi/ForgeFlow: нод-based → красиво, но сложно для обычных людей
- WF Step: список → просто, понятно, как треклист в музыкальном плеере

**Почему это победит:**
- "I do this exact sequence twenty times a day" — это про список, не про ноды
- Macronaut (2 звезды) = ноды. TinyTask (миллионы) = кнопка play

**Срок:** 4-6 недель

---

### Фаза 5: Сообщество (Community)
**Цель:** Создать экосистему.

**Что делать:**
1. **Template marketplace** — скачивание готовых воркфлоу
2. **Share as .exe** — компиляция в портативный файл
3. **JSON export** — обмен конфигами
4. **Import из TinyTask** — конвертер .rec → WF Step
5. **Import из AHK** — конвертер .ahk → WF Step (базовый)

**Почему это важно:**
- AHK вырос за счёт сообщества (тысячи скриптов на форуме)
- Loopi имеет community templates
- Keybind имеет маркетплейс

**Срок:** 2 недели (параллельно с фазой 4)

---

## Что НЕ делать

### ❌ Не делать node-based редактор
Loopi (190 звёзд) и ForgeFlow (9 звёзд) показывают: ноды привлекают разработчиков, но отпугивают обычных людей. Macronaut с нодами набрал 2 звезды. TinyTask с одной кнопкой — миллионы.

### ❌ Не делать AI-first
Prism, Atlas, CORTEX, Deka — все AI-продукты либо в разработке, либо платные, либо enterprise. AI — это модно, но не решает базовую проблему: "я хочу автоматизировать повторяющееся действие."

### ❌ Не делать скриптовый язык
Keybind (KSL), Codeonix (Python/Node.js), ShellForge (PowerShell) — скрипты отпугивают 95% пользователей. "I tried, gave up after ten minutes."

### ❌ Не делать enterprise
AstronRPA, CORTEX, Deka — enterprise-продукты не интересуют домашних пользователей.

### ❌ Не делать кроссплатформенность сейчас
Пока — фокус на Windows. 90% целевой аудитории на Windows. macOS/Linux — потом.

---

## Уникальные преимущества WF Step

1. **Process Management** — ни один конкурент не сочетает управление процессами + воркфлоу + горячие клавиши
2. **Applications Library** — сохранение приложений с путями и перезапуск — уникальная фича
3. **Clean Architecture** — Electron + IPC + React, готов к плагинам
4. **Бесплатность** — полностью бесплатный
5. **Современный UI** — чище, чем TinyTask/AHK/Executor

---

## Конкурентные позиции

### WF Step vs TinyTask
| | TinyTask | WF Step |
|---|---------|---------|
| Запись макросов | ✅ | ✅ (Фаза 1) |
| Редактирование | ❌ | ✅ (Фаза 1) |
| Умные действия | ❌ | ✅ (Фаза 2) |
| Планировщик | ❌ | ✅ (Фаза 3) |
| Процессы | ❌ | ✅ |
| Размер | 36 KB | ~100 MB |
| Портативность | ✅ | ❌ (установщик) |

### WF Step vs AutoHotkey
| | AutoHotkey | WF Step |
|---|-----------|---------|
| Простота | ★★☆☆☆ | ★★★★★ |
| Мощность | ★★★★★ | ★★★☆☆ |
| Запись макросов | ❌ (только скрипты) | ✅ |
| UI | Терминал/текст | GUI |
| Сообщество | Огромное | Нужно строить |
| Скорость старта | Недели | Минуты |

### WF Step vs Keybind
| | Keybind | WF Step |
|---|---------|---------|
| Цена | Free/Pro $4.99 | Бесплатно |
| Сложность | Средняя (KSL) | Низкая |
| Процессы | ❌ | ✅ |
| Applications Library | ❌ | ✅ |
| Голос | ✅ | ❌ |

---

## Рекомендуемый порядок развития

```
Сейчас (v1.0.7)
    │
    ▼
Фаза 1: Macro Recording + Editor (2-3 недели)
    │  → TinyTask Killer Feature
    ▼
Фаза 2: Window-Aware Actions (3-4 недели)
    │  → AHK Killer Feature (для не-программистов)
    ▼
Фаза 3: Scheduler (2 недели)
    │  → Clockwork Killer Feature
    ▼
Фаза 4: Simple Flow Editor (4-6 недель)
    │  → Loopi/ForgeFlow Killer Feature (проще)
    ▼
Фаза 5: Community (параллельно)
       → Экосистема
```

**Общий срок до полного product-market fit: 3-4 месяца**

---

## Метрики успеха

| Фаза | Метрика | Цель |
|------|---------|------|
| 1 | Записи в день | 100+ |
| 2 | Воркфлоу создано | 500+ |
| 3 | Автозапусков в день | 1000+ |
| 4 | Скачиваний | 10000+ |
| 5 | Шаблонов в сообществе | 100+ |

---

## Резюме

WF Step должен стать **"TinyTask, который не ломается"**:
- Записал → отредактировал → воспроизвёл
- Не координаты, а имена окон/элементов
- Не скрипты, а GUI
- Не node-based, а простой список
- Не enterprise, а для каждого

**Слоган:** "Automate your PC. No code. No hassle."
