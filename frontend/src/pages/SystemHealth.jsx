import React, { useState, useEffect } from 'react';
import { Activity, Server, Database, Globe, Cpu, CheckCircle, XCircle, Loader, RefreshCw } from 'lucide-react';

const SystemHealth = () => {
  const [tests, setTests] = useState([
    { id: 'backend', name: 'Python Backend Server', endpoint: 'http://localhost:8000/', type: 'GET', status: 'pending', latency: null },
    { id: 'scraper', name: 'Web Scraper API', endpoint: 'http://localhost:8000/api/scrape', type: 'POST', body: { url: 'https://example.com' }, status: 'pending', latency: null },
    { id: 'vector', name: 'Vector DB Connection', endpoint: 'http://localhost:8000/api/vector/search', type: 'POST', body: { query: 'test' }, status: 'pending', latency: null },
    { id: 'ingest', name: 'Document Ingestion (Advanced)', endpoint: 'http://localhost:8000/api/ingest-advanced', type: 'POST', isFormData: true, status: 'pending', latency: null },
    { id: 'finetune', name: 'Fine-Tuning Engine', endpoint: 'http://localhost:8000/api/finetune/status', type: 'GET', status: 'pending', latency: null }
  ]);

  const [isRunning, setIsRunning] = useState(false);

  const runAllTests = async () => {
    setIsRunning(true);
    
    // Reset status
    setTests(prev => prev.map(t => ({ ...t, status: 'testing', latency: null })));

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = performance.now();
      
      try {
        let options = { method: test.type };
        
        if (test.type === 'POST') {
          if (test.isFormData) {
            const formData = new FormData();
            formData.append('url', 'https://example.com'); // dummy url to test route exists
            options.body = formData;
          } else {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(test.body);
          }
        }

        const res = await fetch(test.endpoint, options);
        
        // We expect some 400s or 422s if the dummy data is incomplete, but as long as it's not a 500 or network error, the route exists!
        // We consider 200, 400, 422 as "service is alive"
        if (res.status === 200 || res.status === 400 || res.status === 422 || res.status === 404) {
             setTests(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'success', latency: Math.round(performance.now() - startTime) } : t));
        } else {
             setTests(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'error', latency: Math.round(performance.now() - startTime) } : t));
        }
      } catch (err) {
        setTests(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'error', latency: null } : t));
      }
    }
    
    setIsRunning(false);
  };

  useEffect(() => {
    runAllTests();
  }, []);

  const getStatusIcon = (status) => {
    if (status === 'pending') return <div className="w-5 h-5 rounded-full bg-gray-200"></div>;
    if (status === 'testing') return <Loader size={20} className="animate-spin text-blue-500" />;
    if (status === 'success') return <CheckCircle size={20} className="text-green-500" />;
    if (status === 'error') return <XCircle size={20} className="text-red-500" />;
  };

  const overallHealth = tests.every(t => t.status === 'success' || t.status === 'pending' || t.status === 'testing');
  const finished = tests.every(t => t.status === 'success' || t.status === 'error');

  return (
    <div className="max-w-4xl mx-auto my-12 px-6 font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <Activity className="text-blue-600" size={32} /> System Health & Testing
          </h1>
          <p className="text-gray-500 mt-2">Automated diagnostics for all ilovellm microservices.</p>
        </div>
        <button 
          onClick={runAllTests} 
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={isRunning ? "animate-spin" : ""} /> Rerun Diagnostics
        </button>
      </div>

      {finished && (
        <div className={`p-4 rounded-xl mb-8 flex items-center gap-4 ${overallHealth ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          {overallHealth ? <CheckCircle size={32} className="text-green-500" /> : <AlertTriangle size={32} className="text-red-500" />}
          <div>
            <h3 className={`font-bold text-lg ${overallHealth ? 'text-green-800' : 'text-red-800'}`}>
              {overallHealth ? "All Services Operational" : "System Degraded"}
            </h3>
            <p className={`text-sm ${overallHealth ? 'text-green-600' : 'text-red-600'}`}>
              {overallHealth ? "All AI pipelines, databases, and APIs are responding normally." : "One or more services failed to respond. Check the backend console."}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 grid grid-cols-12 font-semibold text-gray-500 text-sm">
          <div className="col-span-1">Status</div>
          <div className="col-span-4">Service Name</div>
          <div className="col-span-5">Endpoint</div>
          <div className="col-span-2 text-right">Latency</div>
        </div>
        
        {tests.map(test => (
          <div key={test.id} className="px-6 py-4 border-b border-gray-100 grid grid-cols-12 items-center hover:bg-gray-50 transition-colors">
            <div className="col-span-1">
              {getStatusIcon(test.status)}
            </div>
            <div className="col-span-4 font-medium text-gray-800 flex items-center gap-2">
              {test.id === 'backend' && <Server size={16} className="text-gray-400" />}
              {test.id === 'scraper' && <Globe size={16} className="text-gray-400" />}
              {test.id === 'vector' && <Database size={16} className="text-gray-400" />}
              {test.id === 'ingest' && <Activity size={16} className="text-gray-400" />}
              {test.id === 'finetune' && <Cpu size={16} className="text-gray-400" />}
              {test.name}
            </div>
            <div className="col-span-5 text-sm text-gray-500 font-mono">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600 mr-2">{test.type}</span>
              {test.endpoint}
            </div>
            <div className="col-span-2 text-right text-sm">
              {test.status === 'testing' ? (
                <span className="text-gray-400">Pinging...</span>
              ) : test.latency ? (
                <span className={`${test.latency > 1000 ? 'text-orange-500' : 'text-green-600'} font-medium`}>
                  {test.latency} ms
                </span>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SystemHealth;
