/* public/js/navbar.js */

const menuToggle = document.getElementById("menu-toggle");
const dropdownMenu = document.getElementById("dropdown-menu");
const body = document.body;

// Función para abrir/cerrar menú
function toggleMenu() {
  menuToggle.classList.toggle("open");
  dropdownMenu.classList.toggle("active");

  // BLOQUEAR SCROLL - Usando clase CSS en lugar de style directo
  if (dropdownMenu.classList.contains("active")) {
    body.classList.add("no-scroll");
  } else {
    body.classList.remove("no-scroll");
  }
}

// Evento click en hamburguesa
menuToggle.addEventListener("click", toggleMenu);

// Cerrar al hacer clic en un enlace (para navegar)
dropdownMenu.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    menuToggle.classList.remove("open");
    dropdownMenu.classList.remove("active");
    body.classList.remove("no-scroll");
  });
});