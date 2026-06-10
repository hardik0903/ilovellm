import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader, Cpu, CheckCircle, Database, FileText } from 'lucide-react';

const NLPPage = () => {
  const [status, setStatus] = useState('unloaded'); // unloaded, loading, ready, processing, error
  const [progress, setProgress] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [errorText, setErrorText] = useState('');
  const [useRag, setUseRag] = useState(false);
  
  // Web worker reference
  const worker = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Create the worker
    worker.current = new Worker(new URL('../worker.js', import.meta.url), {
      type: 'module'
    });

    // Listen for messages from the worker
    worker.current.addEventListener('message', (e) => {
      const msg = e.data;
      
      switch (msg.status) {
        case 'progress':
          setStatus('loading');
          // If it has a progress percentage, track it
          if (msg.data && msg.data.progress !== undefined) {
            setProgress(Math.round(msg.data.progress));
          }
          break;
        case 'ready':
          setStatus('ready');
          break;
        case 'processing':
          setStatus('processing');
          break;
        case 'update':
          // Update the last message (assistant's response) as tokens stream in
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              // T5 generates just the answer, so we don't need to split the prompt out
              lastMsg.content = msg.output;
            }
            return newMessages;
          });
          break;
        case 'complete':
          setStatus('ready');
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              lastMsg.content = msg.output;
            }
            return newMessages;
          });
          break;
        case 'error':
          setStatus('error');
          setErrorText(msg.error);
          break;
        default:
          break;
      }
    });

    return () => {
      worker.current.terminate();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleLoadModel = () => {
    setStatus('loading');
    setProgress(0);
    worker.current.postMessage({ type: 'load' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || status !== 'ready') return;

    const userMessage = input.trim();
    setInput('');
    setErrorText('');
    
    let retrievedSources = [];
    let promptContext = '';

    // If RAG is enabled, intercept and hit Vector DB
    if (useRag) {
      try {
        setStatus('processing');
        const res = await fetch('http://127.0.0.1:8000/api/vector/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: userMessage, n_results: 3 })
        });
        const data = await res.json();
        
        if (data.success && data.results.documents[0].length > 0) {
           retrievedSources = data.results.metadatas[0];
           const chunks = data.results.documents[0].join('\n\n---\n\n');
           promptContext = `Based on the following extracted context, answer the user's question accurately. If the answer is not in the context, do not make it up.\n\nContext:\n${chunks}\n\n`;
        }
      } catch (err) {
        setErrorText('Failed to query Vector DB: ' + err.message);
        setStatus('ready');
        return;
      }
    }

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Add empty assistant message that will be filled via stream
    setMessages(prev => [...prev, { role: 'assistant', content: '...', sources: retrievedSources }]);
    
    // Create the full prompt history (for context)
    let conversationHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    
    // Construct the final super prompt sent to local AI
    const finalSuperPrompt = `${promptContext}User: ${userMessage}\n`;
    const fullPrompt = `${conversationHistory}\n${finalSuperPrompt}`;

    // Send to worker
    worker.current.postMessage({ type: 'generate', text: fullPrompt });
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '4rem auto', padding: '0 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <Bot size={64} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800', letterSpacing: '-0.5px' }}>Local NLP Runner</h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
          Running <strong>TinyLlama-1.1B</strong> entirely inside your browser using WebAssembly. No APIs, 100% private, zero costs.
        </p>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '650px' }}>
        
        {/* Status Bar */}
        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={20} color={status === 'ready' || status === 'processing' ? '#38a169' : '#718096'} />
            <span style={{ fontWeight: '600', color: '#2d3748' }}>Model Status:</span>
            {status === 'unloaded' && <span style={{ color: '#718096' }}>Offline</span>}
            {status === 'loading' && <span style={{ color: '#d69e2e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader size={14} className="animate-spin" /> Downloading Weights ({progress}%)</span>}
            {status === 'ready' && <span style={{ color: '#38a169', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle size={14} /> Ready</span>}
            {status === 'processing' && <span style={{ color: '#304fba', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Loader size={14} className="animate-spin" /> Generating...</span>}
            {status === 'error' && <span style={{ color: '#e53e3e' }}>Error</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', color: useRag ? '#38a169' : '#718096', transition: 'color 0.2s' }}>
              <input 
                type="checkbox" 
                checked={useRag} 
                onChange={(e) => setUseRag(e.target.checked)} 
                style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#38a169' }} 
              />
              <Database size={16} /> Chat with Vector DB Context (RAG)
            </label>

            {status === 'unloaded' && (
              <button 
                onClick={handleLoadModel}
                style={{ backgroundColor: '#304fba', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Cpu size={16} /> Load Local Engine
              </button>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', backgroundColor: '#fdfdfd' }}>
          {status === 'unloaded' ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#a0aec0' }}>
              <Bot size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3>The AI Engine is currently asleep.</h3>
              <p>Click "Load Local Engine" to download the model into your browser cache (approx 600MB).</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {messages.length === 0 && status === 'ready' && (
                <div style={{ textAlign: 'center', color: '#a0aec0', marginTop: '2rem' }}>
                  <p>Model is loaded. Turn on "Chat with Vector DB Context" to ask questions about your PDFs!</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: msg.role === 'user' ? '#ebf8ff' : '#f8f9fa', color: '#2d3748', padding: '1rem', borderRadius: '12px', borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px', borderBottomLeftRadius: msg.role === 'assistant' ? '2px' : '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: msg.role === 'user' ? '#2b6cb0' : '#4a5568' }}>
                    {msg.role === 'user' ? 'You' : 'Local AI'}
                  </strong>
                  
                  {/* Source Attribution UI */}
                  {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px dashed #cbd5e0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#718096', alignSelf: 'center' }}>SOURCES:</span>
                      {Array.from(new Set(msg.sources.map(s => s.source))).map((source, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: '#e2e8f0', color: '#4a5568', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          <FileText size={12} /> {source}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{msg.content}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {errorText && (
            <div style={{ margin: '1rem', padding: '1rem', backgroundColor: '#fed7d7', color: '#9b2c2c', borderRadius: '6px' }}>
              <strong>Error:</strong> {errorText}
            </div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={handleSend} style={{ padding: '1.5rem', backgroundColor: '#fff', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={status === 'ready' ? "Ask the local model a question..." : "Waiting for model..."}
            disabled={status !== 'ready'}
            style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '1rem', outline: 'none' }}
          />
          <button
            type="submit"
            disabled={status !== 'ready' || !input.trim()}
            style={{ backgroundColor: status === 'ready' ? '#304fba' : '#cbd5e0', color: 'white', border: 'none', padding: '0 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: status === 'ready' ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'background-color 0.2s' }}
          >
            <Send size={18} /> Send
          </button>
        </form>
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default NLPPage;
