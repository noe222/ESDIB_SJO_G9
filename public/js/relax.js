const soundCards = document.querySelectorAll(".sound-card");
const playBtn = document.getElementById("play-btn");
const currentSoundText = document.getElementById("current-sound");
const audioPlayer = document.getElementById("audio-player");

let currentSound = "";
let isPlaying = false;

const sounds = {
  mar: "assets/music/mar.mp3",
  lluvia: "assets/music/lluvia.mp3",
  bosque: "assets/music/bosque.mp3",
  fuego: "assets/music/fuego.mp3",
};

soundCards.forEach(card => {
  card.addEventListener("click", () => {
    const sound = card.dataset.sound;
    if (sound !== currentSound) {
      currentSound = sound;
      audioPlayer.src = sounds[sound];
      currentSoundText.textContent = "Escuchando: " + card.querySelector("p").textContent;
      playBtn.textContent = "▶️ Reproducir";
      isPlaying = false;
      audioPlayer.pause();
    }
  });
});

playBtn.addEventListener("click", () => {
  if (!currentSound) return alert("Elige un sonido primero 🌿");
  
  if (isPlaying) {
    audioPlayer.pause();
    playBtn.textContent = "▶️ Reproducir";
  } else {
    audioPlayer.play();
    playBtn.textContent = "⏸️ Pausar";
  }
  isPlaying = !isPlaying;
});
