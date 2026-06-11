import React, { useState, useEffect } from 'react';
import { ProductForm } from '../../components/price-intel/ProductForm';
import { ProductTable } from '../../components/price-intel/ProductTable';
import { PriceHistoryChart } from '../../components/price-intel/PriceHistoryChart';
import { AlertFeed } from '../../components/price-intel/AlertFeed';
import { AlertRuleForm } from '../../components/price-intel/AlertRuleForm';
import { priceIntelApi } from '../../services/priceIntelApi';
import { Package, Activity, TrendingDown, ShoppingCart, Bell } from 'lucide-react';

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
        <ShoppingCart size={64} color="#304fba" style={{ marginBottom: '1rem', display: 'inline-block' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800', letterSpacing: '-0.5px' }}>
          Price Intelligence
        </h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
          Real-time competitor tracking, entity resolution, and autonomous anomaly detection.
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <MetricCard 
          title="Tracked Products" 
          value={metrics.total_products} 
          icon={<Package size={24} color="#304fba" />} 
          trend="Entities matched" 
        />
        <MetricCard 
          title="Active Listings" 
          value={metrics.active_listings} 
          icon={<Activity size={24} color="#304fba" />} 
          trend="Scraping across sources" 
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
        
        {/* Left Column (Main Content) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <ProductForm onProductAdded={loadData} />
          
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ backgroundColor: '#f8f9fa', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#2d3748', fontSize: '1.1rem' }}>Monitored Portfolio</strong>
            </div>
            <ProductTable 
              products={products} 
              onRefreshList={loadData} 
              onSelectProduct={handleSelectProduct}
              selectedProductId={selectedProduct?.id}
            />
          </div>

          {selectedProduct && (
            <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <strong style={{ color: '#2d3748', fontSize: '1.1rem' }}>Trend Analysis</strong>
                <span style={{ backgroundColor: '#ebf8ff', color: '#2b6cb0', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  {selectedProduct.name}
                </span>
              </div>
              <PriceHistoryChart data={history} />
            </div>
          )}
        </div>
        
        {/* Right Column (Sidebar) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Alert Feed Widget */}
          <div style={{ backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', overflow: 'hidden', position: 'sticky', top: '2rem' }}>
            <div style={{ backgroundColor: '#f8f9fa', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} color="#718096" />
              <strong style={{ color: '#2d3748', fontSize: '1.1rem' }}>Live Alerts</strong>
            </div>
            <div style={{ padding: '1rem', maxHeight: '400px', overflowY: 'auto' }}>
              <AlertFeed />
            </div>
          </div>

          {/* Rule Configuration Panel */}
          {selectedProduct && (
            <div style={{ marginTop: '1rem' }}>
              <AlertRuleForm 
                productId={selectedProduct.id} 
                onRuleAdded={() => {}} 
              />
            </div>
          )}
          
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
