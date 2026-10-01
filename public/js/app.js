// State Management
const state = {
    role: 'ambulance',
    user: null,
    isOnline: true,
    activeEmergency: null
};

// DOM Elements
const elements = {
    roleTabs: document.querySelectorAll('#role-tabs li'),
    viewSections: document.querySelectorAll('.view-section'),
    loginModal: document.getElementById('login-modal'),
    loginForm: document.getElementById('login-form'),
    userInfoDisplay: document.getElementById('user-info-display'),
    userNameDisplay: document.getElementById('user-name-display'),
    logoutBtn: document.getElementById('logout-btn'),
    toggleOnlineBtn: document.getElementById('toggle-online-btn'),
    connectionDot: document.getElementById('connection-dot'),
    connectionText: document.getElementById('connection-text'),
    chips: document.querySelectorAll('.chip'),
    btnFindHospital: document.getElementById('btn-find-hospital'),
    hospitalResults: document.getElementById('amb-hospital-results'),
    newEmergencySec: document.getElementById('amb-new-emergency'),
    activeEmergencySec: document.getElementById('amb-active-emergency')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    initMap('ambulance-map');
    initMap('admin-map');
    
    // Simulate socket connection
    window.socket = {
        emit: (event, data) => console.log(`Socket emit ${event}:`, data),
        on: (event, cb) => console.log(`Socket listener added for ${event}`)
    };
});

function setupEventListeners() {
    // Role Switching
    elements.roleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const role = tab.getAttribute('data-role');
            switchRole(role);
        });
    });

    // Login Form
    elements.loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const role = document.getElementById('login-role').value;
        const user = document.getElementById('login-user').value;
        
        state.user = { name: user, role: role };
        localStorage.setItem('gh_user', JSON.stringify(state.user));
        
        elements.loginModal.classList.remove('show');
        elements.userInfoDisplay.style.display = 'flex';
        elements.userNameDisplay.textContent = user;
        
        switchRole(role);
        showToast('Logged in successfully', 'success');
    });

    // Logout
    elements.logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('gh_user');
        state.user = null;
        elements.userInfoDisplay.style.display = 'none';
        elements.loginModal.classList.add('show');
    });

    // Online/Offline Toggle
    elements.toggleOnlineBtn.addEventListener('click', () => {
        setOnlineStatus(!state.isOnline);
    });

    // Chips selection
    elements.chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.target.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active');
        });
    });

    // Find Hospital Button
    if(elements.btnFindHospital) {
        elements.btnFindHospital.addEventListener('click', () => {
            elements.newEmergencySec.style.display = 'none';
            elements.hospitalResults.style.display = 'block';
            renderHospitalResults();
        });
    }
}

function checkAuth() {
    const savedUser = localStorage.getItem('gh_user');
    if (savedUser) {
        state.user = JSON.parse(savedUser);
        elements.userInfoDisplay.style.display = 'flex';
        elements.userNameDisplay.textContent = state.user.name;
        switchRole(state.user.role);
    } else {
        elements.loginModal.classList.add('show');
    }
}

function switchRole(role) {
    state.role = role;
    
    // Update tabs
    elements.roleTabs.forEach(tab => {
        if (tab.getAttribute('data-role') === role) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update views
    elements.viewSections.forEach(section => {
        if (section.id === `view-${role}`) {
            section.classList.add('active');
        } else {
            section.classList.remove('active');
        }
    });
    
    // Trigger resize for map rendering fix
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
    }, 100);
}

function setOnlineStatus(isOnline) {
    state.isOnline = isOnline;
    if (isOnline) {
        elements.connectionDot.classList.replace('offline', 'online');
        elements.connectionText.textContent = 'Online';
        elements.toggleOnlineBtn.textContent = 'Go Offline';
        document.getElementById('offline-indicator').style.display = 'none';
        showToast('Back online. Synced data.', 'success');
        if(typeof syncPendingOperations === 'function') syncPendingOperations();
    } else {
        elements.connectionDot.classList.replace('online', 'offline');
        elements.connectionText.textContent = 'Offline';
        elements.toggleOnlineBtn.textContent = 'Go Online';
        document.getElementById('offline-indicator').style.display = 'inline';
        showToast('You are offline. Data is cached locally.', 'error');
    }
}

// Dummy Data & Renderers
const dummyHospitals = [
    { name: 'Aga Khan University Hospital', type: 'Private', typeClass: 'badge-private', dist: '3.2 km', eta: '8 mins', match: '98%', id: 1 },
    { name: 'Liaquat National Hospital', type: 'Private', typeClass: 'badge-private', dist: '4.5 km', eta: '12 mins', match: '90%', id: 2 },
    { name: 'Jinnah Postgraduate', type: 'Govt', typeClass: 'badge-govt', dist: '5.1 km', eta: '15 mins', match: '85%', id: 3 },
    { name: 'Indus Hospital', type: 'Charity', typeClass: 'badge-charity', dist: '12 km', eta: '25 mins', match: '82%', id: 4 }
];

function renderHospitalResults() {
    const list = document.getElementById('hospital-results-list');
    list.innerHTML = '';
    
    dummyHospitals.forEach((h, index) => {
        const div = document.createElement('div');
        div.className = 'card mt-2';
        div.innerHTML = `
            <div class="row justify-between align-center">
                <div>
                    <h3 class="m-0">${h.name}</h3>
                    <div class="mt-2 row align-center">
                        <span class="badge ${h.typeClass}">${h.type}</span>
                        <span class="text-muted small ml-2"><i class="fas fa-car"></i> ${h.dist} (${h.eta})</span>
                        <span class="text-success small ml-2"><i class="fas fa-check-circle"></i> ${h.match} Match</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="selectHospital('${h.name}')">Dispatch</button>
            </div>
        `;
        list.appendChild(div);
    });
}

window.selectHospital = function(name) {
    elements.hospitalResults.style.display = 'none';
    elements.activeEmergencySec.style.display = 'block';
    document.getElementById('dest-hospital-name').textContent = name;
    
    // Start Timer
    startCareLinkTimer();
    
    if(typeof playAlertSound === 'function') playAlertSound();
    if(typeof showNotification === 'function') showNotification('Emergency Dispatched', `Heading to ${name}`);
}

function startCareLinkTimer() {
    let timeLeft = 45 * 60; // 45 minutes
    const timerDisplay = document.getElementById('golden-timer');
    
    setInterval(() => {
        timeLeft--;
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        timerDisplay.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if(timeLeft < 10 * 60) {
            timerDisplay.classList.add('text-danger');
        }
    }, 1000);
}
