const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.post('/', authenticate, authorize(['hospital_staff', 'admin']), (req, res) => {
  const db = req.db;
  const { emergency_id, to_hospital_id, reason, requirements } = req.body;
  const id = uuidv4();
  const from_hospital_id = req.user.role === 'admin' ? req.body.from_hospital_id : req.user.hospital_id;
  
  try {
    db.prepare(`
      INSERT INTO transfers (id, emergency_id, from_hospital_id, to_hospital_id, reason, requirements)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, emergency_id, from_hospital_id, to_hospital_id, reason, requirements);
    
    req.io.emit('transfer:request', { id, emergency_id, from_hospital_id, to_hospital_id });
    res.status(201).json({ id, message: 'Transfer requested' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', authenticate, authorize(['hospital_staff', 'admin']), (req, res) => {
  const db = req.db;
  const { status } = req.body;
  
  try {
    db.prepare('UPDATE transfers SET status = ? WHERE id = ?').run(status, req.params.id);
    req.io.emit('transfer:response', { id: req.params.id, status });
    res.json({ message: 'Transfer status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', authenticate, authorize(['hospital_staff', 'admin']), (req, res) => {
  const db = req.db;
  try {
    let query = 'SELECT * FROM transfers WHERE 1=1';
    let params = [];
    
    if (req.user.role === 'hospital_staff') {
      query += ' AND (from_hospital_id = ? OR to_hospital_id = ?)';
      params.push(req.user.hospital_id, req.user.hospital_id);
    }
    
    const transfers = db.prepare(query).all(...params);
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
