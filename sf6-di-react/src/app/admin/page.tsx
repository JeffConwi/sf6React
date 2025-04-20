'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Slider,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
  Container
} from '@mui/material';

export interface Sequence {
  id: string;
  src: string;
  driveImpactTime: number | null; // seconds
}

export default function AdminPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Fetch static manifest
  useEffect(() => {
    fetch('/sequences.json')
      .then((res) => res.json())
      .then((data: Sequence[]) => {
        setSequences(data);
        if (data.length > 0) setSelectedId(data[0].id);
      });
  }, []);

  const current = sequences.find((seq) => seq.id === selectedId) || null;

  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    setSequences((prev) =>
      prev.map((seq) =>
        seq.id === selectedId ? { ...seq, driveImpactTime: (newValue as number) / 1000 } : seq
      )
    );
  };

  const handleMark = () => {
    if (videoRef.current && current) {
      const time = videoRef.current.currentTime;
      setSequences((prev) =>
        prev.map((seq) => (seq.id === selectedId ? { ...seq, driveImpactTime: time } : seq))
      );
    }
  };

  const handleSave = () => {
    fetch('/api/sequences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sequences),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Save failed');
        return res.json();
      })
      .then(() => alert('Sequences saved successfully!'))
      .catch((err) => alert(err.message));
  };

  return (
    <Box sx={{ bgcolor: 'background.default', color: 'text.primary', minHeight: '100vh', py: 4 }}>
      <Container maxWidth="md">
        <Paper sx={{ p: 4, bgcolor: 'background.paper' }} elevation={3}>
          <Typography variant="h4" gutterBottom>
            Drive Impact Sequence Editor
          </Typography>

          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="seq-select-label">Select Clip</InputLabel>
            <Select
              labelId="seq-select-label"
              value={selectedId}
              label="Select Clip"
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {sequences.map((seq) => (
                <MenuItem key={seq.id} value={seq.id}>
                  {seq.id}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {current && (
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <video
                ref={videoRef}
                src={current.src}
                controls
                width={640}
                style={{ borderRadius: 8, backgroundColor: '#000' }}
              />

              <Box sx={{ mt: 2 }}>
                <Typography gutterBottom>
                  Drive Impact Time: {(current.driveImpactTime ?? 0).toFixed(3)}s
                </Typography>
                <Slider
                  value={(current.driveImpactTime ?? 0) * 1000}
                  onChange={handleSliderChange}
                  min={0}
                  max={(videoRef.current?.duration ?? 10) * 1000}
                  step={1000 / 60}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${(v / 1000).toFixed(3)}s`}
                />

                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Button variant="contained" onClick={handleMark}>
                    Mark Current Frame
                  </Button>
                  <Button variant="contained" color="success" onClick={handleSave}>
                    Save Sequences
                  </Button>
                </Box>
              </Box>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
}