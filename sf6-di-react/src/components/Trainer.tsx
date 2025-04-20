import React, { FC, useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Box, Typography } from '@mui/material';

// Sample sequences manifest
interface Sequence {
  id: string;
  src: string;
  driveImpactTime: number | null; // seconds
}

const sequences: Sequence[] = [
  { id: 'ryu-dp',  src: '/videos/ryu-dp.mp4',  driveImpactTime: 3.75 },
  { id: 'ken-hp',  src: '/videos/ken-hp.mp4',  driveImpactTime: null  },
  { id: 'chun-li', src: '/videos/chun-li.mp4', driveImpactTime: 2.1  },
  // add more clips here
];

const DRIVE_WINDOW_MS = 1000 / 60 * 25; // ~416.67 ms

interface TrainerProps {
    sequences: Sequence[];
  }
  
  const Trainer: FC<TrainerProps> = ({ sequences }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stats, setStats] = useState({ pass: 0, fail: 0 });
  const [feedback, setFeedback] = useState<{ text: string; success: boolean } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const windowRef = useRef<{ open: boolean; timer: NodeJS.Timeout | null }>({ open: false, timer: null });

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
    const video = videoRef.current;
    if (!video) return;

    let userClicked = false;
    const onTimeUpdate = () => {
      if (!windowRef.current.open
          && sequence.driveImpactTime !== null
          && video.currentTime >= sequence.driveImpactTime)
      {
        windowRef.current.open = true;
        windowRef.current.timer = setTimeout(() => {
          windowRef.current.open = false;
          if (!userClicked) handleResult(false, 'Missed!');
        }, DRIVE_WINDOW_MS);
      }
    };

    const handleUserInput = () => {
      userClicked = true;
      if (windowRef.current.timer) clearTimeout(windowRef.current.timer);

      const currentTime = video.currentTime;
      if (currentTime < (sequence.driveImpactTime ?? Infinity)) {
        handleResult(false, 'Too soon!');
      } else if (windowRef.current.open) {
        handleResult(true, 'Good DI!');
      } else {
        // either too late or false positive
        handleResult(false, sequence.driveImpactTime === null ? 'False positive' : 'Too late!');
      }
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    window.addEventListener('click', handleUserInput);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') handleUserInput();
    });

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      window.removeEventListener('click', handleUserInput);
      window.removeEventListener('keydown', handleUserInput as any);
      if (windowRef.current.timer) clearTimeout(windowRef.current.timer);
      windowRef.current.open = false;
    };
  }, [sequence]);

  function handleResult(success: boolean, message: string) {
    setStats(prev => ({
      pass: prev.pass + (success ? 1 : 0),
      fail: prev.fail + (success ? 0 : 1),
    }));

    setFeedback({ text: message, success });

    // Next clip after feedback
    setTimeout(() => {
      setFeedback(null);
      windowRef.current.open = false;
      setCurrentIdx(idx => (idx + 1) % sequences.length);
    }, 1000);
  }

  const total = stats.pass + stats.fail;
  const pct = (count: number) => total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

  return (
    <Box sx={{ textAlign: 'center', p: 2 }}>
      <video
        ref={videoRef}
        src={sequence.src}
        autoPlay
        muted
        width={640}
        style={{ border: '1px solid #444', borderRadius: 8 }}
      />

      {feedback && (
        <Typography variant="h4" sx={{ color: feedback.success ? 'green' : 'red', mt: 2 }}>
          {feedback.text}
        </Typography>
      )}

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 4 }}>
        <Typography>Total: {total}</Typography>
        <Typography sx={{ color: 'green' }}>Pass: {stats.pass} ({pct(stats.pass)}%)</Typography>
        <Typography sx={{ color: 'red' }}>Fail: {stats.fail} ({pct(stats.fail)}%)</Typography>
      </Box>

      <Typography variant="body2" sx={{ mt: 1 }}>
        Click or press [Space] only when you see a Drive Impact.
      </Typography>
    </Box>
  );
}

export default Trainer;