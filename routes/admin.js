const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

router.get('/analytics', authenticate, authorize('admin'), (req, res) => {
  const db = req.db;
  try {
    const totalEmergencies = db.prepare('SELECT COUNT(*) as count FROM emergencies').get().count;
    const completedEmergencies = db.prepare('SELECT COUNT(*) as count FROM emergencies WHERE status = "completed"').get().count;
    const totalHospitals = db.prepare('SELECT COUNT(*) as count FROM hospitals').get().count;
    const totalAmbulances = db.prepare('SELECT COUNT(*) as count FROM ambulances').get().count;
    
    // Average response time (created to arrived)
    const avgResponseData = db.prepare(`
      SELECT AVG((julianday(arrived_at) - julianday(created_at)) * 24 * 60) as avg_minutes 
      FROM emergencies 
      WHERE arrived_at IS NOT NULL AND created_at IS NOT NULL
    `).get();

    res.json({
      totalEmergencies,
      completedEmergencies,
      totalHospitals,
      totalAmbulances,
      averageResponseTimeMinutes: avgResponseData.avg_minutes ? Math.round(avgResponseData.avg_minutes) : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-log', authenticate, authorize('admin'), (req, res) => {
  const db = req.db;
  try {
    const logs = db.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100').all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
