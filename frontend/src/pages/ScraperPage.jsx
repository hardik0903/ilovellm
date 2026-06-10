import React, { useState, useEffect } from 'react';
import { Globe, ArrowRight, Loader, AlertTriangle, Image as ImageIcon, FileText, Link as LinkIcon, Info, WifiOff, Clock, Shield, Zap } from 'lucide-react';

const ScraperPage = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [activeViewTab, setActiveViewTab] = useState('overview');
  const [isOffline, setIsOffline] = useState(() => localStorage.getItem('ilovellm_offline_mode') === 'true');
  const [activeServiceTab, setActiveServiceTab] = useState('static');

  // Service States
  const [url, setUrl] = useState('');
  const [cookiesJson, setCookiesJson] = useState('');
  const [cronSchedule, setCronSchedule] = useState('');
  const [scheduleSuccess, setScheduleSuccess] = useState('');
  const [ignoreRobots, setIgnoreRobots] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);

  useEffect(() => {
    const handler = (e) => setIsOffline(e.detail);
    window.addEventListener('offlineModeChanged', handler);
    return () => window.removeEventListener('offlineModeChanged', handler);
  }, []);

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError('');
    setResult(null);
    setScheduleSuccess('');
    setActiveViewTab('overview');

    try {
      let endpoint = 'http://localhost:8000/api/scrape/static';
      let payload = { url, ignore_robots: ignoreRobots };

      if (activeServiceTab === 'dynamic') {
        endpoint = 'http://localhost:8000/api/scrape/dynamic';
      } else if (activeServiceTab === 'authenticated') {
        endpoint = 'http://localhost:8000/api/scrape/authenticated';
        try {
          payload.cookies = JSON.parse(cookiesJson);
        } catch (err) {
          throw new Error('Invalid Cookies JSON format');
        }
      } else if (activeServiceTab === 'schedule') {
        endpoint = 'http://localhost:8000/api/scrape/schedule';
        payload.cron = cronSchedule;
        payload.mode = 'static'; // Default scheduled mode
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.error || 'Request failed');
      }

      if (activeServiceTab === 'schedule') {
        setScheduleSuccess(`Job scheduled successfully! Job ID: ${data.job_id}. Next run: ${data.next_run_time}`);
      } else {
        if (!data.success) throw new Error(data.error || 'Failed to scrape URL');
        setResult(data.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMedia = async () => {
    if (!result || (!result.images?.length && !result.videos?.length)) return;
    
    setDownloadingMedia(true);
    try {
      const urls = [
        ...(result.images || []).map(i => i.src),
        ...(result.videos || []).map(v => v.src)
      ].filter(url => url);
      
      const response = await fetch('http://localhost:8000/api/scrape/download-media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls }),
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scraped_media.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download media');
    } finally {
      setDownloadingMedia(false);
    }
  };

  const renderViewTabButton = (id, label, Icon) => (
    <button
      onClick={() => setActiveViewTab(id)}
      style={{
        padding: '0.75rem 1.5rem',
        border: 'none',
        background: 'none',
        borderBottom: activeViewTab === id ? '2px solid #304fba' : '2px solid transparent',
        color: activeViewTab === id ? '#304fba' : '#718096',
        fontWeight: activeViewTab === id ? '700' : '500',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '1rem',
        transition: 'all 0.2s'
      }}
      type="button"
    >
      <Icon size={18} /> {label}
    </button>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '4rem auto', padding: '0 2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <Globe size={64} color="#304fba" style={{ marginBottom: '1rem', display: 'inline-block' }} />
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2d3748', fontWeight: '800', letterSpacing: '-0.5px' }}>Web Scraper</h1>
        <p style={{ color: '#718096', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Choose your scraping engine. Each service operates as a distinct microservice endpoint.
        </p>
      </div>

      <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
        {isOffline ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <WifiOff size={48} color="#cbd5e0" style={{ marginBottom: '1rem', display: 'inline-block' }} />
            <h3 style={{ color: '#2d3748', fontSize: '1.3rem', marginBottom: '0.5rem' }}>Offline Mode Active</h3>
            <p style={{ color: '#718096', maxWidth: '400px', margin: '0 auto' }}>Web Scraper requires internet access and is disabled while offline mode is active.</p>
          </div>
        ) : (
        <>
        {/* Service Selector Tabs */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { id: 'static', label: 'Static (Fast)', icon: Zap, color: 'green' },
            { id: 'dynamic', label: 'Dynamic (JS)', icon: Globe, color: 'blue' },
            { id: 'authenticated', label: 'Authenticated', icon: Shield, color: 'purple' },
            { id: 'schedule', label: 'Scheduled', icon: Clock, color: 'orange' }
          ].map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setActiveServiceTab(s.id); setResult(null); setError(''); setScheduleSuccess(''); }}
              style={{
                flex: '1 1 auto',
                padding: '1rem',
                borderRadius: '8px',
                border: activeServiceTab === s.id ? `2px solid ${s.color}` : '1px solid #e2e8f0',
                backgroundColor: activeServiceTab === s.id ? '#f7fafc' : '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                color: '#2d3748',
                transition: 'all 0.2s'
              }}
            >
              <s.icon size={20} color={activeServiceTab === s.id ? s.color : '#a0aec0'} />
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleScrape}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#4a5568' }}>Target URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                required
                style={{
                  width: '100%',
                  padding: '1rem',
                  fontSize: '1.1rem',
                  borderRadius: '6px',
                  border: '2px solid #e2e8f0',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {activeServiceTab === 'authenticated' && (
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#4a5568' }}>Session Cookies (JSON)</label>
                <textarea
                  value={cookiesJson}
                  onChange={(e) => setCookiesJson(e.target.value)}
                  placeholder='[{"name": "session_id", "value": "xyz123"}]'
                  required
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1rem',
                    borderRadius: '6px',
                    border: '2px solid #e2e8f0',
                    outline: 'none',
                    fontFamily: 'monospace',
                    height: '100px'
                  }}
                />
              </div>
            )}

            {activeServiceTab === 'schedule' && (
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.5rem', color: '#4a5568' }}>Cron Expression</label>
                <input
                  type="text"
                  value={cronSchedule}
                  onChange={(e) => setCronSchedule(e.target.value)}
                  placeholder="0 * * * *"
                  required
                  style={{
                    width: '100%',
                    padding: '1rem',
                    fontSize: '1.1rem',
                    borderRadius: '6px',
                    border: '2px solid #e2e8f0',
                    outline: 'none'
                  }}
                />
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#718096' }}>e.g. 0 * * * * for hourly, */5 * * * * for every 5 mins.</p>
              </div>
            )}

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', color: '#4a5568', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ignoreRobots}
                  onChange={(e) => setIgnoreRobots(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                Ignore robots.txt (Bypass restrictions)
              </label>
            </div>

            <button type="submit" disabled={loading} style={{
              backgroundColor: '#304fba',
              color: 'white',
              fontWeight: 'bold',
              padding: '1rem',
              borderRadius: '6px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '1.1rem'
            }}>
              {loading ? <Loader className="animate-spin" /> : <><ArrowRight /> {activeServiceTab === 'schedule' ? 'Schedule Job' : `Execute ${activeServiceTab.charAt(0).toUpperCase() + activeServiceTab.slice(1)} Scrape`}</>}
            </button>
          </div>
        </form>

        {scheduleSuccess && (
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0fff4', color: '#276749', borderRadius: '6px', border: '1px solid #c6f6d5' }}>
            <strong>Success:</strong> {scheduleSuccess}
          </div>
        )}

        {error && (
          <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fed7d7', color: '#9b2c2c', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle />
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div style={{ marginTop: '3rem', animation: 'fadeIn 0.5s ease-in-out' }}>
            {/* Tabs Header */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '2rem' }}>
              {renderViewTabButton('overview', 'Overview', Info)}
              {renderViewTabButton('context', `Text Context (${result.context?.length || 0})`, FileText)}
              {renderViewTabButton('media', `Media (${(result.images?.length || 0) + (result.videos?.length || 0)})`, ImageIcon)}
              {renderViewTabButton('links', `Links (${result.links?.length || 0})`, LinkIcon)}
            </div>

            {/* Tab Content */}
            <div style={{ minHeight: '300px' }}>
              {activeViewTab === 'overview' && (
                <div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{ fontWeight: '700', color: '#4a5568', display: 'block', marginBottom: '0.2rem' }}>Page Title</span>
                    <span style={{ color: '#2d3748', fontSize: '1.1rem' }}>{result.title || 'N/A'}</span>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{ fontWeight: '700', color: '#4a5568', display: 'block', marginBottom: '0.2rem' }}>Meta Description</span>
                    <span style={{ color: '#2d3748', fontSize: '1.1rem' }}>{result.description || 'N/A'}</span>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <span style={{ fontWeight: '700', color: '#4a5568', display: 'block', marginBottom: '0.2rem' }}>Raw HTML Size</span>
                    <span style={{ color: '#2d3748', fontSize: '1.1rem' }}>{(result.bytes / 1024).toFixed(2)} KB</span>
                  </div>
                </div>
              )}

              {activeViewTab === 'context' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {result.context?.length > 0 ? result.context.map((node, i) => (
                    <div key={i} style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', borderLeft: node.tag.includes('h') ? '4px solid #304fba' : '4px solid #cbd5e0' }}>
                      <span style={{ fontSize: '0.8rem', color: '#a0aec0', textTransform: 'uppercase', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>{node.tag}</span>
                      <p style={{ color: '#2d3748', margin: 0, lineHeight: '1.6', fontSize: node.tag === 'h1' ? '1.5rem' : node.tag === 'h2' ? '1.3rem' : '1rem', fontWeight: node.tag.includes('h') ? '700' : '400' }}>
                        {node.text}
                      </p>
                    </div>
                  )) : <p>No text content found.</p>}
                </div>
              )}

              {activeViewTab === 'media' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#2d3748', margin: 0 }}>Extracted Media</h3>
                    {(result.images?.length > 0 || result.videos?.length > 0) && (
                      <button 
                        onClick={handleDownloadMedia} 
                        disabled={downloadingMedia}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#38a169',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: downloadingMedia ? 'not-allowed' : 'pointer',
                          opacity: downloadingMedia ? 0.7 : 1,
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                        {downloadingMedia ? <Loader size={16} className="animate-spin" /> : null}
                        {downloadingMedia ? 'Downloading...' : 'Download All Media (ZIP)'}
                      </button>
                    )}
                  </div>
                  
                  {result.images?.length > 0 && <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#4a5568' }}>Images</h4>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
                    {result.images?.length > 0 ? result.images.map((img, i) => (
                      <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column' }}>
                        <img src={img.src} alt={img.alt} style={{ width: '100%', height: '120px', objectFit: 'contain', backgroundColor: '#fff' }} loading="lazy" />
                        <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: '#718096', wordBreak: 'break-all', maxHeight: '60px', overflow: 'hidden' }}>
                          {img.src}
                        </div>
                      </div>
                    )) : <p>No images found.</p>}
                  </div>

                  {result.videos?.length > 0 && <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#4a5568' }}>Videos</h4>}
                  {result.videos?.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                      {result.videos.map((vid, i) => (
                        <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                          <video src={vid.src} poster={vid.poster} controls style={{ width: '100%', maxHeight: '200px' }} />
                        </div>
                      ))}
                    </div>
                  ) : <p style={{ color: '#718096' }}>No videos found.</p>}
                </div>
              )}

              {activeViewTab === 'links' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {result.links?.length > 0 ? result.links.map((link, i) => (
                    <div key={i} style={{ padding: '0.75rem', borderBottom: '1px solid #edf2f7', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600', color: '#2d3748', marginBottom: '0.2rem' }}>{link.text}</span>
                      <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ color: '#3182ce', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                        {link.href}
                      </a>
                    </div>
                  )) : <p>No outbound links found.</p>}
                </div>
              )}

            </div>
          </div>
        )}
        </>
        )}
      </div>
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ScraperPage;
