import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

export default function ProgressStepper({ steps, activeStep, onStepClick, cardSx }) {
  const cols = steps.length * 2 - 1; // odd columns for icons/labels, even for connectors
  const colsTemplate = `repeat(${cols}, minmax(0, 1fr))`;
  return (
  <Paper elevation={3} sx={{ ...cardSx, mb: 2, width: '100%', overflow: 'hidden' }}>
      {/* Icon + connectors grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: colsTemplate,
          alignItems: 'center',
          justifyItems: 'center',
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
                justifySelf: 'stretch',
                height: 0,
                borderTop: '2px solid rgba(255,255,255,0.25)',
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
                aria-label={`Step ${idx + 1}: ${s.label}`}
                title={s.label}
                sx={{
                  width: { xs: 20, sm: 22, md: 24 },
                  height: { xs: 20, sm: 22, md: 24 },
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: { xs: 11, sm: 12 },
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
          display: { xs: 'none', sm: 'grid' },
          gridTemplateColumns: colsTemplate,
          alignItems: 'start',
          justifyItems: 'center',
          mt: { xs: 0, sm: 1 },
          minWidth: 0,
        }}
      >
        {steps.map((s, idx) => (
          <Box key={`label-${s.label}`} sx={{ gridColumn: idx * 2 + 1, justifySelf: 'center', width: '100%', minWidth: 0 }}>
            <Typography
              variant="body2"
              sx={{
                width: '100%',
                textAlign: 'center',
                lineHeight: 1.1,
                fontSize: { xs: '0.70rem', sm: '0.75rem' },
                whiteSpace: 'normal',
                wordBreak: { xs: 'break-word', sm: 'keep-all' },
                overflowWrap: { xs: 'anywhere', sm: 'normal' },
                display: { xs: 'block', sm: '-webkit-box' },
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: { xs: 'unset', sm: 3 }, // no clamp on mobile; clamp to 3 lines on sm+
                overflow: { xs: 'visible', sm: 'hidden' },
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