import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function PriceHistoryChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px dashed #cbd5e0' }}>
        <p style={{ color: '#a0aec0', fontSize: '0.9rem', fontWeight: '500' }}>Waiting for telemetry data...</p>
      </div>
    );
  }

  const chartData = data.map(obs => ({
    time: new Date(obs.observed_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
          new Date(obs.observed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
    price: obs.observed_price
  })).filter(d => d.price != null);

  if (chartData.length === 0) {
    return (
      <div style={{ height: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px dashed #e53e3e', padding: '0 2rem', textAlign: 'center' }}>
        <p style={{ color: '#c53030', fontSize: '0.9rem', fontWeight: '500' }}>No valid price points available. Bot protection prevented price extraction on the latest attempt.</p>
      </div>
    );
  }

  const minPrice = Math.min(...chartData.map(d => d.price));
  const maxPrice = Math.max(...chartData.map(d => d.price));
  const padding = (maxPrice - minPrice) * 0.1 || minPrice * 0.05;

  return (
    <div style={{ height: '250px', width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#304fba" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#304fba" stopOpacity={0}/>
            </linearGradient>
          </defs>
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
            domain={[minPrice - padding, maxPrice + padding]} 
            tick={{fontSize: 11, fill: '#718096'}} 
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => val.toLocaleString()}
            width={50}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#2d3748', border: 'none', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
          />
          <Area 
            type="monotone" 
            dataKey="price" 
            stroke="#304fba" 
            strokeWidth={3} 
            fillOpacity={1} 
            fill="url(#colorPrice)" 
            activeDot={{r: 6, strokeWidth: 0, fill: '#304fba'}} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
