import React from 'react';

export function StatusBadge({ status }) {
  let colorClass = 'bg-gray-100 text-gray-800';
  let label = status || 'Unknown';

  if (status === 'in_stock') {
    colorClass = 'bg-green-100 text-green-800 border-green-200';
    label = 'In Stock';
  } else if (status === 'out_of_stock') {
    colorClass = 'bg-red-100 text-red-800 border-red-200';
    label = 'Out of Stock';
  } else if (status === 'price_dropped') {
    colorClass = 'bg-blue-100 text-blue-800 border-blue-200';
    label = 'Price Dropped';
  }

  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
}
