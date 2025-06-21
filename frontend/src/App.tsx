import React, { useState, useEffect } from 'react';
import axios from 'axios';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('en');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setVideoFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setError("Please select a video file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", videoFile);
    formData.append("language", language);

    setLoading(true);
    setError(null);
    try {
      const res = await axios.post("http://localhost:8080/v1/api/upload", formData);
      setTransactionId(res.data.transactionId);
      setStatus('UPLOADED');
    } catch (err) {
      console.error("Upload error:", err);
      let errorMessage = "Failed to upload video. Please try again.";

      if (axios.isAxiosError(err)) {
        if (err.response) {
          if (typeof err.response.data === 'string') {
            errorMessage = err.response.data;
          } else if (err.response.data && typeof err.response.data.message === 'string') {
            errorMessage = err.response.data.message;
          } else {
            errorMessage = `Server responded with status ${err.response.status}: ${err.response.statusText}`;
          }
        } else if (err.request) {
          errorMessage = "No response from server. Please check your network connection.";
        } else {
          errorMessage = `Request setup error: ${err.message}`;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      setTransactionId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!transactionId) {
      return;
    }

    setStatus('Processing...');

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:8080/v1/api/status/${transactionId}`);
        const currentStatus = res.data.state;
        setStatus(currentStatus);

        if (currentStatus === 'COMPLETED') {
          clearInterval(interval);
          setLoading(false);

          try {
            const fileRes = await axios.get(`http://localhost:8080/v1/api/result/${transactionId}`, {
              responseType: 'blob',
            });

            const blob = new Blob([fileRes.data], { type: 'application/x-subrip' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'subtitles.srt';
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            setVideoFile(null);
            setTransactionId(null);
            setStatus('Download Complete');
            setError(null);
          } catch (downloadErr) {
            console.error("Error downloading subtitles:", downloadErr);
            let errorMessage = "Failed to download subtitles.";
            if (axios.isAxiosError(downloadErr) && downloadErr.message) {
              errorMessage = `Failed to download subtitles: ${downloadErr.message}`;
            } else if (downloadErr instanceof Error && downloadErr.message) {
              errorMessage = `Failed to download subtitles: ${downloadErr.message}`;
            }
            setError(errorMessage);
            setLoading(false);
            setTransactionId(null);
            setStatus('Download Failed');
          }

        } else if (currentStatus === 'ERROR') {
          clearInterval(interval);
          setError("Subtitle generation failed. Please try again.");
          setLoading(false);
          setTransactionId(null);
          setStatus('Generation Failed');
        }
      } catch (e) {
        console.error("Error fetching status:", e);
        clearInterval(interval);
        let errorMessage = "Could not retrieve status. Please check your connection or try again.";
        if (axios.isAxiosError(e) && e.message) {
          errorMessage = `Could not retrieve status: ${e.message}. Please check your connection or try again.`;
        } else if (e instanceof Error && e.message) {
          errorMessage = `Could not retrieve status: ${e.message}. Please check your connection or try again.`;
        }
        setError(errorMessage);
        setLoading(false);
        setTransactionId(null);
        setStatus('Error Fetching Status');
      }
    }, 2000);

    return () => clearInterval(interval);

  }, [transactionId]);

  return (
      <div style={{
        maxWidth: '600px',
        margin: '40px auto',
        padding: '20px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontFamily: 'Arial, sans-serif',
      }}>
        <h2 style={{ textAlign: 'center' }}>🎬 Subtitle Generator</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="videoFile">Upload Video File:</label>
            <input
                type="file"
                id="videoFile"
                accept="video/*"
                onChange={handleFileChange}
                disabled={loading || !!transactionId}
                style={{ width: '100%' }}
            />
          </div>

          <div>
            <label htmlFor="languageSelect">Language:</label>
            <select
                id="languageSelect"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loading || !!transactionId}
                style={{ padding: '6px', marginTop: '10px' }}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
              <option value="ge">German</option>
            </select>
          </div>

          <button
              type="submit"
              /*
                The button is disabled only if currently loading or a transaction is active.
                It will be enabled once the previous transaction is complete,
                but clicking it without selecting a file will trigger the file validation error.
              */
              disabled={loading || !!transactionId}
              style={{
                padding: '8px 16px',
                marginTop: '10px',
                backgroundColor: (loading || !!transactionId) ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                cursor: (loading || !!transactionId) ? 'not-allowed' : 'pointer',
              }}
          >
            {loading ? "Uploading..." : transactionId ? "Processing..." : "Upload Video"}
          </button>
        </form>

        {error && (
            <p style={{ color: 'red', marginTop: '20px', fontWeight: 'bold' }}>
              Error: {error}
            </p>
        )}

        {transactionId && (
            <p style={{ marginTop: '20px', fontWeight: 'bold' }}>
              Status: {status}
              {status === 'Processing...' && (
                  <span style={{ fontWeight: 'normal', display: 'block' }}>Your request is being processed. Please wait...</span>
              )}
              {status === 'Download Complete' && (
                  <span style={{ fontWeight: 'normal', display: 'block', color: 'green' }}>Subtitles downloaded successfully!</span>
              )}
              {status === 'Generation Failed' && (
                  <span style={{ fontWeight: 'normal', display: 'block', color: 'red' }}>Subtitle generation failed.</span>
              )}
            </p>
        )}

        {!transactionId && !loading && !error && videoFile && (
            <p style={{ marginTop: '20px', fontWeight: 'bold', color: '#555' }}>
              Ready to upload "{videoFile.name}" ({ (videoFile.size / (1024 * 1024)).toFixed(2) } MB)
            </p>
        )}
        {!transactionId && !loading && !error && !videoFile && status === 'Download Complete' && (
            <p style={{ marginTop: '20px', fontWeight: 'bold', color: '#007BFF' }}>
              Please select a new video file to start another transcription.
            </p>
        )}
      </div>
  );
};

export default App;