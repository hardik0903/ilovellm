import React, { useState, useEffect } from 'react';
import { priceIntelApi } from '../../services/priceIntelApi';
import { Bell, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

export function AlertFeed() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const data = await priceIntelApi.getAlerts();
      setAlerts(data);
    } catch (e) {
      console.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (id) => {
    try {
      await priceIntelApi.resolveAlerts([id]);
      setAlerts(alerts.filter(a => a.id !== id));
    } catch (e) {
      console.error("Failed to resolve alert");
    }
  };

  const getSeverityStyles = (severity) => {
    if (severity === 'high') return { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', icon: <AlertTriangle size={18} className="text-red-500" /> };
    if (severity === 'medium') return { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200', icon: <Info size={18} className="text-yellow-500" /> };
    return { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', icon: <Info size={18} className="text-blue-500" /> };
  };

  if (loading && alerts.length === 0) {
    return <div className="text-sm text-gray-500 italic p-4">Loading alerts...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <Bell size={24} className="mb-2 opacity-50" />
        <p className="text-sm font-medium">All caught up!</p>
        <p className="text-xs">No active price drops or scrape issues.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map(alert => {
        const styles = getSeverityStyles(alert.severity);
        return (
          <div key={alert.id} className={`flex items-start p-3 rounded-lg border shadow-sm ${styles.bg} ${styles.border}`}>
            <div className="mr-3 mt-0.5">
              {styles.icon}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-semibold ${styles.text}`}>
                {alert.rule_trigger_source.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div className="text-sm text-gray-700 mt-1">
                {alert.message}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {new Date(alert.created_at).toLocaleString()}
              </div>
            </div>
            <button 
              onClick={() => handleResolve(alert.id)}
              className="p-1 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-700 transition-colors"
              title="Mark as Read"
            >
              <CheckCircle size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
