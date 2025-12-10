import { useState, useEffect } from 'react';

const STORAGE_KEY = 'spreadlab_watchlist';

export default function useWatchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Charger depuis localStorage au montage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setWatchlist(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Erreur chargement watchlist:', e);
    }
    setIsLoaded(true);
  }, []);

  // Sauvegarder dans localStorage quand la watchlist change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
      } catch (e) {
        console.error('Erreur sauvegarde watchlist:', e);
      }
    }
  }, [watchlist, isLoaded]);

  const addToWatchlist = (pairId) => {
    if (!watchlist.includes(pairId)) {
      setWatchlist(prev => [...prev, pairId]);
      return true;
    }
    return false;
  };

  const removeFromWatchlist = (pairId) => {
    setWatchlist(prev => prev.filter(id => id !== pairId));
  };

  const toggleWatchlist = (pairId) => {
    if (watchlist.includes(pairId)) {
      removeFromWatchlist(pairId);
      return false;
    } else {
      addToWatchlist(pairId);
      return true;
    }
  };

  const isInWatchlist = (pairId) => {
    return watchlist.includes(pairId);
  };

  const clearWatchlist = () => {
    setWatchlist([]);
  };

  return {
    watchlist,
    isLoaded,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    isInWatchlist,
    clearWatchlist,
    count: watchlist.length,
  };
}
