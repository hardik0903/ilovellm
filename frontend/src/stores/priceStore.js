import { create } from 'zustand'

const PYTHON_API = 'http://localhost:8000'

export const usePriceStore = create((set, get) => ({
  trackedProducts: {},
  pendingAlerts: [],
  isTracking: false,

  trackProduct: async (url, targetPrice = null, dqsThreshold = 60) => {
    set({ isTracking: true })
    try {
      const res = await fetch(`${PYTHON_API}/api/price/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, target_price: targetPrice, dqs_threshold: dqsThreshold })
      })
      const data = await res.json()
      if (data.success) {
         await get().fetchProduct(data.product_id)
      }
      return data
    } catch (error) {
      console.error(error)
      return { success: false }
    } finally {
      set({ isTracking: false })
    }
  },

  fetchProduct: async (productId) => {
    try {
      const res = await fetch(`${PYTHON_API}/api/price/product/${productId}`)
      const data = await res.json()
      if (data.success) {
        set(state => ({
          trackedProducts: {
            ...state.trackedProducts,
            [productId]: data
          }
        }))
      }
      return data
    } catch (e) {
      return { success: false }
    }
  },

  forceScrape: async (productId) => {
    try {
      const res = await fetch(`${PYTHON_API}/api/price/scrape-now/${productId}`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        await get().fetchProduct(productId)
      }
      return data
    } catch (e) {
      return { success: false }
    }
  },

  fetchAlerts: async () => {
    try {
      const res = await fetch(`${PYTHON_API}/api/price/alerts/pending`)
      const data = await res.json()
      if (data.success) {
        set({ pendingAlerts: data.alerts })
      }
    } catch (e) {}
  },

  markAlertsSeen: async (alertIds) => {
    try {
      await fetch(`${PYTHON_API}/api/price/alerts/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alertIds)
      })
      set({ pendingAlerts: [] })
    } catch (e) {}
  }
}))
