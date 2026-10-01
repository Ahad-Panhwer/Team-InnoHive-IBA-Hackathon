const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.get('/', authenticate, (req, res) => {
  const db = req.db;
  try {
    let query = 'SELECT * FROM doctors WHERE 1=1';
    let params = [];
    
    if (req.query.hospital_id) {
      query += ' AND hospital_id = ?';
      params.push(req.query.hospital_id);
    }
    if (req.query.specialization) {
      query += ' AND specialization = ?';
      params.push(req.query.specialization);
    }
    if (req.query.status) {
      query += ' AND status = ?';
      params.push(req.query.status);
    }

    const doctors = db.prepare(query).all(...params);
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', authenticate, authorize(['doctor', 'hospital_staff', 'admin']), (req, res) => {
  const db = req.db;
  const { status } = req.body;
  
  if (!['onsite','oncall','busy','off'].includes(status)) return res.status(400).json({ error: 'Invalid doctor status' });
  try {
    const doctor = db.prepare('SELECT hospital_id,user_id FROM doctors WHERE id = ?').get(req.params.id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    if (req.user.role === 'hospital_staff' && doctor.hospital_id !== req.user.hospital_id) return res.status(403).json({ error: 'Doctor belongs to another hospital' });
    if (req.user.role === 'doctor' && doctor.user_id && doctor.user_id !== req.user.id) return res.status(403).json({ error: 'You can only update your own doctor profile' });
    db.prepare('UPDATE doctors SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
    req.io.emit('doctor:status-change', { doctor_id: req.params.id, status });
    res.json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
