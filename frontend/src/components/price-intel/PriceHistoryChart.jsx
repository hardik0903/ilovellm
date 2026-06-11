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
      <div className="h-[250px] flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <p className="text-gray-500 text-sm font-medium">Waiting for telemetry data...</p>
      </div>
    );
  }

  const padding = (maxPrice - minPrice) * 0.1 || minPrice * 0.05;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-gray-800 text-white p-3 rounded shadow-lg text-sm border-none">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="flex justify-between gap-4 mb-1" style={{ color: entry.color }}>
              <span className="capitalize">{entry.name}:</span>
              <span className="font-bold">₹{entry.value.toLocaleString()}</span>
            </div>
          ))}
          {viewMode === 'compare' && dataPoint._trigger_source && (
            <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-300">
              <div className="capitalize text-gray-400">Latest Event ({dataPoint._trigger_source})</div>
              <div>Seller: {dataPoint._seller || 'Unknown'}</div>
              <div>Stock: {dataPoint._stock ? dataPoint._stock.replace('_', ' ') : 'Unknown'}</div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Controls Bar */}
      <div className="flex justify-between items-center bg-white p-2 rounded-lg border shadow-sm">
        <div className="flex bg-gray-100 p-1 rounded-md">
          <button 
            className={`px-3 py-1 text-xs font-semibold rounded ${viewMode === 'aggregate' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
            onClick={() => setViewMode('aggregate')}
          >
            Canonical Trend
          </button>
          <button 
            className={`px-3 py-1 text-xs font-semibold rounded ${viewMode === 'compare' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}
            onClick={() => setViewMode('compare')}
          >
            Compare Marketplaces
          </button>
        </div>
        
        {viewMode === 'compare' && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Filter size={14} />
            <select 
              className="bg-transparent border-none outline-none cursor-pointer font-medium"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
            >
              <option value="all">All Sources</option>
              {sources.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="h-[250px] w-full">
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
