import React, { useState, useEffect } from 'react';
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
} from '@mui/material';
import { Download as DownloadIcon, Brightness4, Brightness7 } from '@mui/icons-material';
import axios from 'axios';

// Get backend URL from environment variable with fallback
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ;

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });
  const [downloadingIndex, setDownloadingIndex] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [eventSource, setEventSource] = useState(null);
  const [slowDownloadReason, setSlowDownloadReason] = useState('');
  const [downloadStartTime, setDownloadStartTime] = useState(null);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
    },
  });

  // Clean up event source on component unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const startProgressStream = (downloadId) => {
    // Close existing event source
    if (eventSource) {
      eventSource.close();
    }

    setDownloadStartTime(Date.now());
    setSlowDownloadReason('');

    const es = new EventSource(`${BACKEND_URL}/api/progress_stream/${downloadId}`);
    
    es.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        setDownloadStatus(progress.status || '');
        setDownloadSpeed(progress.speed || 0);
        
        // Check for slow download
        if (progress.status === 'downloading') {
          const currentTime = Date.now();
          const elapsedTime = (currentTime - downloadStartTime) / 1000; // in seconds
          
          if (elapsedTime > 30 && progress.speed < 1024 * 1024) { // 30 seconds and less than 1MB/s
            if (progress.speed < 1024 * 50) { // Less than 50KB/s
              setSlowDownloadReason('Very slow internet connection detected. This might take a while.');
            } else if (progress.speed < 1024 * 200) { // Less than 200KB/s
              setSlowDownloadReason('Slow internet connection detected. Please be patient.');
            }
          }
        }
        
        if (progress.status === 'completed' || progress.status === 'finished') {
          es.close();
          setEventSource(null);
          setSlowDownloadReason('');
        } else if (progress.status === 'error') {
          es.close();
          setEventSource(null);
          setSlowDownloadReason('');
        }
      } catch (error) {}
    };

    es.onerror = () => {
      es.close();
      setEventSource(null);
      setSlowDownloadReason('');
    };

    setEventSource(es);
  };

  const formatSpeed = (speed) => {
    if (!speed) return '';
    if (speed < 1024) return `${speed.toFixed(0)} B/s`;
    if (speed < 1024 * 1024) return `${(speed / 1024).toFixed(1)} KB/s`;
    return `${(speed / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVideoInfo(null);

    try {
      const response = await axios.post(`${BACKEND_URL}/api/download`, { url });
      setVideoInfo(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process video');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeDownload = async (format, index) => {
    setDownloadingIndex(index);
    setDownloadStatus('starting');
    setDownloadSpeed(0);
    
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }

    try {
      const downloadId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      startProgressStream(downloadId);
      const response = await axios.get(
        `${BACKEND_URL}/api/merge_download`,
        {
          params: { 
            url, 
            format_id: format.format_id,
            download_id: downloadId
          },
          responseType: 'blob',
          timeout: 3600000,
        }
      );
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      const blob = new Blob([response.data], { type: 'video/mp4' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${videoInfo.title}_${format.quality || format.resolution}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      setDownloadStatus('completed');
    } catch (err) {
      alert('Failed to download video: ' + (err.response?.data?.detail || err.message));
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
      setDownloadStatus('error');
    } finally {
      setTimeout(() => {
        setDownloadingIndex(null);
        setDownloadStatus('');
        setDownloadSpeed(0);
      }, 3000);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
        <AppBar position="static" color="primary" enableColorOnDark>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Video Downloader
            </Typography>
            <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md">
          <Box sx={{ my: 4 }}>
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  label="Enter Video URL"
                  variant="outlined"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  margin="normal"
                  placeholder="https://www.youtube.com/watch?v=..."
                />
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={loading}
                  sx={{ mt: 2 }}
                >
                  {loading ? <CircularProgress size={24} /> : 'Get Video Info'}
                </Button>
              </form>
            </Paper>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {videoInfo && (
              <Paper elevation={3} sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {videoInfo.title}
                </Typography>
                <List>
                  {(() => {
                    const seen = new Set();
                    return videoInfo.formats.filter(f => f.filesize && f.filesize > 0 && !seen.has(f.quality) && seen.add(f.quality));
                  })().map((format, index) => (
                    <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <Box sx={{ width: '100%' }}>
                        <ListItemText
                          primary={`${format.quality} (${format.resolution})`}
                          secondary={
                            <>
                              <Typography component="span" variant="body2" color="text.primary">
                                {format.mimeType.toUpperCase()}
                              </Typography>
                              {format.hasAudio ? " • With Audio" : " • Video Only"}
                              {format.filesize ? ` • ${(format.filesize / (1024 * 1024)).toFixed(2)} MB` : ""}
                            </>
                          }
                        />
                        {downloadingIndex === index && (
                          <Box sx={{ width: '100%', mt: 2 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {(() => {
                                switch(downloadStatus) {
                                  case 'merging':
                                    return 'Merging audio and video streams...';
                                  case 'downloading':
                                    return 'Downloading video...';
                                  case 'starting':
                                    return 'Preparing download...';
                                  case 'completed':
                                    return 'Download completed!';
                                  case 'error':
                                    return 'An error occurred during download';
                                  default:
                                    return 'Please wait...';
                                }
                              })()}
                            </Typography>
                            {downloadStatus === 'downloading' && downloadSpeed > 0 && (
                              <>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                  Download speed: {formatSpeed(downloadSpeed)}
                                </Typography>
                                {slowDownloadReason && (
                                  <Typography 
                                    variant="caption" 
                                    color="warning.main" 
                                    sx={{ 
                                      display: 'block',
                                      mt: 1,
                                      fontStyle: 'italic'
                                    }}
                                  >
                                    {slowDownloadReason}
                                  </Typography>
                                )}
                              </>
                            )}
                          </Box>
                        )}
                      </Box>
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleMergeDownload(format, index)}
                          title="Download"
                          disabled={downloadingIndex === index}
                        >
                          {downloadingIndex === index ? <CircularProgress size={24} /> : <DownloadIcon />}
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;