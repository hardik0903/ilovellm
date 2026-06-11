import React from 'react';

export function StatusBadge({ status }) {
  let styles = { bg: '#f7fafc', text: '#2d3748', border: '#e2e8f0' };
  let label = status || 'Unknown';

  if (status === 'success' || status === 'in_stock') {
    styles = { bg: '#f0fff4', text: '#22543d', border: '#c6f6d5' };
    label = status === 'success' ? 'Success' : 'In Stock';
  } else if (status === 'out_of_stock') {
    styles = { bg: '#fff5f5', text: '#742a2a', border: '#fed7d7' };
    label = 'Out of Stock';
  } else if (status === 'blocked' || status === 'captcha') {
    styles = { bg: '#fffaf0', text: '#7b341e', border: '#feebc8' };
    label = status === 'blocked' ? 'Blocked' : 'Captcha';
  } else if (status === 'parse_failed' || status === 'error') {
    styles = { bg: '#fff5f5', text: '#742a2a', border: '#fed7d7' };
    label = status === 'parse_failed' ? 'Parse Failed' : 'Error';
  } else if (status === 'price_dropped') {
    styles = { bg: '#ebf8ff', text: '#2a4365', border: '#bee3f8' };
    label = 'Price Dropped';
  } else if (status === 'pending') {
    styles = { bg: '#fffff0', text: '#744210', border: '#fefcbf' };
    label = 'Pending';
  }

  return (
    <span style={{ 
      padding: '0.25rem 0.75rem', 
      display: 'inline-flex', 
      fontSize: '0.75rem', 
      lineHeight: '1.25rem', 
      fontWeight: '600', 
      borderRadius: '9999px', 
      border: `1px solid ${styles.border}`, 
      backgroundColor: styles.bg, 
      color: styles.text 
    }}>
      {label}
    </span>
  );
}
