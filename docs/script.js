document.addEventListener("DOMContentLoaded", () => {
    // 0. Intro Cinematic Sequence & Audio Unlock
    const introCinematic = document.getElementById("intro-cinematic");
    const introVid1 = document.getElementById("intro-vid-1");
    const introTextSeq = document.getElementById("intro-text-seq");
    const localAudio = document.getElementById("local-audio");

    if (introVid1) {
        introVid1.addEventListener("ended", () => {
            introTextSeq.classList.add("active");
        });
    }

    let canPressSpacebar = true;

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
                await promise.catch(err => console.warn(`safePlay ${label} rejected`, err));
            }
            if (!mute) {
                setTimeout(() => { try { video.muted = false; } catch (e) {} }, 300);
            }
        } catch (err) {
            console.warn(`safePlay ${label} error`, err);
        } finally {
            setTimeout(hideLoading, 250);
        }
    }

    // === Inline Perlin Noise ===
    const ImprovedNoise = (function() {
        const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,
        23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,
        125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,
        105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,
        135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,
        82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,
        153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,
        251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,
        106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,
        78,66,215,61,156,180];
        const perm = new Array(512);
        for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
        function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
        function lerp(t, a, b) { return a + t * (b - a); }
        function grad(hash, x, y, z) {
            const h = hash & 15;
            const u = h < 8 ? x : y;
            const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
            return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
        }
        return {
            noise: function(x, y, z) {
                const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
                x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
                const u = fade(x), v = fade(y), w = fade(z);
                const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
                const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
                return lerp(w, lerp(v, lerp(u, grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z)),
                    lerp(u, grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z))),
                    lerp(v, lerp(u, grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1)),
                    lerp(u, grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1))));
            }
        };
    })();

    // === TERRAIN (frequency stage) ===
    const waveStage = document.getElementById("final-stage-wave");
    const terrainContainer = document.getElementById("terrain-three-container");

    function startWaveform(durationMs = 15000) {
        return new Promise(resolve => {
            waveStage.classList.add("active");

            const worldWidth = 128, worldDepth = 128;
            let tCamera, tScene, tRenderer, tAnimId;
            let tMouseX = 0, tMouseY = 0;
            const halfW = window.innerWidth / 2;
            const halfH = window.innerHeight / 2;

            function onTerrainPointerMove(event) {
                if (event.isPrimary === false) return;
                tMouseX = event.clientX - halfW;
                tMouseY = event.clientY - halfH;
            }
            terrainContainer.style.touchAction = 'none';
            terrainContainer.addEventListener('pointermove', onTerrainPointerMove);

            const w = terrainContainer.clientWidth || window.innerWidth;
            const h = terrainContainer.clientHeight || window.innerHeight;

            tCamera = new THREE.PerspectiveCamera(60, w / h, 1, 10000);
            tCamera.position.set(100, 800, -800);
            tCamera.lookAt(-100, 810, -800);

            tScene = new THREE.Scene();
            tScene.background = new THREE.Color(0x0a1a2e);
            tScene.fog = new THREE.FogExp2(0x0a1a2e, 0.0025);

            // Generate heightmap with Perlin noise
            const size = worldWidth * worldDepth;
            const heightData = new Uint8Array(size);
            const zSeed = Math.random() * 100;
            let quality = 1;
            for (let j = 0; j < 4; j++) {
                for (let i = 0; i < size; i++) {
                    const x = i % worldWidth, y = ~~(i / worldWidth);
                    heightData[i] += Math.abs(ImprovedNoise.noise(x / quality, y / quality, zSeed) * quality * 1.75);
                }
                quality *= 5;
            }

            // Create terrain mesh
            const geometry = new THREE.PlaneGeometry(7500, 7500, worldWidth - 1, worldDepth - 1);
            geometry.rotateX(-Math.PI / 2);
            const vertices = geometry.attributes.position.array;
            for (let i = 0; i < size; i++) {
                vertices[i * 3 + 1] = heightData[i] * 10;
            }

            // Generate blue/green texture via canvas
            const texCanvas = document.createElement('canvas');
            texCanvas.width = worldWidth;
            texCanvas.height = worldDepth;
            const texCtx = texCanvas.getContext('2d');
            texCtx.fillStyle = '#000';
            texCtx.fillRect(0, 0, worldWidth, worldDepth);
            const imgData = texCtx.getImageData(0, 0, worldWidth, worldDepth);
            const pixels = imgData.data;
            const sun = new THREE.Vector3(1, 1, 1).normalize();
            const v3 = new THREE.Vector3();

            for (let i = 0, j2 = 0; i < pixels.length; i += 4, j2++) {
                v3.x = (heightData[j2 - 2] || 0) - (heightData[j2 + 2] || 0);
                v3.y = 2;
                v3.z = (heightData[j2 - worldWidth * 2] || 0) - (heightData[j2 + worldWidth * 2] || 0);
                v3.normalize();
                const shade = v3.dot(sun);
                const hFactor = 0.5 + heightData[j2] * 0.007;
                pixels[i]     = (shade * 40) * hFactor;
                pixels[i + 1] = (50 + shade * 100) * hFactor;
                pixels[i + 2] = (80 + shade * 140) * hFactor;
            }
            texCtx.putImageData(imgData, 0, 0);

            const scaledCanvas = document.createElement('canvas');
            scaledCanvas.width = worldWidth * 4;
            scaledCanvas.height = worldDepth * 4;
            const sCtx = scaledCanvas.getContext('2d');
            sCtx.scale(4, 4);
            sCtx.drawImage(texCanvas, 0, 0);

            const texture = new THREE.CanvasTexture(scaledCanvas);
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;

            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
            tScene.add(mesh);

            tRenderer = new THREE.WebGLRenderer({ antialias: false });
            tRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            tRenderer.setSize(w, h);
            terrainContainer.appendChild(tRenderer.domElement);

            function terrainAnimate() {
                tAnimId = requestAnimationFrame(terrainAnimate);
                tCamera.position.x += (tMouseX * 0.5 - tCamera.position.x) * 0.02;
                tCamera.position.y += (-tMouseY * 0.3 + 600 - tCamera.position.y) * 0.02;
                tCamera.lookAt(tScene.position);
                tRenderer.render(tScene, tCamera);
            }
            terrainAnimate();

            setTimeout(() => {
                if (tAnimId) cancelAnimationFrame(tAnimId);
                terrainContainer.removeEventListener('pointermove', onTerrainPointerMove);
                tRenderer.dispose();
                geometry.dispose();
                texture.dispose();
                if (tRenderer.domElement && tRenderer.domElement.parentNode) {
                    tRenderer.domElement.parentNode.removeChild(tRenderer.domElement);
                }
                waveStage.classList.remove("active");
                resolve();
            }, durationMs);
        });
    }

    // === CREDITS WAVES BACKGROUND (boules) ===
    const creditsBgContainer = document.getElementById("credits-waves-bg");

    function startCreditsWaves() {
        const SEPARATION = 100, AMOUNTX = 50, AMOUNTY = 50;
        let cwCamera, cwScene, cwRenderer, cwCount = 0;
        let cwAnimId = null;
        let cwMouseX = 0, cwMouseY = 0;
        const halfW2 = window.innerWidth / 2;
        const halfH2 = window.innerHeight / 2;

        function onCwPointerMove(event) {
            if (event.isPrimary === false) return;
            cwMouseX = event.clientX - halfW2;
            cwMouseY = event.clientY - halfH2;
        }
        creditsBgContainer.addEventListener('pointermove', onCwPointerMove);

        const w = creditsBgContainer.clientWidth || window.innerWidth;
        const h = creditsBgContainer.clientHeight || window.innerHeight;

        cwCamera = new THREE.PerspectiveCamera(75, w / h, 1, 10000);
        cwCamera.position.z = 1000;

        cwScene = new THREE.Scene();

        const numParticles = AMOUNTX * AMOUNTY;
        const positions = new Float32Array(numParticles * 3);
        const colors = new Float32Array(numParticles * 3);

        let idx = 0;
        for (let ix = 0; ix < AMOUNTX; ix++) {
            for (let iy = 0; iy < AMOUNTY; iy++) {
                positions[idx] = ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2);
                positions[idx + 1] = 0;
                positions[idx + 2] = iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2);
                colors[idx] = 0.0;
                colors[idx + 1] = 0.4;
                colors[idx + 2] = 1.0;
                idx += 3;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 6,
            vertexColors: true,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true
        });

        const cwParticles = new THREE.Points(geometry, material);
        cwScene.add(cwParticles);

        cwRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
        cwRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        cwRenderer.setSize(w, h);
        cwRenderer.setClearColor(0x000000, 0);
        creditsBgContainer.appendChild(cwRenderer.domElement);

        function cwAnimate() {
            cwAnimId = requestAnimationFrame(cwAnimate);

            cwCamera.position.x += (cwMouseX - cwCamera.position.x) * 0.05;
            cwCamera.position.y += (-cwMouseY - cwCamera.position.y) * 0.05;
            cwCamera.lookAt(cwScene.position);

            const posArr = geometry.attributes.position.array;
            const colArr = geometry.attributes.color.array;

            let i = 0, ci = 0;
            for (let ix = 0; ix < AMOUNTX; ix++) {
                for (let iy = 0; iy < AMOUNTY; iy++) {
                    const y = (Math.sin((ix + cwCount) * 0.3) * 50) +
                              (Math.sin((iy + cwCount) * 0.5) * 50);
                    posArr[i + 1] = y;

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
            cwCount += 0.1;

            cwRenderer.render(cwScene, cwCamera);
        }
        cwAnimate();
    }

    // === Spacebar logic ===
    document.addEventListener("keydown", async (e) => {
        if (e.code === "Space" && canPressSpacebar) {
            canPressSpacebar = false;

            const whyVid = document.getElementById("why-vid");

            if (introVid1) {
                introVid1.pause();
                introVid1.classList.remove("active");
            }
            introTextSeq.classList.remove("active");

            loadVideoSrc(whyVid, "media/why.mp4");
            whyVid.classList.add("active");
            whyVid.volume = 1.0;
            await safePlay(whyVid, { mute: false, label: 'WHY video' });

            localAudio.volume = 0;
            localAudio.play().catch(e => console.log("Audio play error:", e));

            let vol = 0;
            const fadeInterval = setInterval(() => {
                if (vol < 1) {
                    vol += 0.02;
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

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        let particles = [];
        for (let i = 0; i < 30; i++) {
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

        let mistakes = 0;
        riddleInput.focus();

        riddleInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const val = riddleInput.value.toLowerCase().trim();
                if (val === "alice") {
                    riddleInput.style.color = "#0f0";
                    riddleInput.disabled = true;
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
                                            await startWaveform(15000);

                                            const stageFinale = document.getElementById("final-stage-finale");
                                            const finaleVid = document.getElementById("finale-vid");
                                            const stageCredits = document.getElementById("final-stage-credits");

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
                                                    // Start the boules waves behind credits
                                                    startCreditsWaves();
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
