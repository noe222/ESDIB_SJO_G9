// Cargar y renderizar sonidos desde la API
let allSounds = [];
let currentAudio = null;

// Función para cargar sonidos desde el backend
async function loadSounds(search = '') {
    try {
        // Construir URL con parámetros (sin category)
        const params = new URLSearchParams();
        if (search) params.append('search', search);

        const url = `/api/sounds${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url);

        if (!res.ok) {
            throw new Error(`Error del servidor: ${res.status}`);
        }

        const sounds = await res.json();
        allSounds = sounds;
        renderSounds(sounds);
    } catch (err) {
        console.error('Error cargando sonidos:', err);
        document.getElementById('soundsGrid').innerHTML =
            '<p style="text-align:center; color: red; padding: 2rem;">Error al cargar los sonidos. Inténtalo más tarde.</p>';
    }
}

// Función para renderizar sonidos en el grid
function renderSounds(sounds) {
    const grid = document.getElementById('soundsGrid');

    if (!sounds || sounds.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color: #888; padding: 2rem;">No se encontraron sonidos. ¡Sé el primero en compartir uno!</p>';
        return;
    }

    grid.innerHTML = ''; // Limpiar

    sounds.forEach(sound => {
        // Imagen de portada (usar placeholder si no hay)
        const imgSrc = sound.coverImage?.url || 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80';

        // ID del sonido para MongoDB
        const soundId = sound._id?.$oid || sound._id;

        // Crear tarjeta simple (solo título, sin controles por ahora)
        const card = document.createElement('a');
        card.className = 'sound-card';
        card.dataset.soundId = soundId;
        card.href = `escucha-detalle.html?id=${soundId}`;

        card.innerHTML = `
      <img src="${imgSrc}" alt="${sound.title}" class="sound-card-bg" loading="lazy">
      <div class="sound-card-overlay">
        <h3>${sound.title}</h3>
      </div>
    `;

        grid.appendChild(card);
    });
}

// Debounce para la búsqueda
let searchTimeout;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const searchValue = document.getElementById('searchInput').value;
        loadSounds(searchValue);
    }, 300);
}

// Inicializar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    // Cargar sonidos inicialmente
    loadSounds();

    // Event listener para búsqueda
    document.getElementById('searchInput').addEventListener('input', debounceSearch);
});
