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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white text-gray-800 p-8 font-sans">
      <div className="max-w-[1400px] mx-auto">
      
        {/* Header Area */}
        <div className="flex items-center gap-4 mb-8 border-b pb-6">
          <div className="p-4 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
            <ShoppingCart size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
              E-Commerce Price Intelligence
            </h1>
            <p className="text-gray-500 mt-2 font-medium">
              Real-time competitor tracking • Entity resolution • Autonomous anomaly detection
            </p>
          </div>
        </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <MetricCard 
          title="Tracked Products" 
          value={metrics.total_products} 
          icon={<Package size={24} className="text-blue-600" />} 
          trend="Entities matched" 
        />
        <MetricCard 
          title="Active Listings" 
          value={metrics.active_listings} 
          icon={<Activity size={24} className="text-blue-600" />} 
          trend="Scraping across sources" 
        />
        <MetricCard 
          title="Price Drops (24h)" 
          value={metrics.price_drops_24h} 
          icon={<TrendingDown size={24} className="text-green-600" />} 
          trend="Opportunities detected" 
          highlightColor="text-green-600"
        />
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column (Main Content) */}
        <div className="xl:col-span-8 flex flex-col gap-8">
          <ProductForm onProductAdded={loadData} />
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <strong className="text-gray-800 text-lg">Monitored Portfolio</strong>
            </div>
            <ProductTable 
              products={products} 
              onRefreshList={loadData} 
              onSelectProduct={handleSelectProduct}
              selectedProductId={selectedProduct?.id}
            />
          </div>

          {selectedProduct && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <strong className="text-gray-800 text-lg">Trend Analysis</strong>
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                  {selectedProduct.name}
                </span>
              </div>
              <PriceHistoryChart data={history} />
            </div>
          )}
        </div>
        
        {/* Right Column (Sidebar) */}
        <div className="xl:col-span-4 flex flex-col gap-8">
          
          {/* Alert Feed Widget */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-8">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <Bell size={20} className="text-gray-600" />
              <strong className="text-gray-800 text-lg">Live Alerts</strong>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              <AlertFeed />
            </div>
          </div>

          {/* Rule Configuration Panel */}
          {selectedProduct && (
            <AlertRuleForm 
              productId={selectedProduct.id} 
              onRuleAdded={() => {}} 
            />
          )}
          
        </div>
        
      </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, trend, highlightColor = "text-gray-900" }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm transition-transform hover:-translate-y-1 duration-200">
      <div className="flex items-center gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          {icon}
        </div>
        <div className="text-gray-500 font-semibold">{title}</div>
      </div>
      <div className={`text-4xl font-extrabold mb-2 ${highlightColor}`}>
        {value}
      </div>
      <div className="text-sm text-gray-400 font-medium">
        {trend}
      </div>
    </div>
  );
}
