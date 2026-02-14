import React, { useState, useEffect } from 'react';
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

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(to bottom right, #EBF4FF, #E0E7FF)',
  },
  header: {
    background: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '1.5rem 2rem',
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(to bottom right, #3B82F6, #4F46E5)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '1.25rem',
  },
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '3rem 2rem',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
    padding: '2rem',
  },
  sessionInfo: {
    marginBottom: '1.5rem',
    padding: '1rem',
    background: '#EBF4FF',
    borderRadius: '8px',
  },
  modalityButtons: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  button: {
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  buttonPrimary: {
    background: '#4F46E5',
    color: 'white',
  },
  buttonSecondary: {
    background: '#F3F4F6',
    color: '#374151',
  },
  textarea: {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    fontSize: '1rem',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  badge: {
    display: 'inline-block',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    fontSize: '0.875rem',
    fontWeight: '500',
    marginRight: '0.75rem',
  },
  responseBox: {
    marginTop: '2rem',
    padding: '1rem',
    background: '#F9FAFB',
    borderRadius: '8px',
  },
};

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
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>M</div>
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#111827' }}>MetaIntent</h1>
              <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Autonomous Onboarding Agent</p>
            </div>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          {sessionId && (
            <div style={styles.sessionInfo}>
              <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Session ID:</p>
              <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#111827' }}>{sessionId}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Input Modality
              </label>
              <div style={styles.modalityButtons}>
                {(['text', 'voice', 'document'] as Modality[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModality(m)}
                    style={{
                      ...styles.button,
                      ...(modality === m ? styles.buttonPrimary : styles.buttonSecondary),
                    }}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="input" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Enter your information
              </label>
              <textarea
                id="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={4}
                style={styles.textarea}
                placeholder="Example: My name is John Doe, born 01/15/1990, ID: ABC123456"
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  flex: 1,
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Processing...' : sessionId ? 'Continue Session' : 'Start Onboarding'}
              </button>
              {sessionId && (
                <button
                  type="button"
                  onClick={handleReset}
                  style={{
                    ...styles.button,
                    border: '2px solid #D1D5DB',
                    background: 'white',
                    color: '#374151',
                  }}
                >
                  New Session
                </button>
              )}
            </div>
          </form>

          {response && (
            <div style={{ marginTop: '2rem', borderTop: '1px solid #E5E7EB', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Response</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ ...styles.badge, background: '#DBEAFE', color: '#1E40AF' }}>
                  Status: {response.status}
                </span>
                <span style={{ ...styles.badge, background: '#E9D5FF', color: '#6B21A8' }}>
                  🤖 Claude 4.5 (Bedrock)
                </span>
              </div>

              {response.message && (
                <div style={styles.responseBox}>
                  <p>{response.message}</p>
                </div>
              )}

              {response.nextStep && (
                <div style={{ ...styles.responseBox, background: '#EBF4FF', marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Next Step:</p>
                  <p style={{ fontWeight: '500' }}>{response.nextStep}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ marginTop: '2rem', padding: '1rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '8px' }}>
              <p style={{ color: '#991B1B', fontWeight: '500' }}>Error: {error}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
