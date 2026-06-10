import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader, Database, FileText, Bot, Send, Brain, Cpu, CheckCircle } from 'lucide-react';

const ResearchAssistant = () => {
  const [url, setUrl] = useState('');
  const [loadingStep, setLoadingStep] = useState(''); // '', 'scraping', 'ingesting', 'ready'
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [modelStatus, setModelStatus] = useState('unloaded');
  
  const worker = useRef(null);
  const messagesEndRef = useRef(null);
  const RAG_SOURCE = "ResearchApp_" + Math.random().toString(36).substring(7);

  useEffect(() => {
    worker.current = new Worker(new URL('../../worker.js', import.meta.url), { type: 'module' });
    worker.current.addEventListener('message', handleWorkerMessage);
    return () => worker.current?.terminate();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleWorkerMessage = (e) => {
    const msg = e.data;
    switch (msg.status) {
      case 'progress':
        setModelStatus('loading');
        if (msg.data && msg.data.progress !== undefined) setProgress(Math.round(msg.data.progress));
        break;
      case 'ready':
        setModelStatus('ready');
        break;
      case 'processing':
        setModelStatus('processing');
        break;
      case 'update':
      case 'complete':
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content = msg.output;
            if (msg.status === 'complete') setModelStatus('ready');
          }
          return newMessages;
        });
        break;
      case 'error':
        setModelStatus('error');
        setError(msg.error);
        break;
      default:
        break;
    }
  };

  const handleLoadModel = () => {
    setModelStatus('loading');
    setProgress(0);
    worker.current.postMessage({ type: 'load' });
  };

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
      
      const rawText = scrapeData.data.markdown;

      // Step 2: Ingest (Create a File blob)
      setLoadingStep('ingesting');
      const blob = new Blob([rawText], { type: 'text/markdown' });
      const file = new File([blob], "scraped_research.md", { type: 'text/markdown' });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('chunking_strategy', 'sentence');
      
      const ingestRes = await fetch('http://localhost:8000/api/ingest-advanced', {
        method: 'POST',
        body: formData
      });
      const ingestData = await ingestRes.json();
      if (!ingestData.success) throw new Error('Ingestion failed');

      // Step 3: VectorDB
      const vectorRes = await fetch('http://localhost:8000/api/vector/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks: ingestData.data.chunks, source: RAG_SOURCE })
      });
      const vectorData = await vectorRes.json();
      if (!vectorData.success) throw new Error('Vector DB storage failed');

      setLoadingStep('ready');
      setMessages([{ role: 'assistant', content: 'I have successfully scraped and embedded the paper/blog. What would you like to know about it?' }]);
      
      if (modelStatus === 'unloaded') {
        handleLoadModel();
      }
    } catch (err) {
      setError(err.message);
      setLoadingStep('');
    }
  };

  const handleChat = async (e) => {
    e.preventDefault();
    if (!input.trim() || modelStatus !== 'ready') return;
    
    const userMessage = input.trim();
    setInput('');
    let promptContext = '';

    try {
      setModelStatus('processing');
      // Query Chroma for RAG
      const res = await fetch('http://localhost:8000/api/vector/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage, n_results: 3 })
      });
      const data = await res.json();
      
      // Filter results to only match our current source
      if (data.success && data.results.documents[0].length > 0) {
         const matchingIndices = data.results.metadatas[0].map((meta, idx) => meta.source === RAG_SOURCE ? idx : -1).filter(i => i !== -1);
         const matchingChunks = matchingIndices.map(i => data.results.documents[0][i]);
         
         if (matchingChunks.length > 0) {
            promptContext = `Based on the following extracted text from the paper, answer the question.\n\nContext:\n${matchingChunks.join('\n\n---\n\n')}\n\n`;
         }
      }
    } catch (err) {
      console.error(err);
    }

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);
    
    const conversationHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const finalPrompt = `${promptContext}User: ${userMessage}\n`;
    worker.current.postMessage({ type: 'generate', text: `${conversationHistory}\n${finalPrompt}` });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '4rem auto', padding: '0 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <Brain size={64} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800' }}>AI Research Assistant</h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
          Like a personal Google Scholar + Local AI. Enter a URL to scrape a paper or blog, and ask questions about its contents instantly.
        </p>
      </div>

      {loadingStep !== 'ready' && (
        <form onSubmit={handleProcessUrl} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <input 
            type="url" 
            required 
            placeholder="https://arxiv.org/html/..." 
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
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{ backgroundColor: '#f8f9fa', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} color="#304fba" />
              <strong>{url}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={18} color={modelStatus === 'ready' || modelStatus === 'processing' ? '#38a169' : '#718096'} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: modelStatus === 'ready' ? '#38a169' : '#718096' }}>
                {modelStatus === 'unloaded' ? 'Engine Offline' : modelStatus === 'loading' ? `Downloading ${progress}%` : modelStatus === 'ready' ? 'Ready' : 'Thinking...'}
              </span>
            </div>
          </div>

          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', backgroundColor: '#fdfdfd', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: msg.role === 'user' ? '#ebf8ff' : '#f8f9fa', color: '#2d3748', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: msg.role === 'user' ? '#2b6cb0' : '#4a5568' }}>
                  {msg.role === 'user' ? 'You' : 'AI Researcher'}
                </strong>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{msg.content}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleChat} style={{ padding: '1.5rem', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={modelStatus === 'ready' ? "Ask about the research..." : "Waiting for engine..."}
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
