import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Dashboard from './pages/Dashboard';
import ScraperPage from './pages/ScraperPage';
import IngestionPage from './pages/IngestionPage';
import NLPPage from './pages/NLPPage';
import VectorDBPage from './pages/VectorDBPage';
import FinetuneStudio from './pages/FinetuneStudio';
import SystemHealth from './pages/SystemHealth';
import SearchPage from './pages/SearchPage';
import SDKPage from './pages/SDKPage';
import OfflinePage from './pages/OfflinePage';

// Automated Apps
import ResearchAssistant from './pages/apps/ResearchAssistant';
import { PriceIntelligence } from './pages/apps/PriceIntelligence';
import { JobMarket, LegalAnalyzer, NewsAggregator, CustomerReview, GovernmentMonitor } from './pages/apps/Placeholders';

function App() {
  return (
    <Router>
      <div className="App" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        <div style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/scrape" element={<ScraperPage />} />
            <Route path="/ingest" element={<IngestionPage />} />
            <Route path="/nlp" element={<NLPPage />} />
            <Route path="/vectordb" element={<VectorDBPage />} />
            <Route path="/finetune" element={<FinetuneStudio />} />
            <Route path="/health" element={<SystemHealth />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/sdk" element={<SDKPage />} />
            <Route path="/offline" element={<OfflinePage />} />
            
            {/* Automated Apps */}
            <Route path="/app/research" element={<ResearchAssistant />} />
            <Route path="/app/ecommerce" element={<PriceIntelligence />} />
            <Route path="/app/jobs" element={<JobMarket />} />
            <Route path="/app/legal" element={<LegalAnalyzer />} />
            <Route path="/app/news" element={<NewsAggregator />} />
            <Route path="/app/reviews" element={<CustomerReview />} />
            <Route path="/app/gov" element={<GovernmentMonitor />} />
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
