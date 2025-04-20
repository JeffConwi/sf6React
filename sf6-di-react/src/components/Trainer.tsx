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
    if (video) {
      video.currentTime = 0;
      video.play()?.catch(() => {
        // ignore the “interrupted by pause” error
      });
    }
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

    let opened = false;
    let windowTimer: ReturnType<typeof setTimeout> | null = null;
    let userClicked = false;

    // 1) Frame‐level watcher
    const onFrame = (
      _now: DOMHighResTimeStamp,
      meta: VideoFrameCallbackMetadata
    ) => {
      const t = meta.mediaTime;
      if (
        !opened &&
        sequence.driveImpactTime !== null &&
        t >= sequence.driveImpactTime
      ) {
        opened = true;
        setWindowOpen(true);

        // schedule “Missed!” if they never click
        windowTimer = setTimeout(() => {
          setWindowOpen(false);
          if (!userClicked) handleResult(false, "Missed!");
        }, DRIVE_WINDOW_MS);
      }
      // re‑arm for the next rendered frame
      video.requestVideoFrameCallback(onFrame);
    };

    // kick off the frame loop
    video.requestVideoFrameCallback(onFrame);

    // 2) Your existing click/space handler (unchanged)
    const handleUserInput = () => {
      if (!inputEnabled) return;    // do nothing if we’re locked out
      userClicked = true;
      if (windowTimer) clearTimeout(windowTimer);
      if (windowTimer) clearTimeout(windowTimer);

      const currentTime = video.currentTime;
      if (currentTime < (sequence.driveImpactTime ?? Infinity)) {
        pauseAndResult(false, "DI wasn't active!");
      } else if (opened) {
        pauseAndResult(true, "Good DI!");
      } else {
        pauseAndResult(
          false,
          sequence.driveImpactTime === null ? "False positive" : "Too late!"
        );
      }
    };

    // 3) End‐of‐video fallback (unchanged)
    const onEnded = () => {
      if (userClicked) return;
      if (sequence.driveImpactTime === null) {
        handleResult(true, "Good Block!");
      } else {
        handleResult(false, "Missed!");
      }
    };

    video.addEventListener("ended", onEnded);
    window.addEventListener("click", handleUserInput);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") handleUserInput();
    });

    return () => {
      // cleanup timer + listeners
      if (windowTimer) clearTimeout(windowTimer);
      video.removeEventListener("ended", onEnded);
      windowRef.current.open = false;
      setWindowOpen(false);
      window.removeEventListener("click", handleUserInput);
      window.removeEventListener("keydown", handleUserInput as any);
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
      setCurrentIdx((idx) => (idx + 1) % sequences.length);
      setInputEnabled(true);   
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
