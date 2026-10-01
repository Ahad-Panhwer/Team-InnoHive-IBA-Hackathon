const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.get('/', authenticate, (req, res) => {
  const db = req.db;
  try {
    let query = 'SELECT * FROM ambulances WHERE 1=1';
    let params = [];
    
    if (req.query.status) {
      query += ' AND status = ?';
      params.push(req.query.status);
    }

    const ambulances = db.prepare(query).all(...params);
    res.json(ambulances);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, authorize('admin'), (req, res) => {
  const db = req.db;
  const { vehicle_number, organization, equipment } = req.body;
  const id = uuidv4();
  
  try {
    db.prepare(`
      INSERT INTO ambulances (id, vehicle_number, organization, equipment)
      VALUES (?, ?, ?, ?)
    `).run(id, vehicle_number, organization, equipment);
    
    res.status(201).json({ id, message: 'Ambulance registered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', authenticate, authorize(['driver', 'admin']), (req, res) => {
  const db = req.db;
  const { status } = req.body;
  
  try {
    db.prepare('UPDATE ambulances SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/location', authenticate, authorize(['driver']), (req, res) => {
  const db = req.db;
  const { latitude, longitude } = req.body;
  
  try {
    db.prepare('UPDATE ambulances SET latitude = ?, longitude = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(latitude, longitude, req.params.id);
    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
