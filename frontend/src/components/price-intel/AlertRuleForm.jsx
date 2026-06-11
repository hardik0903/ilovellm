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
    <div style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#2d3748', marginBottom: '1rem' }}>Active Rules</h3>
      
      {rules.length > 0 ? (
        <ul style={{ marginBottom: '1.5rem', listStyleType: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rules.map(r => (
            <li key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', padding: '0.5rem', backgroundColor: '#f8f9fa', borderRadius: '4px', border: '1px solid #f7fafc' }}>
              <span style={{ fontWeight: '500', color: '#4a5568', textTransform: 'uppercase' }}>{r.rule_type.replace('_', ' ')}</span>
              <span style={{ color: '#a0aec0' }}>
                {r.threshold_percent ? `>${r.threshold_percent}% ` : ''}
                {r.threshold_value ? `>₹${r.threshold_value} ` : ''}
                {r.consecutive_count > 1 ? `(${r.consecutive_count}x) ` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: '0.875rem', color: '#a0aec0', fontStyle: 'italic', marginBottom: '1rem' }}>No specific rules set for this product.</p>
      )}

      <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#4a5568', marginBottom: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>Add New Rule</h4>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <select 
          style={{ padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.875rem', outline: 'none' }}
          value={ruleType} 
          onChange={e => setRuleType(e.target.value)}
        >
          <option value="price_drop">Price Drop</option>
          <option value="out_of_stock">Out of Stock</option>
          <option value="scrape_failed">Scrape Failed</option>
        </select>
        
        {ruleType === 'price_drop' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="number" 
              placeholder="% Drop (e.g. 15)" 
              style={{ padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.875rem', width: '50%', outline: 'none' }}
              value={thresholdPercent}
              onChange={e => setThresholdPercent(e.target.value)}
            />
            <input 
              type="number" 
              placeholder="Absolute ₹ (e.g. 500)" 
              style={{ padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.875rem', width: '50%', outline: 'none' }}
              value={thresholdValue}
              onChange={e => setThresholdValue(e.target.value)}
            />
          </div>
        )}

        {ruleType === 'scrape_failed' && (
          <input 
            type="number" 
            placeholder="Consecutive Fails (e.g. 3)" 
            style={{ padding: '0.5rem', border: '1px solid #cbd5e0', borderRadius: '4px', fontSize: '0.875rem', outline: 'none' }}
            value={consecutiveCount}
            onChange={e => setConsecutiveCount(parseInt(e.target.value))}
          />
        )}

        <button 
          type="submit" 
          disabled={loading}
          style={{ backgroundColor: '#3182ce', color: 'white', fontWeight: '600', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.875rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}
        >
          {loading ? 'Saving...' : '+ Add Rule'}
        </button>
      </form>
    </div>
  );
}
