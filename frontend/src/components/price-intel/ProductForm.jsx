import React, { useState } from 'react';
import { priceIntelApi } from '../../services/priceIntelApi';
import { Plus, Search, Loader } from 'lucide-react';

export function ProductForm({ onProductAdded }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !url) return;
    setLoading(true);
    try {
      const product = await priceIntelApi.createProduct({ name });
      await priceIntelApi.trackSource(product.id, url);
      onProductAdded();
      setName('');
      setUrl('');
    } catch (err) {
      console.error(err);
      alert("Failed to add product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
      <h3 style={{ fontSize: '1.25rem', color: '#2d3748', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Search size={20} color="#304fba" />
        Track New Asset
      </h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Product Name (e.g. MacBook Pro M3)" 
          style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '1rem', outline: 'none' }}
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={loading}
        />
        
        <input 
          type="url" 
          placeholder="Target URL (Amazon/Flipkart...)" 
          style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '1rem', outline: 'none' }}
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
        />
        
        <button 
          type="submit" 
          disabled={loading || !name || !url}
          style={{ 
            backgroundColor: (loading || !name || !url) ? '#a0aec0' : '#304fba', 
            color: 'white', 
            padding: '0 2rem', 
            borderRadius: '8px', 
            fontWeight: 'bold', 
            border: 'none', 
            cursor: (loading || !name || !url) ? 'not-allowed' : 'pointer', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            transition: 'background-color 0.2s'
          }}
        >
          {loading ? <Loader size={20} className="animate-spin" /> : <Plus size={20} />}
          {loading ? 'Initializing...' : 'Deploy Tracker'}
        </button>
      </form>
    </div>
  );
}
