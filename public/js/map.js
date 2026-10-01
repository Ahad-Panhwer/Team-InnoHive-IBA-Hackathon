let maps = {};

function initMap(containerId) {
    if (!document.getElementById(containerId)) return;
    
    const map = L.map(containerId).setView([24.8607, 67.0011], 12); // Karachi center
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    maps[containerId] = map;

    // Add dummy hospitals
    addHospitalMarker(map, 24.8933, 67.0736, "Aga Khan University Hospital", "private");
    addHospitalMarker(map, 24.8532, 67.0511, "JPMC", "govt");
    addHospitalMarker(map, 24.8214, 67.1121, "Indus Hospital", "charity");

    // Add ambulance marker
    if(containerId === 'ambulance-map') {
        const ambIcon = L.divIcon({
            html: '<i class="fas fa-truck-medical fa-2x" style="color:var(--accent)"></i>',
            className: 'custom-div-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        L.marker([24.8700, 67.0300], {icon: ambIcon}).addTo(map).bindPopup("Current Location");
    }
}

function addHospitalMarker(map, lat, lng, name, type) {
    let color = 'blue';
    if(type === 'private') color = 'purple';
    if(type === 'charity') color = 'green';
    
    const icon = L.divIcon({
        html: `<div style="background-color:${color}; width:15px; height:15px; border-radius:50%; border:2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
        className: 'custom-div-icon'
    });

    L.marker([lat, lng], {icon: icon}).addTo(map)
        .bindPopup(`<b>${name}</b><br>Type: ${type}`);
}
