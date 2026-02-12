// Randomize particles on load
(function () {
    const particles = document.querySelectorAll('.particle');
    particles.forEach((p) => {
        // Random horizontal position
        p.style.left = Math.random() * 90 + 5 + '%';
        // Random animation delay
        p.style.animationDelay = Math.random() * 8 + 's';
        // Random duration between 5-12s
        p.style.animationDuration = (Math.random() * 7 + 5) + 's';
        // Slight size variation
        const size = Math.random() * 2 + 3;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
    });

    // Re-randomize every 30 seconds
    setInterval(() => {
        particles.forEach((p) => {
            p.style.left = Math.random() * 90 + 5 + '%';
            p.style.animationDelay = '0s';
            p.style.animationDuration = (Math.random() * 7 + 5) + 's';
        });
    }, 30000);
})();
