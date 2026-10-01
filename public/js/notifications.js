// Notifications System

function requestPermission() {
    if ("Notification" in window) {
        Notification.requestPermission();
    }
}

function showNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: '/favicon.ico' });
    }
    showToast(title + ": " + body, 'info');
}

function playAlertSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.2); // A5
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
    } catch(e) {
        console.log("Audio not supported or blocked");
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function flashTitle(message) {
    const originalTitle = document.title;
    let isFlash = false;
    const interval = setInterval(() => {
        document.title = isFlash ? message : originalTitle;
        isFlash = !isFlash;
    }, 1000);
    
    setTimeout(() => {
        clearInterval(interval);
        document.title = originalTitle;
    }, 10000);
}

// Request permission on load
document.addEventListener('DOMContentLoaded', requestPermission);
