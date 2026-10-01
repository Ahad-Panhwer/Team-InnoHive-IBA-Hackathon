const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const { matchHospitals } = require('../utils/matching');

router.post('/', authenticate, authorize(['driver', 'admin']), (req, res) => {
  const db = req.db;
  const { 
    emergency_type, severity, patient_name, patient_age, patient_sex, 
    pickup_lat, pickup_lng, mechanism, notes, target_hospital_id, eta_minutes, distance_km,
    vitals_hr, vitals_bp, vitals_spo2, vitals_gcs
  } = req.body;
  
  const id = uuidv4();
  const case_number = 'EMR-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  
  try {
    const hospital = target_hospital_id ? db.prepare('SELECT id FROM hospitals WHERE id = ? AND verified = 1').get(target_hospital_id) : null;
    if (target_hospital_id && !hospital) return res.status(400).json({ error: 'Selected hospital is unavailable' });
    db.prepare(`
      INSERT INTO emergencies (
        id, case_number, ambulance_id, hospital_id, emergency_type, severity, status,
        patient_name, patient_age, patient_sex, pickup_lat, pickup_lng, 
        mechanism, notes, current_lat, current_lng, eta_minutes, distance_km,
        vitals_hr, vitals_bp, vitals_spo2, vitals_gcs, golden_hour_deadline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, case_number, req.user.ambulance_id, target_hospital_id || null, emergency_type, String(severity).toLowerCase(), target_hospital_id ? 'notified' : 'created',
      patient_name, patient_age, patient_sex, pickup_lat, pickup_lng, 
      mechanism, notes, pickup_lat, pickup_lng, eta_minutes || null, distance_km || null,
      vitals_hr || null, vitals_bp || null, vitals_spo2 || null, vitals_gcs || null,
      new Date(Date.now() + 60 * 60 * 1000).toISOString()
    );
    if (req.user.ambulance_id) db.prepare("UPDATE ambulances SET status = 'enroute', latitude = ?, longitude = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?").run(pickup_lat, pickup_lng, req.user.ambulance_id);
    req.io.emit('emergency:new', { id, case_number, emergency_type, severity, hospital_id: target_hospital_id });
    if (target_hospital_id) req.io.to(`hospital:${target_hospital_id}`).emit('emergency:new', { id, case_number, emergency_type, severity, hospital_id: target_hospital_id });
    res.status(201).json({ id, case_number, message: 'Emergency created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticate, (req, res) => {
  const db = req.db;
  try {
    let query = 'SELECT * FROM emergencies WHERE 1=1';
    let params = [];
    
    if (req.query.status) {
      query += ' AND status = ?';
      params.push(req.query.status);
    }
    if (req.query.hospital_id) {
      query += ' AND hospital_id = ?';
      params.push(req.query.hospital_id);
    }
    if (req.query.ambulance_id) {
      query += ' AND ambulance_id = ?';
      params.push(req.query.ambulance_id);
    }
    if (req.user.role === 'driver') { query += ' AND ambulance_id = ?'; params.push(req.user.ambulance_id); }
    if (req.user.role === 'hospital_staff' || req.user.role === 'doctor') { query += ' AND hospital_id = ?'; params.push(req.user.hospital_id); }

    query += ' ORDER BY created_at DESC';
    const emergencies = db.prepare(query).all(...params);
    res.json(emergencies);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/find-hospital', authenticate, (req, res) => {
  const db = req.db;
  const { emergency_type, lat, lng } = req.query;
  if (!emergency_type || lat === undefined || lng === undefined || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return res.status(400).json({ error: 'emergency_type, lat, and lng are required' });
  }
  try {
    const hospitals = db.prepare('SELECT * FROM hospitals WHERE verified = 1 AND accepting_emergency = 1').all();
    const resources = db.prepare('SELECT * FROM hospital_resources').all();
    const doctors = db.prepare('SELECT * FROM doctors').all();
    res.json(matchHospitals(emergency_type, Number(lat), Number(lng), hospitals, resources, doctors));
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:id', authenticate, (req, res) => {
  const db = req.db;
  try {
    const emergency = db.prepare('SELECT * FROM emergencies WHERE id = ?').get(req.params.id);
    if (!emergency) return res.status(404).json({ error: 'Emergency not found' });
    if (req.user.role === 'driver' && emergency.ambulance_id !== req.user.ambulance_id) return res.status(403).json({ error: 'Emergency belongs to another ambulance' });
    if ((req.user.role === 'hospital_staff' || req.user.role === 'doctor') && emergency.hospital_id !== req.user.hospital_id) return res.status(403).json({ error: 'Emergency belongs to another hospital' });
    res.json(emergency);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', authenticate, authorize(['driver', 'hospital_staff', 'doctor', 'admin']), (req, res) => {
  const db = req.db;
  const { status } = req.body;
  
  const allowed = ['created','assessing','hospital_selected','notified','accepted','declined','enroute','arrived','treatment_started','transferred','completed','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid emergency status' });
  try {
    const current = db.prepare('SELECT hospital_id, ambulance_id FROM emergencies WHERE id = ?').get(req.params.id);
    if (!current) return res.status(404).json({ error: 'Emergency not found' });
    if (req.user.role === 'hospital_staff' && current.hospital_id !== req.user.hospital_id) return res.status(403).json({ error: 'Emergency belongs to another hospital' });
    if (req.user.role === 'doctor' && current.hospital_id !== req.user.hospital_id) return res.status(403).json({ error: 'Emergency belongs to another hospital' });
    if (req.user.role === 'driver' && current.ambulance_id !== req.user.ambulance_id) return res.status(403).json({ error: 'Emergency belongs to another ambulance' });
    db.prepare('UPDATE emergencies SET status = ? WHERE id = ?').run(status, req.params.id);
    
    if (status === 'arrived') {
        db.prepare('UPDATE emergencies SET arrived_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    } else if (status === 'completed') {
        db.prepare('UPDATE emergencies SET completed_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
    }

    req.io.emit('emergency:update', { id: req.params.id, status });
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/vitals', authenticate, authorize(['driver', 'admin']), (req, res) => {
  const db = req.db;
  const { vitals_hr, vitals_bp, vitals_spo2, vitals_gcs, vitals_status } = req.body;
  
  try {
    db.prepare(`
      UPDATE emergencies 
      SET vitals_hr = ?, vitals_bp = ?, vitals_spo2 = ?, vitals_gcs = ?, vitals_status = ? 
      WHERE id = ?
    `).run(vitals_hr, vitals_bp, vitals_spo2, vitals_gcs, vitals_status, req.params.id);
    
    req.io.emit('emergency:vitals', { id: req.params.id, vitals: { vitals_hr, vitals_bp, vitals_spo2, vitals_gcs, vitals_status } });
    res.json({ message: 'Vitals updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/location', authenticate, authorize(['driver']), (req, res) => {
  const db = req.db;
  const { current_lat, current_lng } = req.body;
  
  try {
    db.prepare('UPDATE emergencies SET current_lat = ?, current_lng = ? WHERE id = ?').run(current_lat, current_lng, req.params.id);
    const emergency = db.prepare('SELECT ambulance_id FROM emergencies WHERE id = ?').get(req.params.id);
    if(emergency && emergency.ambulance_id) {
        db.prepare('UPDATE ambulances SET latitude = ?, longitude = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(current_lat, current_lng, emergency.ambulance_id);
    }
    
    req.io.emit('ambulance:location', { id: req.params.id, ambulance_id: emergency.ambulance_id, current_lat, current_lng });
    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/accept', authenticate, authorize(['hospital_staff', 'admin']), (req, res) => {
  const db = req.db;
  const { hospital_id } = req.user.role === 'admin' ? req.body : req.user;
  
  try {
    const existing = db.prepare('SELECT hospital_id FROM emergencies WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Emergency not found' });
    if (existing.hospital_id && hospital_id !== existing.hospital_id) return res.status(403).json({ error: 'Emergency is assigned to another hospital' });
    db.prepare('UPDATE emergencies SET status = ?, hospital_id = ?, accepted_at = CURRENT_TIMESTAMP WHERE id = ?').run('accepted', hospital_id, req.params.id);
    req.io.emit('emergency:update', { id: req.params.id, status: 'accepted', hospital_id });
    res.json({ message: 'Emergency accepted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/decline', authenticate, authorize(['hospital_staff', 'admin']), (req, res) => {
  const db = req.db;
  try {
    const existing = db.prepare('SELECT hospital_id FROM emergencies WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Emergency not found' });
    if (req.user.role === 'hospital_staff' && existing.hospital_id !== req.user.hospital_id) return res.status(403).json({ error: 'Emergency belongs to another hospital' });
    db.prepare("UPDATE emergencies SET status = 'declined' WHERE id = ?").run(req.params.id);
    req.io.emit('emergency:update', { id: req.params.id, status: 'declined' });
    res.json({ message: 'Emergency declined' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
