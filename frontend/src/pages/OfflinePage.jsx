import React, { useState, useEffect } from 'react';
import { Shield, Wifi, WifiOff, Server, Database, Bot, Globe, FileText, Search, CheckCircle, XCircle, AlertTriangle, Lock, HardDrive, Eye, EyeOff } from 'lucide-react';

const OfflinePage = () => {
  const [offlineMode, setOfflineMode] = useState(() => {
    return localStorage.getItem('ilovellm_offline_mode') === 'true';
  });
  const [services, setServices] = useState({
    node: { status: 'checking', label: 'Node.js Backend', port: 3000, url: 'http://127.0.0.1:3000/api/status' },
    python: { status: 'checking', label: 'Python Backend', port: 8000, url: 'http://127.0.0.1:8000/api/status' },
  });
  const [vectorStats, setVectorStats] = useState(null);
  const [showPaths, setShowPaths] = useState(false);

  const toggleOfflineMode = () => {
    const newValue = !offlineMode;
    setOfflineMode(newValue);
    localStorage.setItem('ilovellm_offline_mode', String(newValue));
    window.dispatchEvent(new CustomEvent('offlineModeChanged', { detail: newValue }));
  };

  useEffect(() => {
    const checkService = async (key, url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        const data = await res.json();
        setServices(prev => ({ ...prev, [key]: { ...prev[key], status: data.status === 'ok' ? 'online' : 'error' } }));
      } catch {
        setServices(prev => ({ ...prev, [key]: { ...prev[key], status: 'offline' } }));
      }
    };

    checkService('node', 'http://127.0.0.1:3000/api/status');
    checkService('python', 'http://127.0.0.1:8000/api/status');

    // Check vector DB stats
    (async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/vector/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'test', n_results: 1 })
        });
        const data = await res.json();
        if (data.success) {
          setVectorStats({ connected: true });
        }
      } catch {
        setVectorStats({ connected: false });
      }
    })();

    const interval = setInterval(() => {
      checkService('node', 'http://127.0.0.1:3000/api/status');
      checkService('python', 'http://127.0.0.1:8000/api/status');
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const features = [
    { name: 'Document Ingestion', icon: FileText, local: true, desc: 'All parsing runs on your machine via pdfplumber & PyMuPDF.' },
    { name: 'Vector Database', icon: Database, local: true, desc: 'ChromaDB stores embeddings on your local disk. No cloud sync.' },
    { name: 'Local NLP / Chat', icon: Bot, local: true, desc: 'LaMini-Flan-T5 runs entirely in your browser via WebAssembly.' },
    { name: 'Web Scraper', icon: Globe, local: false, desc: 'Requires internet to fetch target websites. Disabled in offline mode.' },
    { name: 'Web Search', icon: Search, local: false, desc: 'Uses DuckDuckGo externally. Disabled in offline mode.' },
  ];

  const statusIcon = (s) => {
    if (s === 'online') return <CheckCircle size={16} color="#38a169" />;
    if (s === 'offline') return <XCircle size={16} color="#e53e3e" />;
    return <AlertTriangle size={16} color="#d69e2e" />;
  };

  const statusText = (s) => {
    if (s === 'online') return 'Online';
    if (s === 'offline') return 'Offline';
    return 'Checking...';
  };

  return (
    <div className="offline-page">
      <style>{styles}</style>

      {/* Hero */}
      <header className="offline-hero">
        <Shield size={56} color="#304fba" />
        <h1>100% Offline Mode</h1>
        <p>Your data never leaves your machine. All processing happens locally on your hardware.</p>
      </header>

      {/* Master Toggle */}
      <div className="offline-toggle-card">
        <div className="offline-toggle-left">
          <div className="offline-toggle-icon-wrap" data-active={offlineMode}>
            {offlineMode ? <WifiOff size={28} color="#fff" /> : <Wifi size={28} color="#304fba" />}
          </div>
          <div>
            <h2>{offlineMode ? 'Offline Mode Active' : 'Online Mode'}</h2>
            <p>{offlineMode
              ? 'All internet-dependent features (Web Scraper, Web Search) are disabled. Only local tools are available.'
              : 'All features are active. Web Scraper and Web Search require internet access.'
            }</p>
          </div>
        </div>
        <button className="offline-toggle-btn" data-active={offlineMode} onClick={toggleOfflineMode}>
          <span className="offline-toggle-track">
            <span className="offline-toggle-thumb" />
          </span>
        </button>
      </div>

      {/* Service Health */}
      <div className="offline-section-card">
        <div className="offline-section-header">
          <Server size={20} color="#304fba" />
          <h2>Service Health</h2>
        </div>
        <p className="offline-section-sub">Real-time status of all local backend services.</p>

        <div className="offline-services-grid">
          {Object.entries(services).map(([key, svc]) => (
            <div key={key} className="offline-service-item">
              <div className="offline-service-row">
                {statusIcon(svc.status)}
                <strong>{svc.label}</strong>
              </div>
              <div className="offline-service-meta">
                <span className="offline-service-port">Port {svc.port}</span>
                <span className={`offline-service-badge offline-badge-${svc.status}`}>{statusText(svc.status)}</span>
              </div>
            </div>
          ))}
          <div className="offline-service-item">
            <div className="offline-service-row">
              {vectorStats?.connected ? <CheckCircle size={16} color="#38a169" /> : vectorStats === null ? <AlertTriangle size={16} color="#d69e2e" /> : <XCircle size={16} color="#e53e3e" />}
              <strong>ChromaDB Vector Store</strong>
            </div>
            <div className="offline-service-meta">
              <span className="offline-service-port">Embedded</span>
              <span className={`offline-service-badge offline-badge-${vectorStats?.connected ? 'online' : vectorStats === null ? 'checking' : 'offline'}`}>
                {vectorStats?.connected ? 'Connected' : vectorStats === null ? 'Checking...' : 'Disconnected'}
              </span>
            </div>
          </div>
          <div className="offline-service-item">
            <div className="offline-service-row">
              <CheckCircle size={16} color="#38a169" />
              <strong>Browser NLP Engine</strong>
            </div>
            <div className="offline-service-meta">
              <span className="offline-service-port">WebAssembly</span>
              <span className="offline-service-badge offline-badge-online">Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Privacy Matrix */}
      <div className="offline-section-card">
        <div className="offline-section-header">
          <Lock size={20} color="#304fba" />
          <h2>Feature Privacy Matrix</h2>
        </div>
        <p className="offline-section-sub">See which features run fully local and which require internet.</p>

        <div className="offline-matrix">
          <div className="offline-matrix-header">
            <span>Feature</span>
            <span>Network</span>
            <span>Status</span>
          </div>
          {features.map((f, i) => {
            const disabled = offlineMode && !f.local;
            return (
              <div key={i} className={`offline-matrix-row ${disabled ? 'disabled' : ''}`}>
                <div className="offline-matrix-feature">
                  <f.icon size={18} color={disabled ? '#cbd5e0' : '#304fba'} />
                  <div>
                    <strong>{f.name}</strong>
                    <span className="offline-matrix-desc">{f.desc}</span>
                  </div>
                </div>
                <span className={`offline-network-badge ${f.local ? 'local' : 'internet'}`}>
                  {f.local ? '🔒 Local Only' : '🌐 Internet'}
                </span>
                <span className={`offline-status-badge ${disabled ? 'blocked' : 'active'}`}>
                  {disabled ? 'Blocked' : 'Active'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Storage */}
      <div className="offline-section-card">
        <div className="offline-section-header">
          <HardDrive size={20} color="#304fba" />
          <h2>Local Data Storage</h2>
          <button className="offline-eye-btn" onClick={() => setShowPaths(!showPaths)}>
            {showPaths ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPaths ? 'Hide' : 'Show'} Paths
          </button>
        </div>
        <p className="offline-section-sub">All your data is stored exclusively on your local disk.</p>

        <div className="offline-storage-grid">
          <div className="offline-storage-item">
            <Database size={20} color="#304fba" />
            <div>
              <strong>Vector Embeddings</strong>
              <span>{showPaths ? './backend/chroma_storage/' : '••••••••'}</span>
            </div>
          </div>
          <div className="offline-storage-item">
            <Bot size={20} color="#304fba" />
            <div>
              <strong>NLP Model Cache</strong>
              <span>{showPaths ? 'Browser IndexedDB (ONNX cache)' : '••••••••'}</span>
            </div>
          </div>
          <div className="offline-storage-item">
            <FileText size={20} color="#304fba" />
            <div>
              <strong>Uploaded Documents</strong>
              <span>{showPaths ? 'In-memory only (not persisted)' : '••••••••'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Assurance */}
      <div className="offline-privacy-banner">
        <Shield size={24} />
        <div>
          <strong>Privacy Guarantee</strong>
          <p>ilovellm is designed from the ground up for complete data sovereignty. No telemetry, no analytics, no cloud dependencies. Your documents, embeddings, and AI conversations stay on your machine — always.</p>
        </div>
      </div>

      {/* Footer */}
      <div className="offline-footer-note">
        Built with privacy-first architecture by{' '}
        <a href="https://hardikpandey.in" target="_blank" rel="noreferrer">Hardik Pandey</a>.
        GDPR compliant by design.
      </div>
    </div>
  );
};

const styles = `
  .offline-page {
    max-width: 960px;
    margin: 0 auto;
    padding: 3rem 2rem 4rem;
  }

  .offline-hero {
    text-align: center;
    margin-bottom: 3rem;
  }
  .offline-hero h1 {
    font-size: 2.5rem;
    font-weight: 800;
    color: #2d3748;
    margin: 1rem 0 0.75rem;
    letter-spacing: -0.5px;
  }
  .offline-hero p {
    color: #718096;
    font-size: 1.15rem;
    max-width: 520px;
    margin: 0 auto;
    line-height: 1.7;
  }

  /* Toggle Card */
  .offline-toggle-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.75rem 2rem;
    margin-bottom: 2rem;
    gap: 2rem;
  }
  .offline-toggle-left {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .offline-toggle-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.3s;
  }
  .offline-toggle-icon-wrap[data-active="false"] {
    background: #edf2f7;
  }
  .offline-toggle-icon-wrap[data-active="true"] {
    background: #304fba;
  }
  .offline-toggle-left h2 {
    font-size: 1.15rem;
    font-weight: 700;
    color: #2d3748;
    margin: 0 0 0.25rem;
  }
  .offline-toggle-left p {
    font-size: 0.88rem;
    color: #718096;
    margin: 0;
    line-height: 1.5;
    max-width: 480px;
  }

  .offline-toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
  }
  .offline-toggle-track {
    display: block;
    width: 56px;
    height: 30px;
    border-radius: 15px;
    position: relative;
    transition: background 0.25s;
  }
  .offline-toggle-btn[data-active="false"] .offline-toggle-track {
    background: #cbd5e0;
  }
  .offline-toggle-btn[data-active="true"] .offline-toggle-track {
    background: #304fba;
  }
  .offline-toggle-thumb {
    display: block;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #fff;
    position: absolute;
    top: 3px;
    transition: left 0.25s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  }
  .offline-toggle-btn[data-active="false"] .offline-toggle-thumb {
    left: 3px;
  }
  .offline-toggle-btn[data-active="true"] .offline-toggle-thumb {
    left: 29px;
  }

  /* Section card */
  .offline-section-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }
  .offline-section-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.25rem;
  }
  .offline-section-header h2 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #2d3748;
    margin: 0;
  }
  .offline-section-sub {
    color: #718096;
    font-size: 0.92rem;
    margin-bottom: 1.25rem;
  }

  /* Services Grid */
  .offline-services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 0.75rem;
  }
  .offline-service-item {
    background: #f8f9fa;
    border: 1px solid #edf2f7;
    border-radius: 8px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .offline-service-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .offline-service-row strong {
    font-size: 0.9rem;
    color: #2d3748;
  }
  .offline-service-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .offline-service-port {
    font-size: 0.78rem;
    color: #a0aec0;
  }
  .offline-service-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .offline-badge-online { background: #f0fff4; color: #276749; }
  .offline-badge-offline { background: #fff5f5; color: #9b2c2c; }
  .offline-badge-checking { background: #fffff0; color: #975a16; }

  /* Feature Privacy Matrix */
  .offline-matrix {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
  }
  .offline-matrix-header {
    display: grid;
    grid-template-columns: 1fr 140px 90px;
    padding: 0.75rem 1.25rem;
    background: #f8f9fa;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #718096;
    border-bottom: 1px solid #e2e8f0;
  }
  .offline-matrix-row {
    display: grid;
    grid-template-columns: 1fr 140px 90px;
    padding: 1rem 1.25rem;
    align-items: center;
    border-bottom: 1px solid #edf2f7;
    transition: opacity 0.2s, background 0.2s;
  }
  .offline-matrix-row:last-child { border-bottom: none; }
  .offline-matrix-row.disabled {
    opacity: 0.5;
    background: #fafafa;
  }
  .offline-matrix-feature {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .offline-matrix-feature strong {
    display: block;
    font-size: 0.9rem;
    color: #2d3748;
    margin-bottom: 0.15rem;
  }
  .offline-matrix-desc {
    display: block;
    font-size: 0.78rem;
    color: #a0aec0;
    line-height: 1.4;
  }
  .offline-network-badge {
    font-size: 0.78rem;
    font-weight: 600;
  }
  .offline-network-badge.local { color: #276749; }
  .offline-network-badge.internet { color: #c05621; }
  .offline-status-badge {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .offline-status-badge.active { background: #f0fff4; color: #276749; }
  .offline-status-badge.blocked { background: #fff5f5; color: #9b2c2c; }

  /* Storage */
  .offline-storage-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .offline-storage-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #f8f9fa;
    border: 1px solid #edf2f7;
    border-radius: 8px;
    padding: 1rem 1.25rem;
  }
  .offline-storage-item strong {
    display: block;
    font-size: 0.9rem;
    color: #2d3748;
    margin-bottom: 0.15rem;
  }
  .offline-storage-item span {
    font-size: 0.82rem;
    color: #a0aec0;
    font-family: monospace;
  }
  .offline-eye-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    background: #edf2f7;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 0.3rem 0.65rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #718096;
    cursor: pointer;
    transition: all 0.15s;
  }
  .offline-eye-btn:hover {
    background: #e2e8f0;
    color: #304fba;
  }

  /* Privacy Banner */
  .offline-privacy-banner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    background: #304fba;
    color: #fff;
    border-radius: 8px;
    padding: 1.5rem 2rem;
    margin-bottom: 2rem;
  }
  .offline-privacy-banner strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.35rem;
  }
  .offline-privacy-banner p {
    font-size: 0.88rem;
    opacity: 0.9;
    line-height: 1.6;
    margin: 0;
  }

  /* Footer */
  .offline-footer-note {
    background: #f8f9fa;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1.25rem;
    text-align: center;
    color: #718096;
    font-size: 0.9rem;
  }
  .offline-footer-note a {
    color: #304fba;
    font-weight: 700;
    text-decoration: none;
  }
  .offline-footer-note a:hover {
    text-decoration: underline;
  }
`;

export default OfflinePage;
