import React, { useState } from 'react';
import './App.css';

const API_ENDPOINT = 'https://0exoqpsrxa.execute-api.us-east-1.amazonaws.com/onboard';

type Modality = 'text' | 'voice' | 'document';
type Status = 'initiated' | 'identity_pending' | 'identity_verified' | 'onboarding_in_progress' | 'completed' | 'failed';

interface ApiResponse {
  sessionId: string;
  status: Status;
  nextStep?: string;
  message?: string;
}

function App() {
  const [input, setInput] = useState('');
  const [modality, setModality] = useState<Modality>('text');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        ...(sessionId && { sessionId }),
        input,
        modality,
      };

      const res = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

      const data: ApiResponse = await res.json();
      setResponse(data);
      setSessionId(data.sessionId);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setSessionId(null);
    setResponse(null);
    setError(null);
  };

  return (
    <div className="App">
      {/* Background Effects */}
      <div className="bg-container">
        <div className="grid-pattern"></div>
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <div className="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="logo-text">MetaIntent</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-wrapper">
          <h1 className="page-title">
            AI-POWERED<br />
            <span className="gradient-text">ONBOARDING</span>
          </h1>
          <p className="page-subtitle">
            Experience the future of autonomous onboarding with MetaIntent.<br />
            Powered by Claude on AWS Bedrock.
          </p>

          <div className="card">
            {sessionId && (
              <div className="session-info">
                <h3>Active Session</h3>
                <p>ID: {sessionId}</p>
              </div>
            )}

            {response && (
              <div className="status-badge">
                <span className="status-dot"></span>
                Status: {response.status}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="modality-section">
                <label className="section-label">Select Input Modality</label>
                <div className="modality-buttons">
                  {(['text', 'voice', 'document'] as Modality[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModality(m)}
                      className={`modality-btn ${modality === m ? 'active' : ''}`}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-section">
                <label htmlFor="input" className="section-label">
                  Enter Your Information
                </label>
                <textarea
                  id="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="input-field"
                  placeholder="Example: My name is John Doe, born 01/15/1990, ID: ABC123456..."
                  required
                />
              </div>

              <div className="action-buttons">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <span className="loading">
                      <span className="loading-dot"></span>
                      <span className="loading-dot"></span>
                      <span className="loading-dot"></span>
                    </span>
                  ) : sessionId ? 'Continue Session' : 'Start Onboarding'}
                </button>
                {sessionId && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="btn-secondary"
                  >
                    New Session
                  </button>
                )}
              </div>
            </form>

            {response && response.message && (
              <div className="response-section">
                <label className="response-label">AI Response</label>
                <div className="response-content">
                  <p>{response.message}</p>
                </div>
              </div>
            )}

            {response && response.nextStep && (
              <div className="response-section" style={{ marginTop: '1rem' }}>
                <label className="response-label">Next Step</label>
                <div className="response-content">
                  <p>{response.nextStep}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
