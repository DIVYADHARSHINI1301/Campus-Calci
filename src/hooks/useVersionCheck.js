import { useEffect, useState } from 'react';

export const useVersionCheck = (checkInterval = 60000) => {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  const currentVersion = localStorage.getItem('appVersion') || '1.0.0';

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch('/version.json?t=' + Date.now());
        const data = await response.json();
        
        if (data.version !== currentVersion) {
          setNewVersionAvailable(true);
        }
      } catch (error) {
        console.error('Version check failed:', error);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, checkInterval);
    return () => clearInterval(interval);
  }, [currentVersion, checkInterval]);

  const updateVersion = async () => {
    const response = await fetch('/version.json?t=' + Date.now());
    const data = await response.json();
    localStorage.setItem('appVersion', data.version);
    
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
    
    window.location.reload(true);
  };

  return { newVersionAvailable, updateVersion };
};
