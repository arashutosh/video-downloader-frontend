import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, 
  TextField, 
  Button, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Grid, 
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  AppBar,
  Toolbar,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  Download, 
  CheckCircle, 
  Error, 
  ContentCopy,
  Refresh,
  DarkMode,
  LightMode
} from '@mui/icons-material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const API_BASE_URL = 'http://localhost:5001';

function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloading, setDownloading] = useState(false);
  // Initialize dark mode from localStorage immediately
  const getInitialDarkMode = () => {
    const savedDarkMode = localStorage.getItem('darkMode');
    return savedDarkMode !== null ? JSON.parse(savedDarkMode) : false;
  };

  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const eventSourceRef = useRef(null);

  // Save dark mode preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
  };

  // Create theme based on dark mode state
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
  });

  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setVideoInfo(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/download`, { url: url.trim() });
      setVideoInfo(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch video information');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format) => {
    if (!videoInfo || downloading) return;

    setDownloading(true);
    setDownloadProgress({ status: 'starting', percent: 0 });
    
    const newDownloadId = `${videoInfo.video_id}_${format.format_id}_${Date.now()}`;

    try {
      // Start progress monitoring
      startProgressMonitoring(newDownloadId);

      // Start download
      const downloadUrl = `${API_BASE_URL}/api/merge_download?url=${encodeURIComponent(url)}&format_id=${format.format_id}&download_id=${newDownloadId}`;
      
      const response = await axios.get(downloadUrl, {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadProgress({ status: 'downloading', percent });
          }
        }
      });

      // Create download link
      const blob = new Blob([response.data], { type: 'video/mp4' });
      const downloadUrl2 = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl2;
      link.download = `${videoInfo.title || 'video'}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl2);

      setDownloadProgress({ status: 'completed', percent: 100 });
    } catch (err) {
      setDownloadProgress({ 
        status: 'error', 
        percent: 0, 
        error: err.response?.data?.detail || 'Download failed' 
      });
    } finally {
      setDownloading(false);
      stopProgressMonitoring();
    }
  };

  const startProgressMonitoring = (id) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_BASE_URL}/api/progress_stream/${id}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        setDownloadProgress(progress);
        
        if (progress.status === 'completed' || progress.status === 'error') {
          eventSource.close();
        }
      } catch (err) {
        console.error('Error parsing progress:', err);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };
  };

  const stopProgressMonitoring = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopProgressMonitoring();
    };
  }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'downloading':
      case 'merging':
        return <CircularProgress size={20} />;
      default:
        return <Download />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'downloading':
      case 'merging':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ 
        minHeight: '100vh', 
        bgcolor: 'background.default',
        color: 'text.primary'
      }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Video Downloader
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={darkMode}
                  onChange={handleDarkModeToggle}
                  icon={<LightMode />}
                  checkedIcon={<DarkMode />}
                />
              }
              label={darkMode ? "Dark Mode" : "Light Mode"}
              sx={{ color: 'inherit' }}
            />
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box component="form" onSubmit={handleUrlSubmit} sx={{ mb: 4 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={10}>
                <TextField
                  fullWidth
                  label="Enter YouTube URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={loading}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || !url.trim()}
                  startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
                >
                  {loading ? 'Loading...' : 'Get Formats'}
                </Button>
              </Grid>
            </Grid>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {videoInfo && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  {videoInfo.title}
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {videoInfo.formats
                    .filter(format => format.resolution !== 'unknown')
                    .map((format, index) => (
                    <Card variant="outlined" key={index}>
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="h6" component="div">
                            {format.quality}
                          </Typography>
                          <Chip 
                            label={format.resolution} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {format.mimeType.toUpperCase()} • {format.hasAudio ? 'With Audio' : 'Video Only'}
                        </Typography>
                        
                        {format.filesize > 0 && (
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Size: {(format.filesize / (1024 * 1024)).toFixed(1)} MB
                          </Typography>
                        )}

                        <Box display="flex" gap={1} mt={2}>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<Download />}
                            onClick={() => handleDownload(format)}
                            disabled={downloading}
                            fullWidth
                          >
                            Download
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {downloadProgress.status && (
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  {getStatusIcon(downloadProgress.status)}
                  <Typography variant="h6">
                    Download Progress
                  </Typography>
                </Box>
                
                <Box display="flex" alignItems="center" gap={2}>
                  <Box flex={1}>
                    <LinearProgress 
                      variant="determinate" 
                      value={downloadProgress.percent} 
                      color={getStatusColor(downloadProgress.status)}
                    />
                  </Box>
                  <Typography variant="body2">
                    {downloadProgress.percent}%
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Status: {downloadProgress.status}
                  {downloadProgress.error && ` - ${downloadProgress.error}`}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

// LinearProgress component for the progress bar
const LinearProgress = ({ variant, value, color }) => (
  <Box sx={{ width: '100%', bgcolor: 'grey.200', borderRadius: 1, overflow: 'hidden' }}>
    <Box
      sx={{
        width: `${value}%`,
        height: 8,
        bgcolor: color === 'success' ? 'success.main' : 
                color === 'error' ? 'error.main' : 'primary.main',
        transition: 'width 0.3s ease'
      }}
    />
  </Box>
);

export default App;