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
          </Routes>
        </div>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
