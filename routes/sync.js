const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, (req, res) => {
  const db = req.db;
  const { device_id, operations } = req.body; // operations: [{ operation: 'CREATE_EMERGENCY', data: {...} }]
  
  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'Operations must be an array' });
  }

  try {
    const insertSync = db.prepare('INSERT INTO sync_queue (device_id, operation, data) VALUES (?, ?, ?)');
    
    db.transaction(() => {
      for (const op of operations) {
        insertSync.run(device_id, op.operation, JSON.stringify(op.data));
        
        // Here we could directly process the operations based on op.operation, 
        // e.g., if op.operation === 'UPDATE_LOCATION', apply to emergencies table.
        // For simplicity, we just queue them. A separate worker or logic would process the queue.
      }
    })();
    
    res.json({ message: 'Sync operations queued successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/status', authenticate, (req, res) => {
  const db = req.db;
  try {
    const pendingCount = db.prepare('SELECT COUNT(*) as count FROM sync_queue WHERE status = "pending"').get().count;
    res.json({ pendingSyncs: pendingCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
