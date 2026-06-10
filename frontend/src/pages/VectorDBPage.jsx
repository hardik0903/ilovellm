import React, { useState } from 'react';
import { Database, Search, Loader, HardDrive, Zap } from 'lucide-react';

const VectorDBPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/vector/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, n_results: 5 })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Search failed');
      }
      
      setResults(data.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '4rem auto', padding: '0 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <HardDrive size={64} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800', letterSpacing: '-0.5px' }}>Vector Memory Brain</h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
          Semantic Search powered by ChromaDB. Instantly retrieve mathematically relevant chunks from your scraped and ingested data.
        </p>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', padding: '2rem' }}>
        
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} color="#a0aec0" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              value={query} 
              onChange={e => setQuery(e.target.value)}
              placeholder="Ask a semantic question (e.g. 'What are the grading criteria?')" 
              style={{ width: '100%', padding: '1rem 1rem 1rem 3rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1.1rem', outline: 'none' }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !query.trim()}
            style={{ backgroundColor: '#304fba', color: 'white', border: 'none', padding: '0 2rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loading ? <Loader className="animate-spin" /> : <><Zap size={18} /> Search Vector Space</>}
          </button>
        </form>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#fed7d7', color: '#9b2c2c', borderRadius: '6px', marginBottom: '2rem' }}>
            {error}
          </div>
        )}

        <div>
          {results.documents && results.documents[0].length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ color: '#4a5568', marginBottom: '0.5rem' }}>Top {results.documents[0].length} Semantic Matches:</h3>
              {results.documents[0].map((doc, idx) => (
                <div key={idx} style={{ padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8f9fa', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: '-12px', right: '1.5rem', backgroundColor: '#ebf8ff', color: '#2b6cb0', padding: '0.2rem 0.8rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', border: '1px solid #bee3f8' }}>
                    Distance Score: {results.distances[0][idx].toFixed(4)}
                  </span>
                  <div style={{ color: '#718096', fontSize: '0.85rem', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Source: {results.metadatas[0][idx].source}
                  </div>
                  <p style={{ margin: 0, color: '#2d3748', lineHeight: '1.6' }}>{doc}</p>
                </div>
              ))}
            </div>
          ) : (
            !loading && results.documents && <p style={{ color: '#a0aec0', textAlign: 'center', padding: '2rem 0' }}>No relevant data found in the Vector Database.</p>
          )}
        </div>

      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default VectorDBPage;
