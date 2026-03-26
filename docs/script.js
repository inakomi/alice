document.addEventListener("DOMContentLoaded", () => {
    // 0. Intro Cinematic Sequence & Audio Unlock
    const introCinematic = document.getElementById("intro-cinematic");
    const introVid1 = document.getElementById("intro-vid-1");
    const introTextSeq = document.getElementById("intro-text-seq");
    const localAudio = document.getElementById("local-audio");

    // Start video 1
    if (introVid1) {
        introVid1.addEventListener("ended", () => {
            introTextSeq.classList.add("active");
        });
    }

    let canPressSpacebar = true;

    // Helper to play a video reliably
    const loadingOverlay = document.getElementById("loading-overlay");
    const loadingText = document.getElementById("loading-text");

    function showLoading(text) {
        if (!loadingOverlay) return;
        if (loadingText) loadingText.innerText = text || "Loading...";
        loadingOverlay.hidden = false;
        loadingOverlay.style.pointerEvents = "auto";
    }

    function hideLoading() {
        if (!loadingOverlay) return;
        loadingOverlay.hidden = true;
        loadingOverlay.style.pointerEvents = "none";
    }

    // Lazy-load video source only when needed
    function loadVideoSrc(video, src) {
        if (video && !video.src.includes(src)) {
            video.src = src;
            video.load();
        }
    }

    async function safePlay(video, { mute = true, label = "video" } = {}) {
        if (!video) return;

        try {
            video.muted = mute;
            video.currentTime = 0;
            const promise = video.play();
            if (promise && promise.catch) {
                await promise.catch(err => {
                    console.warn(`safePlay ${label} rejected`, err);
                });
            }
            if (!mute) {
                setTimeout(() => {
                    try { video.muted = false; } catch (e) { }
                }, 300);
            }
        } catch (err) {
            console.warn(`safePlay ${label} error`, err);
        } finally {
            setTimeout(hideLoading, 250);
        }
    }

    // Three.js Points Waves effect (blue nuances) with mouse interaction
    const waveStage = document.getElementById("final-stage-wave");
    const waveContainer = document.getElementById("wave-three-container");

    function startWaveform(durationMs = 6000) {
        return new Promise(resolve => {
            waveStage.classList.add("active");

            const SEPARATION = 100, AMOUNTX = 50, AMOUNTY = 50;
            let waveCamera, waveScene, waveRenderer, waveParticles, waveCount = 0;
            let waveAnimId = null;
            let wMouseX = 0, wMouseY = 0;
            const halfW = window.innerWidth / 2;
            const halfH = window.innerHeight / 2;

            // Mouse interaction
            function onWavePointerMove(event) {
                if (event.isPrimary === false) return;
                wMouseX = event.clientX - halfW;
                wMouseY = event.clientY - halfH;
            }
            waveContainer.style.touchAction = 'none';
            waveContainer.addEventListener('pointermove', onWavePointerMove);

            // Setup
            const w = waveContainer.clientWidth || window.innerWidth;
            const h = waveContainer.clientHeight || window.innerHeight;

            waveCamera = new THREE.PerspectiveCamera(75, w / h, 1, 10000);
            waveCamera.position.z = 1000;

            waveScene = new THREE.Scene();

            const numParticles = AMOUNTX * AMOUNTY;
            const positions = new Float32Array(numParticles * 3);
            const scales = new Float32Array(numParticles);
            const colors = new Float32Array(numParticles * 3);

            let idx = 0, j = 0;
            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    positions[idx] = ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2);
                    positions[idx + 1] = 0;
                    positions[idx + 2] = iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2);
                    colors[idx] = 0.0;
                    colors[idx + 1] = 0.4;
                    colors[idx + 2] = 1.0;
                    scales[j] = 1;
                    idx += 3;
                    j++;
                }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: 6,
                vertexColors: true,
                transparent: true,
                opacity: 0.9,
                sizeAttenuation: true
            });

            waveParticles = new THREE.Points(geometry, material);
            waveScene.add(waveParticles);

            waveRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
            waveRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            waveRenderer.setSize(w, h);
            waveRenderer.setClearColor(0x000000, 0);
            waveContainer.appendChild(waveRenderer.domElement);

            function waveAnimate() {
                waveAnimId = requestAnimationFrame(waveAnimate);

                // Camera follows mouse (like original example)
                waveCamera.position.x += (wMouseX - waveCamera.position.x) * 0.05;
                waveCamera.position.y += (-wMouseY - waveCamera.position.y) * 0.05;
                waveCamera.lookAt(waveScene.position);

                const posArr = geometry.attributes.position.array;
                const colArr = geometry.attributes.color.array;

                let i = 0, ci = 0;
                for (let ix = 0; ix < AMOUNTX; ix++) {
                    for (let iy = 0; iy < AMOUNTY; iy++) {
                        const y = (Math.sin((ix + waveCount) * 0.3) * 50) +
                                  (Math.sin((iy + waveCount) * 0.5) * 50);
                        posArr[i + 1] = y;

                        // Blue nuances based on height
                        const norm = (y + 100) / 200;
                        colArr[ci]     = norm * 0.15;
                        colArr[ci + 1] = 0.25 + norm * 0.55;
                        colArr[ci + 2] = 0.6 + norm * 0.4;

                        i += 3;
                        ci += 3;
                    }
                }

                geometry.attributes.position.needsUpdate = true;
                geometry.attributes.color.needsUpdate = true;
                waveCount += 0.1;

                waveRenderer.render(waveScene, waveCamera);
            }

            waveAnimate();

            // Cleanup after duration
            setTimeout(() => {
                if (waveAnimId) cancelAnimationFrame(waveAnimId);
                waveContainer.removeEventListener('pointermove', onWavePointerMove);
                waveRenderer.dispose();
                geometry.dispose();
                material.dispose();
                if (waveRenderer.domElement && waveRenderer.domElement.parentNode) {
                    waveRenderer.domElement.parentNode.removeChild(waveRenderer.domElement);
                }
                waveStage.classList.remove("active");
                resolve();
            }, durationMs);
        });
    }

    // Spacebar logic
    document.addEventListener("keydown", async (e) => {
        if (e.code === "Space" && canPressSpacebar) {
            canPressSpacebar = false;

            const whyVid = document.getElementById("why-vid");

            if (introVid1) {
                introVid1.pause();
                introVid1.classList.remove("active");
            }
            introTextSeq.classList.remove("active");

            // Lazy-load WHY video
            loadVideoSrc(whyVid, "media/why.mp4");
            whyVid.classList.add("active");
            whyVid.volume = 1.0;
            await safePlay(whyVid, { mute: false, label: 'WHY video' });

            // Start Audio Fade In
            localAudio.volume = 0;
            localAudio.play().catch(e => console.log("Audio play error:", e));

            let vol = 0;
            const fadeInterval = setInterval(() => {
                if (vol < 1) {
                    vol += 0.02; // Faster fade (was 0.01)
                    localAudio.volume = Math.max(0, Math.min(vol, 1));
                } else {
                    clearInterval(fadeInterval);
                }
            }, 80);

            whyVid.addEventListener('ended', async () => {
                const glitchReveal = document.getElementById("glitch-reveal");
                const glitchName = document.getElementById("glitch-name");

                glitchReveal.classList.add("active");
                whyVid.classList.remove("active");

                setTimeout(() => {
                    glitchName.innerText = "INES";
                    glitchName.setAttribute("data-text", "INES");

                    setTimeout(async () => {
                        glitchReveal.classList.remove("active");

                        const schoolVid = document.getElementById("school-vid");
                        whyVid.classList.remove("active");
                        whyVid.pause();

                        // Lazy-load SCHOOL video
                        loadVideoSrc(schoolVid, "media/school.mp4");
                        schoolVid.classList.add("active");
                        await safePlay(schoolVid, { mute: true, label: 'SCHOOL video' });

                        schoolVid.addEventListener('ended', async () => {
                            const liesReveal = document.getElementById("lies-reveal");
                            schoolVid.classList.remove("active");
                            liesReveal.classList.add("active");

                            setTimeout(async () => {
                                liesReveal.classList.remove("active");

                                const craycrayVid = document.getElementById("craycray-vid");
                                schoolVid.classList.remove("active");
                                schoolVid.pause();

                                // Lazy-load CRAYCRAY video
                                loadVideoSrc(craycrayVid, "media/craycray.mp4");
                                craycrayVid.classList.add("active");
                                await safePlay(craycrayVid, { mute: true, label: 'CRAYCRAY video' });

                                craycrayVid.addEventListener('ended', () => {
                                    startAliceGame();
                                });
                            }, 5000);
                        });

                    }, 2000);
                }, 2000);
            });
        }
    });

    // Skip Logic
    const skipBtn = document.getElementById("skip-btn");
    if (skipBtn) {
        skipBtn.addEventListener("click", () => {
            const allIntroVids = document.querySelectorAll(".intro-video");
            allIntroVids.forEach(v => {
                v.pause();
                v.classList.remove("active");
            });

            introTextSeq.classList.remove("active");
            document.getElementById("glitch-reveal").classList.remove("active");
            document.getElementById("lies-reveal").classList.remove("active");
            skipBtn.style.display = "none";

            startAliceGame();
        });
    }

    function startAliceGame() {
        const gameContainer = document.getElementById("game-container");
        const canvas = document.getElementById("game-canvas");
        const ctx = canvas.getContext("2d");
        const riddleInput = document.getElementById("riddle-input");
        const tickingContainer = document.getElementById("ticking-messages");

        gameContainer.classList.add("active");
        document.getElementById("skip-btn").style.display = "none";

        // Simplified particles: fewer particles, lower frequency
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles = [];
        for (let i = 0; i < 30; i++) { // Reduced from 80 to 30
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2,
                speed: 0.5 + Math.random() * 1,
                opacity: Math.random() * 0.4
            });
        }

        let particleRAF;
        function drawBackground() {
            ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speed;
                if (p.y > canvas.height) p.y = -10;
                ctx.fillStyle = `rgba(100, 200, 255, ${p.opacity})`;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });
            particleRAF = requestAnimationFrame(drawBackground);
        }
        drawBackground();

        // Riddle Logic
        let mistakes = 0;
        riddleInput.focus();

        riddleInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const val = riddleInput.value.toLowerCase().trim();
                if (val === "alice") {
                    riddleInput.style.color = "#0f0";
                    riddleInput.disabled = true;
                    // Stop particles when game solved
                    if (particleRAF) cancelAnimationFrame(particleRAF);

                    const victoryReveal = document.getElementById("victory-reveal");
                    const riddleUi = document.getElementById("riddle-ui");
                    const stage1 = document.getElementById("final-stage-1");
                    const stage2 = document.getElementById("final-stage-2");
                    const stage3 = document.getElementById("final-stage-3");
                    const btnReplay = document.getElementById("btn-replay");
                    const btnStop = document.getElementById("btn-stop");

                    riddleUi.style.opacity = "0";
                    setTimeout(() => {
                        riddleUi.style.display = "none";
                        victoryReveal.classList.add("active");

                        setTimeout(() => {
                            stage1.classList.remove("active");
                            setTimeout(() => {
                                stage2.classList.add("active");
                            }, 500);
                        }, 3000);
                    }, 1000);

                    const triggerFinalInversion = () => {
                        stage2.classList.remove("active");
                        setTimeout(() => {
                            const stageDots = document.getElementById("final-stage-dots");
                            stageDots.classList.add("active");

                            setTimeout(() => {
                                stageDots.classList.remove("active");
                                setTimeout(() => {
                                    stage3.classList.add("active");

                                    setTimeout(() => {
                                        stage3.classList.remove("active");
                                        setTimeout(async () => {
                                            await startWaveform(5200);

                                            const stageFinale = document.getElementById("final-stage-finale");
                                            const finaleVid = document.getElementById("finale-vid");
                                            const stageCredits = document.getElementById("final-stage-credits");

                                            // Lazy-load FINALE video
                                            loadVideoSrc(finaleVid, "media/finale.mp4");
                                            stageFinale.classList.add("active");

                                            if (!localAudio.paused && localAudio.volume > 0) {
                                                finaleVid.muted = true;
                                            } else {
                                                finaleVid.muted = false;
                                            }

                                            await safePlay(finaleVid, { mute: finaleVid.muted, label: 'Finale video' });

                                            function showCredits() {
                                                stageFinale.classList.remove("active");
                                                finaleVid.pause();
                                                setTimeout(() => {
                                                    stageCredits.classList.add("active");
                                                }, 500);
                                            }

                                            finaleVid.onended = showCredits;
                                            setTimeout(() => {
                                                if (!stageCredits.classList.contains("active")) {
                                                    showCredits();
                                                }
                                            }, 60000);

                                        }, 500);
                                    }, 4000);
                                }, 500);
                            }, 2000);
                        }, 500);
                    };

                    btnReplay.onclick = () => triggerFinalInversion();
                    btnStop.onclick = () => triggerFinalInversion();

                } else {
                    mistakes++;
                    riddleInput.value = "";
                    addTickingMessage();
                    riddleInput.style.transform = "translateX(10px)";
                    setTimeout(() => riddleInput.style.transform = "translateX(-10px)", 50);
                    setTimeout(() => riddleInput.style.transform = "translateX(0)", 100);
                }
            }
        });

        function addTickingMessage() {
            const msg = document.createElement("div");
            msg.className = "ticking-msg";
            msg.innerText = "the clock is ticking";
            msg.style.left = Math.random() * 80 + 10 + "%";
            msg.style.top = Math.random() * 80 + 10 + "%";
            msg.style.fontSize = (0.5 + Math.random() * 1) + "rem";
            tickingContainer.appendChild(msg);

            gameContainer.style.background = "radial-gradient(circle at center, #003366 0%, #000 100%)";
            setTimeout(() => {
                gameContainer.style.background = "radial-gradient(circle at center, #0a1128 0%, #000 100%)";
            }, 100);
        }
    }

    // 1. Logic Variables & Unlock System
    let hasDiverted = false;
    let isUnlocked = false;
    const divertOverlay = document.getElementById("divert-overlay");
    const divertInput = document.getElementById("divert-input");

    divertInput.addEventListener("input", (e) => {
        if (e.target.value.toLowerCase() === "aa") {
            isUnlocked = true;
            divertOverlay.classList.remove("active");
            e.target.blur();
            e.target.value = "";
        }
    });

    // 2. Immersion (Fullscreen) Logic
    const immersionBtn = document.getElementById("immersion-btn");
    immersionBtn.addEventListener("click", () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        }
        immersionBtn.classList.add("hidden");
        setTimeout(() => immersionBtn.remove(), 500);
    });

    // 3. Horizontal Scroll Magic
    const scrollWrapper = document.querySelector(".scroll-wrapper");

    scrollWrapper.addEventListener("wheel", (evt) => {
        evt.preventDefault();

        if (!hasDiverted) {
            hasDiverted = true;
            divertOverlay.classList.add("active");
            setTimeout(() => {
                divertInput.focus();
            }, 100);
            return;
        }

        if (!isUnlocked) return;

        scrollWrapper.scrollLeft += evt.deltaY * 2.0;
    }, { passive: false });
});
