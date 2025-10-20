import React from 'react';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  useMediaQuery,
  useTheme,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// Simple in-memory cache for monster details to avoid refetching
const detailsCache = new Map(); // key: index, value: detail object
const CACHE_STORAGE_KEY = 'monsterDetailsCache.v1';
const CR_INDEX_CACHE = new Map(); // key: 'cr:3' etc, value: array of results

function scheduleIdle(cb) {
  const ric = typeof window !== 'undefined' && (window.requestIdleCallback || null);
  if (ric) return window.requestIdleCallback(cb);
  return setTimeout(cb, 0);
}

function getConnectionHints() {
  try {
    const c = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
    return {
      saveData: Boolean(c?.saveData),
      effectiveType: c?.effectiveType || 'unknown',
    };
  } catch (_) {
    return { saveData: false, effectiveType: 'unknown' };
  }
}

function prefetchImagesFor(rows, detailsLookup, { concurrency = 4 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const { saveData, effectiveType } = getConnectionHints();
  if (saveData || (typeof effectiveType === 'string' && /(^|\b)(2g|slow-2g)\b/i.test(effectiveType))) {
    // Avoid image prefetch on very slow networks or when data saver is on
    return;
  }
  scheduleIdle(() => {
    let i = 0;
    function nextBatch() {
      if (i >= rows.length) return;
      const batch = rows.slice(i, i + concurrency);
      i += concurrency;
      batch.forEach((m) => {
        const detail = detailsLookup?.(m.index);
        const constructed = m.index ? `https://www.dnd5eapi.co/api/images/monsters/${m.index}.png` : undefined;
        const url = detail?.image ? `https://www.dnd5eapi.co${detail.image}` : constructed;
        if (!url) return;
        try {
          const img = new Image();
          img.decoding = 'async';
          img.loading = 'eager';
          img.referrerPolicy = 'no-referrer';
          img.src = url;
        } catch (_) {}
      });
      // schedule next chunk during idle time
      scheduleIdle(nextBatch);
    }
    nextBatch();
  });
}

async function fetchJSON(url, { signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export default function MonsterBrowserModal({ open, onClose, onImport, initialIndex = null, autoOpenDescription = false }) {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'));
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [monsters, setMonsters] = React.useState([]); // list entries from /api/monsters
  const [query, setQuery] = React.useState('');
  // CR search state
  const [crResults, setCrResults] = React.useState([]);
  const [crLoading, setCrLoading] = React.useState(false);
  const [crError, setCrError] = React.useState(null);
  const crAbortRef = React.useRef(null);

  // pagination
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(25);

  // Adapt pagination for small screens
  React.useEffect(() => {
    if (isSmall && rowsPerPage > 10) setRowsPerPage(10);
  }, [isSmall]);

  // description dialog
  const [descOpen, setDescOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(null); // detailed monster
  const [descLoading, setDescLoading] = React.useState(false);
  const [descError, setDescError] = React.useState(null);
  // bump this to force re-render when cache fills
  const [cacheVersion, setCacheVersion] = React.useState(0);
  const persistTimeoutRef = React.useRef(null);
  const persistDirtyRef = React.useRef(false);
  const [pendingInitialIdx, setPendingInitialIdx] = React.useState(null);

  // Load persisted cache on first open
  React.useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem(CACHE_STORAGE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          Object.entries(obj).forEach(([index, detail]) => {
            if (!detailsCache.has(index)) detailsCache.set(index, detail);
          });
          setCacheVersion((v) => v + 1);
        }
      }
    } catch (_) {
      // ignore
    }
  }, [open]);

  const persistCacheSoon = React.useCallback(() => {
    persistDirtyRef.current = true;
    if (persistTimeoutRef.current) return;
    persistTimeoutRef.current = setTimeout(() => {
      persistTimeoutRef.current = null;
      if (!persistDirtyRef.current) return;
      persistDirtyRef.current = false;
      try {
        const obj = Object.fromEntries(detailsCache.entries());
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj));
      } catch (_) {
        // ignore storage errors
      }
    }, 1000);
  }, []);

  // Load base list
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchJSON('https://www.dnd5eapi.co/api/monsters?limit=10000', { signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        const results = Array.isArray(data?.results) ? data.results : [];
        setMonsters(results);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.name === 'AbortError') return;
        setError(e.message || String(e));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, [open]);

  // Auto-open description for an initial index if provided
  React.useEffect(() => {
    if (!open) return;
    if (!initialIndex) return;
    // Defer slightly to allow base list to settle
    setPendingInitialIdx(initialIndex);
  }, [open, initialIndex]);

  React.useEffect(() => {
    if (!open || !pendingInitialIdx) return;
    (async () => {
      try {
        setDescError(null);
        setDescLoading(true);
        setDescOpen(true);
        let detail = detailsCache.get(pendingInitialIdx);
        if (!detail) {
          detail = await fetchJSON(`https://www.dnd5eapi.co/api/monsters/${pendingInitialIdx}`);
          detailsCache.set(pendingInitialIdx, detail);
          setCacheVersion((v) => v + 1);
          persistCacheSoon();
        }
        setSelected(detail);
      } catch (e) {
        setDescError(e.message || String(e));
      } finally {
        setDescLoading(false);
        setPendingInitialIdx(null);
      }
    })();
  }, [open, pendingInitialIdx, persistCacheSoon]);

  // Parse search query to detect name vs CR search
  function parseQuery(qRaw) {
    const q = (qRaw || '').trim();
    if (!q) return { mode: 'name', text: '' };
    // Detect explicit CR markers
    const crPattern = /^(?:cr|level|lvl)[\s:]+(.+)$/i;
    const hashPattern = /^#\s*(.+)$/; // e.g. #3 or #3-5
    const onlyNumOrRange = /^(\d+)(?:\s*-\s*(\d+))?$/;
    let m;
    if ((m = q.match(crPattern)) || (m = q.match(hashPattern)) || q.match(onlyNumOrRange)) {
      let body = m ? m[1] : q;
      body = String(body).trim();
      const range = body.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (range) {
        const start = parseInt(range[1], 10);
        const end = range[2] ? parseInt(range[2], 10) : start;
        if (!isNaN(start) && !isNaN(end)) {
          const [lo, hi] = start <= end ? [start, end] : [end, start];
          const values = [];
          for (let v = lo; v <= hi && values.length < 15; v++) values.push(v);
          return { mode: 'cr', values };
        }
      }
      const single = parseInt(body, 10);
      if (!isNaN(single)) return { mode: 'cr', values: [single] };
    }
    return { mode: 'name', text: q };
  }

  const parsed = React.useMemo(() => parseQuery(query), [query]);

  // Execute CR search when applicable
  React.useEffect(() => {
    if (!open) return;
    if (parsed.mode !== 'cr') {
      // cancel any in-flight CR search
      if (crAbortRef.current) {
        try { crAbortRef.current.abort(); } catch (_) {}
        crAbortRef.current = null;
      }
      setCrLoading(false);
      setCrError(null);
      return;
    }
    const values = parsed.values || [];
    if (values.length === 0) {
      setCrResults([]);
      setCrLoading(false);
      setCrError(null);
      return;
    }
    // Serve entirely from cache if possible
    const cachedGroups = values.map((v) => CR_INDEX_CACHE.get(`cr:${v}`) || null);
    if (cachedGroups.every((g) => Array.isArray(g))) {
      const merged = Array.from(new Map(cachedGroups.flat().map((r) => [r.index, r])).values());
      setCrResults(merged);
      setCrLoading(false);
      setCrError(null);
      return;
    }
    // Fetch missing groups
    if (crAbortRef.current) {
      try { crAbortRef.current.abort(); } catch (_) {}
      crAbortRef.current = null;
    }
    const controller = new AbortController();
    crAbortRef.current = controller;
    setCrLoading(true);
    setCrError(null);
    (async () => {
      try {
        const results = [];
        for (const v of values) {
          const key = `cr:${v}`;
          if (CR_INDEX_CACHE.has(key)) {
            results.push(CR_INDEX_CACHE.get(key));
            continue;
          }
          const data = await fetchJSON(`https://www.dnd5eapi.co/api/monsters?challenge_rating=${encodeURIComponent(v)}`, { signal: controller.signal });
          const group = Array.isArray(data?.results) ? data.results : [];
          CR_INDEX_CACHE.set(key, group);
          results.push(group);
        }
        const merged = Array.from(new Map(results.flat().map((r) => [r.index, r])).values());
        setCrResults(merged);
        setCrLoading(false);
      } catch (e) {
        if (e?.name === 'AbortError') return;
        setCrError(e.message || String(e));
        setCrLoading(false);
      } finally {
        if (crAbortRef.current === controller) crAbortRef.current = null;
      }
    })();
  }, [open, parsed]);

  // Filtered rows
  const filtered = React.useMemo(() => {
    if (parsed.mode === 'cr') return crResults;
    const q = (parsed.text || '').toLowerCase();
    if (!q) return monsters;
    return monsters.filter((m) => m.name?.toLowerCase().includes(q));
  }, [monsters, parsed, crResults]);

  const paged = React.useMemo(() => {
    const start = page * rowsPerPage;
    return filtered.slice(start, start + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  // Ensure details for the current page are loaded (to populate Level column)
  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function ensureDetails() {
      const toFetch = paged.filter((m) => !detailsCache.has(m.index));
      if (toFetch.length === 0) return;
      // limit concurrency to avoid hammering API
      const concurrency = 8;
      for (let i = 0; i < toFetch.length && !cancelled; i += concurrency) {
        const batch = toFetch.slice(i, i + concurrency);
        try {
          const results = await Promise.all(
            batch.map((m) => fetchJSON(`https://www.dnd5eapi.co${m.url}`, { signal: controller.signal }))
          );
          results.forEach((d, idx) => {
            const key = batch[idx].index;
            if (!detailsCache.has(key)) detailsCache.set(key, d);
          });
          if (!cancelled) {
            // signal that new details are ready to display
            setCacheVersion((v) => v + 1);
            // schedule persisting cache
            persistCacheSoon();
          }
        } catch (e) {
          if (e?.name === 'AbortError') return;
          // ignore batch errors; individual rows will handle lack of details
        }
      }
    }
    ensureDetails();
    // Prefetch images for currently visible rows (even without details)
    prefetchImagesFor(paged, (idx) => detailsCache.get(idx));
    // idle prefetch next page
    scheduleIdle(() => {
      if (cancelled) return;
      const start = (page + 1) * rowsPerPage;
      const nextPage = filtered.slice(start, start + rowsPerPage);
      // Prefetch next page images immediately for snappier avatar rendering
      prefetchImagesFor(nextPage, (idx) => detailsCache.get(idx));
      const missing = nextPage.filter((m) => !detailsCache.has(m.index));
      if (missing.length === 0) return;
      const prefetchController = new AbortController();
      const concurrency = 4;
      (async () => {
        for (let i = 0; i < missing.length && !cancelled; i += concurrency) {
          const batch = missing.slice(i, i + concurrency);
          try {
            const results = await Promise.all(
              batch.map((m) => fetchJSON(`https://www.dnd5eapi.co${m.url}`, { signal: prefetchController.signal }))
            );
            results.forEach((d, idx) => {
              const key = batch[idx].index;
              if (!detailsCache.has(key)) detailsCache.set(key, d);
            });
            if (!cancelled) {
              setCacheVersion((v) => v + 1);
              persistCacheSoon();
            }
          } catch (e) {
            if (e?.name === 'AbortError') return;
          }
        }
      })();
      // Cleanup prefetch when effect invalidates
      return () => prefetchController.abort();
    });
    return () => { cancelled = true; controller.abort(); };
  }, [paged, page, rowsPerPage, filtered, persistCacheSoon]);

  const handleChangePage = (_e, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const openDescription = async (event, monster) => {
    // Avoid keeping focus inside the now-hidden ancestor (outer dialog)
    try { event?.currentTarget?.blur?.(); } catch (_) {}
    setDescError(null);
    setDescLoading(true);
    setDescOpen(true);
    try {
      let detail = detailsCache.get(monster.index);
      if (!detail) {
        detail = await fetchJSON(`https://www.dnd5eapi.co${monster.url}`);
        detailsCache.set(monster.index, detail);
      }
      setSelected(detail);
    } catch (e) {
      setDescError(e.message || String(e));
    } finally {
      setDescLoading(false);
    }
  };

  const closeDescription = () => {
    setDescOpen(false);
    setSelected(null);
    setDescError(null);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={isSmall}
      maxWidth={isSmall ? 'md' : 'lg'}
      PaperProps={{
        sx: {
          bgcolor: '#2a2a2a',
          color: '#fff',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
        Bestiary
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} size="small" aria-label="Close" title="Close" sx={{ color: '#fff' }}>
          <span aria-hidden>×</span>
        </IconButton>
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          '&.MuiDialogContent-dividers': { borderColor: '#444' },
          color: '#fff',
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <TextField
            label="Search bestiary (name or level)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            fullWidth
            size="small"
            InputLabelProps={{ sx: { color: '#bbb' } }}
            InputProps={{
              sx: {
                color: '#fff',
                bgcolor: '#1f1f1f',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#555' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#888' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#aaa' },
              },
              endAdornment: (
                <InputAdornment position="end">
                  {query ? (
                    <Tooltip title="Clear">
                      <IconButton size="small" onClick={() => setQuery('')} aria-label="Clear search" sx={{ color: '#fff' }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }} aria-hidden>
                          ×
                        </span>
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {loading || crLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress color="inherit" />
          </Box>
        ) : error || crError ? (
          <Typography sx={{ color: '#ff6b6b' }}>{error || crError}</Typography>
        ) : (
          <Paper variant="outlined" sx={{ bgcolor: '#262626', color: '#fff', borderColor: '#444' }}>
            <TableContainer sx={{ maxHeight: isSmall ? '60vh' : 600 }}>
              <Table stickyHeader size={isSmall ? 'medium' : 'small'} sx={{
                '& .MuiTableCell-root': { borderColor: '#444', color: '#fff' },
                '& .MuiTableRow-hover:hover': { backgroundColor: '#3f3f3f', outline: '1px solid #555' },
                transition: 'background-color 120ms ease',
              }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#353535' }}>
                    <TableCell sx={{ backgroundColor: '#353535', color: '#fff' }} width={isSmall ? 48 : 56}>Icon</TableCell>
                    <TableCell sx={{ backgroundColor: '#353535', color: '#fff' }}>Name</TableCell>
                    {!isSmall && (
                      <TableCell sx={{ backgroundColor: '#353535', color: '#fff' }} width={120}>Level</TableCell>
                    )}
                    <TableCell sx={{ backgroundColor: '#353535', color: '#fff' }} width={isSmall ? 120 : 150} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.map((m) => {
                    const detail = detailsCache.get(m.index);
                    const level = detail?.challenge_rating ?? null;
                    return (
                      <TableRow key={`${m.index}-${cacheVersion}`} hover>
                        <TableCell>
                          <MonsterAvatar name={m.name} index={m.index} detail={detail} size={isSmall ? 32 : 28} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500} sx={{ color: '#fff' }}>{m.name}</Typography>
                          {detail ? (
                            <Typography variant="caption" sx={{ color: '#bbb' }}>
                              {detail.size} {detail.type} • {detail.alignment}
                            </Typography>
                          ) : (
                            <Typography variant="caption" sx={{ color: '#999' }}>Loading details…</Typography>
                          )}
                        </TableCell>
                        {!isSmall && (
                          <TableCell>
                            {level ?? (
                              <Typography variant="caption" sx={{ color: '#999' }}>—</Typography>
                            )}
                          </TableCell>
                        )}
                        <TableCell align="right">
                          {typeof onImport === 'function' && (
                            <Button
                              variant="contained"
                              size={isSmall ? 'medium' : 'small'}
                              onClick={async (e) => {
                                // Ensure details, then pass back to caller
                                try {
                                  let d = detailsCache.get(m.index);
                                  if (!d) {
                                    d = await fetchJSON(`https://www.dnd5eapi.co${m.url}`);
                                    detailsCache.set(m.index, d);
                                    setCacheVersion((v) => v + 1);
                                    persistCacheSoon();
                                  }
                                  const constructed = m.index ? `https://www.dnd5eapi.co/api/images/monsters/${m.index}.png` : undefined;
                                  const imageUrl = d?.image ? `https://www.dnd5eapi.co${d.image}` : constructed;
                                  const hp = Number.parseInt(d?.hit_points, 10) || undefined;
                                  // Movement: prefer walk/ground feet; parse first integer from walk or overall speed
                                  const speedObj = d?.speed || {};
                                  const walkStr = typeof speedObj === 'object' ? (speedObj.walk || speedObj.land || '') : String(speedObj || '');
                                  const mStr = walkStr || (typeof speedObj === 'string' ? speedObj : '');
                                  const num = (mStr && /\d+/.test(mStr)) ? parseInt(mStr.match(/\d+/)[0], 10) : undefined;
                                  const movement = Number.isFinite(num) ? num : 30;
                                  // Size mapping
                                  const sizeMap = { Tiny: 1, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4 };
                                  const gridSize = sizeMap[d?.size] || 1;
                                  await onImport({
                                    index: m.index,
                                    name: m.name,
                                    hp,
                                    movement,
                                    imageUrl,
                                    size: gridSize,
                                  }, d);
                                } catch (_) { /* ignore */ }
                              }}
                              sx={{
                                mr: 1,
                                color: '#000',
                                backgroundColor: '#fff',
                                borderColor: '#777',
                                '&:hover': { backgroundColor: '#eaeaea' },
                              }}
                            >
                              Summon
                            </Button>
                          )}
                          <Button
                            variant="outlined"
                            size={isSmall ? 'medium' : 'small'}
                            onClick={(e) => openDescription(e, m)}
                            sx={{
                              color: '#fff',
                              borderColor: '#777',
                              '&:hover': { borderColor: '#aaa', backgroundColor: 'rgba(255,255,255,0.06)' },
                            }}
                          >
                            Description
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={isSmall ? [5, 10, 25] : [10, 25, 50, 100]}
              sx={{
                color: '#fff',
                '& .MuiTablePagination-toolbar': { color: '#fff' },
                '& .MuiIconButton-root': { color: '#fff' },
                '& .MuiInputBase-root': { color: '#fff' },
                '& .MuiSelect-icon': { color: '#fff' },
              }}
            />
          </Paper>
        )}

        {/* Description sub-dialog */}
        <Dialog
          open={descOpen}
          onClose={closeDescription}
          fullWidth
          fullScreen={isSmall}
          maxWidth={isSmall ? 'md' : 'md'}
          PaperProps={{ sx: { bgcolor: '#2a2a2a', color: '#fff' } }}
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#fff' }}>
            {selected?.name || 'Monster'}
            <Box sx={{ flex: 1 }} />
            <IconButton onClick={closeDescription} size="small" aria-label="Close" title="Close" sx={{ color: '#fff' }}>
              <span aria-hidden>×</span>
            </IconButton>
          </DialogTitle>
          <DialogContent
            dividers
            sx={{ '&.MuiDialogContent-dividers': { borderColor: '#444' }, color: '#fff' }}
          >
            {descLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress color="inherit" />
              </Box>
            ) : descError ? (
              <Typography sx={{ color: '#ff6b6b' }}>{descError}</Typography>
            ) : selected ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: isSmall ? '1fr' : '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Overview</Typography>
                  <Typography variant="body2" sx={{ color: '#bbb' }}>
                    {selected.size} {selected.type} • {selected.alignment}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#bbb' }}>
                    AC: {Array.isArray(selected.armor_class) ? selected.armor_class.map(a => a.value).join(', ') : selected.armor_class} • HP: {selected.hit_points}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#bbb' }}>
                    Speed: {typeof selected.speed === 'object' ? Object.entries(selected.speed).map(([k,v]) => `${k} ${v}`).join(', ') : selected.speed}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#bbb' }}>
                    CR: {selected.challenge_rating} • Proficiency Bonus: {selected.proficiency_bonus}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#bbb' }}>
                    Senses: {selected.senses ? Object.entries(selected.senses).map(([k,v]) => `${k} ${v}`).join(', ') : '—'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#bbb' }}>
                    Languages: {selected.languages || '—'}
                  </Typography>
                  {(() => {
                    const constructed = selected?.index ? `https://www.dnd5eapi.co/api/images/monsters/${selected.index}.png` : undefined;
                    const largeImageUrl = selected?.image ? `https://www.dnd5eapi.co${selected.image}` : constructed;
                    return largeImageUrl ? (
                      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                        <Box
                          component="img"
                          src={largeImageUrl}
                          alt={selected?.name}
                          loading="eager"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          sx={{
                            maxWidth: '100%',
                            maxHeight: isSmall ? '40vh' : 320,
                            borderRadius: 1,
                            border: '1px solid #444',
                            backgroundColor: '#1f1f1f',
                            objectFit: 'contain',
                          }}
                        />
                      </Box>
                    ) : null;
                  })()}
                </Box>
                <Box>
                  {Array.isArray(selected.special_abilities) && selected.special_abilities.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Special Abilities</Typography>
                      {selected.special_abilities.map((a) => (
                        <Box key={a.name} sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>{a.name}</Typography>
                          <Typography variant="body2" sx={{ color: '#bbb' }}>{a.desc}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {Array.isArray(selected.actions) && selected.actions.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Actions</Typography>
                      {selected.actions.map((a, i) => (
                        <Box key={`${a.name}-${i}`} sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>{a.name}</Typography>
                          <Typography variant="body2" sx={{ color: '#bbb' }}>{a.desc}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                  {Array.isArray(selected.legendary_actions) && selected.legendary_actions.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ color: '#fff' }}>Legendary Actions</Typography>
                      {selected.legendary_actions.map((a, i) => (
                        <Box key={`${a.name}-${i}`} sx={{ mb: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ color: '#fff' }}>{a.name}</Typography>
                          <Typography variant="body2" sx={{ color: '#bbb' }}>{a.desc}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: '#bbb' }}>Select a monster to view details.</Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ borderTop: '1px solid #444' }}>
            <Button onClick={closeDescription} sx={{ color: '#fff' }}>Close</Button>
          </DialogActions>
        </Dialog>
      </DialogContent>
      <DialogActions sx={{ borderTop: '1px solid #444' }}>
        <Button onClick={onClose} variant="outlined" sx={{ color: '#fff', borderColor: '#777', '&:hover': { borderColor: '#aaa', backgroundColor: 'rgba(255,255,255,0.06)' } }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Small helper component to render monster avatar with image fallback
function MonsterAvatar({ name, index, detail, size = 28 }) {
  const initial = name?.[0]?.toUpperCase() || '?';
  const constructed = index ? `https://www.dnd5eapi.co/api/images/monsters/${index}.png` : undefined;
  const preferred = detail?.image ? `https://www.dnd5eapi.co${detail.image}` : constructed;
  const [src, setSrc] = React.useState(preferred);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setSrc(preferred);
  }, [preferred]);

  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      {!loaded && (
        <Box
          sx={{
            position: 'absolute', inset: 0, bgcolor: '#444', borderRadius: '50%',
            animation: 'pulse 1.2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%': { opacity: 0.6 },
              '50%': { opacity: 1 },
              '100%': { opacity: 0.6 },
            },
          }}
        />
      )}
      <Avatar
        src={src}
        alt={name}
        sx={{ width: size, height: size, bgcolor: '#555', color: '#fff' }}
        imgProps={{
          referrerPolicy: 'no-referrer',
          loading: 'lazy',
          decoding: 'async',
          onError: () => { setSrc(undefined); setLoaded(true); },
          onLoad: () => setLoaded(true),
        }}
      >
        {initial}
      </Avatar>
    </Box>
  );
}
