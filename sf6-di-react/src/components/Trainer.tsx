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
      video.play();
    }
  }, [sequence]);

  // Timing & input handling
  useEffect(() => {
    let windowStartMs: number;

    const video = videoRef.current;
    if (!video) return;

    let userClicked = false;
    const onTimeUpdate = () => {
      if (
        !windowRef.current.open &&
        sequence.driveImpactTime !== null &&
        video.currentTime >= sequence.driveImpactTime
      ) {
        windowRef.current.open = true;
        setWindowOpen(true);
        windowStartMs = performance.now();
        console.log(
          `→ window open @ videoTime=${video.currentTime.toFixed(
            3
          )}s, ms=${windowStartMs.toFixed(1)}`
        );
        windowRef.current.timer = setTimeout(() => {
          const windowEndMs = performance.now();
          console.log(
            `← window close after ${(windowEndMs - windowStartMs).toFixed(1)}ms`
          );
          windowRef.current.open = false;
          setWindowOpen(false);
          if (!userClicked) handleResult(false, "Missed!");
        }, DRIVE_WINDOW_MS);
      }
    };
    // NEW: when a no‑DI clip finishes, that’s a success if the user never clicked
    const onEnded = () => {
      if (sequence.driveImpactTime === null && !userClicked) {
        // no pause here
        setStats(prev => ({ pass: prev.pass + 1, fail: prev.fail }));
        setOverlay({ text: 'Nice dodge!', success: true });
        setTimeout(() => {
          setOverlay(null);
          setCurrentIdx(i => (i + 1) % sequences.length);
        }, 1000);
      }
    };
    const handleUserInput = () => {
      const clickMs = performance.now();
      const clickTime = video.currentTime;
      console.log(
        `✱ click @ videoTime=${clickTime.toFixed(3)}s, ms=${clickMs.toFixed(
          1
        )} (delta=${(clickMs - windowStartMs).toFixed(1)}ms)`
      );
      userClicked = true;
      if (windowRef.current.timer) clearTimeout(windowRef.current.timer);

      const currentTime = video.currentTime;
      console.log("User clicked at video time", video.currentTime);
      if (currentTime < (sequence.driveImpactTime ?? Infinity)) {
        handleResult(false, "Too soon!");
      } else if (windowRef.current.open) {
        handleResult(true, "Good DI!");
      } else {
        // either too late or false positive
        handleResult(
          false,
          sequence.driveImpactTime === null ? "False positive" : "Too late!"
        );
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    window.addEventListener("click", handleUserInput);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space") handleUserInput();
    });

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("click", handleUserInput);
      window.removeEventListener("keydown", handleUserInput as any);
      if (windowRef.current.timer) clearTimeout(windowRef.current.timer);
      windowRef.current.open = false;
    };
  }, [sequence]);

  function handleResult(success: boolean, message: string) {
    const video = videoRef.current;
    if (video) video.pause();
    setOverlay({ text: message, success });
    setStats((prev) => ({
      pass: prev.pass + (success ? 1 : 0),
      fail: prev.fail + (success ? 0 : 1),
    }));

    setFeedback({ text: message, success });

    // Next clip after feedback
    setTimeout(() => {
      setOverlay(null);
      setFeedback(null);
      windowRef.current.open = false;
      setCurrentIdx((idx) => (idx + 1) % sequences.length);
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
