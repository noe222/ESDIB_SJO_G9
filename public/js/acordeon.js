document.addEventListener('DOMContentLoaded', () => {

    // Configuración de las imágenes de flecha
    const arrowClosed = 'https://neumastorage2025.blob.core.windows.net/esdibcontainerg9/imagenes_juntas_Neuma/iconografia_flecha_abajo.png';
    const arrowOpen = 'https://neumastorage2025.blob.core.windows.net/esdibcontainerg9/imagenes_juntas_Neuma/iconografia_flecha_arriba.png';   // Flecha hacia arriba/abierta

    const items = document.querySelectorAll('.accordion-item');

    items.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const arrowImg = item.querySelector('.arrow-icon');

        header.addEventListener('click', () => {
            // Cerrar otros items si quieres comportamiento de acordeón estricto (opcional)
            // items.forEach(i => {
            //     if(i !== item) {
            //         i.classList.remove('active');
            //         i.querySelector('.arrow-icon').src = arrowClosed;
            //     }
            // });

            // Alternar clase active
            item.classList.toggle('active');

            // Cambiar imagen de flecha
            if (item.classList.contains('active')) {
                arrowImg.src = arrowOpen;
            } else {
                arrowImg.src = arrowClosed;
            }
        });
    });
});