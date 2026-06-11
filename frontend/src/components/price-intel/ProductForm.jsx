import React, { useState } from 'react';
import { priceIntelApi } from '../../services/priceIntelApi';
import { Plus, Link, Loader } from 'lucide-react';

export function ProductForm({ onProductAdded }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      await priceIntelApi.createProduct(url);
      onProductAdded();
      setUrl('');
    } catch (err) {
      console.error(err);
      alert("Failed to track product. Ensure the URL is valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
      <h3 style={{ fontSize: '1.25rem', color: '#2d3748', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Link size={24} color="#304fba" />
        Track New Asset
      </h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <input 
          type="url" 
          placeholder="Paste Amazon, Flipkart, or Myntra URL here..." 
          style={{ flex: 1, padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e0', fontSize: '1rem', outline: 'none' }}
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
          required
        />
        
        <button 
          type="submit" 
          disabled={loading || !url}
          style={{ 
            backgroundColor: (loading || !url) ? '#a0aec0' : '#304fba', 
            color: 'white', 
            padding: '0 2rem', 
            borderRadius: '8px', 
            fontWeight: 'bold', 
            border: 'none', 
            cursor: (loading || !url) ? 'not-allowed' : 'pointer', 
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
