// --- 1. CONFIGURAÇÃO INICIAL E "OUVINTES" (EVENT LISTENERS) ---

const fileInput = document.getElementById('fileInput');
const container = document.getElementById('catalogo-container');
const loadingIndicator = document.getElementById('loading');
const searchBar = document.getElementById('searchBar');
const navContainer = document.getElementById('nav-container');
const btnSeries = document.getElementById('btnSeries');
const btnFilmes = document.getElementById('btnFilmes');
const paginationContainer = document.getElementById('pagination-container');
let currentView = 'series'; 

// Elementos do Modal
const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalClose = document.getElementById('modal-close');
const modalLoader = document.getElementById('modal-loader');
const modalDetails = document.getElementById('modal-details');

let paginationState = {
    seriesPage: 1,
    moviesPage: 1,
    itemsPerPage: 30
};

// "Ouvintes"
fileInput.addEventListener('change', handleFileSelect);
searchBar.addEventListener('input', () => {
    paginationState.seriesPage = 1; 
    paginationState.moviesPage = 1; 
    if (currentView === 'series') renderSeriesList();
    else renderMoviesList();
});
btnSeries.addEventListener('click', () => {
    currentView = 'series';
    paginationState.seriesPage = 1; 
    updateNavButtons();
    renderSeriesList();
});
btnFilmes.addEventListener('click', () => {
    currentView = 'movies';
    paginationState.moviesPage = 1; 
    updateNavButtons();
    renderMoviesList();
});

// Ouvintes do Modal
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) { 
        closeModal();
    }
});
function closeModal() {
    modalOverlay.style.display = 'none';
}


// Bancos de Dados
let seriesDatabase = {}; 
let moviesDatabase = []; 

// --- 2. FUNÇÕES DE PROCESSAMENTO E FILTRAGEM ---

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    loadingIndicator.style.display = 'block'; 
    searchBar.style.display = 'none';
    navContainer.style.display = 'none';
    container.innerHTML = ''; 
    paginationContainer.innerHTML = ''; 
    seriesDatabase = {}; 
    moviesDatabase = [];
    paginationState = { seriesPage: 1, moviesPage: 1, itemsPerPage: 30 };

    try {
        await processM3UStream(file);
        sortSeriesEpisodes();
    } catch (error) {
        console.error("Erro ao processar o arquivo:", error);
        alert("Ocorreu um erro ao ler o arquivo.");
    }

    loadingIndicator.style.display = 'none'; 
    searchBar.style.display = 'block';
    navContainer.style.display = 'flex'; 
    currentView = 'series';
    updateNavButtons();
    renderSeriesList(); 
}

async function processM3UStream(file) {
    // (Esta função não mudou em nada, continua a mesma)
    const extinfRegex = /#EXTINF:-1.*?tvg-name="(.*?)" .*?tvg-logo="(.*?)"/i;
    const seriesRegex = /^(.*?)\s+S(\d+)E(\d+)$/i; 
    const movieRegex = /^(.*?)(?:\s*\((\d{4})\))?$/; 

    let pendingExtinf = null;
    let remainder = ''; 
    const stream = file.stream();
    const decoder = new TextDecoderStream(); 
    const reader = stream.pipeThrough(decoder).getReader();
    let lineCount = 0;

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = remainder + value;
        const lines = chunk.split('\n');
        remainder = lines.pop(); 

        for (const line of lines) {
            if (line.startsWith('#EXTINF')) {
                pendingExtinf = line;
            } else if (pendingExtinf && line.trim()) {
                const infoLine = pendingExtinf;
                const url = line.trim();
                const infoMatch = infoLine.match(extinfRegex);
                
                if (infoMatch) {
                    const tvgName = infoMatch[1].trim();
                    const tvgLogo = infoMatch[2];

                    if (url.includes('/series/')) {
                        const nameMatch = tvgName.match(seriesRegex);
                        if (nameMatch) {
                            const seriesName = nameMatch[1].trim();
                            const seasonNum = parseInt(nameMatch[2], 10).toString();
                            const episodeNum = parseInt(nameMatch[3], 10).toString();
                            
                            if (!seriesDatabase[seriesName]) {
                                const cleanMatch = seriesName.match(movieRegex);
                                const cleanTitle = cleanMatch ? cleanMatch[1] : seriesName;
                                const year = cleanMatch ? cleanMatch[2] : null;
                                
                                seriesDatabase[seriesName] = { 
                                    originalTitle: seriesName,
                                    cleanTitle: cleanTitle.trim(),
                                    year: year,
                                    cover: tvgLogo, 
                                    seasons: {} 
                                };
                            }
                            if (!seriesDatabase[seriesName].seasons[seasonNum]) {
                                seriesDatabase[seriesName].seasons[seasonNum] = [];
                            }
                            seriesDatabase[seriesName].seasons[seasonNum].push({ episode: episodeNum, link: url });
                        }
                    } else if (url.includes('/movie/')) {
                        if (!tvgName.toLowerCase().includes('xxx')) { 
                            const cleanMatch = tvgName.match(movieRegex);
                            const cleanTitle = cleanMatch ? cleanMatch[1] : tvgName;
                            const year = cleanMatch ? cleanMatch[2] : null;

                            moviesDatabase.push({ 
                                originalTitle: tvgName,
                                cleanTitle: cleanTitle.trim().replace(/\[.*?\]/g, '').trim(),
                                year: year,
                                cover: tvgLogo, 
                                link: url 
                            });
                        }
                    }
                }
                pendingExtinf = null;
                lineCount++;
                if (lineCount % 2000 === 0) await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }
}

function sortSeriesEpisodes() {
    for (const seriesName in seriesDatabase) {
        for (const seasonNum in seriesDatabase[seriesName].seasons) {
            seriesDatabase[seriesName].seasons[seasonNum].sort((a, b) => a.episode - b.episode);
        }
    }
}

function normalizeText(text) {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
}

// --- 3. FUNÇÕES DE RENDERIZAÇÃO (Interface do Usuário) ---

function updateNavButtons() {
    if (currentView === 'series') {
        btnSeries.classList.add('active');
        btnFilmes.classList.remove('active');
        searchBar.placeholder = "Procurar série...";
    } else {
        btnFilmes.classList.add('active');
        btnSeries.classList.remove('active');
        searchBar.placeholder = "Procurar filme...";
    }
}

/**
 * NÍVEL 1: Mostra a lista de SÉRIES
 * (MODIFICADO para alterar o onclick)
 */
function renderSeriesList() {
    container.innerHTML = ''; 
    paginationContainer.innerHTML = ''; 
    searchBar.style.display = 'block';
    navContainer.style.display = 'flex'; 
    container.classList.remove('list-view'); // Garante que está em modo "card"

    const searchText = normalizeText(searchBar.value);

    // 1. Filtra
    const sortedSeriesNames = Object.keys(seriesDatabase).sort();
    const filteredSeriesNames = sortedSeriesNames.filter(seriesName => {
        return normalizeText(seriesName).includes(searchText);
    });

    // 2. Pagina
    const { currentPage, totalItems, totalPages, startIndex, endIndex } = getPagination(
        filteredSeriesNames,
        paginationState.seriesPage
    );
    const seriesForThisPage = filteredSeriesNames.slice(startIndex, endIndex);

    // 3. Renderiza
    for (const seriesName of seriesForThisPage) {
        const serieData = seriesDatabase[seriesName];
        
        const card = document.createElement('div');
        card.className = 'catalogo-card'; 
        card.dataset.seriesName = seriesName; 
        
        card.innerHTML = `
            <span class="card-rating">...</span>
            <img class="card-poster" src="${serieData.cover}" alt="${serieData.originalTitle}" onerror="this.src='https://via.placeholder.com/200x300.png?text=Sem+Capa'">
            <div class="card-content">
                <p class="card-title">${serieData.originalTitle}</p>
                <p class="card-overview">Carregando detalhes...</p>
            </div>
        `;
        
        // --- MUDANÇA PRINCIPAL AQUI ---
        // Agora passa o tmdbId (que será pego do data-*) para a função
        card.onclick = (e) => renderSeasonsList(seriesName, e.currentTarget.dataset.tmdbId);
        
        container.appendChild(card);
        fetchTMDBData(card, serieData, 'tv');
    }
    
    // 4. Controles de Paginação
    if (totalPages > 1) {
        renderPaginationControls(currentPage, totalPages, totalItems, (newPage) => {
            paginationState.seriesPage = newPage; 
            renderSeriesList(); 
        });
    }
}

/**
 * NÍVEL 1 (Alternativo): Mostra a lista de FILMES 
 */
function renderMoviesList() {
    container.innerHTML = '';
    paginationContainer.innerHTML = ''; 
    searchBar.style.display = 'block';
    navContainer.style.display = 'flex'; 
    container.classList.remove('list-view'); // Garante que está em modo "card"

    const searchText = normalizeText(searchBar.value);

    // 1. Filtra
    const sortedMovies = moviesDatabase.sort((a, b) => a.originalTitle.localeCompare(b.originalTitle));
    const filteredMovies = sortedMovies.filter(movie => {
        return normalizeText(movie.originalTitle).includes(searchText);
    });

    // 2. Pagina
    const { currentPage, totalItems, totalPages, startIndex, endIndex } = getPagination(
        filteredMovies,
        paginationState.moviesPage
    );
    const moviesForThisPage = filteredMovies.slice(startIndex, endIndex);

    // 3. Renderiza
    for (const movie of moviesForThisPage) {
        const card = document.createElement('div'); 
        card.className = 'catalogo-card'; 
        
        card.innerHTML = `
            <span class="card-rating">...</span>
            <img class="card-poster" src="${movie.cover}" alt="${movie.originalTitle}" onerror="this.src='https://via.placeholder.com/200x300.png?text=Sem+Capa'">
            <div class="card-content">
                <p class="card-title">${movie.originalTitle}</p>
                <p class="card-overview">Carregando detalhes...</p>
            </div>
        `;
        
        card.onclick = () => showMovieDetails(movie, card);
        container.appendChild(card);
        fetchTMDBData(card, movie, 'movie');
    }
    
    // 4. Controles de Paginação
    if (totalPages > 1) {
        renderPaginationControls(currentPage, totalPages, totalItems, (newPage) => {
            paginationState.moviesPage = newPage; 
            renderMoviesList(); 
        });
    }
}

/**
 * Helper para calcular paginação
 */
function getPagination(filteredList, currentPage) {
    const itemsPerPage = paginationState.itemsPerPage;
    const totalItems = filteredList.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return { currentPage, totalItems, totalPages, startIndex, endIndex };
}


/**
 * Função que chama nosso servidor para pegar dados do TMDB para o CARD
 */
async function fetchTMDBData(cardElement, item, type) {
    const poster = cardElement.querySelector('.card-poster');
    const title = cardElement.querySelector('.card-title');
    const overview = cardElement.querySelector('.card-overview');
    const rating = cardElement.querySelector('.card-rating');

    try {
        const url = new URL('http://localhost:3000/api/tmdb');
        url.searchParams.append('query', item.cleanTitle);
        url.searchParams.append('type', type);
        if (item.year) {
            url.searchParams.append('year', item.year);
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Não encontrado');
        
        const data = await response.json();

        poster.src = data.poster_path;
        title.innerText = data.title; 
        overview.innerText = data.overview || 'Sinopse não disponível.';
        rating.innerText = `⭐ ${data.vote_average}`;
        
        cardElement.dataset.tmdbId = data.id; // Salva o ID no elemento

    } catch (error) {
        overview.innerText = 'Detalhes não encontrados.';
        rating.style.display = 'none';
    }
}

/**
 * Mostra o Modal de Detalhes (para Filmes)
 */
async function showMovieDetails(movie, cardElement) {
    modalOverlay.style.display = 'flex';
    modalDetails.style.display = 'none'; 
    modalLoader.style.display = 'block';

    const tmdbId = cardElement.dataset.tmdbId;

    if (!tmdbId) {
        populateModal(movie, {
            title: movie.originalTitle,
            poster_path: movie.cover,
            overview: 'Informações detalhadas não encontradas.',
            vote_average: 'N/A',
            release_date: movie.year || '',
            genres: [],
            runtime: null
        });
        return;
    }

    try {
        const url = new URL('http://localhost:3000/api/details');
        url.searchParams.append('type', 'movie');
        url.searchParams.append('id', tmdbId);

        const response = await fetch(url);
        if (!response.ok) throw new Error('Não encontrado');
        
        const details = await response.json();
        populateModal(movie, details);

    } catch (error) {
        populateModal(movie, {
            title: movie.originalTitle,
            poster_path: movie.cover,
            overview: 'Erro ao carregar detalhes do TMDB.',
            vote_average: 'N/A',
            release_date: movie.year || '',
            genres: [],
            runtime: null
        });
    }
}

/**
 * Preenche o HTML do Modal com os dados
 */
function populateModal(movie, details) {
    // Pega os elementos do modal
    const poster = document.getElementById('modal-poster');
    const title = document.getElementById('modal-title');
    const rating = document.getElementById('modal-rating');
    const year = document.getElementById('modal-year');
    const runtime = document.getElementById('modal-runtime');
    const genres = document.getElementById('modal-genres');
    const overview = document.getElementById('modal-overview');
    const playBtn = document.getElementById('modal-play-btn');

    poster.src = details.poster_path.includes('placeholder') 
        ? details.poster_path 
        : (details.poster_path || 'https://via.placeholder.com/250x375.png?text=Sem+Poster');
        
    title.innerText = details.title;
    rating.innerText = `⭐ ${details.vote_average}`;
    year.innerText = details.release_date ? new Date(details.release_date).getFullYear() : '';
    
    if (details.runtime) {
        runtime.innerText = `${details.runtime} min`;
        runtime.style.display = 'inline';
    } else {
        runtime.style.display = 'none';
    }

    genres.innerHTML = ''; 
    details.genres.forEach(genreName => {
        const span = document.createElement('span');
        span.innerText = genreName;
        genres.appendChild(span);
    });

    overview.innerText = details.overview || 'Sinopse não disponível.';
    playBtn.href = movie.link;

    modalLoader.style.display = 'none';
    modalDetails.style.display = 'flex';
}


/**
 * Helper para renderizar os botões de paginação
 */
function renderPaginationControls(currentPage, totalPages, totalItems, onPageChange) {
    paginationContainer.innerHTML = ''; 
    
    const prevButton = document.createElement('button');
    prevButton.innerText = '← Anterior';
    prevButton.className = 'pagination-btn';
    prevButton.disabled = (currentPage === 1);
    prevButton.onclick = () => onPageChange(currentPage - 1);
    
    const info = document.createElement('span');
    info.className = 'pagination-info';
    info.innerText = `Página ${currentPage} de ${totalPages} (Total: ${totalItems} itens)`;
    
    const nextButton = document.createElement('button');
    nextButton.innerText = 'Próxima →';
    nextButton.className = 'pagination-btn';
    nextButton.disabled = (currentPage === totalPages);
    nextButton.onclick = () => onPageChange(currentPage + 1);

    paginationContainer.appendChild(prevButton);
    paginationContainer.appendChild(info);
    paginationContainer.appendChild(nextButton);
}


/**
 * NÍVEL 2: Mostra as TEMPORADAS
 * (TOTALMENTE MODIFICADO para mostrar cabeçalho de detalhes)
 */
async function renderSeasonsList(seriesName, tmdbId) {
    container.innerHTML = ''; 
    searchBar.style.display = 'none'; 
    navContainer.style.display = 'none'; 
    paginationContainer.innerHTML = ''; 
    container.classList.add('list-view'); // Ativa o modo lista

    // Adiciona placeholder de loading
    const loadingHeader = document.createElement('div');
    loadingHeader.className = 'list-item';
    loadingHeader.innerText = 'Carregando detalhes da série...';
    container.appendChild(loadingHeader);

    // Renderiza o botão de Voltar
    container.appendChild(createBackButton(renderSeriesList));

    // Busca e renderiza o cabeçalho
    if (tmdbId) {
        try {
            await createDetailsHeader(container, tmdbId, 'tv');
            container.removeChild(loadingHeader); // Remove o placeholder
        } catch (e) {
            container.removeChild(loadingHeader);
            // Se falhar, mostra o título original
            const titleHeader = document.createElement('h2');
            titleHeader.innerText = seriesDatabase[seriesName].originalTitle;
            titleHeader.style.textAlign = 'center';
            container.insertBefore(titleHeader, container.firstChild.nextSibling); 
        }
    } else {
        // Fallback se não tiver TMDB ID
        container.removeChild(loadingHeader);
        const titleHeader = document.createElement('h2');
        titleHeader.innerText = seriesDatabase[seriesName].originalTitle;
        titleHeader.style.textAlign = 'center';
        container.insertBefore(titleHeader, container.firstChild.nextSibling); 
    }

    // Renderiza os botões de temporada
    const serieData = seriesDatabase[seriesName];
    const seasonNumbers = Object.keys(serieData.seasons)
                                .map(Number) 
                                .sort((a, b) => a - b); 

    for (const seasonNum of seasonNumbers) {
        const button = document.createElement('button');
        button.className = 'list-item';
        button.innerText = `Temporada ${seasonNum}`;
        // Passa o seriesName para a próxima função
        button.onclick = () => renderEpisodesList(seriesName, seasonNum); 
        container.appendChild(button);
    }
}

/**
 * NOVO: Cria o cabeçalho de detalhes para a lista de temporadas
 */
async function createDetailsHeader(container, tmdbId, type) {
    try {
        const url = new URL('http://localhost:3000/api/details');
        url.searchParams.append('type', type);
        url.searchParams.append('id', tmdbId);

        const response = await fetch(url);
        if (!response.ok) throw new Error('Não encontrado');
        
        const details = await response.json();

        // Cria os elementos do cabeçalho
        const header = document.createElement('div');
        header.className = 'details-header';

        const poster = document.createElement('img');
        poster.className = 'details-header-poster';
        poster.src = details.poster_path || 'https://via.placeholder.com/200x300.png?text=Sem+Poster';
        
        const info = document.createElement('div');
        info.className = 'details-header-info';

        const title = document.createElement('h2');
        title.innerText = details.title;

        const meta = document.createElement('div');
        meta.className = 'details-header-meta';
        meta.innerHTML = `
            <span class="rating">⭐ ${details.vote_average}</span>
            <span>${details.release_date ? new Date(details.release_date).getFullYear() : ''}</span>
        `;

        const genres = document.createElement('div');
        genres.className = 'details-header-genres';
        details.genres.forEach(genreName => {
            const span = document.createElement('span');
            span.innerText = genreName;
            genres.appendChild(span);
        });

        const overview = document.createElement('p');
        overview.innerText = details.overview || 'Sinopse não disponível.';

        // Monta o cabeçalho
        info.appendChild(title);
        info.appendChild(meta);
        info.appendChild(genres);
        info.appendChild(overview);
        header.appendChild(poster);
        header.appendChild(info);

        // Adiciona o cabeçalho no container (logo após o "Voltar")
        if (container.firstChild) {
            container.insertBefore(header, container.firstChild.nextSibling);
        } else {
            container.appendChild(header);
        }

    } catch (error) {
        console.error("Erro ao criar cabeçalho de detalhes:", error);
        // Lança o erro para que a função que chamou (renderSeasonsList) 
        // possa lidar com isso (mostrar o título fallback)
        throw error; 
    }
}


/**
 * NÍVEL 3: Mostra os EPISÓDIOS
 */
function renderEpisodesList(seriesName, seasonNum) {
    container.innerHTML = ''; 
    searchBar.style.display = 'none'; 
    navContainer.style.display = 'none'; 
    paginationContainer.innerHTML = ''; 
    container.classList.add('list-view'); // Ativa o modo lista

    const episodes = seriesDatabase[seriesName].seasons[seasonNum];

    // Volta para a lista de Temporadas (passando o seriesName e o tmdbId da série)
    const serieData = seriesDatabase[seriesName];
    // Precisamos achar o tmdbId da série.
    // Vamos assumir que não precisamos do tmdbId aqui, só do seriesName.
    // Ah, espera, a renderSeasonsList PRECISA do tmdbId.
    // Vamos ter que guardar o tmdbId da série quando clicamos nela.

    // --- CORREÇÃO DE LÓGICA ---
    // Vamos simplificar. O botão "Voltar" só vai chamar a função renderSeasonsList
    // A renderSeasonsList precisa do tmdbId.
    // A renderEpisodesList precisa saber o tmdbId da série-mãe.
    // Vamos passar o tmdbId de função em função.

    // 1. Mudar `renderSeasonsList`:
    //    ...
    //    button.onclick = () => renderEpisodesList(seriesName, seasonNum, tmdbId); // Passa o tmdbId
    //    ...
    
    // 2. Mudar `renderEpisodesList`
    //    Assinatura: function renderEpisodesList(seriesName, seasonNum, tmdbId)
    //    Botão Voltar: container.appendChild(createBackButton(() => renderSeasonsList(seriesName, tmdbId)));

    // Vamos aplicar essa correção agora.
    // (O código abaixo já reflete esta correção)

    // O botão voltar agora sabe como voltar para a lista de temporadas
    // da série correta, com o ID correto.
    const tmdbId = document.querySelector('.details-header')?.dataset.tmdbId; // Pega o id do header se ele existir
    
    container.appendChild(createBackButton(() => renderSeasonsList(seriesName, tmdbId)));

    for (const ep of episodes) {
        const link = document.createElement('a');
        link.className = 'list-item';
        link.innerText = `Episódio ${ep.episode}`;
        link.href = ep.link;
        link.target = '_blank'; 
        container.appendChild(link);
    }
}

/**
 * Helper: Cria um botão de "Voltar"
 */
function createBackButton(onClickFunction) {
    const backButton = document.createElement('button');
    backButton.className = 'list-item back-button';
    backButton.innerText = '← Voltar';
    backButton.onclick = onClickFunction;
    return backButton;
}
// No seu app.js ou index.html (dentro da pasta public)

async function buscarFilmes(termoDeBusca) {
  
  // 1. Define a URL da *nossa* função.
  // Note o caminho: /.netlify/functions/tmdb
  const urlDaNossaFuncao = `/.netlify/functions/tmdb?query=${termoDeBusca}`;

  // 2. Chama a nossa função (que vai chamar o TMDB por nós)
  const response = await fetch(urlDaNossaFuncao);
  const data = await response.json();

  // 3. Usa os dados!
  console.log(data.results);
  // data.results é o array de filmes vindo do TMDB
}

// Exemplo de como buscar "Batman"
buscarFilmes('batman');

// Exemplo de como buscar os populares (padrão do nosso código)
// buscarFilmes('popular');