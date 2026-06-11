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
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Link size={24} className="text-blue-600" />
        Track New Asset
      </h3>
      
      <form onSubmit={handleSubmit} className="flex gap-4 flex-wrap">
        <input 
          type="url" 
          placeholder="Paste Amazon, Flipkart, or Myntra URL here..." 
          className="flex-1 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
          required
        />
        
        <button 
          type="submit" 
          disabled={loading || !url}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-white transition-colors ${
            (loading || !url) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? <Loader size={20} className="animate-spin" /> : <Plus size={20} />}
          {loading ? 'Initializing...' : 'Deploy Tracker'}
        </button>
      </form>
    </div>
  );
}
