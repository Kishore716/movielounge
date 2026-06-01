/**
 * CineLuxe - Web Application Logic
 * Supports JWT authentication backend & local/cloud watchlists.
 */

// Application Constants & State
const API_KEY = 'adcd241';
const BASE_URL = 'https://www.omdbapi.com/';
const DEFAULT_SEARCH = 'Avengers';
const SPOTLIGHT_ID = 'tt3896198'; // Interstellar

let state = {
    user: null,
    storageMode: 'json', // 'mysql' or 'json', set by backend
    searchQuery: '',
    currentResults: [],
    currentPage: 1,
    totalResults: 0,
    watchlist: [], // loaded from server or localStorage
    compareList: [],
    compareMode: false,
    activeMovieId: null,
    cache: {}
};

// --- API FETCH UTILITIES ---

async function fetchFromAPI(params) {
    const paramString = new URLSearchParams(params).toString();
    const cacheKey = paramString;

    if (state.cache[cacheKey]) {
        return state.cache[cacheKey];
    }

    try {
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&${paramString}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        if (data.Response === "True") {
            state.cache[cacheKey] = data;
        }
        return data;
    } catch (error) {
        console.error('API Fetch Error:', error);
        showToast('Error connecting to movie server.', 'x');
        return { Response: "False", Error: error.message };
    }
}

// --- DOM ELEMENTS REFERENCE ---
const heroSection = document.getElementById('hero-spotlight');
const heroBackdrop = document.getElementById('hero-backdrop-img');
const heroTitle = document.getElementById('hero-title');
const heroYear = document.getElementById('hero-year');
const heroRatingVal = document.getElementById('hero-rating-val');
const heroRuntime = document.getElementById('hero-runtime');
const heroGenre = document.getElementById('hero-genre');
const heroPlot = document.getElementById('hero-plot');
const heroDetailsBtn = document.getElementById('hero-details-btn');
const heroWatchlistBtn = document.getElementById('hero-watchlist-btn');

const searchInput = document.getElementById('header-search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const searchTitle = document.getElementById('search-title');
const searchSubtitle = document.getElementById('search-subtitle');
const moviesGrid = document.getElementById('movies-grid');

const filterType = document.getElementById('filter-type');
const filterYear = document.getElementById('filter-year');
const sortBy = document.getElementById('sort-by');

const paginationPanel = document.getElementById('pagination-panel');
const pageIndicator = document.getElementById('page-indicator');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');

const watchlistDrawer = document.getElementById('watchlist-drawer');
const toggleWatchlistBtn = document.getElementById('toggle-watchlist-btn');
const closeWatchlistBtn = document.getElementById('close-watchlist-btn');
const watchlistEmptyState = document.getElementById('watchlist-empty-state');
const watchlistItemsList = document.getElementById('watchlist-items-list');
const watchlistCount = document.getElementById('watchlist-count');

const compareBar = document.getElementById('compare-bar');
const toggleCompareModeBtn = document.getElementById('toggle-compare-mode-btn');
const compareCountBadge = document.getElementById('compare-count');
const compareSlot1 = document.getElementById('compare-slot-1');
const compareSlot2 = document.getElementById('compare-slot-2');
const triggerComparisonBtn = document.getElementById('trigger-comparison-btn');
const clearCompareBtn = document.getElementById('clear-compare-btn');

const detailsModal = document.getElementById('details-modal');
const closeDetailsBtn = document.getElementById('close-details-btn');
const modalHeroBg = document.getElementById('modal-hero-bg');
const modalPoster = document.getElementById('modal-poster');
const modalType = document.getElementById('modal-type');
const modalTitle = document.getElementById('modal-title');
const modalYear = document.getElementById('modal-year');
const modalRated = document.getElementById('modal-rated');
const modalRuntime = document.getElementById('modal-runtime');
const modalRatings = document.getElementById('modal-ratings');
const modalTagline = document.getElementById('modal-tagline');
const modalPlot = document.getElementById('modal-plot');
const modalDirector = document.getElementById('modal-director');
const modalWriter = document.getElementById('modal-writer');
const modalCast = document.getElementById('modal-cast');
const modalGenre = document.getElementById('modal-genre');
const modalReleased = document.getElementById('modal-released');
const modalBoxOffice = document.getElementById('modal-boxoffice');
const modalAwards = document.getElementById('modal-awards');
const modalLanguage = document.getElementById('modal-language');
const modalCountry = document.getElementById('modal-country');
const modalWatchlistBtn = document.getElementById('modal-watchlist-btn');
const modalCompareBtn = document.getElementById('modal-compare-btn');
const modalPlayBtn = document.getElementById('modal-play-btn');

// Player Elements
const modalPlayerContainer = document.getElementById('modal-player-container');
const playerSeasonSelect = document.getElementById('player-season-select');
const playerEpisodeSelect = document.getElementById('player-episode-select');
const modalPlayerIframe = document.getElementById('modal-player-iframe');
const playerLoading = document.getElementById('player-loading');


const comparisonModal = document.getElementById('comparison-modal');
const closeCompareModalBtn = document.getElementById('close-compare-modal-btn');
const compareTableHeader = document.getElementById('compare-table-header');
const compareTableBody = document.getElementById('compare-table-body');

// Auth elements
const authModal = document.getElementById('auth-modal');
const closeAuthBtn = document.getElementById('close-auth-btn');
const navAuthBtn = document.getElementById('nav-auth-btn');
const navAuthText = document.getElementById('nav-auth-text');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginErrorMsg = document.getElementById('login-error-msg');
const signupErrorMsg = document.getElementById('signup-error-msg');

const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toast-icon');
const toastMessage = document.getElementById('toast-message');

// --- INIT APP ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Setup Icons & Listeners
    lucide.createIcons();
    setupEventListeners();

    // 2. Fetch User & Watchlist
    await checkUserSession();
    
    // 3. Load Spotlight Hero
    await loadSpotlightMovie(SPOTLIGHT_ID);
    
    // 4. Load Initial grid search
    await runSearch(DEFAULT_SEARCH, 1);
});

// --- SESSION & WATCHLIST SYNC ---

async function checkUserSession() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        
        if (data.user) {
            state.user = data.user;
            state.storageMode = data.storageMode;
            updateNavbarAuthUI(true, data.user.username);
            await fetchWatchlistFromServer();
        } else {
            state.user = null;
            state.storageMode = data.storageMode;
            updateNavbarAuthUI(false);
            loadLocalWatchlist();
        }
    } catch (err) {
        console.error('Session check failed:', err);
        loadLocalWatchlist();
    }
}

function loadLocalWatchlist() {
    state.watchlist = JSON.parse(localStorage.getItem('cineluxe_watchlist')) || [];
    updateWatchlistUI();
    syncCardUI();
}

async function fetchWatchlistFromServer() {
    try {
        const res = await fetch('/api/watchlist');
        if (res.ok) {
            state.watchlist = await res.json();
        } else {
            state.watchlist = [];
        }
        updateWatchlistUI();
        syncCardUI();
    } catch (err) {
        console.error('Failed to fetch server watchlist:', err);
    }
}

/**
 * Pushes any guest items in localStorage to user account database on login
 */
async function syncLocalStorageWatchlistToServer() {
    const localList = JSON.parse(localStorage.getItem('cineluxe_watchlist')) || [];
    if (localList.length === 0) return;

    console.log('[Sync] Uploading local watchlist to server account...');
    for (const movie of localList) {
        try {
            await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movie)
            });
        } catch (err) {
            console.error('[Sync] Item sync failed:', err);
        }
    }
    // Clear guest list
    localStorage.removeItem('cineluxe_watchlist');
}

function updateNavbarAuthUI(isLoggedIn, username = '') {
    const logoArea = document.getElementById('nav-logo');
    
    // Remove old badge if any
    const oldBadge = logoArea.querySelector('.storage-badge');
    if (oldBadge) oldBadge.remove();

    // Create mode indicator
    const modeBadge = document.createElement('span');
    modeBadge.className = `storage-badge ${state.storageMode === 'json' ? 'json-mode' : ''}`;
    modeBadge.textContent = state.storageMode === 'mysql' ? 'MySQL' : 'Local Fallback';
    logoArea.appendChild(modeBadge);

    if (isLoggedIn) {
        navAuthText.textContent = `Log Out (${username})`;
        navAuthBtn.classList.remove('btn-primary');
        navAuthBtn.classList.add('btn-secondary');
    } else {
        navAuthText.textContent = 'Sign In';
        navAuthBtn.classList.remove('btn-secondary');
        navAuthBtn.classList.add('btn-primary');
    }
}

// --- SPOTLIGHT LANDING HERO ---

async function loadSpotlightMovie(imdbID) {
    const data = await fetchFromAPI({ i: imdbID, plot: 'short' });
    if (data.Response === "True") {
        heroBackdrop.style.backgroundImage = `url('${data.Poster}')`;
        heroTitle.textContent = data.Title;
        heroYear.textContent = data.Year;
        heroRatingVal.textContent = data.imdbRating;
        heroRuntime.textContent = data.Runtime;
        heroGenre.textContent = data.Genre;
        heroPlot.textContent = data.Plot;
        
        heroDetailsBtn.onclick = () => openDetailsModal(imdbID);
        
        const inWatchlist = state.watchlist.some(item => item.imdbID === imdbID);
        updateSpotlightWatchlistBtn(inWatchlist, imdbID, data);
    }
}

function updateSpotlightWatchlistBtn(inWatchlist, imdbID, data) {
    if (inWatchlist) {
        heroWatchlistBtn.innerHTML = `<i data-lucide="check"></i> Added to Watchlist`;
        heroWatchlistBtn.className = "btn btn-primary";
    } else {
        heroWatchlistBtn.innerHTML = `<i data-lucide="plus"></i> Add to Watchlist`;
        heroWatchlistBtn.className = "btn btn-secondary";
    }
    lucide.createIcons();
    
    heroWatchlistBtn.onclick = async () => {
        const movieObj = {
            imdbID,
            Title: data.Title,
            Year: data.Year,
            Type: data.Type,
            Poster: data.Poster
        };
        await handleToggleWatchlistRequest(movieObj);
        const nowInWatchlist = state.watchlist.some(item => item.imdbID === imdbID);
        updateSpotlightWatchlistBtn(nowInWatchlist, imdbID, data);
    };
}

// --- SEARCH & GRID FUNCTIONS ---

let searchDebounceTimeout;
function debounceSearch(callback, delay = 500) {
    return (...args) => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => callback(...args), delay);
    };
}

async function runSearch(query, page = 1) {
    state.searchQuery = query;
    state.currentPage = page;
    
    renderSkeletons();
    
    const params = {
        s: query || DEFAULT_SEARCH,
        page: page
    };
    
    const typeVal = filterType.value;
    if (typeVal) params.type = typeVal;
    
    const yearVal = filterYear.value;
    if (yearVal) params.y = yearVal;
    
    const data = await fetchFromAPI(params);
    
    if (data.Response === "True") {
        state.currentResults = data.Search;
        state.totalResults = parseInt(data.totalResults);
        
        sortAndRenderResults();
        
        const totalPages = Math.ceil(state.totalResults / 10);
        pageIndicator.textContent = `Page ${page} of ${totalPages}`;
        paginationPanel.classList.remove('hide');
        
        prevPageBtn.disabled = page === 1;
        nextPageBtn.disabled = page === totalPages;
        
        if (query) {
            searchTitle.textContent = `Search Results for "${query}"`;
            searchSubtitle.textContent = `Found ${state.totalResults} titles matching search filters`;
        } else {
            searchTitle.textContent = "Trending Now";
            searchSubtitle.textContent = "Discover popular titles or search above";
        }
    } else {
        state.currentResults = [];
        state.totalResults = 0;
        paginationPanel.classList.add('hide');
        moviesGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i data-lucide="compass" class="empty-icon"></i>
                <p>No titles found</p>
                <span>We couldn't find any results matching your search terms. Please check your spelling or filters.</span>
            </div>
        `;
        lucide.createIcons();
        if (query) {
            searchTitle.textContent = `No results for "${query}"`;
            searchSubtitle.textContent = 'Try adjusting your search filters';
        }
    }
}

function sortAndRenderResults() {
    const sortVal = sortBy.value;
    const sorted = [...state.currentResults];
    
    if (sortVal === 'year-desc') {
        sorted.sort((a, b) => parseInt(b.Year) - parseInt(a.Year));
    } else if (sortVal === 'year-asc') {
        sorted.sort((a, b) => parseInt(a.Year) - parseInt(b.Year));
    } else if (sortVal === 'title-asc') {
        sorted.sort((a, b) => a.Title.localeCompare(b.Title));
    } else if (sortVal === 'title-desc') {
        sorted.sort((a, b) => b.Title.localeCompare(a.Title));
    }
    
    renderMovieGrid(sorted);
}

function renderSkeletons() {
    moviesGrid.innerHTML = Array(8).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-poster"></div>
            <div class="skeleton-info">
                <div class="skeleton-title"></div>
                <div class="skeleton-meta"></div>
            </div>
        </div>
    `).join('');
}

function renderMovieGrid(items = state.currentResults) {
    if (items.length === 0) return;
    
    moviesGrid.innerHTML = items.map(movie => {
        const inWatchlist = state.watchlist.some(item => item.imdbID === movie.imdbID);
        const inCompare = state.compareList.some(item => item.imdbID === movie.imdbID);
        const posterUrl = movie.Poster !== 'N/A' ? movie.Poster : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop';
        
        return `
            <div class="movie-card" data-id="${movie.imdbID}">
                <div class="card-badge">${movie.Type}</div>
                <div class="card-actions-top">
                    <button class="card-floating-btn watchlist-btn ${inWatchlist ? 'active' : ''}" data-id="${movie.imdbID}" aria-label="Add to watchlist">
                        <i data-lucide="heart" style="${inWatchlist ? 'fill: currentColor' : ''}"></i>
                    </button>
                    <button class="card-floating-btn compare-btn ${inCompare ? 'active-compare' : ''}" data-id="${movie.imdbID}" aria-label="Add to comparison">
                        <i data-lucide="columns-2"></i>
                    </button>
                </div>
                <div class="card-poster-wrapper">
                    <img src="${posterUrl}" alt="${movie.Title}" loading="lazy">
                    <div class="card-overlay">
                        <button class="btn btn-secondary view-details-card-btn" data-id="${movie.imdbID}">
                            <i data-lucide="info"></i> Quick View
                        </button>
                        <button class="play-btn" data-id="${movie.imdbID}" aria-label="Play">
                            <i data-lucide="play"></i> Watch
                        </button>
                    </div>
                </div>
                <div class="card-details">
                    <h3 class="card-title">${movie.Title}</h3>
                    <div class="card-meta">
                        <span>${movie.Year}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    lucide.createIcons();
    
    // Bind card triggers
    document.querySelectorAll('.movie-card').forEach(card => {
        const id = card.dataset.id;
        const movieObj = items.find(item => item.imdbID === id);
        
        card.addEventListener('click', (e) => {
            if (e.target.closest('.card-floating-btn')) return;
            // avoid opening details when play button clicked (play handler will open details)
            if (e.target.closest('.play-btn')) return;
            openDetailsModal(id);
        });
        
        card.querySelector('.watchlist-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            handleToggleWatchlistRequest(movieObj);
        });
        
        card.querySelector('.compare-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCompare(movieObj);
        });
        const playBtn = card.querySelector('.play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // open details first then start player
                openDetailsModal(id).then(() => {
                    // if it's a series, open series player; else movie player
                    const kind = (movieObj && movieObj.Type) || 'movie';
                    loadPlayer(id, kind.toLowerCase());
                });
            });
        }
    });
}

// --- WATCHLIST ADAPTER (localStorage / DB server routing) ---

async function handleToggleWatchlistRequest(movie) {
    const isSaved = state.watchlist.some(item => item.imdbID === movie.imdbID);

    if (state.user) {
        // Run against Cloud DB endpoints
        try {
            if (isSaved) {
                const res = await fetch(`/api/watchlist/${movie.imdbID}`, { method: 'DELETE' });
                if (res.ok) {
                    state.watchlist = state.watchlist.filter(item => item.imdbID !== movie.imdbID);
                    showToast(`"${movie.Title}" removed from Watchlist`);
                } else {
                    throw new Error('Server returned error status');
                }
            } else {
                const res = await fetch('/api/watchlist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(movie)
                });
                if (res.ok) {
                    state.watchlist.push(movie);
                    showToast(`"${movie.Title}" added to Watchlist`);
                } else {
                    throw new Error('Server returned error status');
                }
            }
        } catch (err) {
            console.error('Server watchlist sync failure:', err);
            showToast('Unable to synchronize watchlist changes.', 'x');
        }
    } else {
        // Fallback local storage
        const idx = state.watchlist.findIndex(item => item.imdbID === movie.imdbID);
        if (idx > -1) {
            state.watchlist.splice(idx, 1);
            showToast(`"${movie.Title}" removed from Watchlist`);
        } else {
            state.watchlist.push(movie);
            showToast(`"${movie.Title}" added to Watchlist (Saved locally)`);
        }
        localStorage.setItem('cineluxe_watchlist', JSON.stringify(state.watchlist));
    }

    updateWatchlistUI();
    syncCardUI();
    
    // Sync detailed modal buttons if open
    if (state.activeMovieId === movie.imdbID) {
        updateModalActionButtons(movie.imdbID, movie);
    }
    // Sync Spotlight Choice if active
    if (movie.imdbID === SPOTLIGHT_ID) {
        loadSpotlightMovie(SPOTLIGHT_ID);
    }
}

function updateWatchlistUI() {
    watchlistCount.textContent = state.watchlist.length;
    
    if (state.watchlist.length === 0) {
        watchlistEmptyState.classList.remove('hide');
        watchlistItemsList.innerHTML = '';
    } else {
        watchlistEmptyState.classList.add('hide');
        watchlistItemsList.innerHTML = state.watchlist.map(movie => {
            const posterUrl = movie.Poster !== 'N/A' ? movie.Poster : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=100&auto=format&fit=crop';
            return `
                <div class="watchlist-item" data-id="${movie.imdbID}">
                    <img class="watchlist-item-img" src="${posterUrl}" alt="${movie.Title}">
                    <div class="watchlist-item-details">
                        <span class="watchlist-item-title">${movie.Title}</span>
                        <span class="watchlist-item-meta">${movie.Type} • ${movie.Year}</span>
                    </div>
                    <button class="btn-remove-watchlist" data-id="${movie.imdbID}" aria-label="Remove from Watchlist">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `;
        }).join('');
        
        lucide.createIcons();
        
        document.querySelectorAll('.watchlist-item').forEach(item => {
            const id = item.dataset.id;
            item.addEventListener('click', (e) => {
                if (e.target.closest('.btn-remove-watchlist')) return;
                openDetailsModal(id);
                watchlistDrawer.classList.remove('open');
            });
            
            item.querySelector('.btn-remove-watchlist').addEventListener('click', (e) => {
                e.stopPropagation();
                const movieObj = state.watchlist.find(m => m.imdbID === id);
                handleToggleWatchlistRequest(movieObj);
            });
        });
    }
}

// --- STATE SYNCHRONIZATION ---

/**
 * Solves the UI mismatch bug. Checks all cards currently on screen 
 * and maps their CSS classes/active icons dynamically to sync states.
 */
function syncCardUI() {
    document.querySelectorAll('.movie-card').forEach(card => {
        const id = card.dataset.id;
        const inWatchlist = state.watchlist.some(item => item.imdbID === id);
        const inCompare = state.compareList.some(item => item.imdbID === id);
        
        const wlBtn = card.querySelector('.watchlist-btn');
        const compBtn = card.querySelector('.compare-btn');
        
        if (wlBtn) {
            if (inWatchlist) {
                wlBtn.classList.add('active');
                const heartIcon = wlBtn.querySelector('svg');
                if (heartIcon) heartIcon.style.fill = 'currentColor';
            } else {
                wlBtn.classList.remove('active');
                const heartIcon = wlBtn.querySelector('svg');
                if (heartIcon) heartIcon.style.fill = 'none';
            }
        }
        
        if (compBtn) {
            if (inCompare) {
                compBtn.classList.add('active-compare');
            } else {
                compBtn.classList.remove('active-compare');
            }
        }
    });
}

// --- COMPARISON DRAWER & CALCULATOR ---

function toggleCompare(movie) {
    const idx = state.compareList.findIndex(item => item.imdbID === movie.imdbID);
    
    if (idx > -1) {
        state.compareList.splice(idx, 1);
        showToast(`"${movie.Title}" removed from comparison`);
    } else {
        if (state.compareList.length >= 2) {
            showToast('You can compare a maximum of two titles side-by-side.', 'warning');
            return;
        }
        state.compareList.push(movie);
        showToast(`"${movie.Title}" queued for comparison`);
    }
    
    updateCompareBar();
    syncCardUI();
    
    // Sync detailed modal buttons if open
    if (state.activeMovieId === movie.imdbID) {
        updateModalActionButtons(movie.imdbID, movie);
    }
}

function updateCompareBar() {
    compareCountBadge.textContent = state.compareList.length;
    
    if (state.compareList.length > 0) {
        compareBar.classList.remove('hide');
    } else {
        compareBar.classList.add('hide');
    }
    
    if (state.compareList[0]) {
        const item1 = state.compareList[0];
        const posterUrl = item1.Poster !== 'N/A' ? item1.Poster : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=100&auto=format&fit=crop';
        compareSlot1.innerHTML = `
            <img src="${posterUrl}" style="width: 30px; height: 40px; border-radius: var(--radius-sm); object-fit: cover;">
            <span class="slot-movie-title">${item1.Title}</span>
            <button class="btn-remove-slot" data-idx="0"><i data-lucide="x"></i></button>
        `;
        compareSlot1.classList.add('filled');
    } else {
        compareSlot1.innerHTML = `<span class="slot-placeholder">Slot 1 Empty</span>`;
        compareSlot1.classList.remove('filled');
    }
    
    if (state.compareList[1]) {
        const item2 = state.compareList[1];
        const posterUrl = item2.Poster !== 'N/A' ? item2.Poster : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=100&auto=format&fit=crop';
        compareSlot2.innerHTML = `
            <img src="${posterUrl}" style="width: 30px; height: 40px; border-radius: var(--radius-sm); object-fit: cover;">
            <span class="slot-movie-title">${item2.Title}</span>
            <button class="btn-remove-slot" data-idx="1"><i data-lucide="x"></i></button>
        `;
        compareSlot2.classList.add('filled');
    } else {
        compareSlot2.innerHTML = `<span class="slot-placeholder">Slot 2 Empty</span>`;
        compareSlot2.classList.remove('filled');
    }
    
    lucide.createIcons();
    
    document.querySelectorAll('.btn-remove-slot').forEach(btn => {
        btn.onclick = () => {
            const idx = parseInt(btn.dataset.idx);
            toggleCompare(state.compareList[idx]);
        };
    });
    
    triggerComparisonBtn.disabled = state.compareList.length !== 2;
}

async function openComparisonModal() {
    if (state.compareList.length !== 2) return;
    
    compareTableBody.innerHTML = `
        <tr>
            <td colspan="3" style="text-align: center; padding: 40px;">
                <div style="font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 10px;">
                     Downloading comparison matrices...
                </div>
            </td>
        </tr>
    `;
    comparisonModal.classList.remove('hide');
    document.body.style.overflow = 'hidden';
    
    const m1 = await fetchFromAPI({ i: state.compareList[0].imdbID, plot: 'full' });
    const m2 = await fetchFromAPI({ i: state.compareList[1].imdbID, plot: 'full' });
    
    if (m1.Response === "False" || m2.Response === "False") {
        showToast('Unable to load comparison data.', 'x');
        closeCompareModal();
        return;
    }
    
    document.getElementById('compare-col-1-title').textContent = m1.Title;
    document.getElementById('compare-col-2-title').textContent = m2.Title;
    
    // Numeric metrics calculators
    const parseRating = (rStr) => parseFloat(rStr) || 0;
    const parseBoxOffice = (boStr) => {
        if (!boStr || boStr === 'N/A') return 0;
        return parseInt(boStr.replace(/[^0-9]/g, '')) || 0;
    };
    const parseRuntime = (rtStr) => {
        if (!rtStr || rtStr === 'N/A') return 0;
        return parseInt(rtStr.replace(/[^0-9]/g, '')) || 0;
    };
    
    const r1 = parseRating(m1.imdbRating);
    const r2 = parseRating(m2.imdbRating);
    const bo1 = parseBoxOffice(m1.BoxOffice);
    const bo2 = parseBoxOffice(m2.BoxOffice);
    const rt1 = parseRuntime(m1.Runtime);
    const rt2 = parseRuntime(m2.Runtime);
    
    // Award highlight algorithm
    const highlight = (v1, v2, displayVal1, displayVal2) => {
        if (v1 === 0 && v2 === 0) return [`<td>${displayVal1}</td>`, `<td>${displayVal2}</td>`];
        if (v1 > v2) {
            return [`<td class="highlight-win">${displayVal1} <i data-lucide="check" style="display:inline-block; width: 14px; height: 14px; margin-left:4px; vertical-align: middle;"></i></td>`, `<td>${displayVal2}</td>`];
        } else if (v2 > v1) {
            return [`<td>${displayVal1}</td>`, `<td class="highlight-win">${displayVal2} <i data-lucide="check" style="display:inline-block; width: 14px; height: 14px; margin-left:4px; vertical-align: middle;"></i></td>`];
        }
        return [`<td>${displayVal1}</td>`, `<td>${displayVal2}</td>`];
    };
    
    const ratingCols = highlight(r1, r2, m1.imdbRating || 'N/A', m2.imdbRating || 'N/A');
    const boxOfficeCols = highlight(bo1, bo2, m1.BoxOffice || 'N/A', m2.BoxOffice || 'N/A');
    const runtimeCols = highlight(rt1, rt2, m1.Runtime || 'N/A', m2.Runtime || 'N/A');
    
    const getPosterHtml = (m) => {
        const url = m.Poster !== 'N/A' ? m.Poster : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=150&auto=format&fit=crop';
        return `
            <div class="compare-card-visual">
                <img src="${url}" alt="${m.Title}">
                <span>${m.Title}</span>
            </div>
        `;
    };
    
    compareTableBody.innerHTML = `
        <tr>
            <td>Visual</td>
            <td>${getPosterHtml(m1)}</td>
            <td>${getPosterHtml(m2)}</td>
        </tr>
        <tr>
            <td>IMDb Rating</td>
            ${ratingCols[0]}
            ${ratingCols[1]}
        </tr>
        <tr>
            <td>Box Office</td>
            ${boxOfficeCols[0]}
            ${boxOfficeCols[1]}
        </tr>
        <tr>
            <td>Runtime Length</td>
            ${runtimeCols[0]}
            ${runtimeCols[1]}
        </tr>
        <tr>
            <td>Release Date</td>
            <td>${m1.Released || 'N/A'}</td>
            <td>${m2.Released || 'N/A'}</td>
        </tr>
        <tr>
            <td>Genre Category</td>
            <td>${m1.Genre || 'N/A'}</td>
            <td>${m2.Genre || 'N/A'}</td>
        </tr>
        <tr>
            <td>Director</td>
            <td>${m1.Director || 'N/A'}</td>
            <td>${m2.Director || 'N/A'}</td>
        </tr>
        <tr>
            <td>Writers List</td>
            <td>${m1.Writer || 'N/A'}</td>
            <td>${m2.Writer || 'N/A'}</td>
        </tr>
        <tr>
            <td>Primary Actors</td>
            <td>${m1.Actors || 'N/A'}</td>
            <td>${m2.Actors || 'N/A'}</td>
        </tr>
        <tr>
            <td>Plot Synopsis</td>
            <td>${m1.Plot || 'N/A'}</td>
            <td>${m2.Plot || 'N/A'}</td>
        </tr>
        <tr>
            <td>Awards Achieved</td>
            <td>${m1.Awards || 'N/A'}</td>
            <td>${m2.Awards || 'N/A'}</td>
        </tr>
        <tr>
            <td>Language & Country</td>
            <td>${m1.Language} (${m1.Country})</td>
            <td>${m2.Language} (${m2.Country})</td>
        </tr>
    `;
    
    lucide.createIcons();
}

function closeCompareModal() {
    comparisonModal.classList.add('hide');
    document.body.style.overflow = 'auto';
}

function clearComparisonList() {
    state.compareList = [];
    updateCompareBar();
    syncCardUI();
    showToast('Cleared comparison queue');
}

// --- DETAILS MODAL VIEW ---

async function openDetailsModal(imdbID) {
    state.activeMovieId = imdbID;
    document.body.style.overflow = 'hidden';
    
    // Reset view
    modalTitle.textContent = "Loading Movie Details...";
    modalRatings.innerHTML = '';
    modalPlot.textContent = '';
    modalDirector.textContent = '';
    modalWriter.textContent = '';
    modalCast.textContent = '';
    modalGenre.textContent = '';
    modalReleased.textContent = '';
    modalBoxOffice.textContent = '';
    modalAwards.textContent = '';
    modalLanguage.textContent = '';
    modalCountry.textContent = '';
    modalPoster.src = '';
    modalWatchlistBtn.className = "btn btn-secondary btn-sm hide";
    modalCompareBtn.className = "btn btn-secondary btn-sm hide";
    
    detailsModal.classList.remove('hide');
    
    const data = await fetchFromAPI({ i: imdbID, plot: 'full' });
    
    if (data.Response === "True") {
        modalHeroBg.style.backgroundImage = `url('${data.Poster}')`;
        const posterUrl = data.Poster !== 'N/A' ? data.Poster : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=400&auto=format&fit=crop';
        modalPoster.src = posterUrl;
        
        modalType.textContent = data.Type;
        modalTitle.textContent = data.Title;
        modalYear.textContent = data.Year;
        modalRated.textContent = data.Rated;
        modalRuntime.textContent = data.Runtime;
        
        let ratingsHtml = '';
        if (data.imdbRating && data.imdbRating !== 'N/A') {
            ratingsHtml += `
                <span class="rating-badge imdb">
                    <i data-lucide="star"></i> ${data.imdbRating}/10 (IMDb)
                </span>
            `;
        }
        
        if (data.Ratings) {
            data.Ratings.forEach(r => {
                if (r.Source === "Rotten Tomatoes") {
                    ratingsHtml += `
                        <span class="rating-badge tomato">
                            <i data-lucide="sparkles"></i> ${r.Value} (Rotten Tomatoes)
                        </span>
                    `;
                } else if (r.Source === "Metacritic") {
                    ratingsHtml += `
                        <span class="rating-badge metacritic">
                            <i data-lucide="award"></i> ${r.Value} (Metacritic)
                        </span>
                    `;
                }
            });
        }
        modalRatings.innerHTML = ratingsHtml;
        
        modalPlot.textContent = data.Plot;
        modalDirector.textContent = data.Director;
        modalWriter.textContent = data.Writer;
        modalCast.textContent = data.Actors;
        
        modalGenre.textContent = data.Genre;
        modalReleased.textContent = data.Released;
        modalBoxOffice.textContent = data.BoxOffice !== 'N/A' ? data.BoxOffice : 'Not Disclosed';
        modalAwards.textContent = data.Awards !== 'N/A' ? data.Awards : 'None';
        modalLanguage.textContent = data.Language;
        modalCountry.textContent = data.Country;
        
        // Show and configure details action buttons
        updateModalActionButtons(imdbID, data);
    } else {
        modalTitle.textContent = "Error Loading Details";
        modalPlot.textContent = "Could not fetch details for this movie.";
    }
}

function updateModalActionButtons(imdbID, data) {
    modalWatchlistBtn.classList.remove('hide');
    modalCompareBtn.classList.remove('hide');

    const inWatchlist = state.watchlist.some(item => item.imdbID === imdbID);
    const inCompare = state.compareList.some(item => item.imdbID === imdbID);

    if (inWatchlist) {
        modalWatchlistBtn.innerHTML = `<i data-lucide="check"></i> In Watchlist`;
        modalWatchlistBtn.className = "btn btn-primary btn-sm";
    } else {
        modalWatchlistBtn.innerHTML = `<i data-lucide="plus"></i> Add to Watchlist`;
        modalWatchlistBtn.className = "btn btn-secondary btn-sm";
    }

    if (inCompare) {
        modalCompareBtn.innerHTML = `<i data-lucide="check"></i> Added to Compare`;
        modalCompareBtn.className = "btn btn-primary btn-sm";
    } else {
        modalCompareBtn.innerHTML = `<i data-lucide="columns-2"></i> Compare`;
        modalCompareBtn.className = "btn btn-secondary btn-sm";
    }

    lucide.createIcons();

    modalWatchlistBtn.onclick = () => {
        handleToggleWatchlistRequest({
            imdbID,
            Title: data.Title,
            Year: data.Year,
            Type: data.Type,
            Poster: data.Poster
        });
    };

    modalCompareBtn.onclick = () => {
        toggleCompare({
            imdbID,
            Title: data.Title,
            Year: data.Year,
            Type: data.Type,
            Poster: data.Poster
        });
    };

    // Show play button in modal
    modalPlayBtn.style.display = 'inline-flex';
    modalPlayBtn.onclick = () => {
        const kind = (data && data.Type) ? data.Type.toLowerCase() : 'movie';
        if (kind === 'series') {
            // show season selector if available
            populateSeasonEpisodeControls(imdbID, data);
        }
        loadPlayer(imdbID, kind);
    };
}

async function loadPlayer(imdbID, kind = 'movie', season = null, episode = null) {
    modalPlayerContainer.classList.remove('hide');
    playerLoading.classList.remove('hide');
    modalPlayerIframe.src = '';

    try {
        let endpoint = '/api/stream/movie';
        let qs = `?imdb=${encodeURIComponent(imdbID)}&autoplay=1`;
        if (kind === 'tv' || kind === 'series') {
            if (season && episode) {
                endpoint = '/api/stream/episode';
                qs = `?imdb=${encodeURIComponent(imdbID)}&season=${season}&episode=${episode}&autoplay=1`;
            } else {
                endpoint = '/api/stream/tv';
                qs = `?imdb=${encodeURIComponent(imdbID)}&autoplay=1`;
            }
        }

        const res = await fetch(`${endpoint}${qs}`);
        if (!res.ok) throw new Error('Failed to fetch embed URL');
        const data = await res.json();
        if (data && data.embedUrl) {
            // Primary provider URL from backend (IMDb id remains unchanged: tt...)
            modalPlayerIframe.src = data.embedUrl;
        } else if (data && data.url) {
            modalPlayerIframe.src = data.url;
        } else {
            throw new Error('Invalid embed response');
        }

        // If iframe fails to load and fallback URLs are available, try next provider.
        const fallbackUrls = (data && Array.isArray(data.fallbackEmbedUrls)) ? data.fallbackEmbedUrls : [];
        if (fallbackUrls.length > 0) {
            let fallbackIndex = 0;
            modalPlayerIframe.onerror = () => {
                if (fallbackIndex < fallbackUrls.length) {
                    modalPlayerIframe.src = fallbackUrls[fallbackIndex];
                    fallbackIndex += 1;
                }
            };
        }
    } catch (err) {
        console.error('Player load error:', err);
        showToast('Unable to load player.', 'x');
    } finally {
        playerLoading.classList.add('hide');
    }
}

async function populateSeasonEpisodeControls(imdbID, omdbData) {
    // Hide first
    playerSeasonSelect.classList.add('hide');
    playerEpisodeSelect.classList.add('hide');

    // OMDB often includes totalSeasons
    const totalSeasons = parseInt(omdbData.totalSeasons) || 0;
    if (totalSeasons > 0) {
        playerSeasonSelect.innerHTML = '';
        for (let s = 1; s <= totalSeasons; s++) {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = `Season ${s}`;
            playerSeasonSelect.appendChild(opt);
        }
        playerSeasonSelect.classList.remove('hide');

        // Load episodes for season 1 by default
        const defaultSeason = 1;
        await fetchSeasonEpisodes(imdbID, defaultSeason);

        playerSeasonSelect.onchange = async () => {
            const s = parseInt(playerSeasonSelect.value);
            await fetchSeasonEpisodes(imdbID, s);
        };

        playerEpisodeSelect.onchange = () => {
            const s = playerSeasonSelect.value;
            const e = playerEpisodeSelect.value;
            if (s && e) loadPlayer(imdbID, 'tv', s, e);
        };
    }
}

async function fetchSeasonEpisodes(imdbID, season) {
    playerEpisodeSelect.classList.add('hide');
    playerEpisodeSelect.innerHTML = '';
    playerLoading.classList.remove('hide');
    try {
        const data = await fetchFromAPI({ i: imdbID, Season: season });
        if (data && data.Episodes && Array.isArray(data.Episodes)) {
            data.Episodes.forEach(ep => {
                const opt = document.createElement('option');
                opt.value = ep.Episode; // numeric
                opt.textContent = `${ep.Episode}. ${ep.Title}`;
                playerEpisodeSelect.appendChild(opt);
            });
            playerEpisodeSelect.classList.remove('hide');
        }
    } catch (err) {
        console.error('Failed to fetch episodes:', err);
    } finally {
        playerLoading.classList.add('hide');
    }
}

// Latest additions fetch/render

function closeDetailsModal() {
    state.activeMovieId = null;
    detailsModal.classList.add('hide');
    // hide and reset player
    if (modalPlayerContainer) modalPlayerContainer.classList.add('hide');
    if (modalPlayerIframe) modalPlayerIframe.src = '';
    if (modalPlayBtn) modalPlayBtn.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// --- AUTHENTICATION DIALOG HANDLERS ---

function openAuthModal(tab = 'login') {
    authModal.classList.remove('hide');
    document.body.style.overflow = 'hidden';
    switchAuthTab(tab);
}

function closeAuthModal() {
    authModal.classList.add('hide');
    document.body.style.overflow = 'auto';
    loginForm.reset();
    signupForm.reset();
    loginErrorMsg.classList.add('hide');
    signupErrorMsg.classList.add('hide');
}

function switchAuthTab(tab) {
    if (tab === 'login') {
        tabLogin.classList.add('active');
        tabSignup.classList.remove('active');
        loginForm.classList.remove('hide');
        signupForm.classList.add('hide');
    } else {
        tabLogin.classList.remove('active');
        tabSignup.classList.add('active');
        loginForm.classList.add('hide');
        signupForm.classList.remove('hide');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    loginErrorMsg.classList.add('hide');

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            state.user = data.user;
            state.storageMode = data.storageMode;
            updateNavbarAuthUI(true, data.user.username);
            closeAuthModal();
            showToast(`Welcome back, ${data.user.username}!`);
            
            // Sync guest local items to backend db
            await syncLocalStorageWatchlistToServer();
            await fetchWatchlistFromServer();
        } else {
            loginErrorMsg.textContent = data.error || 'Login failed';
            loginErrorMsg.classList.remove('hide');
        }
    } catch (err) {
        console.error(err);
        loginErrorMsg.textContent = 'Server connection error.';
        loginErrorMsg.classList.remove('hide');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    signupErrorMsg.classList.add('hide');

    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;

    if (password !== confirmPassword) {
        signupErrorMsg.textContent = 'Passwords do not match.';
        signupErrorMsg.classList.remove('hide');
        return;
    }

    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            state.user = data.user;
            state.storageMode = data.storageMode;
            updateNavbarAuthUI(true, data.user.username);
            closeAuthModal();
            showToast(`Account successfully created, ${data.user.username}!`);

            await syncLocalStorageWatchlistToServer();
            await fetchWatchlistFromServer();
        } else {
            signupErrorMsg.textContent = data.error || 'Registration failed';
            signupErrorMsg.classList.remove('hide');
        }
    } catch (err) {
        console.error(err);
        signupErrorMsg.textContent = 'Server connection error.';
        signupErrorMsg.classList.remove('hide');
    }
}

async function handleLogout() {
    try {
        const res = await fetch('/api/auth/logout', { method: 'POST' });
        if (res.ok) {
            state.user = null;
            updateNavbarAuthUI(false);
            showToast('Logged out successfully.');
            // Clear current list and reload empty/localStorage guest watchlist
            loadLocalWatchlist();
        }
    } catch (err) {
        console.error(err);
        showToast('Logout connection issue.', 'x');
    }
}

// --- GENERAL INTERACTION & EVENT BINDINGS ---

function setupEventListeners() {
    // Navbar Logo reloader
    document.getElementById('nav-logo').addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hide');
        runSearch('', 1);
    });

    // Realtime search with debounce
    searchInput.addEventListener('input', debounceSearch((e) => {
        const val = e.target.value.trim();
        if (val) {
            clearSearchBtn.classList.remove('hide');
            runSearch(val, 1);
        } else {
            clearSearchBtn.classList.add('hide');
            runSearch('', 1);
        }
    }, 400));
    
    // Clear search trigger
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hide');
        runSearch('', 1);
    });
    
    // Filters adjustments
    filterType.addEventListener('change', () => runSearch(searchInput.value.trim(), 1));
    filterYear.addEventListener('input', debounceSearch(() => runSearch(searchInput.value.trim(), 1), 600));
    sortBy.addEventListener('change', () => sortAndRenderResults());
    
    // Pagination Controls
    prevPageBtn.addEventListener('click', () => {
        if (state.currentPage > 1) {
            runSearch(state.searchQuery, state.currentPage - 1);
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        runSearch(state.searchQuery, state.currentPage + 1);
    });
    
    // Watchlist drawer triggers
    toggleWatchlistBtn.addEventListener('click', () => {
        watchlistDrawer.classList.toggle('open');
    });
    
    closeWatchlistBtn.addEventListener('click', () => {
        watchlistDrawer.classList.remove('open');
    });
    
    // Modals close
    closeDetailsBtn.addEventListener('click', closeDetailsModal);
    detailsModal.addEventListener('click', (e) => {
        if (e.target === detailsModal) closeDetailsModal();
    });
    
    // Compare actions
    triggerComparisonBtn.addEventListener('click', openComparisonModal);
    closeCompareModalBtn.addEventListener('click', closeCompareModal);
    comparisonModal.addEventListener('click', (e) => {
        if (e.target === comparisonModal) closeCompareModal();
    });
    clearCompareBtn.addEventListener('click', clearComparisonList);

    // Auth actions
    navAuthBtn.addEventListener('click', () => {
        if (state.user) {
            handleLogout();
        } else {
            openAuthModal('login');
        }
    });
    closeAuthBtn.addEventListener('click', closeAuthModal);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });
    tabLogin.addEventListener('click', () => switchAuthTab('login'));
    tabSignup.addEventListener('click', () => switchAuthTab('signup'));

    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
}

// --- UTILITY TOAST NOTIFICATIONS ---

let toastTimer;
function showToast(message, type = 'info') {
    toastMessage.textContent = message;
    
    if (type === 'warning') {
        toastIcon.setAttribute('data-lucide', 'alert-triangle');
        toast.style.borderColor = 'rgba(251, 191, 36, 0.4)';
    } else if (type === 'x') {
        toastIcon.setAttribute('data-lucide', 'x-circle');
        toast.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
        toastIcon.setAttribute('data-lucide', 'info');
        toast.style.borderColor = 'rgba(99, 102, 241, 0.25)';
    }
    
    lucide.createIcons();
    toast.classList.remove('hide');
    
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.add('hide');
    }, 3000);
}
