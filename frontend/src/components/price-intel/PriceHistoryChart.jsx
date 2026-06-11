import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Filter } from 'lucide-react';

const COLORS = ['#304fba', '#e53e3e', '#38a169', '#d69e2e', '#805ad5'];

export function PriceHistoryChart({ data }) {
  const [viewMode, setViewMode] = useState('aggregate'); // 'aggregate' | 'compare'
  const [selectedSource, setSelectedSource] = useState('all');

  const { chartData, sources, minPrice, maxPrice } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], sources: [], minPrice: 0, maxPrice: 0 };

    const srcSet = new Set(data.map(d => d.source_name));
    const allSources = Array.from(srcSet);

    let lastPrices = {};
    let minP = Infinity;
    let maxP = -Infinity;

    const formattedData = data.map(obs => {
      lastPrices[obs.source_name] = obs.observed_price;
      
      const prices = Object.values(lastPrices);
      const aggPrice = Math.min(...prices);
      
      minP = Math.min(minP, aggPrice, obs.observed_price);
      maxP = Math.max(maxP, aggPrice, obs.observed_price);

      return {
        time: new Date(obs.observed_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
              new Date(obs.observed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        aggregate: aggPrice,
        ...lastPrices,
        
        // Metadata for tooltip
        _trigger_source: obs.source_name,
        _seller: obs.seller_name,
        _stock: obs.stock_status,
      };
    });

    return { chartData: formattedData, sources: allSources, minPrice: minP, maxPrice: maxP };
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px dashed #cbd5e0' }}>
        <p style={{ color: '#a0aec0', fontSize: '0.875rem', fontWeight: '500' }}>Waiting for telemetry data...</p>
      </div>
    );
  }

  const padding = (maxPrice - minPrice) * 0.1 || minPrice * 0.05;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div style={{ backgroundColor: '#2d3748', color: 'white', padding: '0.75rem', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '0.875rem', border: 'none' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '0.5rem', margin: 0 }}>{label}</p>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.25rem', color: entry.color }}>
              <span style={{ textTransform: 'capitalize' }}>{entry.name}:</span>
              <span style={{ fontWeight: 'bold' }}>₹{entry.value.toLocaleString()}</span>
            </div>
          ))}
          {viewMode === 'compare' && dataPoint._trigger_source && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #4a5568', fontSize: '0.75rem', color: '#e2e8f0' }}>
              <div style={{ textTransform: 'capitalize', color: '#a0aec0', marginBottom: '0.25rem' }}>Latest Event ({dataPoint._trigger_source})</div>
              <div style={{ marginBottom: '0.125rem' }}>Seller: {dataPoint._seller || 'Unknown'}</div>
              <div>Stock: {dataPoint._stock ? dataPoint._stock.replace('_', ' ') : 'Unknown'}</div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
        <div style={{ display: 'flex', backgroundColor: '#f8f9fa', padding: '0.25rem', borderRadius: '6px' }}>
          <button 
            style={{ 
              padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: '600', borderRadius: '4px', border: 'none', cursor: 'pointer',
              backgroundColor: viewMode === 'aggregate' ? '#fff' : 'transparent', 
              color: viewMode === 'aggregate' ? '#2b6cb0' : '#718096', 
              boxShadow: viewMode === 'aggregate' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none' 
            }}
            onClick={() => setViewMode('aggregate')}
          >
            Canonical Trend
          </button>
          <button 
            style={{ 
              padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: '600', borderRadius: '4px', border: 'none', cursor: 'pointer',
              backgroundColor: viewMode === 'compare' ? '#fff' : 'transparent', 
              color: viewMode === 'compare' ? '#2b6cb0' : '#718096', 
              boxShadow: viewMode === 'compare' ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none' 
            }}
            onClick={() => setViewMode('compare')}
          >
            Compare Marketplaces
          </button>
        </div>
        
        {viewMode === 'compare' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#718096' }}>
            <Filter size={14} />
            <select 
              style={{ backgroundColor: 'transparent', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: '500', color: '#4a5568' }}
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
        )}
      </div>

      <div style={{ height: '250px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis 
              dataKey="time" 
              tick={{fontSize: 11, fill: '#718096'}} 
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={30}
            />
            <YAxis 
              domain={[Math.max(0, minPrice - padding), maxPrice + padding]} 
              tick={{fontSize: 11, fill: '#718096'}} 
              axisLine={false}
              tickLine={false}
              tickFormatter={(val) => val.toLocaleString()}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            {viewMode === 'compare' && <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />}
            
            {viewMode === 'aggregate' ? (
              <Line 
                type="stepAfter" 
                dataKey="aggregate" 
                name="Lowest Price"
                stroke="#304fba" 
                strokeWidth={3} 
                dot={false}
                activeDot={{r: 6, fill: '#304fba'}} 
              />
            ) : (
              sources.filter(s => selectedSource === 'all' || selectedSource === s).map((source, idx) => (
                <Line 
                  key={source}
                  type="stepAfter" 
                  dataKey={source} 
                  name={source}
                  stroke={COLORS[idx % COLORS.length]} 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{r: 5}} 
                  connectNulls={true}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
