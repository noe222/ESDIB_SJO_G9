/* js/navbar.js */

const menuToggle = document.getElementById("menu-toggle");
const navLinks = document.getElementById("nav-links");
const body = document.body;

menuToggle.addEventListener("click", () => {
  // Alternar clase 'active' para mostrar/ocultar menú
  navLinks.classList.toggle("active");
  
  // Alternar clase 'open' para animar el icono hamburguesa a X
  menuToggle.classList.toggle("open");

  // Bloquear el scroll del fondo cuando el menú está abierto
  if (navLinks.classList.contains("active")) {
    body.style.overflow = "hidden";
  } else {
    body.style.overflow = "auto";
  }
});

// Cerrar menú al hacer clic en un enlace (opcional pero recomendado)
navLinks.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("active");
    menuToggle.classList.remove("open");
    body.style.overflow = "auto";
  });
});