// Offline Storage & Sync Simulation

const STORE_KEY = 'golden_hour_cache';
const QUEUE_KEY = 'golden_hour_sync_queue';

function cacheData(key, data) {
    try {
        let cache = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
        cache[key] = {
            data: data,
            timestamp: Date.now()
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(cache));
    } catch(e) {
        console.error('Error caching data', e);
    }
}

function getCachedData(key) {
    try {
        let cache = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
        return cache[key] ? cache[key].data : null;
    } catch(e) {
        return null;
    }
}

function addToSyncQueue(operation) {
    try {
        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
        queue.push({
            ...operation,
            timestamp: Date.now()
        });
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        
        // Update UI badge if exists
        console.log(`Added to sync queue. Pending items: ${queue.length}`);
    } catch(e) {
        console.error('Error adding to sync queue', e);
    }
}

function syncPendingOperations() {
    try {
        let queue = JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
        if(queue.length === 0) return;
        
        console.log(`Syncing ${queue.length} operations...`);
        // Simulate network request
        setTimeout(() => {
            localStorage.removeItem(QUEUE_KEY);
            if(typeof showToast === 'function') {
                showToast('All offline changes synced successfully', 'success');
            }
        }, 1500);
    } catch(e) {
        console.error('Error syncing operations', e);
    }
}

// Network status listeners
window.addEventListener('online', () => {
    if(typeof setOnlineStatus === 'function') {
        setOnlineStatus(true);
    }
});

window.addEventListener('offline', () => {
    if(typeof setOnlineStatus === 'function') {
        setOnlineStatus(false);
    }
});
