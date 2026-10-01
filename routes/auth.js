const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');

router.post('/register', (req, res) => {
  const { username, password, role, full_name, email, phone, hospital_id, ambulance_id, specialization } = req.body;
  const db = req.db;
  
  try {
    if (!username || !password || !full_name || !['driver', 'hospital_staff', 'doctor', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'username, password, full_name and a valid role are required' });
    }
    if (role === 'admin') return res.status(403).json({ error: 'Administrator accounts are provisioned by the system administrator' });
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    
    db.prepare(`
      INSERT INTO users (id, username, password, role, full_name, email, phone, hospital_id, ambulance_id, specialization)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, hash, role, full_name, email, phone, hospital_id, ambulance_id, specialization);
    
    res.status(201).json({ message: 'User registered successfully', userId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const db = req.db;

  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        hospital_id: user.hospital_id,
        ambulance_id: user.ambulance_id
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    delete user.password;
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile', authenticate, (req, res) => {
  const db = req.db;
  try {
    const user = db.prepare('SELECT id, username, role, full_name, email, phone, hospital_id, ambulance_id, specialization, status, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
