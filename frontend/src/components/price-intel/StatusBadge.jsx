import React from 'react';

export function StatusBadge({ status }) {
  let colorClass = 'bg-gray-100 text-gray-800';
  let label = status || 'Unknown';

  if (status === 'success' || status === 'in_stock') {
    colorClass = 'bg-green-100 text-green-800 border-green-200';
    label = status === 'success' ? 'Success' : 'In Stock';
  } else if (status === 'out_of_stock') {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
    label = 'Out of Stock';
  } else if (status === 'blocked' || status === 'captcha') {
    colorClass = 'bg-orange-100 text-orange-800 border-orange-200';
    label = status === 'blocked' ? 'Blocked' : 'Captcha';
  } else if (status === 'parse_failed' || status === 'error') {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
    label = status === 'parse_failed' ? 'Parse Failed' : 'Error';
  } else if (status === 'price_dropped') {
    colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
    label = 'Price Dropped';
  } else if (status === 'pending') {
    colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    label = 'Pending';
  }

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
}
