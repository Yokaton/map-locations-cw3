    const ROWS = 6; // 2. НАСТРОЙКА СЕТКИ
    const COLS = 10;

    let selectedCells = new Set();
    let selectedLocation = null;
    let currentRoute = null;
    let routeTransitions = {};
    let devMode = false; // Режим разработчика (будет удален после теста, обычные игроки не смогут увидеть все локации)

    function renderMap() {
        const container = document.getElementById('grid10x6');
        container.innerHTML = '';

        for (let row = 1; row <= ROWS; row++) {
            for (let col = 1; col <= COLS; col++) {
                const cellId = `${row}_${col}`;
                const isSelected = selectedCells.has(cellId);
                const cellDiv = document.createElement('div');
                cellDiv.className = 'cell';
                if (isSelected) cellDiv.classList.add('selected');
                cellDiv.innerHTML = `<span>${row}:${col}</span>`;
                cellDiv.onclick = (function (id) {
                    return function () {
                        if (selectedCells.has(id)) {
                            selectedCells.delete(id);
                        } else {
                            selectedCells.add(id);
                        }
                        renderMap();
                    };
                })(cellId);
                container.appendChild(cellDiv);
            }
        }
    }

    // 3. ОПРЕДЕЛЕНИЕ ЛОКАЦИИ
    function identifyLocation() {
        const selectedArray = Array.from(selectedCells).sort();
        if (selectedArray.length === 0) {
            document.getElementById('locationResult').innerHTML = "❓ Нет отметок";
            document.getElementById('locationResult').className = "location-name";
            document.getElementById('locationDescription').style.display = 'none';
            selectedLocation = null;
            return;
        }

        let matchingLocations = [];

        for (let [locName, data] of Object.entries(locationsDB)) {
            const locTransitions = [...data.transitions].sort();
            if (JSON.stringify(locTransitions) === JSON.stringify(selectedArray)) {
                matchingLocations.push(locName);
            }
        }

        const resultDiv = document.getElementById('locationResult');
        const descDiv = document.getElementById('locationDescription');
        const descText = document.getElementById('locationDescText');

        if (matchingLocations.length === 0) {
            resultDiv.innerHTML = "❌ Неизвестная локация<br><span style='font-size:11px'>Нет совпадений в базе</span>";
            resultDiv.className = "location-name";
            descDiv.style.display = 'none';
            selectedLocation = null;
        } else if (matchingLocations.length === 1) {
            resultDiv.innerHTML = `${matchingLocations[0]}`;
            resultDiv.className = "location-name";
            selectedLocation = matchingLocations[0];
            descText.innerHTML = locationsDB[selectedLocation].description;
            descDiv.style.display = 'block';
        } else {
            let listHtml = "⚠️ НЕСКОЛЬКО ВАРИАНТОВ:<br>";
            matchingLocations.forEach(name => {
                listHtml += `<span>📍 ${name}</span><br>`;
            });
            listHtml += "<span style='font-size:10px'>У этих локаций одинаковые переходы</span>";
            resultDiv.innerHTML = listHtml;
            resultDiv.className = "location-multiple";
            descDiv.style.display = 'none';
            selectedLocation = null;
        }
    }

    // 4. ПОИСК ПУТИ
    function findShortestPathByName(startName, endName) {
        if (startName === endName) return [startName];

        const queue = [
            [startName]
        ];
        const visited = new Set();
        visited.add(startName);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];
            const neighbors = routeGraph[current] || [];

            for (let next of neighbors) {
                if (!visited.has(next)) {
                    const newPath = [...path, next];
                    if (next === endName) return newPath;
                    visited.add(next);
                    queue.push(newPath);
                }
            }
        }
        return null;
    }

    function getRouteTransitions(path) {
        const transitions = {};

        for (let i = 0; i < path.length - 1; i++) {
            const fromLoc = path[i];
            const toLoc = path[i + 1];
            const locData = locationsDB[fromLoc];

            if (locData && locData.transitionTargets) {
                for (let [cellId, target] of Object.entries(locData.transitionTargets)) {
                    if (target === toLoc) {
                        if (!transitions[fromLoc]) {
                            transitions[fromLoc] = [];
                        }
                        transitions[fromLoc].push(cellId);
                        break;
                    }
                }
            }
        }

        return transitions;
    }

    // 5. ЗАПОЛНЕНИЕ СПИСКОВ
    function populateSelects() {
        const fromSelect = document.getElementById('routeFromSelect');
        const toSelect = document.getElementById('routeToSelect');
        const names = Object.keys(locationsDB);

        fromSelect.innerHTML = '';
        toSelect.innerHTML = '';

        names.forEach(name => {
            const opt1 = document.createElement('option');
            opt1.value = name;
            opt1.textContent = name;
            const opt2 = document.createElement('option');
            opt2.value = name;
            opt2.textContent = name;
            fromSelect.appendChild(opt1);
            toSelect.appendChild(opt2);
        });
    }

    function showRoute() {
        const from = document.getElementById('routeFromSelect').value;
        const to = document.getElementById('routeToSelect').value;
        if (!from || !to) return;

        const path = findShortestPathByName(from, to);
        const resultDiv = document.getElementById('routeResult');
        const showRouteBtn = document.getElementById('showRouteBtn');

        if (path) {
            resultDiv.innerHTML = `КРАТЧАЙШИЙ ПУТЬ:<br> ${path.join(' → ')}<br>Длина: ${path.length - 1} переход(ов)`;
            currentRoute = path;
            routeTransitions = getRouteTransitions(path);
            selectedLocation = null;
            showRouteBtn.style.display = 'block';
        } else {
            resultDiv.innerHTML = `❌ Путь между "${from}" и "${to}" не найден`;
            currentRoute = null;
            routeTransitions = {};
            showRouteBtn.style.display = 'none';
        }
    }

    // 6. ОТОБРАЖЕНИЕ ЛОКАЦИЙ (МАРШРУТ ИЛИ ВСЕ)
    function createLocationCard(locName, data, stepNumber = null, routeCellsForLoc = []) {
        const card = document.createElement('div');
        card.className = 'location-card';

        if (selectedLocation === locName) {
            card.classList.add('selected');
        }

        // Номер шага (только для маршрута)
        if (stepNumber !== null) {
            const stepBadge = document.createElement('div');
            stepBadge.className = 'step-number';
            stepBadge.textContent = stepNumber;
            card.appendChild(stepBadge);
        }

        // Заголовок
        const title = document.createElement('div');
        title.className = 'location-card-title';
        title.textContent = locName;
        card.appendChild(title);

        // Описание
        const desc = document.createElement('div');
        desc.className = 'location-card-desc';
        desc.textContent = data.description;
        card.appendChild(desc);

        // Мини-сетка
        const grid = document.createElement('div');
        grid.className = 'location-card-grid';

        for (let row = 1; row <= ROWS; row++) {
            for (let col = 1; col <= COLS; col++) {
                const cellId = `${row}_${col}`;
                const cell = document.createElement('div');
                cell.className = 'location-card-cell';

                if (data.transitions.includes(cellId)) {
                    const target = data.transitionTargets[cellId];
                    const isSelfLoop = (target === locName);
                    const isInRoute = routeCellsForLoc.includes(cellId);

                    if (isInRoute) {
                        cell.classList.add('in-route');
                    } else {
                        cell.classList.add('has-transition');
                        if (isSelfLoop) {
                            cell.classList.add('self-loop');
                        }
                    }
                }

                grid.appendChild(cell);
            }
        }

        card.appendChild(grid);

        // Клик по карточке
        card.onclick = () => {
            selectedLocation = locName;

            document.querySelectorAll('.location-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            document.getElementById('locationResult').innerHTML = `${locName}`;
            document.getElementById('locationResult').className = "location-name";
            document.getElementById('locationDescText').innerHTML = data.description;
            document.getElementById('locationDescription').style.display = 'block';

            selectedCells.clear();
            data.transitions.forEach(t => selectedCells.add(t));
            renderMap();

            if (currentRoute) {
                renderRouteLocations();
            }
        };

        return card;
    }

    function renderRouteLocations() {
        const container = document.getElementById('locationsGrid');
        container.innerHTML = '';

        if (!currentRoute || currentRoute.length === 0) return;

        document.getElementById('sectionTitle').textContent = 'МАРШРУТ';
        document.getElementById('devModeBadge').style.display = 'none';

        const routeInfoDisplay = document.getElementById('routeInfoDisplay');
        routeInfoDisplay.style.display = 'block';
        routeInfoDisplay.innerHTML = `Маршрут: ${currentRoute.join(' → ')} (подсвечены используемые переходы)`;

        // Рендерим локации СТРОГО по порядку маршрута
        currentRoute.forEach((locName, index) => {
            const data = locationsDB[locName];
            const routeCellsForLoc = routeTransitions[locName] || [];
            const card = createLocationCard(locName, data, index + 1, routeCellsForLoc);
            container.appendChild(card);
        });
    }

    function renderAllLocations() {
        const container = document.getElementById('locationsGrid');
        container.innerHTML = '';

        document.getElementById('sectionTitle').textContent = '🔧 ВСЕ ЛОКАЦИИ';
        document.getElementById('devModeBadge').style.display = 'inline-block';
        document.getElementById('routeInfoDisplay').style.display = 'none';

        for (let [locName, data] of Object.entries(locationsDB)) {
            const card = createLocationCard(locName, data, null, []);
            container.appendChild(card);
        }
    }

    function showBottomSection(mode) {
        const section = document.getElementById('bottomSection');
        const showRouteBtn = document.getElementById('showRouteBtn');

        section.classList.add('active');

        if (mode === 'route' && currentRoute) {
            devMode = false;
            showRouteBtn.style.display = 'none';
            renderRouteLocations();
        } else if (mode === 'dev') {
            devMode = true;
            currentRoute = null;
            routeTransitions = {};
            document.getElementById('routeResult').innerHTML = 'Выберите две локации';
            renderAllLocations();
        }
    }

    // 7. ВАЛИДАЦИЯ ДАННЫХ
    function validateLocationData(data) {
        if (!data.transitions || !Array.isArray(data.transitions)) {
            return false;
        }
        if (!data.transitionTargets || typeof data.transitionTargets !== 'object') {
            return false;
        }
        return true;
    }

    // 8. ЗАПУСК
    function init() {
        let validCount = 0;
        let invalidCount = 0;

        for (let [locName, data] of Object.entries(locationsDB)) {
            if (!validateLocationData(data)) {
                console.error(`⚠️ Локация "${locName}" имеет неверный формат!`);
                invalidCount++;
            } else {
                validCount++;
            }
        }

        console.log(`📊 База данных загружена: ${validCount} локаций OK, ${invalidCount} ошибок`);
        renderMap();
        populateSelects();

        // ✅ Обработчики кнопок
        document.getElementById('identifyBtn').onclick = identifyLocation;

        document.getElementById('clearSelectionsBtn').onclick = () => {
            selectedCells.clear();
            renderMap();
            document.getElementById('locationResult').innerHTML = "❓ Не определена";
            document.getElementById('locationResult').className = "location-name";
            document.getElementById('locationDescription').style.display = 'none';
            selectedLocation = null;
        };

        document.getElementById('findRouteBtn').onclick = showRoute;

        document.getElementById('showRouteBtn').onclick = () => {
            showBottomSection('route');
        };

        document.getElementById('devModeBtn').onclick = () => {
            showBottomSection('dev');
        };

        document.getElementById('closeBottomBtn').onclick = () => {
            document.getElementById('bottomSection').classList.remove('active');
            document.getElementById('showRouteBtn').style.display = currentRoute ? 'block' : 'none';
        };
    }

    // ПЕРЕКЛЮЧЕНИЕ ТЕМЫ
    const themeToggle = document.getElementById('themeToggle');
    const html = document.documentElement;

    // Загрузка сохранённой темы
    const savedTheme = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'dark' ? '🌙 Тема' : '☀️ Тема';

    // Переключение темы
    themeToggle.onclick = () => {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.textContent = next === 'dark' ? '🌙 Тема' : '☀️ Тема';
    };

    init();