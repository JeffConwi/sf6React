import React, { FC, useState, useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";

// Sample sequences manifest
interface Sequence {
  id: string;
  src: string;
  driveImpactTime: number | null; // seconds
}

const DRIVE_WINDOW_MS = (1000 / 60) * 25; // ~416.67 ms

interface TrainerProps {
  sequences: Sequence[];
}

const Trainer: FC<TrainerProps> = ({ sequences }) => {
  const [overlay, setOverlay] = useState<{
    text: string;
    success: boolean;
  } | null>(null);
  const windowOpenRef = useRef(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputEnabled, setInputEnabled] = useState(true);
  const [stats, setStats] = useState({ pass: 0, fail: 0 });
  const [feedback, setFeedback] = useState<{
    text: string;
    success: boolean;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const windowRef = useRef<{ open: boolean; timer: NodeJS.Timeout | null }>({
    open: false,
    timer: null,
  });

  const sequence = sequences[currentIdx];

  // Restart video on sequence change
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
  
    let listening = true;
    let windowTimer: ReturnType<typeof setTimeout> | null = null;
  
    // 1) FRAME‑LEVEL WATCHER
    const onFrame = (_now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata) => {
      if (!listening) return;
  
      // Only fire for DI clips
      if (
        sequence.driveImpactTime !== null &&
        !windowOpen &&
        meta.mediaTime >= sequence.driveImpactTime
      ) {
        // mark window open
        windowOpenRef.current = true;

        setWindowOpen(true);
  
        const openMs = performance.now();
        console.log(`🔔 DI window OPEN at mediaTime=${meta.mediaTime.toFixed(3)}s (ts=${openMs.toFixed(1)}ms)`);
  
        // schedule auto‑miss
        windowTimer = setTimeout(() => {
          const closeMs = performance.now();
          console.log(`🔒 DI window CLOSED after ${(closeMs - openMs).toFixed(1)}ms`);
          if (!listening) return;
          windowOpenRef.current = false;
          setWindowOpen(false);
          listening = false;
          handleResult(false, 'Missed!');
        }, DRIVE_WINDOW_MS);
      }
  
      if (listening) video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  
    // 2) INPUT HANDLER
    const onClick = () => {
      if (!inputEnabled || !listening) return;
      listening = false;
      if (windowTimer) clearTimeout(windowTimer);
  
      const clickMs = performance.now();
      const clickTime = video.currentTime;
      console.log(`✱ click at mediaTime=${clickTime.toFixed(3)}s (ts=${clickMs.toFixed(1)}ms), windowOpen=${windowOpen}`);
  
      if (sequence.driveImpactTime === null) {
        pauseAndResult(false, 'False positive');
      } else if (clickTime < sequence.driveImpactTime!) {
        pauseAndResult(false, 'Too soon!');
      } else if (windowOpen) {
        pauseAndResult(true, 'Good DI!');
      } else {
        pauseAndResult(false, 'Too late!');
      }
    };
    window.addEventListener('click', onClick);
    window.addEventListener('keydown', e => { if (e.code === 'Space') onClick(); });
  
    // 3) ENDED FALLBACK (unchanged)
    const onEnded = () => {
      if (!listening) return;
      listening = false;
      if (sequence.driveImpactTime === null) {
        console.log('🔔 clip ended with no DI → auto-success');
        handleResult(true, 'Nice block!');
      } else if (!windowOpen) {
        console.log('🔔 clip ended before window opened → auto-miss');
        handleResult(false, 'Missed!');
      }
    };
    video.addEventListener('ended', onEnded);
  
    // 4) play
    video.currentTime = 0;
    video.play()?.catch(() => {});
  
    // CLEANUP
    return () => {
      listening = false;
      if (windowTimer) clearTimeout(windowTimer);
      video.removeEventListener('ended', onEnded);
      window.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onClick as any);
      windowOpenRef.current = false;
      setWindowOpen(false);
    };
  }, [sequence]);
  
  
  
  const pauseAndResult = (success: boolean, msg: string) => {
    const v = videoRef.current;
    if (v) v.pause();
    handleResult(success, msg);
  };
  // Timing & input handling
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
  
    // reset state for this clip
    windowOpenRef.current = false;
    setWindowOpen(false);
    let clicked = false;
  
    // timers we’ll clear on cleanup
    let openTimer: ReturnType<typeof setTimeout> | null   = null;
    let closeTimer: ReturnType<typeof setTimeout> | null  = null;
    let endTimer: ReturnType<typeof setTimeout> | null    = null;
  
    // 1) When metadata is loaded, schedule everything
    const onLoaded = () => {
      // Only schedule a reaction window for clips with a driveImpactTime
      if (sequence.driveImpactTime !== null) {
        const openMs  = sequence.driveImpactTime * 1000;
        const closeMs = openMs + DRIVE_WINDOW_MS;
  
        // open the visual cue
        openTimer = setTimeout(() => {
          windowOpenRef.current = true;

          setWindowOpen(true);
        }, openMs);
  
        // close it & auto‑miss if no click
        closeTimer = setTimeout(() => {
          windowOpenRef.current = false;
          setWindowOpen(false);

          if (!clicked) handleResult(false, 'Missed!');
        }, closeMs);
      }
  
      // ALWAYS schedule the end‑of‑clip fallback
      //   • if no DI → auto‑success (dodge)
      //   • if DI but it never got to open → auto‑miss
      const fudge = 100; // small extra to ensure ended
      endTimer = setTimeout(() => {
        if (clicked) return;
        if (sequence.driveImpactTime === null) {
          handleResult(true, 'Nice dodge!');
        } else {
          handleResult(false, 'Missed!');
        }
      }, (video.duration * 1000) + fudge);
    };
  
    video.addEventListener('loadedmetadata', onLoaded);
  
    // 2) Click/space handler — clear all timers, then score
    const handleClick = () => {
      if (!inputEnabled) return;
  
      clicked = true;
      [openTimer, closeTimer, endTimer].forEach(t => t && clearTimeout(t));
  
      const now = video.currentTime;
      if (sequence.driveImpactTime === null) {
        pauseAndResult(false, 'DI not Active!');
      } else if (now < sequence.driveImpactTime) {
        pauseAndResult(false, 'Too soon!');
      } else if (windowOpenRef.current) {
        pauseAndResult(true, 'Good DI!');
      } else {
        pauseAndResult(false, 'Too late!');
      }
    };
  
    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') handleClick();
    });
  
    // (Optional) ensure video actually starts
    video.currentTime = 0;
    video.play()?.catch(() => { /* swallow interrupted errors */ });
  
    // CLEANUP on sequence change
    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleClick as any);
      [openTimer, closeTimer, endTimer].forEach(t => t && clearTimeout(t));
      windowOpenRef.current = false;
      setWindowOpen(false);

    };
  }, [sequence]);
  
  
  

  function handleResult(success: boolean, message: string) {
    console.log("▶ handleResult called:", success, message);
    // 1) lock out any more clicks until we reset
    setInputEnabled(false);
    // 2) pause, overlay, stats…
    const video = videoRef.current!;
    video.pause();
    setOverlay({ text: message, success });
    setStats((prev) => ({
      pass: prev.pass + (success ? 1 : 0),
      fail: prev.fail + (success ? 0 : 1),
    }));

    setFeedback({ text: message, success });

     // 3) after 1s, clear & advance, and re‑enable input
    setTimeout(() => {
      setOverlay(null);
      windowRef.current.open = false;
      console.log("⏭ advancing to next clip");
      setCurrentIdx(() => {
        let next = Math.floor(Math.random() * sequences.length);
        // avoid immediate repeat:
        if (next === currentIdx && sequences.length > 1) {
          next = (next + 1) % sequences.length;
        }
        return next;
      });      setInputEnabled(true);   
    }, 1000);
  }

  const total = stats.pass + stats.fail;
  const pct = (count: number) =>
    total > 0 ? ((count / total) * 100).toFixed(1) : "0.0";

  return (
    <Box sx={{ textAlign: "center", p: 2 }}>
      <Box sx={{ position: "relative", display: "inline-block" }}>
        <video
          ref={videoRef}
          src={sequence.src}
          autoPlay
          muted
          width={640}
          style={{ border: "1px solid #444", borderRadius: 8 }}
        />
        {windowOpen && (
          <Box
            sx={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              width: "120px",
              height: "6px",
              bgcolor: "rgba(0, 255, 0, 0.6)",
              borderRadius: "3px",
              transition: "opacity 0.2s ease",
              opacity: 1,
            }}
          />
        )}
        {overlay && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <Typography
              variant="h3"
              sx={{
                color: overlay.success ? "lime" : "tomato",
                p: 2,
                bgcolor: "rgba(0,0,0,0.8)",
                borderRadius: 2,
              }}
            >
              {overlay.text}
            </Typography>
          </Box>
        )}
      </Box>

      {feedback && (
        <Typography
          variant="h4"
          sx={{ color: feedback.success ? "green" : "red", mt: 2 }}
        >
          {feedback.text}
        </Typography>
      )}

      <Box sx={{ mt: 2, display: "flex", justifyContent: "center", gap: 4 }}>
        <Typography>Total: {total}</Typography>
        <Typography sx={{ color: "green" }}>
          Pass: {stats.pass} ({pct(stats.pass)}%)
        </Typography>
        <Typography sx={{ color: "red" }}>
          Fail: {stats.fail} ({pct(stats.fail)}%)
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ mt: 1 }}>
        Click or press [Space] only when you see a Drive Impact.
      </Typography>
    </Box>
  );
};

export default Trainer;
