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
    if (severity === 'high') return { bg: '#fff5f5', text: '#9b2c2c', border: '#fed7d7', icon: <AlertTriangle size={18} color="#f56565" /> };
    if (severity === 'medium') return { bg: '#fffff0', text: '#975a16', border: '#fefcbf', icon: <Info size={18} color="#ecc94b" /> };
    return { bg: '#ebf8ff', text: '#2c5282', border: '#bee3f8', icon: <Info size={18} color="#4299e1" /> };
  };

  if (loading && alerts.length === 0) {
    return <div style={{ fontSize: '0.875rem', color: '#a0aec0', fontStyle: 'italic', padding: '1rem' }}>Loading alerts...</div>;
  }

  if (alerts.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', color: '#a0aec0', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
        <Bell size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.875rem', fontWeight: '500', margin: 0 }}>All caught up!</p>
        <p style={{ fontSize: '0.75rem', margin: 0 }}>No active price drops or scrape issues.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {alerts.map(alert => {
        const styles = getSeverityStyles(alert.severity);
        return (
          <div key={alert.id} style={{ display: 'flex', alignItems: 'flex-start', padding: '0.75rem', borderRadius: '8px', border: `1px solid ${styles.border}`, backgroundColor: styles.bg, boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <div style={{ marginRight: '0.75rem', marginTop: '0.125rem' }}>
              {styles.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: styles.text }}>
                {alert.rule_trigger_source.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#4a5568', marginTop: '0.25rem' }}>
                {alert.message}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
                {new Date(alert.created_at).toLocaleString()}
              </div>
            </div>
            <button 
              onClick={() => handleResolve(alert.id)}
              style={{ padding: '0.25rem', borderRadius: '9999px', background: 'none', border: 'none', color: '#a0aec0', cursor: 'pointer', transition: 'color 0.2s' }}
              title="Mark as Read"
              onMouseOver={(e) => e.currentTarget.style.color = '#4a5568'}
              onMouseOut={(e) => e.currentTarget.style.color = '#a0aec0'}
            >
              <CheckCircle size={18} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
