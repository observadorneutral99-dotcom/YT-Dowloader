const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const loadingIndicator = document.getElementById('loading');
const downloadToast = document.getElementById('download-toast');
const downloadTitle = document.getElementById('download-title');

let debounceTimer;

// Search functionality
async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Empieza a buscar</h3>
                <p>Encuentra tus canciones y descárgalas en un clic.</p>
            </div>
        `;
        return;
    }

    // UI State
    resultsContainer.innerHTML = '';
    loadingIndicator.classList.remove('hidden');

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        displayResults(data.results);
    } catch (error) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error al buscar</h3>
                <p>${error.message}</p>
            </div>
        `;
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

// Display results
function displayResults(results) {
    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ghost"></i>
                <h3>Sin resultados</h3>
                <p>No pudimos encontrar "${searchInput.value}". Intenta con otra búsqueda.</p>
            </div>
        `;
        return;
    }

    results.forEach(song => {
        // Crop thumbnails to square if possible by replacing part of yt img url if it's there
        let thumbUrl = song.thumbnail;
        
        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <div class="thumbnail-wrapper">
                <img src="${thumbUrl}" alt="Portada" class="song-thumbnail">
                <button class="download-btn" onclick="downloadSong('${song.videoId}', '${song.title.replace(/'/g, "\\'")}')" title="Descargar">
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
            <div class="song-info">
                <h3 class="song-title" title="${song.title}">${song.title}</h3>
                <p class="song-artist" title="${song.artists}">${song.artists}</p>
            </div>
        `;
        resultsContainer.appendChild(card);
    });
}

// Download functionality
async function downloadSong(videoId, title) {
    downloadTitle.textContent = title;
    downloadToast.classList.remove('hidden');

    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ videoId })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        if (data.success && data.downloadUrl) {
            // Trigger actual download
            const a = document.createElement('a');
            a.href = data.downloadUrl;
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // Change toast to success temporarily
            downloadToast.innerHTML = `
                <div class="toast-content">
                    <i class="fas fa-check-circle"></i>
                    <div class="toast-text">
                        <h4>Descarga lista</h4>
                        <p>${title}</p>
                    </div>
                </div>
            `;
            setTimeout(() => {
                downloadToast.classList.add('hidden');
                // Reset toast inner html for next time
                setTimeout(() => {
                    downloadToast.innerHTML = `
                        <div class="toast-content">
                            <i class="fas fa-circle-notch fa-spin"></i>
                            <div class="toast-text">
                                <h4>Descargando archivo</h4>
                                <p id="download-title"></p>
                            </div>
                        </div>
                    `;
                }, 500);
            }, 3000);
        }
    } catch (error) {
        alert(`Error al descargar: ${error.message}`);
        downloadToast.classList.add('hidden');
    }
}

// Event Listeners - Search on type with debounce
searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        performSearch();
    }, 600); // Wait 600ms after user stops typing
});

// Also keep Enter key functionality for immediate search
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        clearTimeout(debounceTimer);
        performSearch();
    }
});
