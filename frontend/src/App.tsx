import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [language, setLanguage] = useState('en');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

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

    setIsProcessing(true);
    setStatus('Processing...');

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`http://localhost:8080/v1/api/status/${transactionId}`);
        const currentStatus = res.data.state;
        setStatus(currentStatus);

        if (currentStatus === 'COMPLETED') {
          clearInterval(interval);
          setLoading(false);
          setIsProcessing(false);

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
          setIsProcessing(false);
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
        setIsProcessing(false);
        setTransactionId(null);
        setStatus('Error Fetching Status');
      }
    }, 2000);

    return () => clearInterval(interval);

  }, [transactionId]);

  return (
      <div className="container">
        <h2>🎬 Subtitle Generator</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="videoFile">Upload Video File:</label>
            <input
                type="file"
                id="videoFile"
                accept="video/*"
                onChange={handleFileChange}
                disabled={loading || !!transactionId}
            />
          </div>

          <div>
            <label htmlFor="languageSelect">Language:</label>
            <select
                id="languageSelect"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={loading || !!transactionId}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="mr">Marathi</option>
              <option value="de">German</option>
            </select>
          </div>

          <button
              type="submit"
              disabled={loading || !!transactionId}
          >
            {loading ? "Uploading..." : transactionId ? "Processing..." : "Upload Video"}
          </button>
        </form>

        {error && (
            <p className="error-message">
              Error: {error}
            </p>
        )}

        {transactionId && (
            <p className={`status-message ${
                status === 'Download Complete' ? 'download-complete' :
                    status === 'Generation Failed' ? 'generation-failed' :
                        status === 'Processing...' ? 'processing' : ''
            }`}>
              Status: {status}
              {isProcessing && <span className="spinner"></span>} {/* Spinner will show next to "Processing..." */}
              {status === 'Processing...' && (
                  <span>Your request is being processed. Please wait...</span>
              )}
              {status === 'Download Complete' && (
                  <span>Subtitles downloaded successfully!</span>
              )}
              {status === 'Generation Failed' && (
                  <span>Subtitle generation failed.</span>
              )}
            </p>
        )}

        {!transactionId && !loading && !error && videoFile && (
            <p className="ready-to-upload-message">
              Ready to upload "{videoFile.name}" ({ (videoFile.size / (1024 * 1024)).toFixed(2) } MB)
            </p>
        )}
        {!transactionId && !loading && !error && !videoFile && status === 'Download Complete' && (
            <p className="select-new-file-message">
              Please select a new video file to start another transcription.
            </p>
        )}
      </div>
  );
};

export default App;