import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { priceIntelApi } from '../../services/priceIntelApi';
import { RefreshCw, ExternalLink } from 'lucide-react';

export function ProductTable({ products, onRefreshList, onSelectProduct, selectedProductId }) {
  const [refreshing, setRefreshing] = useState(null);

  const handleRefresh = async (listingId) => {
    setRefreshing(listingId);
    try {
      await priceIntelApi.runScrape(listingId);
      onRefreshList();
    } catch (e) {
      alert("Failed to refresh");
    } finally {
      setRefreshing(null);
    }
  };

  if (!products || products.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: '#fdfdfd' }}>
        <p style={{ color: '#718096', fontSize: '1.1rem' }}>No products tracked. Deploy a new tracker above.</p>
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
      <thead style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #e2e8f0' }}>
        <tr>
          <th style={{ padding: '1rem 1.5rem', color: '#4a5568', fontSize: '0.85rem', textTransform: 'uppercase' }}>Asset</th>
          <th style={{ padding: '1rem 1.5rem', color: '#4a5568', fontSize: '0.85rem', textTransform: 'uppercase' }}>Source</th>
          <th style={{ padding: '1rem 1.5rem', color: '#4a5568', fontSize: '0.85rem', textTransform: 'uppercase' }}>Live Price</th>
          <th style={{ padding: '1rem 1.5rem', color: '#4a5568', fontSize: '0.85rem', textTransform: 'uppercase' }}>Status</th>
          <th style={{ padding: '1rem 1.5rem', color: '#4a5568', fontSize: '0.85rem', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {products.map(p => {
          const listing = p.listings?.[0];
          const isSelected = selectedProductId === p.id;
          
          return (
            <tr 
              key={p.id} 
              onClick={() => onSelectProduct(p)}
              style={{ 
                cursor: 'pointer', 
                borderBottom: '1px solid #e2e8f0', 
                backgroundColor: isSelected ? '#ebf8ff' : '#fff',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
              onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = '#fff'; }}
            >
              <td style={{ padding: '1rem 1.5rem' }}>
                <div style={{ fontWeight: 'bold', color: '#2d3748', fontSize: '1rem' }}>{p.name}</div>
                <div style={{ color: '#718096', fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {listing?.title ? listing.title : (listing?.latest_scrape_status === 'blocked' ? `Title Blocked (${listing.latest_block_reason || 'Bot Protection'})` : 'Resolving title...')}
                </div>
              </td>
              <td style={{ padding: '1rem 1.5rem' }}>
                {listing?.source_name ? (
                  <span style={{ display: 'inline-block', backgroundColor: '#edf2f7', color: '#4a5568', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'capitalize' }}>
                    {listing.source_name}
                  </span>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '0.85rem' }}>Pending...</span>
                )}
              </td>
              <td style={{ padding: '1rem 1.5rem' }}>
                {listing?.latest_scrape_status === 'success' && listing?.current_price ? (
                  <div>
                    <span style={{ fontWeight: '800', color: '#2d3748', fontSize: '1.1rem' }}>
                      {listing.currency} {listing.current_price.toLocaleString()}
                    </span>
                    {listing.mrp && listing.mrp > listing.current_price && (
                      <span style={{ color: '#a0aec0', textDecoration: 'line-through', fontSize: '0.85rem', display: 'block' }}>
                        {listing.currency} {listing.mrp.toLocaleString()}
                      </span>
                    )}
                  </div>
                ) : listing?.latest_scrape_status === 'blocked' ? (
                  <span style={{ color: '#e53e3e', fontSize: '0.85rem', fontWeight: 'bold' }}>Blocked ({listing.latest_block_reason || 'CAPTCHA'})</span>
                ) : listing?.latest_scrape_status === 'parse_failed' ? (
                  <span style={{ color: '#dd6b20', fontSize: '0.85rem', fontWeight: 'bold' }}>Parse Failed</span>
                ) : listing?.latest_scrape_status === 'error' ? (
                  <span style={{ color: '#e53e3e', fontSize: '0.85rem', fontWeight: 'bold' }}>Error</span>
                ) : (
                  <span style={{ color: '#a0aec0', fontSize: '0.85rem', fontStyle: 'italic' }}>Scanning...</span>
                )}
              </td>
              <td style={{ padding: '1rem 1.5rem' }}>
                <StatusBadge status={listing?.stock_status} />
              </td>
              <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                {listing && (
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <a 
                      href={listing.source_url} 
                      target="_blank" 
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#718096', padding: '0.5rem', borderRadius: '4px' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#edf2f7'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRefresh(listing.id); }}
                      disabled={refreshing === listing.id}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.25rem', 
                        backgroundColor: '#ebf8ff', color: '#2b6cb0', 
                        border: 'none', padding: '0.25rem 0.75rem', 
                        borderRadius: '4px', fontWeight: 'bold', cursor: refreshing === listing.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <RefreshCw size={14} className={refreshing === listing.id ? "animate-spin" : ""} />
                      {refreshing === listing.id ? 'Syncing...' : 'Sync'}
                    </button>
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
