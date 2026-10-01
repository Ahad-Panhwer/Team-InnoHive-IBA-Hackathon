const fs = require('fs');
const path = require('path');
const Database = require('./connection');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './database/emergency.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

console.log('Initializing database...');

const initSql = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('driver','hospital_staff','doctor','admin')),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  hospital_id TEXT,
  ambulance_id TEXT,
  specialization TEXT,
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hospitals
CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT,
  type TEXT NOT NULL CHECK(type IN ('Government','Private','Charitable')),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  emergency_phone TEXT,
  verified INTEGER DEFAULT 0,
  accepting_emergency INTEGER DEFAULT 1,
  trust_score INTEGER DEFAULT 80,
  gate_name TEXT DEFAULT 'Emergency entrance',
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hospital Resources
CREATE TABLE IF NOT EXISTS hospital_resources (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  resource_type TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  total INTEGER DEFAULT 0,
  available INTEGER DEFAULT 0,
  status TEXT DEFAULT 'available',
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Doctors
CREATE TABLE IF NOT EXISTS doctors (
  id TEXT PRIMARY KEY,
  hospital_id TEXT NOT NULL REFERENCES hospitals(id),
  user_id TEXT REFERENCES users(id),
  full_name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  status TEXT DEFAULT 'onsite' CHECK(status IN ('onsite','oncall','busy','off')),
  phone TEXT,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ambulances
CREATE TABLE IF NOT EXISTS ambulances (
  id TEXT PRIMARY KEY,
  vehicle_number TEXT NOT NULL,
  driver_id TEXT REFERENCES users(id),
  organization TEXT,
  equipment TEXT,
  status TEXT DEFAULT 'available' CHECK(status IN ('available','dispatched','enroute','at_scene','returning','maintenance')),
  latitude REAL,
  longitude REAL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Emergency Cases
CREATE TABLE IF NOT EXISTS emergencies (
  id TEXT PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL,
  ambulance_id TEXT REFERENCES ambulances(id),
  hospital_id TEXT REFERENCES hospitals(id),
  emergency_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('critical','serious','moderate')),
  status TEXT DEFAULT 'created' CHECK(status IN ('created','assessing','hospital_selected','notified','accepted','declined','enroute','arrived','treatment_started','transferred','completed','cancelled')),
  patient_name TEXT,
  patient_age INTEGER,
  patient_sex TEXT,
  patient_blood_group TEXT,
  patient_cnic TEXT,
  patient_contact TEXT,
  vitals_hr TEXT,
  vitals_bp TEXT,
  vitals_spo2 TEXT,
  vitals_gcs TEXT,
  vitals_status TEXT DEFAULT 'stable',
  mechanism TEXT,
  allergies TEXT,
  notes TEXT,
  treatment_given TEXT,
  requirements TEXT,
  eta_minutes INTEGER,
  distance_km REAL,
  pickup_lat REAL,
  pickup_lng REAL,
  current_lat REAL,
  current_lng REAL,
  golden_hour_deadline DATETIME,
  destination_area TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  accepted_at DATETIME,
  arrived_at DATETIME,
  completed_at DATETIME
);

-- Transfer Requests
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY,
  emergency_id TEXT REFERENCES emergencies(id),
  from_hospital_id TEXT REFERENCES hospitals(id),
  to_hospital_id TEXT REFERENCES hospitals(id),
  reason TEXT,
  requirements TEXT,
  status TEXT DEFAULT 'requested' CHECK(status IN ('requested','accepted','declined','in_transit','completed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  emergency_id TEXT,
  sender_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  recipient_id TEXT,
  recipient_type TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  details TEXT,
  ip_address TEXT
);

-- Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  operation TEXT NOT NULL,
  data TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  synced_at DATETIME
);
`;

db.exec(initSql);

console.log('Tables created. Seeding data...');

// Seeding Data
const hashPassword = (pw) => bcrypt.hashSync(pw, 10);

const adminId = uuidv4();
const driverId = uuidv4();
const hospitalStaffId = uuidv4();
const doctorUserId = uuidv4();

const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, username, password, role, full_name) VALUES (?, ?, ?, ?, ?)');
insertUser.run(adminId, 'admin', hashPassword('admin'), 'admin', 'System Administrator');
insertUser.run(driverId, 'driver', hashPassword('driver'), 'driver', 'Demo Driver');
insertUser.run(hospitalStaffId, 'hospital', hashPassword('hospital'), 'hospital_staff', 'Demo Hospital Staff');
insertUser.run(doctorUserId, 'doctor', hashPassword('doctor'), 'doctor', 'Demo Doctor');

// Seed the demo network once; generated ids must not create duplicate hospitals on every restart.
if (db.prepare('SELECT COUNT(*) AS count FROM hospitals').get().count === 0) {
// Hospitals in Pakistan (Demo Data)
const hospitalsData = [
  { id: uuidv4(), name: 'Aga Khan University Hospital', city: 'Karachi', province: 'Sindh', type: 'Private', lat: 24.8922, lng: 67.0734 },
  { id: uuidv4(), name: 'Jinnah Postgraduate Medical Centre', city: 'Karachi', province: 'Sindh', type: 'Government', lat: 24.8511, lng: 67.0427 },
  { id: uuidv4(), name: 'Civil Hospital', city: 'Karachi', province: 'Sindh', type: 'Government', lat: 24.8623, lng: 67.0145 },
  { id: uuidv4(), name: 'Liaquat National Hospital', city: 'Karachi', province: 'Sindh', type: 'Private', lat: 24.8901, lng: 67.0745 },
  { id: uuidv4(), name: 'Mayo Hospital', city: 'Lahore', province: 'Punjab', type: 'Government', lat: 31.5794, lng: 74.3129 },
  { id: uuidv4(), name: 'Shaukat Khanum Hospital', city: 'Lahore', province: 'Punjab', type: 'Charitable', lat: 31.4770, lng: 74.2706 },
  { id: uuidv4(), name: 'Jinnah Hospital', city: 'Lahore', province: 'Punjab', type: 'Government', lat: 31.4878, lng: 74.2969 },
  { id: uuidv4(), name: 'PIMS', city: 'Islamabad', province: 'Federal', type: 'Government', lat: 33.7027, lng: 73.0483 },
  { id: uuidv4(), name: 'Shifa International', city: 'Islamabad', province: 'Federal', type: 'Private', lat: 33.6669, lng: 73.0645 },
  { id: uuidv4(), name: 'Lady Reading Hospital', city: 'Peshawar', province: 'KPK', type: 'Government', lat: 34.0097, lng: 71.5746 },
  { id: uuidv4(), name: 'Hayatabad Medical Complex', city: 'Peshawar', province: 'KPK', type: 'Government', lat: 33.9926, lng: 71.4426 },
  { id: uuidv4(), name: 'Bolan Medical Complex', city: 'Quetta', province: 'Balochistan', type: 'Government', lat: 30.2223, lng: 66.9856 },
  { id: uuidv4(), name: 'Sandeman Provincial Hospital', city: 'Quetta', province: 'Balochistan', type: 'Government', lat: 30.1985, lng: 67.0097 },
  { id: uuidv4(), name: 'Allied Hospital', city: 'Faisalabad', province: 'Punjab', type: 'Government', lat: 31.4312, lng: 73.0682 },
  { id: uuidv4(), name: 'Faisalabad Institute of Cardiology', city: 'Faisalabad', province: 'Punjab', type: 'Government', lat: 31.4284, lng: 73.0784 },
  { id: uuidv4(), name: 'Nishtar Hospital', city: 'Multan', province: 'Punjab', type: 'Government', lat: 30.2052, lng: 71.4552 },
  { id: uuidv4(), name: 'Liaquat University Hospital', city: 'Hyderabad', province: 'Sindh', type: 'Government', lat: 25.3854, lng: 68.3695 },
  { id: uuidv4(), name: 'Ghulam Muhammad Mahar Medical College', city: 'Sukkur', province: 'Sindh', type: 'Government', lat: 27.7268, lng: 68.8228 },
];

const insertHospital = db.prepare('INSERT OR IGNORE INTO hospitals (id, name, city, province, type, latitude, longitude, verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)');
const insertResource = db.prepare('INSERT OR IGNORE INTO hospital_resources (id, hospital_id, resource_type, resource_name, total, available) VALUES (?, ?, ?, ?, ?, ?)');
const insertDoctor = db.prepare('INSERT OR IGNORE INTO doctors (id, hospital_id, full_name, specialization) VALUES (?, ?, ?, ?)');
const updateStaffHospital = db.prepare('UPDATE users SET hospital_id = ? WHERE id = ?');
const updateDoctorHospital = db.prepare('UPDATE users SET hospital_id = ? WHERE id = ?');

let firstHospId = null;

hospitalsData.forEach((h, index) => {
  insertHospital.run(h.id, h.name, h.city, h.province, h.type, h.lat, h.lng);
  
  if (index === 0) {
    firstHospId = h.id;
    updateStaffHospital.run(h.id, hospitalStaffId);
    updateDoctorHospital.run(h.id, doctorUserId);
    // Link doctor user to first hospital's doctor
    db.prepare('INSERT OR IGNORE INTO doctors (id, hospital_id, user_id, full_name, specialization) VALUES (?, ?, ?, ?, ?)').run(uuidv4(), h.id, doctorUserId, 'Demo Doctor', 'Neurosurgeon');
  }

  // Resources
  const flagship = index === 0;
  insertResource.run(uuidv4(), h.id, 'bed', 'Emergency Bed', 50, flagship ? 18 : Math.floor(Math.random() * 50));
  insertResource.run(uuidv4(), h.id, 'icu', 'ICU', 20, flagship ? 3 : Math.floor(Math.random() * 20));
  insertResource.run(uuidv4(), h.id, 'equipment', 'CT Scanner', 2, flagship ? 1 : Math.floor(Math.random() * 2));
  insertResource.run(uuidv4(), h.id, 'equipment', 'Ventilator', 15, flagship ? 6 : Math.floor(Math.random() * 15));

  // Fictional, available specialty resources make the integrated demo usable across emergency types.
  if (flagship) {
    insertResource.run(uuidv4(), h.id, 'equipment', 'Cath Lab', 1, 1);
    insertResource.run(uuidv4(), h.id, 'equipment', 'Operating Room', 2, 1);
    insertResource.run(uuidv4(), h.id, 'equipment', 'Burn Unit', 1, 1);
    insertResource.run(uuidv4(), h.id, 'ward', 'Pediatric Ward', 12, 4);
    insertResource.run(uuidv4(), h.id, 'ward', 'Maternity Ward', 10, 3);
  }

  // Doctors (random)
  insertDoctor.run(uuidv4(), h.id, `Dr. ${h.name.split(' ')[0]}`, 'Cardiologist');
  insertDoctor.run(uuidv4(), h.id, `Dr. ${h.name.split(' ')[0]} Traumatologist`, 'Trauma Surgeon');
  if (flagship) {
    insertDoctor.run(uuidv4(), h.id, 'Dr. Demo Stroke Specialist', 'Neurologist');
    insertDoctor.run(uuidv4(), h.id, 'Dr. Demo Child Specialist', 'Pediatrician');
    insertDoctor.run(uuidv4(), h.id, 'Dr. Demo Obstetrician', 'Obstetrician');
  }
});

// Ambulances
const insertAmbulance = db.prepare('INSERT OR IGNORE INTO ambulances (id, vehicle_number, driver_id, organization) VALUES (?, ?, ?, ?)');
const ambId = uuidv4();
insertAmbulance.run(ambId, 'KHI-1234', driverId, 'Edhi Foundation');
db.prepare('UPDATE users SET ambulance_id = ? WHERE id = ?').run(ambId, driverId);
insertAmbulance.run(uuidv4(), 'LHR-5678', null, 'Rescue 1122');
insertAmbulance.run(uuidv4(), 'ISB-9012', null, 'Chhipa');
}

console.log('Database initialized and seeded.');
db.close();
