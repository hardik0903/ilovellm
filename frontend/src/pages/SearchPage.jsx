import React, { useState, useEffect } from 'react';
import { Search, Globe, ChevronRight, DownloadCloud, CheckCircle, Loader, WifiOff } from 'lucide-react';

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(() => localStorage.getItem('ilovellm_offline_mode') === 'true');
  
  useEffect(() => {
    const handler = (e) => setIsOffline(e.detail);
    window.addEventListener('offlineModeChanged', handler);
    return () => window.removeEventListener('offlineModeChanged', handler);
  }, []);

  // Track ingestion status for each result URL
  const [ingestStatus, setIngestStatus] = useState({});

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResults([]);
    
    try {
      const res = await fetch('http://127.0.0.1:8000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), max_results: 10 })
      });
      
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
      } else {
        setError(data.error || "Failed to fetch search results.");
      }
    } catch (err) {
      setError("Server error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractAndIngest = async (url) => {
    setIngestStatus(prev => ({ ...prev, [url]: 'loading' }));
    
    try {
      // 1. Scrape the URL
      const scrapeRes = await fetch('http://127.0.0.1:3000/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const scrapeData = await scrapeRes.json();
      if (!scrapeData.success) {
        throw new Error("Scraping failed.");
      }

      // Basic chunking of extracted text nodes
      const chunks = scrapeData.data.context.map(node => node.text).filter(text => text.trim().length > 20);

      // 2. Store in Vector DB
      const storeRes = await fetch('http://127.0.0.1:8000/api/vector/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunks: chunks,
          source: url
        })
      });

      const storeData = await storeRes.json();
      if (storeData.success) {
        setIngestStatus(prev => ({ ...prev, [url]: 'success' }));
      } else {
        throw new Error("Vector DB storage failed.");
      }
    } catch (err) {
      console.error(err);
      setIngestStatus(prev => ({ ...prev, [url]: 'error' }));
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '3rem auto', padding: '0 2rem' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <Globe size={64} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800', letterSpacing: '-0.5px' }}>Web Search API</h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Search the live web and instantly extract and ingest articles into your local Vector Database. Powered by DuckDuckGo.
        </p>
      </div>

      {isOffline ? (
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '3rem 1rem', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <WifiOff size={48} color="#cbd5e0" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: '#2d3748', fontSize: '1.3rem', marginBottom: '0.5rem' }}>Offline Mode Active</h3>
          <p style={{ color: '#718096', maxWidth: '400px', margin: '0 auto' }}>Web Search requires internet access and is disabled while offline mode is active. Turn off offline mode to use this feature.</p>
        </div>
      ) : (
      <>
        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={20} color="#a0aec0" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for anything (e.g. latest AI news)..."
                style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1.1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={(e) => e.target.style.borderColor = '#304fba'}
                onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading || !query.trim()}
              style={{ backgroundColor: '#304fba', color: 'white', border: 'none', padding: '0 2rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: loading || !query.trim() ? 'not-allowed' : 'pointer', opacity: loading || !query.trim() ? 0.7 : 1, transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {loading ? <Loader size={20} className="animate-spin" /> : <Search size={20} />}
              Search
            </button>
          </form>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fed7d7', color: '#9b2c2c', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #feb2b2' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {results.map((result, index) => (
              <div key={index} style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, paddingRight: '2rem' }}>
                    <a href={result.href} target="_blank" rel="noreferrer" style={{ fontSize: '0.9rem', color: '#4a5568', textDecoration: 'none', display: 'block', marginBottom: '0.25rem' }}>
                      {result.href}
                    </a>
                    <a href={result.href} target="_blank" rel="noreferrer" style={{ fontSize: '1.4rem', color: '#304fba', textDecoration: 'none', fontWeight: 'bold', lineHeight: '1.3' }}>
                      {result.title}
                    </a>
                  </div>
                  
                  {/* Extract & Ingest Button */}
                  <button 
                    onClick={() => handleExtractAndIngest(result.href)}
                    disabled={ingestStatus[result.href] === 'loading' || ingestStatus[result.href] === 'success'}
                    style={{ 
                      backgroundColor: ingestStatus[result.href] === 'success' ? '#c6f6d5' : '#edf2f7', 
                      color: ingestStatus[result.href] === 'success' ? '#276749' : '#2d3748', 
                      border: '1px solid',
                      borderColor: ingestStatus[result.href] === 'success' ? '#9ae6b4' : '#e2e8f0',
                      padding: '0.5rem 1rem', 
                      borderRadius: '6px', 
                      fontWeight: 'bold', 
                      cursor: ingestStatus[result.href] ? 'not-allowed' : 'pointer',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {ingestStatus[result.href] === 'loading' && <Loader size={16} className="animate-spin" />}
                    {ingestStatus[result.href] === 'success' && <CheckCircle size={16} />}
                    {!ingestStatus[result.href] && <DownloadCloud size={16} />}
                    
                    {ingestStatus[result.href] === 'loading' ? 'Extracting...' : 
                     ingestStatus[result.href] === 'success' ? 'Ingested!' : 
                     ingestStatus[result.href] === 'error' ? 'Failed' : 'Extract & Ingest'}
                  </button>
                </div>

                <p style={{ color: '#4a5568', lineHeight: '1.6', marginTop: '0.5rem' }}>
                  {result.body}
                </p>
              </div>
            ))}
          </div>
        )}
      </>
      )}

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SearchPage;
