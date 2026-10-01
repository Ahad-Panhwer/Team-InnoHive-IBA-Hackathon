const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', authenticate, (req, res) => {
  const db = req.db;
  try {
    let query = 'SELECT * FROM hospitals WHERE 1=1';
    let params = [];
    
    if (req.query.city) {
      query += ' AND city = ?';
      params.push(req.query.city);
    }
    if (req.query.type) {
      query += ' AND type = ?';
      params.push(req.query.type);
    }
    if (req.query.verified) {
      query += ' AND verified = ?';
      params.push(req.query.verified);
    }
    if (req.query.accepting) {
      query += ' AND accepting_emergency = ?';
      params.push(req.query.accepting);
    }

    const hospitals = db.prepare(query).all(...params);
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', authenticate, (req, res) => {
  const db = req.db;
  try {
    const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(req.params.id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    
    const resources = db.prepare('SELECT * FROM hospital_resources WHERE hospital_id = ?').all(req.params.id);
    const doctors = db.prepare('SELECT * FROM doctors WHERE hospital_id = ?').all(req.params.id);
    
    hospital.resources = resources;
    hospital.doctors = doctors;
    
    res.json(hospital);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, authorize('admin'), (req, res) => {
  const db = req.db;
  const { name, city, province, type, latitude, longitude, address, phone, email, emergency_phone, resources = [], doctors = [] } = req.body;
  if (!name || !city || !['Government', 'Private', 'Charitable'].includes(type) || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return res.status(400).json({ error: 'name, city, valid type and coordinates are required' });
  }
  const id = uuidv4();
  
  try {
    const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO hospitals (id, name, city, province, type, latitude, longitude, address, phone, email, emergency_phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, city, province, type, latitude, longitude, address, phone, email, emergency_phone);
    const addResource = db.prepare('INSERT INTO hospital_resources (id,hospital_id,resource_type,resource_name,total,available) VALUES (?,?,?,?,?,?)');
    for (const r of resources) if (r.resource_name && Number(r.total) >= 0 && Number(r.available) >= 0 && Number(r.available) <= Number(r.total)) addResource.run(uuidv4(),id,r.resource_type||'general',r.resource_name,Number(r.total),Number(r.available));
    const addDoctor = db.prepare('INSERT INTO doctors (id,hospital_id,full_name,specialization,status) VALUES (?,?,?,? ,?)');
    for (const d of doctors) if (d.full_name && d.specialization) addDoctor.run(uuidv4(),id,d.full_name,d.specialization,['onsite','oncall','busy','off'].includes(d.status)?d.status:'onsite');
    });
    create();
    res.status(201).json({ id, message: 'Hospital created' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticate, authorize(['admin', 'hospital_staff']), (req, res) => {
  const db = req.db;
  const fields = ['name', 'city', 'province', 'type', 'latitude', 'longitude', 'address', 'phone', 'email', 'emergency_phone', 'accepting_emergency', 'gate_name'];
  let updates = [];
  let params = [];
  
  for (let field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }
  
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  if (req.user.role === 'hospital_staff' && req.user.hospital_id !== req.params.id) return res.status(403).json({ error: 'You can only update your own hospital' });
  
  params.push(req.params.id);
  
  try {
    db.prepare(`UPDATE hospitals SET ${updates.join(', ')}, last_updated = CURRENT_TIMESTAMP WHERE id = ?`).run(...params);
    req.io.emit('hospital:status-change', { hospital_id: req.params.id });
    res.json({ message: 'Hospital updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/resources', authenticate, authorize(['admin', 'hospital_staff']), (req, res) => {
  const db = req.db;
  const resources = req.body.resources; // Array of { resource_name, total, available }
  
  if (!Array.isArray(resources)) return res.status(400).json({ error: 'Resources must be an array' });
  if (req.user.role === 'hospital_staff' && req.user.hospital_id !== req.params.id) return res.status(403).json({ error: 'You can only update your own hospital resources' });

  try {
    const updateStmt = db.prepare(`
      INSERT INTO hospital_resources (id, hospital_id, resource_type, resource_name, total, available)
      VALUES (?, ?, 'general', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET total=excluded.total, available=excluded.available, last_updated=CURRENT_TIMESTAMP
    `);
    
    const deleteStmt = db.prepare('DELETE FROM hospital_resources WHERE hospital_id = ? AND resource_name = ?');
    
    db.transaction(() => {
      for (const r of resources) {
        const existing = db.prepare('SELECT id FROM hospital_resources WHERE hospital_id = ? AND resource_name = ?').get(req.params.id, r.resource_name);
        if (existing) {
          db.prepare('UPDATE hospital_resources SET total = ?, available = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(r.total, r.available, existing.id);
        } else {
          updateStmt.run(uuidv4(), req.params.id, r.resource_name, r.total, r.available);
        }
      }
    })();
    
    req.io.emit('hospital:resource-update', { hospital_id: req.params.id });
    res.json({ message: 'Resources updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/verify', authenticate, authorize('admin'), (req, res) => {
  const db = req.db;
  try {
    db.prepare('UPDATE hospitals SET verified = 1 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Hospital verified' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/doctors', authenticate, (req, res) => {
  const db = req.db;
  try {
    const doctors = db.prepare('SELECT * FROM doctors WHERE hospital_id = ?').all(req.params.id);
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
