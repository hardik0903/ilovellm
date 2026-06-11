import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader, Database, FileText, Bot, Send, Brain, Cpu, CheckCircle, AlertTriangle, BookOpen, Zap } from 'lucide-react';

const ResearchAssistant = () => {
  const [url, setUrl] = useState('');
  const [loadingStep, setLoadingStep] = useState(''); // '', 'scraping', 'ingesting', 'ready'
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [modelStatus, setModelStatus] = useState('idle'); // idle, retrieving, generating, ready
  const [documentId, setDocumentId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleProcessUrl = async (e) => {
    e.preventDefault();
    if (!url) return;
    setError('');
    
    try {
      // Step 1: Scrape
      setLoadingStep('scraping');
      const scrapeRes = await fetch('http://localhost:8000/api/scrape/static', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, force_refresh: false, ignore_robots: true })
      });
      const scrapeData = await scrapeRes.json();
      
      if (!scrapeData.success) throw new Error(scrapeData.error || 'Scraping failed');
      
      setDocumentId(scrapeData.data.document_id);

      setLoadingStep('ingesting');
      
      const formData = new FormData();
      if (scrapeData.data.page_map) {
        formData.append('page_map_json', JSON.stringify(scrapeData.data.page_map));
      } else {
        const file = new File([scrapeData.data.extracted_text || scrapeData.data.context.map(c => c.text).join('\n') || "Empty Document"], 'url.txt', { type: 'text/plain' });
        formData.append('file', file);
      }
      formData.append('chunking_strategy', 'recursive_overlap');
      
      const ingestRes = await fetch('http://localhost:8000/api/ingest-advanced', {
        method: 'POST',
        body: formData
      });
      const ingestData = await ingestRes.json();
      if (!ingestData.success) throw new Error('Ingestion failed');

      // Step 3: VectorDB + BM25
      const vectorRes = await fetch('http://localhost:8000/api/vector/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks: ingestData.data.chunks, source: "ResearchApp", document_id: scrapeData.data.document_id })
      });
      const vectorData = await vectorRes.json();
      if (!vectorData.success && !vectorData.cached) throw new Error('Vector DB storage failed');

      setLoadingStep('ready');
      setModelStatus('ready');
      setMessages([{ role: 'assistant', content: 'I have successfully scraped and embedded the paper/blog. What would you like to know about it?' }]);
    } catch (err) {
      setError(err.message);
      setLoadingStep('');
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!input.trim() || modelStatus !== 'ready') return;
    
    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setModelStatus('retrieving');

    // Add placeholder assistant message
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true, phase: 'retrieving' }]);

    try {
      const res = await fetch('http://localhost:8000/api/research/query/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage, document_id: documentId })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              
              if (payload.phase === 'retrieving') {
                setModelStatus('retrieving');
                setMessages(prev => {
                  const msgs = [...prev];
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], phase: 'retrieving' };
                  return msgs;
                });
              } else if (payload.phase === 'second_pass') {
                setMessages(prev => {
                  const msgs = [...prev];
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], phase: 'second_pass' };
                  return msgs;
                });
              } else if (payload.phase === 'generating') {
                setModelStatus('generating');
                setMessages(prev => {
                  const msgs = [...prev];
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], phase: 'generating' };
                  return msgs;
                });
              } else if (payload.phase === 'complete') {
                setMessages(prev => {
                  const msgs = [...prev];
                  msgs[msgs.length - 1] = {
                    role: 'assistant',
                    content: payload.data.answer,
                    structured: payload.data,
                    streaming: false,
                    phase: 'complete'
                  };
                  return msgs;
                });
                setModelStatus('ready');
              }
            } catch (parseErr) {
              // Skip malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      // Fallback to non-streaming endpoint
      try {
        const fallbackRes = await fetch('http://localhost:8000/api/research/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: userMessage, document_id: documentId })
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success) {
          setMessages(prev => {
            const msgs = [...prev];
            msgs[msgs.length - 1] = {
              role: 'assistant',
              content: fallbackData.data.answer,
              structured: fallbackData.data,
              streaming: false,
              phase: 'complete'
            };
            return msgs;
          });
        } else {
          throw new Error('Fallback also failed');
        }
      } catch {
        setMessages(prev => {
          const msgs = [...prev];
          msgs[msgs.length - 1] = { role: 'assistant', content: 'Sorry, an error occurred while researching.', streaming: false };
          return msgs;
        });
      }
      setModelStatus('ready');
    }
  };

  const getStatusLabel = () => {
    switch (modelStatus) {
      case 'retrieving': return '🔍 Retrieving...';
      case 'generating': return '🧠 Generating...';
      case 'ready': return '✅ Ready';
      default: return '⏳ Idle';
    }
  };

  const getStatusColor = () => {
    if (modelStatus === 'ready') return '#38a169';
    if (modelStatus === 'retrieving' || modelStatus === 'generating') return '#d69e2e';
    return '#718096';
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.7) return '#38a169';
    if (conf >= 0.4) return '#d69e2e';
    return '#e53e3e';
  };

  const getConfidenceLabel = (conf) => {
    if (conf >= 0.7) return 'High';
    if (conf >= 0.4) return 'Medium';
    return 'Low';
  };

  const renderPhaseIndicator = (phase) => {
    const phases = [
      { key: 'retrieving', label: 'Retrieving', icon: <Search size={14} /> },
      { key: 'second_pass', label: 'Deep Search', icon: <Database size={14} /> },
      { key: 'generating', label: 'Synthesizing', icon: <Brain size={14} /> },
    ];
    return (
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.75rem', color: '#718096' }}>
        {phases.map((p, idx) => {
          const isActive = phase === p.key;
          const isPast = phases.findIndex(x => x.key === phase) > idx;
          return (
            <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: isActive ? 1 : isPast ? 0.5 : 0.3 }}>
              {isPast ? <CheckCircle size={14} color="#38a169" /> : isActive ? <Loader size={14} className="animate-spin" /> : p.icon}
              <span style={{ fontSize: '0.8rem', fontWeight: isActive ? 'bold' : 'normal' }}>{p.label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '4rem auto', padding: '0 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <Brain size={64} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800' }}>AI Research Assistant</h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
          Hybrid BM25 + Dense retrieval with evidence-grounded answers. Enter a URL to analyze a paper or blog.
        </p>
      </div>

      {loadingStep !== 'ready' && (
        <form onSubmit={handleProcessUrl} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <input 
            type="url" 
            required 
            placeholder="https://arxiv.org/pdf/... or any article URL" 
            value={url} 
            onChange={e => setUrl(e.target.value)}
            style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '1rem' }}
          />
          <button 
            type="submit" 
            disabled={loadingStep !== ''}
            style={{ backgroundColor: '#304fba', color: 'white', padding: '0 2rem', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loadingStep ? <Loader className="animate-spin" size={20} /> : <Search size={20} />}
            {loadingStep === 'scraping' ? 'Scraping...' : loadingStep === 'ingesting' ? 'Embedding...' : 'Analyze Paper'}
          </button>
        </form>
      )}

      {error && <div style={{ color: '#e53e3e', backgroundColor: '#fed7d7', padding: '1rem', borderRadius: '8px', marginBottom: '2rem' }}>{error}</div>}

      {loadingStep === 'ready' && (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '700px' }}>
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="#304fba" />
              <strong style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{url}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} color={getStatusColor()} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: getStatusColor() }}>
                {getStatusLabel()}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', backgroundColor: '#fdfdfd', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: msg.role === 'user' ? '#ebf8ff' : '#f8f9fa', color: '#2d3748', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: msg.role === 'user' ? '#2b6cb0' : '#4a5568' }}>
                  {msg.role === 'user' ? 'You' : 'AI Researcher'}
                </strong>
                
                {/* Streaming phase indicator */}
                {msg.streaming && msg.phase && renderPhaseIndicator(msg.phase)}
                
                {/* Answer text */}
                {msg.content && (
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{msg.content}</p>
                )}
                
                {/* Structured response UI */}
                {msg.structured && (
                  <div style={{ marginTop: '1rem' }}>
                    {/* Confidence meter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <Zap size={16} color={getConfidenceColor(msg.structured.confidence)} />
                      <span style={{ fontSize: '0.85rem', color: '#4a5568' }}>Confidence:</span>
                      <div style={{ flex: 1, height: '6px', backgroundColor: '#edf2f7', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${(msg.structured.confidence || 0) * 100}%`, height: '100%', backgroundColor: getConfidenceColor(msg.structured.confidence), borderRadius: '3px', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: getConfidenceColor(msg.structured.confidence) }}>
                        {getConfidenceLabel(msg.structured.confidence)} ({((msg.structured.confidence || 0) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    
                    {/* Evidence blocks */}
                    {msg.structured.evidence_blocks && msg.structured.evidence_blocks.length > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#4a5568', fontSize: '0.85rem' }}>
                          <BookOpen size={14} />
                          <strong>Evidence Sources ({msg.structured.evidence_blocks.length} chunks)</strong>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {msg.structured.evidence_blocks.map((block) => (
                            <div key={block.id} title={block.text} style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: (msg.structured.evidence_ids || []).includes(block.id) ? '#ebf8ff' : '#f7fafc',
                              border: `1px solid ${(msg.structured.evidence_ids || []).includes(block.id) ? '#63b3ed' : '#e2e8f0'}`,
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              color: '#4a5568',
                              cursor: 'pointer',
                              fontWeight: (msg.structured.evidence_ids || []).includes(block.id) ? 'bold' : 'normal'
                            }}>
                              [{block.id}] Page {block.page}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Reasoning */}
                    {msg.structured.reasoning && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#f0fff4', borderRadius: '6px', fontSize: '0.8rem', color: '#276749', borderLeft: '3px solid #48bb78' }}>
                        <strong>Reasoning:</strong> {msg.structured.reasoning}
                      </div>
                    )}
                    
                    {/* Faithfulness warnings */}
                    {msg.structured.faithfulness_flags && msg.structured.faithfulness_flags.length > 0 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#fffff0', borderRadius: '6px', fontSize: '0.8rem', color: '#975a16', borderLeft: '3px solid #ecc94b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.25rem' }}>
                          <AlertTriangle size={14} />
                          <strong>Low grounding detected in:</strong>
                        </div>
                        {msg.structured.faithfulness_flags.map((flag, fi) => (
                          <div key={fi} style={{ marginLeft: '1.25rem', fontStyle: 'italic' }}>• "{flag}"</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleChat} style={{ padding: '1.5rem', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={modelStatus === 'ready' ? "Ask about the research..." : "Processing..."}
              disabled={modelStatus !== 'ready'}
              style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e0', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={modelStatus !== 'ready' || !input.trim()}
              style={{ backgroundColor: '#304fba', color: 'white', padding: '0 1.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Send size={18} /> Ask
            </button>
          </form>
        </div>
      )}
      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ResearchAssistant;
