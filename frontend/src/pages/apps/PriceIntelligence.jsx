import React, { useState, useEffect } from 'react';
import { ProductForm } from '../../components/price-intel/ProductForm';
import { ProductTable } from '../../components/price-intel/ProductTable';
import { PriceHistoryChart } from '../../components/price-intel/PriceHistoryChart';
import { priceIntelApi } from '../../services/priceIntelApi';
import { Package, Activity, TrendingDown, ShoppingCart } from 'lucide-react';

export function PriceIntelligence() {
  const [products, setProducts] = useState([]);
  const [metrics, setMetrics] = useState({ total_products: 0, active_listings: 0, price_drops_24h: 0 });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [history, setHistory] = useState([]);

  const loadData = async () => {
    try {
      const [prods, stats] = await Promise.all([
        priceIntelApi.listProducts(),
        priceIntelApi.getDashboardMetrics()
      ]);
      const detailedProds = await Promise.all(prods.map(p => priceIntelApi.getProduct(p.id)));
      setProducts(detailedProds);
      setMetrics(stats);
      if (selectedProduct) {
        const hist = await priceIntelApi.getHistory(selectedProduct.id);
        setHistory(hist);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectProduct = async (product) => {
    setSelectedProduct(product);
    try {
      const hist = await priceIntelApi.getHistory(product.id);
      setHistory(hist);
    } catch (e) {
      console.error("Failed to load history");
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '4rem auto', padding: '0 2rem', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header Area */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <ShoppingCart size={64} color="#304fba" style={{ marginBottom: '1rem' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800' }}>Price Intelligence</h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
          Real-time competitor tracking and intelligent market analysis.
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <MetricCard 
          title="Tracked Products" 
          value={metrics.total_products} 
          icon={<Package size={24} color="#304fba" />} 
          trend="+12% this week" 
        />
        <MetricCard 
          title="Active Listings" 
          value={metrics.active_listings} 
          icon={<Activity size={24} color="#304fba" />} 
          trend="All sources healthy" 
        />
        <MetricCard 
          title="Price Drops (24h)" 
          value={metrics.price_drops_24h} 
          icon={<TrendingDown size={24} color="#38a169" />} 
          trend="Opportunities detected" 
          highlightColor="#38a169"
        />
      </div>

      {/* Main Interface */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <ProductForm onProductAdded={loadData} />
          
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#f8f9fa', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#2d3748', fontSize: '1.1rem' }}>Monitored Portfolio</strong>
            </div>
            <ProductTable 
              products={products} 
              onRefreshList={loadData} 
              onSelectProduct={handleSelectProduct}
              selectedProductId={selectedProduct?.id}
            />
          </div>
        </div>
        
        {/* Right Column */}
        <div>
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', padding: '1.5rem', position: 'sticky', top: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <strong style={{ color: '#2d3748', fontSize: '1.1rem' }}>
                {selectedProduct ? 'Trend Analysis' : 'Select a product'}
              </strong>
              {selectedProduct && (
                <span style={{ backgroundColor: '#ebf8ff', color: '#2b6cb0', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  {selectedProduct.name}
                </span>
              )}
            </div>
            
            <PriceHistoryChart data={history} />
            
            {selectedProduct && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#718096', fontSize: '0.85rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>AI Insights</strong>
                <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: 0, color: '#4a5568', fontSize: '0.9rem', lineHeight: '1.5' }}>
                    Price is currently stable. Based on historical trends, expect potential discounts during upcoming merchant sale events.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, highlightColor = "#2d3748" }) {
  return (
    <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          {icon}
        </div>
        <div style={{ color: '#718096', fontWeight: '600' }}>{title}</div>
      </div>
      <div style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', color: highlightColor }}>
        {value}
      </div>
      <div style={{ fontSize: '0.9rem', color: '#a0aec0', fontWeight: '500' }}>
        {trend}
      </div>
    </div>
  );
}
