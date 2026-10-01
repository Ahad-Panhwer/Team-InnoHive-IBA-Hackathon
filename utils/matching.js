const { haversine } = require('./haversine');

// Emergency type requirements
const TYPE_REQUIREMENTS = {
  head_injury: ['CT scanner', 'neurosurgeon', 'emergency bed'], // possible ICU
  cardiac: ['cath lab', 'cardiologist', 'ICU'],
  stroke: ['CT scanner', 'neurologist', 'emergency bed'],
  trauma: ['CT scanner', 'trauma surgeon', 'operating room', 'emergency bed'],
  burn: ['burn unit', 'emergency bed'], // possible ICU
  respiratory: ['ventilator', 'ICU', 'pulmonologist'],
  pediatric: ['pediatric ward', 'pediatrician'],
  obstetric: ['maternity ward', 'obstetrician']
};

function matchHospitals(emerg_type, lat, lng, hospitals, resources, doctors) {
  const reqs = TYPE_REQUIREMENTS[emerg_type] || ['emergency bed'];
  const MAX_RADIUS = 60; // 60 km max distance default

  let matched = [];
  
  for (const hospital of hospitals) {
    if (hospital.accepting_emergency === 0) continue;

    // Calculate distance
    const distance = haversine(lat, lng, hospital.latitude, hospital.longitude);
    if (distance > MAX_RADIUS) continue; // Filter by initial radius

    const hospResources = resources.filter(r => r.hospital_id === hospital.id);
    const hospDoctors = doctors.filter(d => d.hospital_id === hospital.id);

    let requiredCapabilitiesScore = 0;
    let requiredCapabilitiesTotal = reqs.length;
    let requiredCapabilitiesMatched = 0;
    
    let specialistAvailable = false;
    let bedAvailable = false;
    
    let reasons = [];

    for (const req of reqs) {
      // Check if it's a doctor specialization
      let docMatch = hospDoctors.find(d => d.specialization.toLowerCase() === req.toLowerCase() && d.status === 'onsite');
      if (docMatch) {
        requiredCapabilitiesMatched++;
        specialistAvailable = true;
        reasons.push(`${req} available (onsite)`);
      } else {
        // check resource
        let resMatch = hospResources.find(r => r.resource_name.toLowerCase() === req.toLowerCase() && r.available > 0);
        if (resMatch) {
          requiredCapabilitiesMatched++;
          if (req.toLowerCase().includes('bed') || req.toLowerCase().includes('icu')) bedAvailable = true;
          reasons.push(`${req} available (${resMatch.available} free)`);
        } else {
            reasons.push(`${req} NOT available/free`);
        }
      }
    }

    const reqMatchPercentage = (requiredCapabilitiesMatched / requiredCapabilitiesTotal) * 100;
    
    // Resource availability overall percentage
    let totalAvail = hospResources.reduce((acc, curr) => acc + curr.available, 0);
    let totalTotal = hospResources.reduce((acc, curr) => acc + curr.total, 0);
    const resourceAvailPerc = totalTotal > 0 ? (totalAvail / totalTotal) * 100 : 0;
    
    // Scoring
    // Required capabilities match (weight: 40%)
    // Distance/ETA (weight: 25%) - closer is better, normalize against max radius
    // Resource availability (weight: 20%)
    // Trust score (weight: 10%)
    // Data freshness (weight: 5%)
    
    const capScore = (reqMatchPercentage / 100) * 40;
    const distScore = (Math.max(0, MAX_RADIUS - distance) / MAX_RADIUS) * 25;
    const resScore = (resourceAvailPerc / 100) * 20;
    const trustScore = (hospital.trust_score / 100) * 10;
    
    // Simplification for freshness - assume max score for now
    const freshnessScore = 5; 
    
    const totalScore = capScore + distScore + resScore + trustScore + freshnessScore;

    matched.push({
      hospital: hospital,
      distance_km: distance.toFixed(2),
      travel_time_mins: Math.round(distance / 40 * 60), // assume 40km/h avg speed
      score: totalScore.toFixed(2),
      reasons: reasons,
      reqMatchPercentage,
      specialistAvailable,
      bedAvailable
    });
  }

  // Sort by score descending
  matched.sort((a, b) => b.score - a.score);
  
  // Return top 10
  return matched.slice(0, 10);
}

module.exports = { matchHospitals };
