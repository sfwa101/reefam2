import confetti from "canvas-confetti";

export const fireConfetti = () => {
  const defaults = { startVelocity: 32, spread: 360, ticks: 70, zIndex: 9999, scalar: 0.9 };
  const colors = ["#16a34a", "#f59e0b", "#fbbf24", "#22c55e", "#facc15", "#ffffff"];

  confetti({ ...defaults, particleCount: 80, origin: { x: 0.5, y: 0.35 }, colors });

  setTimeout(() => {
    confetti({ ...defaults, particleCount: 50, angle: 60, spread: 70, origin: { x: 0, y: 0.6 }, colors });
    confetti({ ...defaults, particleCount: 50, angle: 120, spread: 70, origin: { x: 1, y: 0.6 }, colors });
  }, 220);
};

export const fireMiniConfetti = () => {
  confetti({
    particleCount: 40,
    spread: 60,
    startVelocity: 25,
    origin: { y: 0.4 },
    colors: ["#16a34a", "#f59e0b", "#fbbf24"],
    zIndex: 9999,
    scalar: 0.8,
  });
};
