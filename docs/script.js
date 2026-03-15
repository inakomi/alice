document.addEventListener("DOMContentLoaded", () => {
    // 0. Intro Cinematic Sequence & Audio Unlock
    const introCinematic = document.getElementById("intro-cinematic");
    const introVid1 = document.getElementById("intro-vid-1");
    const introTextSeq = document.getElementById("intro-text-seq");
    const takeChainsBtn = document.getElementById("take-chains-btn");
    const localAudio = document.getElementById("local-audio");


    // Start video 1
    if (introVid1) {
        introVid1.addEventListener("ended", () => {
            // Video ended normally without spacebar, show text.
            introTextSeq.classList.add("active");
        });
    }

    let canPressSpacebar = true; // Let user press spacebar IMMEDIATELY!

    // Helper to play a video reliably (handles autoplay restrictions and errors)
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

    async function safePlay(video, { mute = true, label = "video" } = {}) {
        if (!video) return;
        showLoading(`Starting ${label}...`);

        try {
            video.muted = mute;
            video.currentTime = 0;
            video.load();
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

    // Waveform visualizer (before the finale video)
    const waveCanvas = document.getElementById("audio-wave-canvas");
    const waveStage = document.getElementById("final-stage-wave");
    let waveCtx, waveAnalyser, waveData, waveRAF, waveAudioCtx;

    function initWaveForm() {
        if (!waveCanvas || !localAudio || waveAudioCtx) return;
        waveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = waveAudioCtx.createMediaElementSource(localAudio);
        waveAnalyser = waveAudioCtx.createAnalyser();
        waveAnalyser.fftSize = 2048;
        source.connect(waveAnalyser);
        waveAnalyser.connect(waveAudioCtx.destination);

        waveData = new Uint8Array(waveAnalyser.fftSize);
        waveCtx = waveCanvas.getContext("2d");

        function resize() {
            const rect = waveCanvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            waveCanvas.width = rect.width * dpr;
            waveCanvas.height = rect.height * dpr;
            waveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();
        window.addEventListener("resize", resize);
    }

    function startWaveform(durationMs = 9000) {
        if (!waveCtx || !waveAnalyser) initWaveForm();
        if (!waveCtx || !waveAnalyser) return Promise.resolve();

        waveAnalyser.getByteTimeDomainData(waveData);

        const w = waveCanvas.clientWidth;
        const h = waveCanvas.clientHeight;

        // Keep a small buffer of past samples for smoother motion
        const history = new Array(60).fill(0);
        let historyIdx = 0;

        function draw() {
            waveAnalyser.getByteTimeDomainData(waveData);

            // Smooth the waveform by averaging nearby samples
            for (let i = 0; i < waveData.length; i += 16) {
                const base = waveData[i];
                history[historyIdx] = base;
                historyIdx = (historyIdx + 1) % history.length;
            }

            const avg = history.reduce((sum, v) => sum + v, 0) / history.length;
            const bass = (avg - 128) / 128;

            waveCtx.clearRect(0, 0, w, h);

            const gradient = waveCtx.createLinearGradient(0, 0, w, h);
            gradient.addColorStop(0, "rgba(0, 230, 255, 0.15)");
            gradient.addColorStop(0.5, "rgba(60, 80, 220, 0.25)");
            gradient.addColorStop(1, "rgba(160, 0, 255, 0.15)");
            waveCtx.fillStyle = gradient;
            waveCtx.fillRect(0, 0, w, h);

            const midY = h / 2;
            const amp = h * (0.2 + Math.abs(bass) * 0.25);

            const time = performance.now() * 0.0005;

            for (let layer = 0; layer < 5; layer++) {
                const offset = (layer - 2) * 18;
                const alpha = 0.12 + (5 - layer) * 0.14;
                waveCtx.strokeStyle = `rgba(160, 255, 255, ${alpha})`;
                waveCtx.lineWidth = 1 + (5 - layer) * 1.2;
                waveCtx.beginPath();
                for (let i = 0; i < w; i += 6) {
                    const idx = Math.floor((i / w) * waveData.length);
                    const value = (waveData[idx] - 128) / 128;
                    const wave = Math.sin(i * 0.01 + time * (0.6 + layer * 0.2)) * 18;
                    const y = midY + value * amp + wave + offset * Math.sin(time * 0.5 + layer);
                    if (i === 0) waveCtx.moveTo(i, y);
                    else waveCtx.lineTo(i, y);
                }
                waveCtx.stroke();
            }

            waveRAF = requestAnimationFrame(draw);
        }

        return new Promise(resolve => {
            waveStage.classList.add("active");
            if (waveAudioCtx.state === "suspended") waveAudioCtx.resume();
            draw();
            setTimeout(() => {
                cancelAnimationFrame(waveRAF);
                waveStage.classList.remove("active");
                waveCtx.clearRect(0, 0, w, h);
                resolve();
            }, durationMs);
        });
    }

    // Spacebar logic
    document.addEventListener("keydown", async (e) => {
        if (e.code === "Space" && canPressSpacebar) {
            canPressSpacebar = false; // Prevent multiple triggers
            console.log("Spacebar pressed: take away constraints");
            
            const whyVid = document.getElementById("why-vid");
            
            // Hide intro elements and stop first video if still playing!
            if (introVid1) {
                introVid1.pause();
                introVid1.classList.remove("active");
            }
            introTextSeq.classList.remove("active");
            if (takeChainsBtn) {
                takeChainsBtn.classList.remove("show");
                takeChainsBtn.style.display = "none";
            }

            // Start 'why' video with sound
            whyVid.classList.add("active");
            whyVid.volume = 1.0; 
            
            // Re-load and play to ensure no freeze
            await safePlay(whyVid, { mute: false, label: 'WHY video' });

            // Start Audio Fade In logic (Very slow transition)
            localAudio.volume = 0;
            localAudio.play().catch(e => console.log("Audio play error:", e));
            
            let vol = 0;
            const fadeInterval = setInterval(() => {
                if (vol < 1) {
                    vol += 0.01;
                    localAudio.volume = Math.max(0, Math.min(vol, 1));
                } else {
                    clearInterval(fadeInterval);
                }
            }, 80);

            // Wait for 'why' video to finish or a certain duration before revealing site
            whyVid.addEventListener('ended', async () => {
                const glitchReveal = document.getElementById("glitch-reveal");
                const glitchName = document.getElementById("glitch-name");

                // Show ALICE
                glitchReveal.classList.add("active");
                whyVid.classList.remove("active");

                // After 2 seconds, glitch into INES
                setTimeout(() => {
                    glitchName.innerText = "INES";
                    glitchName.setAttribute("data-text", "INES");
                    
                    // Stay on INES for 2 seconds then fade out to show school video
                    setTimeout(async () => {
                        glitchReveal.classList.remove("active");
                        
                        const schoolVid = document.getElementById("school-vid");
                        // Reset other videos just in case
                        whyVid.classList.remove("active");
                        whyVid.pause();

                        // Ensure school video is ready to play
                        schoolVid.muted = true;
                        schoolVid.playsInline = true;
                        schoolVid.currentTime = 0;
                        schoolVid.style.visibility = "visible";

                        schoolVid.classList.add("active");
                        await safePlay(schoolVid, { mute: true, label: 'SCHOOL video' });

                        // Optional debug overlay (will show briefly)
                        const debugLabel = document.createElement("div");
                        debugLabel.textContent = "SCHOOL VIDEO";
                        debugLabel.style.position = "absolute";
                        debugLabel.style.top = "1rem";
                        debugLabel.style.left = "1rem";
                        debugLabel.style.padding = "0.25rem 0.5rem";
                        debugLabel.style.background = "rgba(0,0,0,0.6)";
                        debugLabel.style.color = "#fff";
                        debugLabel.style.zIndex = "6000";
                        document.body.appendChild(debugLabel);
                        setTimeout(() => debugLabel.remove(), 3000);

                        schoolVid.addEventListener('ended', async () => {
                            const liesReveal = document.getElementById("lies-reveal");
                            const liesText = document.getElementById("lies-text");
                            
                            schoolVid.classList.remove("active");
                            liesReveal.classList.add("active");

                            // Wait 5 seconds on the white text then show craycray video
                            setTimeout(async () => {
                                liesReveal.classList.remove("active");
                                
                                const craycrayVid = document.getElementById("craycray-vid");
                                // Ensure school vid is fully gone
                                schoolVid.classList.remove("active");
                                schoolVid.pause();

                                craycrayVid.classList.add("active");
                                await safePlay(craycrayVid, { mute: true, label: 'CRAYCRAY video' });

                                // Séquence terminée : on s'arrête là après la vidéo
                                craycrayVid.addEventListener('ended', () => {
                                    // Start the Alice Game after craycray ends
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
            console.log("Button clicked: SKIP INTRO");
            // Stop all videos
            const allIntroVids = document.querySelectorAll(".intro-video");
            allIntroVids.forEach(v => {
                v.pause();
                v.classList.remove("active");
            });
            
            // Hide other intro elements
            introTextSeq.classList.remove("active");
            const glitchReveal = document.getElementById("glitch-reveal");
            const liesReveal = document.getElementById("lies-reveal");
            glitchReveal.classList.remove("active");
            liesReveal.classList.remove("active");
            
            // Hide skip button itself
            skipBtn.style.display = "none";

            // Start the game
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
        
        // Background particles effect
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles = [];
        for(let i=0; i<80; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 2,
                speed: 0.5 + Math.random() * 1.5,
                opacity: Math.random() * 0.5
            });
        }

        function drawBackground() {
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.speed;
                if (p.y > canvas.height) p.y = -10;
                ctx.fillStyle = `rgba(100, 200, 255, ${p.opacity})`;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            });
            requestAnimationFrame(drawBackground);
        }
        drawBackground();

        // Riddle Logic
        let mistakes = 0;
        riddleInput.focus();

        riddleInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const val = riddleInput.value.toLowerCase().trim();
                if (val === "alice") {
                    // Correct!
                    riddleInput.style.color = "#0f0";
                    riddleInput.disabled = true;
                    
                    const victoryReveal = document.getElementById("victory-reveal");
                    const riddleUi = document.getElementById("riddle-ui");
                    const stage1 = document.getElementById("final-stage-1");
                    const stage2 = document.getElementById("final-stage-2");
                    const stage3 = document.getElementById("final-stage-3");
                    const btnReplay = document.getElementById("btn-replay");
                    const btnStop = document.getElementById("btn-stop");
                    
                    // Fade out riddle
                    riddleUi.style.opacity = "0";
                    setTimeout(() => {
                        riddleUi.style.display = "none";
                        victoryReveal.classList.add("active");
                        
                        // Stage 1: Bold Revelation (Wait 3s instead of 5s)
                        setTimeout(() => {
                            stage1.classList.remove("active");
                            // Wait briefly before Stage 2
                            setTimeout(() => {
                                stage2.classList.add("active");
                            }, 500); // reduced from 1000
                        }, 3000); // reduced from 5000
                    }, 1000); // reduced from 2000

                    // Handle Choices - Both lead to the same inevitable path
                    const triggerFinalInversion = () => {
                        stage2.classList.remove("active");
                        setTimeout(() => {
                            const stageDots = document.getElementById("final-stage-dots");
                            stageDots.classList.add("active");
                            
                            setTimeout(() => {
                                stageDots.classList.remove("active");
                                setTimeout(() => {
                                    stage3.classList.add("active");
                                    
                                    // NEW: Finale Video and Credits
                                    setTimeout(() => {
                                        stage3.classList.remove("active");
                                        setTimeout(async () => {
                                            // Show waveform animation that reacts to the audio
                                            await startWaveform(5200);

                                            const stageFinale = document.getElementById("final-stage-finale");
                                            const finaleVid = document.getElementById("finale-vid");
                                            const stageCredits = document.getElementById("final-stage-credits");

                                            stageFinale.classList.add("active");

                                            // Handle Audio logic for finale
                                            if (!localAudio.paused && localAudio.volume > 0) {
                                                finaleVid.muted = true;
                                            } else {
                                                finaleVid.muted = false;
                                            }

// Preload and play reliably
                                                await safePlay(finaleVid, { mute: finaleVid.muted, label: 'Finale video' });

                                            function showCredits() {
                                                stageFinale.classList.remove("active");
                                                finaleVid.pause();
                                                setTimeout(() => {
                                                    stageCredits.classList.add("active");
                                                }, 500); // reduced from 1000
                                            }

                                            finaleVid.onended = showCredits;

                                            // Safety: if video is longer than 2 mins or freezes
                                            setTimeout(() => {
                                                if (!stageCredits.classList.contains("active")) {
                                                    showCredits();
                                                }
                                            }, 60000); // 1 minute safety cap

                                        }, 500); // reduced from 1000
                                    }, 4000); // Philosophy stays for 4s instead of 6s

                                }, 500); // reduced from 1000
                            }, 2000); // Wait 2 seconds on the dots instead of 3
                        }, 500); // reduced from 1000
                    };

                    btnReplay.onclick = () => { console.log("Button clicked: we play another guessing"); triggerFinalInversion(); };
                    btnStop.onclick = () => { console.log("Button clicked: we stop"); triggerFinalInversion(); };

                } else {
                    // Wrong!
                    mistakes++;
                    riddleInput.value = "";
                    addTickingMessage();
                    // Shake effect
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
            
            // Randomly flash blue background on mistake
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
            e.target.value = ""; // clear input
        }
    });

    // 1. Custom Cursor & Cinematic Trail Logic
    const cursor = document.querySelector(".cursor");
    const trail = document.createElement("div");
    trail.className = "cursor-trail";
    document.body.appendChild(trail);

    let mouseX = 0, mouseY = 0;
    let trailX = 0, trailY = 0;
    let cursorX = 0, cursorY = 0;

    document.addEventListener("mousemove", (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    // Smooth animation for both cursor and trail
    function animateMouse() {
        // Cursor follows immediately but with a tiny bit of smoothing for 'liquid' feel
        cursorX += (mouseX - cursorX) * 0.8;
        cursorY += (mouseY - cursorY) * 0.8;
        
        // Trail follows much slower
        trailX += (mouseX - trailX) * 0.1;
        trailY += (mouseY - trailY) * 0.1;
        
        cursor.style.left = cursorX + "px";
        cursor.style.top = cursorY + "px";
        trail.style.left = trailX + "px";
        trail.style.top = trailY + "px";
        
        requestAnimationFrame(animateMouse);
    }
    animateMouse();

    // Hover Effects on interactive/large visual elements
    const hoverElements = document.querySelectorAll(".video-wrapper, .glitch, #take-chains-btn");
    hoverElements.forEach(el => {
        el.addEventListener("mouseenter", () => cursor.classList.add("hovered"));
        el.addEventListener("mouseleave", () => cursor.classList.remove("hovered"));
    });

    // 3. Immersion (Fullscreen) Logic
    const immersionBtn = document.getElementById("immersion-btn");
    immersionBtn.addEventListener("click", () => {
        console.log("Button clicked: immersion");
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable full-screen mode: ${err.message}`);
            });
        }
        immersionBtn.classList.add("hidden");
        setTimeout(() => immersionBtn.remove(), 500);
    });

    // 2. Horizontal Scroll Magic
    const scrollWrapper = document.querySelector(".scroll-wrapper");

    // Translate vertical scroll wheel into horizontal scrolling
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

        if (!isUnlocked) {
            return; // Block scroll until unlocked
        }

        // Adjust the multiplier for scroll speed/smoothness
        // The deltaY provides the vertical scroll amount, we apply it horizontally
        scrollWrapper.scrollLeft += evt.deltaY * 2.0; 
    }, { passive: false }); // explicit non-passive to allow preventDefault
});
