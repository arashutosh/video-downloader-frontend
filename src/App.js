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
  useTheme,
  ThemeProvider,
  createTheme,
  AppBar,
  Toolbar,
} from '@mui/material';
import { Download as DownloadIcon, Brightness4, Brightness7 } from '@mui/icons-material';
import axios from 'axios';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [backendPort, setBackendPort] = useState(5001);
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });
  const [downloadingIndex, setDownloadingIndex] = useState(null);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
    },
  });

  useEffect(() => {
    // Try to detect backend port
    const checkBackendPort = async () => {
      for (let port = 5001; port < 5010; port++) {
        try {
          // await axios.get(`https://video-downloader-backend-ttbf.onrender.com:${port}/api/health`);
          await axios.get(`http://localhost:${port}/api/health`);
          setBackendPort(port);
          break;
        } catch (err) {
          continue;
        }
      }
    };
    checkBackendPort();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVideoInfo(null);

    try {
      // const response = await axios.post(`https://video-downloader-backend-ttbf.onrender.com:${backendPort}/api/download`, { url });
      const response = await axios.post(`http://localhost:${backendPort}/api/download`, { url });
      console.log('Received video info from backend:', response.data);
      setVideoInfo(response.data);
    } catch (err) {
      console.error('Error fetching video info:', err);
      setError(err.response?.data?.error || 'Failed to process video');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeDownload = async (format, index) => {
    setDownloadingIndex(index);
    try {
      const response = await axios.post(
        `http://localhost:${backendPort}/api/merge_download`,
        { url, format_id: format.format_id },
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], { type: 'video/mp4' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${videoInfo.title}_${format.quality || format.resolution}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Failed to download video.');
    } finally {
      setDownloadingIndex(null);
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
                {console.log('Rendering formats:', videoInfo.formats)}
                <List>
                  {/* {videoInfo.formats.map((format, index) => ( */}
                    {/* Filter formats: only one per quality, and only those with filesize */}
                    {(() => {
                    const seen = new Set();
                    return videoInfo.formats.filter(f => f.filesize && f.filesize > 0 && !seen.has(f.quality) && seen.add(f.quality));
                  })().map((format, index) => (
                    <ListItem key={index}>
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
