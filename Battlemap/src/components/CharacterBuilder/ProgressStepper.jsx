import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export default function ProgressStepper({ steps, activeStep, onStepClick, cardSx }) {
  const cols = steps.length * 2 - 1; // odd columns for icons/labels, even for connectors
  return (
  <Paper elevation={3} sx={{ ...cardSx, mb: 2, width: '100%', overflow: 'hidden' }}>
      {/* Icon + connectors grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          alignItems: 'center',
          columnGap: 0.5,
          minWidth: 0,
        }}
      >
        {/* Connectors in even columns */}
        {steps.slice(0, -1).map((_, idx) => (
          <Box
            key={`conn-${idx}`}
            sx={{ gridColumn: (idx + 1) * 2, height: 2, bgcolor: 'rgba(255,255,255,0.25)' }}
          />
        ))}

        {/* Icons in odd columns */}
        {steps.map((s, idx) => {
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;
          return (
            <Box key={`icon-${s.label}`}
              sx={{ gridColumn: idx * 2 + 1, justifySelf: 'center', minWidth: 0 }}
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
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
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
                whiteSpace: 'pre-line', // respect \n from split, don't preserve extra spaces
                textAlign: 'center',
                lineHeight: 1.15,
                wordBreak: 'normal',
                overflowWrap: 'normal',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {s.label.split(' ').join('\n')}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}