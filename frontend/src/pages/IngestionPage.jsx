import React, { useState, useRef } from 'react';
import { FileText, UploadCloud, Loader, AlertTriangle, CheckCircle, Database, Download, Video, Settings, Mic, Layout, FileImage, FileAudio, FileCode, Check } from 'lucide-react';

const IngestionPage = () => {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isHovering, setIsHovering] = useState(false);
  
  // Settings
  const [chunkingStrategy, setChunkingStrategy] = useState('sentence');
  const [whisperModel, setWhisperModel] = useState('base');
  const [useOcr, setUseOcr] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  const [storeStatus, setStoreStatus] = useState('idle'); // idle, loading, success, error
  
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsHovering(true);
  };
  const handleDragLeave = () => setIsHovering(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      setUrl('');
    }
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setUrl('');
    }
  };

  const handleIngest = async (e) => {
    e.preventDefault();
    if (!file && !url) return;

    setLoading(true);
    setError('');
    setResult(null);
    setActiveTab('text');
    setStoreStatus('idle');

    const formData = new FormData();
    if (file) formData.append('file', file);
    if (url) formData.append('url', url);
    formData.append('chunking_strategy', chunkingStrategy);
    formData.append('whisper_model', whisperModel);
    formData.append('use_ocr', useOcr);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/ingest-advanced', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.detail || data.error || 'Failed to ingest document');
      }
      setResult(data.data);
    } catch (err) {
      setError(err.message + (err.message === 'Failed to fetch' ? ' (Make sure Python backend on port 8000 is running!)' : ''));
    } finally {
      setLoading(false);
    }
  };

  const handleStoreVector = async () => {
    if (!result?.chunks?.length) return;
    setStoreStatus('loading');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/vector/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks: result.chunks, source: result.filename })
      });
      const data = await res.json();
      if (data.success) {
        setStoreStatus('success');
        setTimeout(() => setStoreStatus('idle'), 3000);
      } else {
        throw new Error(data.error);
      }
    } catch(err) { 
      setStoreStatus('error');
      alert('Error: ' + err.message); 
    }
  };

  const downloadJson = () => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `extracted_${result.filename}.json`);
    dlAnchorElem.click();
  };

  const getFileIcon = (filename) => {
    if (!filename) return <FileText size={48} />;
    const ext = filename.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg'].includes(ext)) return <FileImage size={48} />;
    if (['mp3', 'wav', 'm4a'].includes(ext)) return <FileAudio size={48} />;
    if (['html', 'json', 'xml'].includes(ext)) return <FileCode size={48} />;
    return <FileText size={48} />;
  };

  const renderTabButton = (id, label, Icon) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`tab-button ${activeTab === id ? 'active' : ''}`}
    >
      <Icon size={18} /> {label}
    </button>
  );

  return (
    <div className="ingestion-container">
      <div className="hero-section">
        <div className="icon-wrapper">
          <Database size={40} color="#fff" />
        </div>
        <h1 className="hero-title">Universal Document Ingestion</h1>
        <p className="hero-subtitle">
          Transform any file format into clean, chunked, NLP-ready text. Powered by local offline AI models.
        </p>
      </div>

      <div className="main-card">
        <div className="grid-layout">
          {/* Left Column: Input Selection */}
          <div className="input-section">
            <h3 className="section-title">
              <UploadCloud size={20} className="text-blue-500" /> Upload Source
            </h3>
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
              className={`dropzone ${isHovering ? 'hovering' : ''} ${file ? 'has-file' : ''}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept=".pdf,.docx,.txt,.csv,.xlsx,.html,.json,.png,.jpg,.jpeg,.eml,.mp3,.wav,.m4a" />
              
              {file ? (
                <div className="file-preview animate-scale-in">
                  <div className="file-icon-pulse">
                    {getFileIcon(file.name)}
                  </div>
                  <h4 className="file-name">{file.name}</h4>
                  <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
                  <p className="file-change">Click to change file</p>
                </div>
              ) : (
                <div className="upload-prompt">
                  <div className="upload-icon-container">
                    <UploadCloud size={36} />
                  </div>
                  <h3 className="upload-title">Drag & Drop file or click to browse</h3>
                  <p className="upload-supported">Supports PDF, DOCX, XLSX, Images, MP3 & more</p>
                </div>
              )}
            </div>

            <div className="divider">
              <span>OR</span>
            </div>

            <div className="url-input-wrapper">
              <div className="url-icon">
                <Video size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Paste a YouTube URL here..." 
                value={url}
                onChange={(e) => { setUrl(e.target.value); setFile(null); }}
                className="url-input"
              />
              {url && <div className="url-active-indicator"></div>}
            </div>
          </div>

          {/* Right Column: Settings */}
          <div className="settings-section">
            <h3 className="section-title">
              <Settings size={20} className="text-gray-500" /> Pipeline Settings
            </h3>
            
            <div className="setting-group">
              <label className="setting-label">
                <Layout size={16} /> Smart Chunking Strategy
              </label>
              <div className="select-wrapper">
                <select 
                  value={chunkingStrategy} 
                  onChange={(e) => setChunkingStrategy(e.target.value)}
                  className="modern-select"
                >
                  <option value="sentence">Sentence-aware (Preserve syntax)</option>
                  <option value="fixed">Fixed size (512 words w/ overlap)</option>
                  <option value="heading">Heading-aware (Group by structure)</option>
                  <option value="semantic">Semantic (TF-IDF similarity grouping)</option>
                </select>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">
                <Mic size={16} /> Whisper Audio Model (Offline)
              </label>
              <div className="select-wrapper">
                <select 
                  value={whisperModel} 
                  onChange={(e) => setWhisperModel(e.target.value)}
                  className="modern-select"
                >
                  <option value="tiny">Tiny (39MB - Fastest)</option>
                  <option value="base">Base (74MB - Balanced)</option>
                  <option value="small">Small (244MB - Better Accuracy)</option>
                  <option value="medium">Medium (769MB - Multilingual)</option>
                  <option value="large">Large (1.5GB - 8GB+ RAM req.)</option>
                </select>
              </div>
            </div>

            <div className="toggle-group">
              <label className="toggle-label">
                <div className="toggle-wrapper">
                  <input 
                    type="checkbox" 
                    checked={useOcr} 
                    onChange={(e) => setUseOcr(e.target.checked)}
                    className="modern-checkbox"
                  />
                  <div className="toggle-switch"></div>
                </div>
                <span className="toggle-text">Force Tesseract OCR (Scanned PDFs)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="action-section">
          <button 
            onClick={handleIngest}
            disabled={loading || (!file && !url)}
            className={`process-button ${loading ? 'loading' : ''} ${(!file && !url) ? 'disabled' : ''}`}
          >
            {loading ? (
              <span className="flex-center gap-2"><Loader className="animate-spin" size={20} /> Processing via Python...</span>
            ) : (
              <span className="flex-center gap-2"><Database size={20} /> Extract & Process</span>
            )}
            <div className="btn-glow"></div>
          </button>
        </div>

        {error && (
          <div className="error-alert animate-slide-up">
            <AlertTriangle size={20} />
            <div>
              <strong>Ingestion Failed</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="results-container animate-fade-in-up">
          <div className="results-header">
            <div className="results-title-area">
              <div className="success-icon-wrapper">
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 className="results-title">Extraction Complete</h3>
                <p className="results-subtitle">{result.filename} • {result.strategy} chunking</p>
              </div>
            </div>
            
            <div className="results-actions">
              <button 
                onClick={handleStoreVector}
                disabled={storeStatus === 'loading' || storeStatus === 'success'}
                className={`action-btn btn-store ${storeStatus}`}
              >
                {storeStatus === 'loading' ? <Loader className="animate-spin" size={16} /> :
                 storeStatus === 'success' ? <Check size={16} /> : <Database size={16} />}
                {storeStatus === 'loading' ? 'Storing...' : 
                 storeStatus === 'success' ? 'Stored!' : 'Store in Vector DB'}
              </button>
              
              <button onClick={downloadJson} className="action-btn btn-download">
                <Download size={16} /> Export JSON
              </button>
            </div>
          </div>

          <div className="tabs-header">
            {renderTabButton('text', `Structured Chunks (${result.total_chunks})`, FileText)}
          </div>

          <div className="tabs-content">
            {activeTab === 'text' && (
              <div className="chunks-grid">
                {result.chunks?.map((chunk, i) => (
                  <div key={i} className="chunk-card animate-scale-in" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="chunk-header">
                      <span className="chunk-badge">Chunk {i + 1}</span>
                      <span className="chunk-size">{chunk.length} chars</span>
                    </div>
                    <p className="chunk-text">{chunk}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        /* Global & Layout */
        .flex-center { display: flex; align-items: center; justify-content: center; }
        .gap-2 { gap: 0.5rem; }
        .text-blue-500 { color: #3b82f6; }
        .text-gray-500 { color: #6b7280; }
        
        .ingestion-container {
          max-width: 1100px;
          margin: 3rem auto 5rem;
          padding: 0 1.5rem;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        /* Hero Section */
        .hero-section {
          text-align: center;
          margin-bottom: 3rem;
        }
        .icon-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: linear-gradient(135deg, #304fba 0%, #4a6ee0 100%);
          box-shadow: 0 10px 25px -5px rgba(48, 79, 186, 0.4);
          margin-bottom: 1.5rem;
        }
        .hero-title {
          font-size: 2.5rem;
          font-weight: 800;
          color: #1a202c;
          letter-spacing: -0.02em;
          margin-bottom: 1rem;
        }
        .hero-subtitle {
          font-size: 1.15rem;
          color: #4a5568;
          max-width: 650px;
          margin: 0 auto;
          line-height: 1.6;
        }

        /* Main Card */
        .main-card {
          background: #ffffff;
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02);
          border: 1px solid rgba(226, 232, 240, 0.8);
          position: relative;
          overflow: hidden;
        }

        .grid-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 3rem;
          margin-bottom: 2.5rem;
        }

        @media (max-width: 768px) {
          .grid-layout { grid-template-columns: 1fr; gap: 2rem; }
        }

        .section-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        /* Dropzone */
        .dropzone {
          border: 2px dashed #cbd5e0;
          border-radius: 16px;
          padding: 2.5rem 1.5rem;
          text-align: center;
          cursor: pointer;
          background-color: #f8fafc;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .dropzone:hover, .dropzone.hovering {
          border-color: #304fba;
          background-color: #f0f4ff;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -10px rgba(48, 79, 186, 0.15);
        }
        .dropzone.has-file {
          border-style: solid;
          border-color: #e2e8f0;
          background-color: #ffffff;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        
        .upload-icon-container {
          display: inline-flex;
          padding: 1rem;
          background: #edf2f7;
          border-radius: 50%;
          color: #4a5568;
          margin-bottom: 1rem;
          transition: all 0.3s ease;
        }
        .dropzone:hover .upload-icon-container {
          background: #e0e7ff;
          color: #304fba;
          transform: scale(1.1);
        }
        .upload-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 0.25rem;
        }
        .upload-supported {
          font-size: 0.85rem;
          color: #718096;
        }

        .file-preview {
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #2b6cb0;
        }
        .file-icon-pulse {
          margin-bottom: 1rem;
          animation: pulse-soft 2s infinite;
        }
        .file-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1a202c;
          margin-bottom: 0.25rem;
          word-break: break-all;
        }
        .file-size {
          font-size: 0.85rem;
          color: #718096;
          margin-bottom: 1rem;
        }
        .file-change {
          font-size: 0.8rem;
          font-weight: 600;
          color: #304fba;
          background: #ebf4ff;
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
        }

        /* Divider */
        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 1.5rem 0;
          color: #a0aec0;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .divider::before, .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #e2e8f0;
        }
        .divider span { padding: 0 1rem; }

        /* URL Input */
        .url-input-wrapper {
          position: relative;
          transition: all 0.3s ease;
        }
        .url-input-wrapper:focus-within {
          transform: translateY(-2px);
        }
        .url-icon {
          position: absolute;
          top: 0; bottom: 0; left: 1.25rem;
          display: flex;
          align-items: center;
          color: #a0aec0;
          transition: color 0.3s ease;
        }
        .url-input-wrapper:focus-within .url-icon { color: #304fba; }
        .url-input {
          width: 100%;
          padding: 1.25rem 1rem 1.25rem 3.5rem;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
          background: #f8fafc;
          font-size: 1rem;
          outline: none;
          transition: all 0.3s ease;
          color: #2d3748;
          font-weight: 500;
        }
        .url-input:focus {
          border-color: #304fba;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(48, 79, 186, 0.1);
        }
        .url-active-indicator {
          position: absolute;
          right: 1.25rem;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #48bb78;
          box-shadow: 0 0 8px rgba(72, 187, 120, 0.6);
        }

        /* Settings Section */
        .settings-section {
          background: #f8fafc;
          padding: 2rem;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          height: 100%;
        }

        .setting-group { margin-bottom: 1.75rem; }
        .setting-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.95rem;
          font-weight: 600;
          color: #4a5568;
          margin-bottom: 0.75rem;
        }
        
        .select-wrapper {
          position: relative;
        }
        .select-wrapper::after {
          content: '';
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          width: 0; height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-top: 5px solid #a0aec0;
          pointer-events: none;
        }
        .modern-select {
          width: 100%;
          padding: 1rem 1.25rem;
          border-radius: 10px;
          border: 1px solid #cbd5e0;
          background-color: #ffffff;
          font-size: 0.95rem;
          color: #2d3748;
          appearance: none;
          outline: none;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }
        .modern-select:focus {
          border-color: #304fba;
          box-shadow: 0 0 0 3px rgba(48, 79, 186, 0.1);
        }

        /* Toggle Switch */
        .toggle-group {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e2e8f0;
        }
        .toggle-label {
          display: flex;
          align-items: center;
          cursor: pointer;
          gap: 1rem;
        }
        .toggle-wrapper {
          position: relative;
          width: 44px;
          height: 24px;
        }
        .modern-checkbox {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .toggle-switch {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #cbd5e0;
          transition: .3s;
          border-radius: 24px;
        }
        .toggle-switch:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .modern-checkbox:checked + .toggle-switch {
          background-color: #304fba;
        }
        .modern-checkbox:checked + .toggle-switch:before {
          transform: translateX(20px);
        }
        .toggle-text {
          font-size: 0.95rem;
          font-weight: 600;
          color: #2d3748;
        }

        /* Process Button */
        .action-section {
          margin-top: 2rem;
        }
        .process-button {
          position: relative;
          width: 100%;
          padding: 1.25rem;
          background: #304fba;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.15rem;
          font-weight: 700;
          cursor: pointer;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 10px 20px -5px rgba(48, 79, 186, 0.3);
        }
        .process-button:hover:not(.disabled):not(.loading) {
          transform: translateY(-2px);
          box-shadow: 0 15px 25px -5px rgba(48, 79, 186, 0.4);
          background: #27419e;
        }
        .process-button.disabled {
          background: #cbd5e0;
          color: #a0aec0;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }
        .process-button.loading {
          cursor: wait;
          background: #4a6ee0;
        }
        .btn-glow {
          position: absolute;
          top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 60%);
          transform: scale(0);
          transition: transform 0.5s ease-out;
          pointer-events: none;
        }
        .process-button:hover:not(.disabled) .btn-glow {
          transform: scale(1);
        }

        /* Error Alert */
        .error-alert {
          margin-top: 1.5rem;
          padding: 1rem 1.5rem;
          background-color: #fff5f5;
          border-left: 4px solid #f56565;
          border-radius: 8px;
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          color: #c53030;
          box-shadow: 0 4px 6px rgba(245, 101, 101, 0.1);
        }

        /* Results Container */
        .results-container {
          margin-top: 3rem;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 15px 35px -5px rgba(0,0,0,0.05), 0 0 0 1px rgba(226, 232, 240, 0.5);
          overflow: hidden;
        }
        
        .results-header {
          padding: 2rem;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.5rem;
        }
        
        .results-title-area {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }
        .success-icon-wrapper {
          color: #38a169;
          background: #f0fff4;
          padding: 0.75rem;
          border-radius: 50%;
        }
        .results-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #1a202c;
          margin: 0 0 0.25rem 0;
        }
        .results-subtitle {
          font-size: 0.9rem;
          color: #718096;
          margin: 0;
          font-weight: 500;
        }

        .results-actions {
          display: flex;
          gap: 1rem;
        }
        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.25rem;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-store {
          background: #e6fffa;
          color: #285e61;
        }
        .btn-store:hover { background: #b2f5ea; transform: translateY(-1px); }
        .btn-store.loading { opacity: 0.7; cursor: wait; }
        .btn-store.success { background: #48bb78; color: white; }
        
        .btn-download {
          background: #ebf4ff;
          color: #304fba;
        }
        .btn-download:hover { background: #e0e7ff; transform: translateY(-1px); }

        .tabs-header {
          display: flex;
          padding: 0 1rem;
          border-bottom: 1px solid #e2e8f0;
          background: #fff;
        }
        .tab-button {
          padding: 1.25rem 1.5rem;
          border: none;
          background: none;
          color: #718096;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          transition: color 0.2s;
        }
        .tab-button:hover { color: #2d3748; }
        .tab-button.active { color: #304fba; }
        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 3px;
          background: #304fba;
          border-radius: 3px 3px 0 0;
        }

        .tabs-content {
          padding: 2rem;
          background: #fafbfc;
        }

        /* Chunks Grid */
        .chunks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        .chunk-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          transition: all 0.2s ease;
          position: relative;
          border-top: 4px solid #304fba;
        }
        .chunk-card:hover {
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);
          transform: translateY(-2px);
        }
        .chunk-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #edf2f7;
        }
        .chunk-badge {
          background: #ebf4ff;
          color: #304fba;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .chunk-size {
          font-size: 0.75rem;
          color: #a0aec0;
          font-weight: 600;
        }
        .chunk-text {
          font-size: 0.95rem;
          line-height: 1.7;
          color: #4a5568;
          margin: 0;
          white-space: pre-wrap;
          max-height: 250px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }
        /* Custom Scrollbar for chunks */
        .chunk-text::-webkit-scrollbar { width: 4px; }
        .chunk-text::-webkit-scrollbar-track { background: transparent; }
        .chunk-text::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 4px; }

        /* Animations */
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        
        .animate-fade-in-up { animation: fadeInUp 0.5s ease-out forwards; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        @keyframes pulse-soft {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default IngestionPage;
