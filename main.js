/* ============================================================
   ALBA · WebAR — main.js
   ------------------------------------------------------------
   Architecture rules (NON-NEGOTIABLE):
   1. The <a-scene> is mounted ONCE at page load and never removed.
   2. MindAR is started ONCE on the user's first tap (iOS gesture).
   3. After start, the camera feed stays visible for the whole session.
      UI states are HTML overlays sitting on top — never route changes.
   4. The AR video lives inside the scene as <a-video>, anchored to
      the marker. It is never shown fullscreen.
   ============================================================ */

(() => {
  "use strict";

  // ----- DOM handles --------------------------------------------------------
  const sceneEl       = document.querySelector("#ar-scene");
  const targetEl      = document.querySelector("#ar-target");
  const videoEl       = document.querySelector("#ar-video");

  const introEl       = document.querySelector("#intro-screen");
  const startBtn      = document.querySelector("#start-btn");

  const pillEl        = document.querySelector("#detected-pill");
  const tapHintEl     = document.querySelector("#tap-hint");

  const cardsEl       = document.querySelector("#cards-screen");
  const cardsContinue = document.querySelector("#cards-continue-btn");

  const endEl         = document.querySelector("#end-screen");
  const replayBtn     = document.querySelector("#replay-btn");

  const errorEl       = document.querySelector("#error-screen");
  const errorRetryBtn = document.querySelector("#error-retry-btn");

  // ----- Simple flags (no state machine) -----------------------------------
  let arStarted     = false;  // MindAR.start() has been called
  let videoUnlocked = false;  // iOS unlock dance has run
  let videoPlaying  = false;  // we asked to play and didn't get rejected
  let targetVisible = false;  // marker currently in frame
  let cardsShown    = false;  // cards have been shown at least once
  let playInFlight  = false;  // guards against concurrent play() calls

  // ----- Overlay helpers ---------------------------------------------------
  const show = (el) => {
    el.classList.add("is-visible");
    el.setAttribute("aria-hidden", "false");
  };
  const hide = (el) => {
    el.classList.remove("is-visible");
    el.setAttribute("aria-hidden", "true");
  };

  // ============================================================
  //                 iOS VIDEO UNLOCK STRATEGY
  // On first user gesture: call play() and immediately pause + reset.
  // This grants the video element permission to be played programmatically
  // later when the marker is found.
  // ============================================================
  function unlockVideo() {
    if (videoUnlocked) return;

    // Defensive: belt-and-braces on the attributes iOS Safari checks.
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute("playsinline", "");
    videoEl.setAttribute("webkit-playsinline", "");

    const p = videoEl.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        videoEl.pause();
        videoEl.currentTime = 0;
        videoUnlocked = true;
        console.log("VIDEO: unlocked");
      }).catch((err) => {
        // Even on rejection, the gesture often still satisfies iOS for the
        // next call. We treat it as unlocked optimistically.
        videoUnlocked = true;
        console.log("VIDEO: unlock attempt rejected, continuing:", err && err.message);
      });
    } else {
      // Older browsers — synchronous return
      videoEl.pause();
      videoEl.currentTime = 0;
      videoUnlocked = true;
      console.log("VIDEO: unlocked (sync)");
    }
  }

  // ============================================================
  //                       VIDEO PLAYBACK
  // ============================================================
  function playArVideo() {
    if (playInFlight) return;
    if (videoPlaying && !videoEl.paused) return;

    playInFlight = true;
    try { videoEl.currentTime = 0; } catch (_) { /* iOS pre-metadata edge case */ }

    const attempt = () => {
      const p = videoEl.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          videoPlaying = true;
          playInFlight = false;
          hide(tapHintEl);
          console.log("VIDEO: play success");
        }).catch((err) => {
          playInFlight = false;
          console.log("VIDEO: play failed:", err && err.message);
          // Single retry after 300ms — required by spec
          setTimeout(() => {
            if (!videoPlaying && !playInFlight) {
              console.log("VIDEO: retry triggered");
              playInFlight = true;
              const r = videoEl.play();
              if (r && typeof r.then === "function") {
                r.then(() => {
                  videoPlaying = true;
                  playInFlight = false;
                  hide(tapHintEl);
                  console.log("VIDEO: play success (retry)");
                }).catch((err2) => {
                  playInFlight = false;
                  console.log("VIDEO: retry failed:", err2 && err2.message);
                });
              }
            }
          }, 300);
        });
      } else {
        videoPlaying = true;
        playInFlight = false;
        hide(tapHintEl);
        console.log("VIDEO: play success (sync)");
      }
    };

    attempt();
  }

  function pauseArVideo() {
    if (!videoEl.paused) {
      videoEl.pause();
      console.log("VIDEO: paused");
    }
    videoPlaying = false;
  }

  // ============================================================
  //                  MINDAR LIFECYCLE
  // ============================================================
  async function startAR() {
    if (arStarted) return;
    arStarted = true;

    // 1. Hide the intro overlay immediately — the camera is about to appear.
    hide(introEl);

    // 2. Unlock video on this gesture (the only first-tap we get reliably).
    unlockVideo();

    // 3. Start MindAR. This requests the camera and begins the live feed.
    const arSystem = sceneEl.systems["mindar-image-system"];
    if (!arSystem) {
      console.error("AR: mindar-image-system not found");
      onArError();
      return;
    }

    try {
      console.log("AR: initialized");
      await arSystem.start();   // camera turns on here
      console.log("AR: started");
    } catch (err) {
      console.error("AR: start failed:", err);
      onArError();
    }
  }

  function onArError() {
    arStarted = false;
    show(errorEl);
  }

  // ============================================================
  //                  TARGET EVENTS
  // ============================================================
  targetEl.addEventListener("targetFound", () => {
    targetVisible = true;
    console.log("AR: target found");
    show(pillEl);
    // Show tap hint only if the user hasn't yet played the video this session
    if (!videoPlaying && !cardsShown) {
      show(tapHintEl);
    }
  });

  targetEl.addEventListener("targetLost", () => {
    targetVisible = false;
    console.log("AR: target lost");
    hide(pillEl);
    hide(tapHintEl);
    // Pause video to save battery — camera and scene stay alive.
    pauseArVideo();
  });

  // ============================================================
  //                  TAP-TO-PLAY (inside scene)
  // ============================================================
  // We listen on the scene canvas itself rather than the body, so that
  // taps on UI buttons don't accidentally trigger AR playback.
  sceneEl.addEventListener("click", () => {
    // Ensure unlock happened (defensive — startBtn should have done this).
    if (!videoUnlocked) unlockVideo();

    // Only react to taps when the marker is currently visible and we
    // haven't already moved past the AR moment.
    if (targetVisible && !cardsShown) {
      playArVideo();
    }
  });

  // ============================================================
  //                  VIDEO END → CARDS
  // ============================================================
  videoEl.addEventListener("ended", () => {
    console.log("VIDEO: ended");
    videoPlaying = false;
    showCards();
  });

  function showCards() {
    if (cardsShown) return;
    cardsShown = true;
    // Hide AR-moment UI but leave the scene running underneath.
    hide(tapHintEl);
    hide(pillEl);
    show(cardsEl);
  }

  // Also allow the user to manually advance from the video to the cards
  // (in case they want to skip). A long-press on the scene is too fiddly;
  // we let the video naturally end OR they can tap "continue" on cards later.
  // For a manual skip path: double-tap on the scene during playback.
  let lastTap = 0;
  sceneEl.addEventListener("click", () => {
    const now = Date.now();
    if (videoPlaying && now - lastTap < 320) {
      showCards();
    }
    lastTap = now;
  });

  // ============================================================
  //                  CARDS → END
  // ============================================================
  cardsContinue.addEventListener("click", () => {
    hide(cardsEl);
    show(endEl);
  });

  // ============================================================
  //                  REPLAY (from end screen)
  // Goes back to the AR moment WITHOUT remounting the scene.
  // ============================================================
  replayBtn.addEventListener("click", () => {
    hide(endEl);
    cardsShown = false;
    videoPlaying = false;
    try { videoEl.currentTime = 0; } catch (_) {}
    // If the marker is still in view, show the tap hint again.
    if (targetVisible) {
      show(pillEl);
      show(tapHintEl);
    }
  });

  // ============================================================
  //                  ERROR RETRY
  // ============================================================
  errorRetryBtn.addEventListener("click", () => {
    hide(errorEl);
    show(introEl);
    arStarted = false;
  });

  // ============================================================
  //                  START BUTTON (entry point)
  // ============================================================
  startBtn.addEventListener("click", startAR, { once: false });

  // ============================================================
  //                  PAGE VISIBILITY
  // When the user backgrounds the tab, pause the video. We do NOT
  // stop MindAR — restarting would re-trigger the camera permission
  // flow on iOS and break the "camera always visible" rule. Pausing
  // the video and letting MindAR auto-pause its render loop is enough.
  // ============================================================
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseArVideo();
    }
  });

  // ============================================================
  //                  iOS SAFARI: prevent gesture scroll
  // ============================================================
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("touchmove", (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // ----- Boot log ----------------------------------------------------------
  console.log("ALBA WebAR ready — waiting for user gesture");
})();
