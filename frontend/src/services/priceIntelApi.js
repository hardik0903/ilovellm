import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/price-intel';

export const priceIntelApi = {
  getDashboardMetrics: async () => {
    const res = await axios.get(`${API_BASE}/dashboard/metrics`);
    return res.data;
  },
  listProducts: async () => {
    const res = await axios.get(`${API_BASE}/products`);
    return res.data;
  },
  getProduct: async (id) => {
    const res = await axios.get(`${API_BASE}/products/${id}`);
    return res.data;
  },
  createProduct: async (data) => {
    const res = await axios.post(`${API_BASE}/track`, { source_url: data.name });
    return res.data;
  },
  trackSource: async (productId, url) => {
    const res = await axios.post(`${API_BASE}/track/${productId}`, { source_url: url });
    return res.data;
  },
  runScrape: async (listingId) => {
    const res = await axios.post(`${API_BASE}/scrape/run/${listingId}`);
    return res.data;
  },
  getHistory: async (productId) => {
    const res = await axios.get(`${API_BASE}/history/${productId}`);
    return res.data;
  }
};
