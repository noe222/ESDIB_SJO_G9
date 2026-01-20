// Scroll snap profesional para móvil - Tipo TikTok
(function() {
  // Solo activar en móvil
  if (window.innerWidth > 767) return;

  let isScrolling = false;
  let currentSection = 0;
  const sections = document.querySelectorAll('.snap-section');
  
  if (sections.length === 0) return;

  // Función para hacer scroll suave a una sección
  function scrollToSection(index) {
    if (index < 0 || index >= sections.length) return;
    
    isScrolling = true;
    currentSection = index;
    
    sections[index].scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    
    setTimeout(() => {
      isScrolling = false;
    }, 1000);
  }

  // Detectar scroll del usuario
  let scrollTimeout;
  let lastScrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  window.addEventListener('scroll', function() {
    if (isScrolling) return;
    
    clearTimeout(scrollTimeout);
    
    scrollTimeout = setTimeout(function() {
      const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      
      // Determinar la sección más cercana
      let closestSection = 0;
      let closestDistance = Infinity;
      
      sections.forEach((section, index) => {
        const rect = section.getBoundingClientRect();
        const distance = Math.abs(rect.top);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestSection = index;
        }
      });
      
      // Snap a la sección más cercana si no estamos ya en ella
      if (Math.abs(sections[closestSection].getBoundingClientRect().top) > 50) {
        scrollToSection(closestSection);
      }
      
      lastScrollTop = currentScrollTop;
    }, 150);
  }, { passive: true });

  // Touch swipe para mejor experiencia en móvil
  let touchStartY = 0;
  let touchEndY = 0;
  
  document.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  
  document.addEventListener('touchend', function(e) {
    if (isScrolling) return;
    
    touchEndY = e.changedTouches[0].clientY;
    const swipeDistance = touchStartY - touchEndY;
    
    // Si el swipe es significativo (más de 50px)
    if (Math.abs(swipeDistance) > 50) {
      if (swipeDistance > 0 && currentSection < sections.length - 1) {
        // Swipe hacia arriba - siguiente sección
        scrollToSection(currentSection + 1);
      } else if (swipeDistance < 0 && currentSection > 0) {
        // Swipe hacia abajo - sección anterior
        scrollToSection(currentSection - 1);
      }
    }
  }, { passive: true });
  
  // Inicializar en la primera sección
  scrollToSection(0);
})();
