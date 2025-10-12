import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export default function ProgressStepper({ steps, activeStep, onStepClick, cardSx }) {
  const cols = steps.length * 2 - 1; // odd columns for icons/labels, even for connectors
  const colsXs = `repeat(${cols}, 1fr)`;
  const colsMd = steps.map((_, i) => (i < steps.length - 1 ? 'minmax(120px,1fr) minmax(28px,0.5fr)' : 'minmax(120px,1fr)')).join(' ');
  return (
  <Paper elevation={3} sx={{ ...cardSx, mb: 2, width: '100%', overflow: 'hidden' }}>
      {/* Icon + connectors grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: colsXs, md: colsMd },
          alignItems: 'center',
          columnGap: 0.5,
          minWidth: 0,
          position: 'relative',
        }}
      >
        {/* Connectors in even columns */}
        {steps.slice(0, -1).map((_, idx) => (
          <Box
            key={`conn-${idx}`}
            sx={{
              gridColumn: (idx + 1) * 2,
              gridRow: 1,
              alignSelf: 'center',
              height: 2,
              bgcolor: 'rgba(255,255,255,0.25)',
              borderRadius: 1,
            }}
          />
        ))}

        {/* Icons in odd columns */}
        {steps.map((s, idx) => {
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;
          return (
            <Box key={`icon-${s.label}`}
              sx={{ gridColumn: idx * 2 + 1, gridRow: 1, justifySelf: 'center', minWidth: 0, zIndex: 1 }}
            >
              <Box
                role="button"
                tabIndex={0}
                onClick={() => onStepClick?.(idx)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStepClick?.(idx); }}
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#fff',
                  bgcolor: isActive ? 'primary.main' : (isCompleted ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)'),
                  border: isActive ? '2px solid rgba(255,255,255,0.6)' : '2px solid rgba(255,255,255,0.2)'
                }}
              >
                {idx + 1}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Labels aligned precisely under icons */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: colsXs, md: colsMd },
          alignItems: 'start',
          mt: 1,
          minWidth: 0,
        }}
      >
        {steps.map((s, idx) => (
          <Box key={`label-${s.label}`} sx={{ gridColumn: idx * 2 + 1, justifySelf: 'center', maxWidth: '100%', minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                width: '100%',
                textAlign: 'center',
                lineHeight: 1.2,
                whiteSpace: 'normal',
                wordBreak: 'keep-all',
                overflowWrap: 'normal',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 3, // allow up to 3 lines before truncation
                overflow: 'hidden',
              }}
            >
              {s.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}