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
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import axios from 'axios';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [backendPort, setBackendPort] = useState(5001);

  useEffect(() => {
    // Try to detect backend port
    const checkBackendPort = async () => {
      for (let port = 5001; port < 5010; port++) {
        try {
          await axios.get(`https://video-downloader-backend-ttbf.onrender.com:${port}/api/health`);
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
      const response = await axios.post(`https://video-downloader-backend-ttbf.onrender.com:${backendPort}/api/download`, { url });
      setVideoInfo(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process video');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url, title) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Video Downloader
        </Typography>
        
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
              {videoInfo.formats.map((format, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={`Quality: ${format.quality || 'Unknown'}`}
                    secondary={`Type: ${format.mimeType}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleDownload(format.url, videoInfo.title)}
                    >
                      <DownloadIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Paper>
        )}
      </Box>
    </Container>
  );
}

export default App; 
