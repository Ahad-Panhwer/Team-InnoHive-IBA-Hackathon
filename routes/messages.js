const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.post('/', authenticate, (req, res) => {
  const db = req.db;
  const { emergency_id, recipient_id, recipient_type, content, message_type } = req.body;
  const id = uuidv4();
  
  try {
    db.prepare(`
      INSERT INTO messages (id, emergency_id, sender_id, sender_type, recipient_id, recipient_type, content, message_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, emergency_id, req.user.id, req.user.role, recipient_id, recipient_type, content, message_type || 'text');
    
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    req.io.emit('message:receive', msg);
    
    res.status(201).json({ id, message: 'Message sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/emergency/:emergency_id', authenticate, (req, res) => {
  const db = req.db;
  try {
    const messages = db.prepare('SELECT * FROM messages WHERE emergency_id = ? ORDER BY created_at ASC').all(req.params.emergency_id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
