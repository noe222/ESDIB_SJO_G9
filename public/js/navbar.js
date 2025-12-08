/* public/js/navbar.js */

const menuToggle = document.getElementById("menu-toggle");
const dropdownMenu = document.getElementById("dropdown-menu");
// const body = document.body; // Opcional, si queremos bloquear scroll

menuToggle.addEventListener("click", () => {
  // Alternar icono X
  menuToggle.classList.toggle("open");
  
  // Alternar visibilidad del menú
  dropdownMenu.classList.toggle("active");
});

// Cerrar menú al hacer clic en un enlace
dropdownMenu.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    menuToggle.classList.remove("open");
    dropdownMenu.classList.remove("active");
  });
});

// (Opcional) Cerrar si hago clic fuera
document.addEventListener("click", (e) => {
  if (!menuToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
    menuToggle.classList.remove("open");
    dropdownMenu.classList.remove("active");
  }
});