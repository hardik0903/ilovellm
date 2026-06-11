import React, { useState, useEffect } from 'react';
import { priceIntelApi } from '../../services/priceIntelApi';

export function AlertRuleForm({ productId, onRuleAdded }) {
  const [rules, setRules] = useState([]);
  const [ruleType, setRuleType] = useState('price_drop');
  const [thresholdPercent, setThresholdPercent] = useState('');
  const [thresholdValue, setThresholdValue] = useState('');
  const [consecutiveCount, setConsecutiveCount] = useState(3);
  const [loading, setLoading] = useState(false);

  const loadRules = async () => {
    try {
      const data = await priceIntelApi.getRules(productId);
      setRules(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadRules();
  }, [productId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await priceIntelApi.createRule({
        product_id: productId,
        rule_scope: 'product_specific',
        rule_type: ruleType,
        threshold_percent: thresholdPercent ? parseFloat(thresholdPercent) : null,
        threshold_value: thresholdValue ? parseFloat(thresholdValue) : null,
        consecutive_count: consecutiveCount
      });
      setThresholdPercent('');
      setThresholdValue('');
      await loadRules();
      if (onRuleAdded) onRuleAdded();
    } catch (e) {
      alert("Failed to save rule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Active Rules</h3>
      
      {rules.length > 0 ? (
        <ul className="mb-6 space-y-2">
          {rules.map(r => (
            <li key={r.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded border border-gray-100">
              <span className="font-medium text-gray-700 uppercase">{r.rule_type.replace('_', ' ')}</span>
              <span className="text-gray-500">
                {r.threshold_percent ? `>${r.threshold_percent}% ` : ''}
                {r.threshold_value ? `>₹${r.threshold_value} ` : ''}
                {r.consecutive_count > 1 ? `(${r.consecutive_count}x) ` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 italic mb-4">No specific rules set for this product.</p>
      )}

      <h4 className="text-sm font-bold text-gray-700 mb-3 border-t pt-4">Add New Rule</h4>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <select 
          className="p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={ruleType} 
          onChange={e => setRuleType(e.target.value)}
        >
          <option value="price_drop">Price Drop</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="scrape_failed">Scrape Failed</option>
        </select>
        
        {ruleType === 'price_drop' && (
          <div className="flex gap-2">
            <input 
              type="number" 
              placeholder="% Drop (e.g. 15)" 
              className="p-2 border rounded text-sm w-1/2"
              value={thresholdPercent}
              onChange={e => setThresholdPercent(e.target.value)}
            />
            <input 
              type="number" 
              placeholder="Absolute ₹ (e.g. 500)" 
              className="p-2 border rounded text-sm w-1/2"
              value={thresholdValue}
              onChange={e => setThresholdValue(e.target.value)}
            />
          </div>
        )}

        {ruleType === 'scrape_failed' && (
          <input 
            type="number" 
            placeholder="Consecutive Fails (e.g. 3)" 
            className="p-2 border rounded text-sm"
            value={consecutiveCount}
            onChange={e => setConsecutiveCount(parseInt(e.target.value))}
          />
        )}

        <button 
          type="submit" 
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded text-sm transition-colors mt-2"
        >
          {loading ? 'Saving...' : '+ Add Rule'}
        </button>
      </form>
    </div>
  );
}
