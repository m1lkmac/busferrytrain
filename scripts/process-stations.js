import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and parse CSV
function parseCSV(content) {
  const lines = content.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map((line) => {
    // Handle quoted values with commas
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const obj = {};
    headers.forEach((header, idx) => {
      obj[header.trim()] = values[idx] || "";
    });
    return obj;
  });
}

// Main processing
const csvPath = path.join(
  __dirname,
  "../../12go-TH-stations-mapping.csv"
);
const outputPath = path.join(__dirname, "../src/data/stations.json");

console.log("Reading CSV from:", csvPath);
const csvContent = fs.readFileSync(csvPath, "utf-8");
const rawStations = parseCSV(csvContent);

// Process and clean stations
const seenIds = new Set();
const stations = rawStations
  .filter((s) => {
    // Filter out stations with invalid coordinates
    const lat = parseFloat(s.lat);
    const lon = parseFloat(s.lon);
    // Valid Thailand coordinates: lat 5-21, lon 97-106
    return lat >= 5 && lat <= 21 && lon >= 97 && lon <= 106;
  })
  .map((s) => ({
    id: s.station_id,
    name: s.station_name.replace(/^"|"$/g, ""), // Remove quotes
    city: s.city,
    province: s.province,
    country: "Thailand",
    lat: parseFloat(s.lat),
    lon: parseFloat(s.lon),
    company: "12go",
  }))
  .filter((s) => {
    // Remove duplicates by ID
    if (seenIds.has(s.id)) {
      return false;
    }
    seenIds.add(s.id);
    return true;
  });

// Create lookup indexes
const byId = {};
const byCity = {};
const byProvince = {};

stations.forEach((station) => {
  byId[station.id] = station;

  if (!byCity[station.city]) {
    byCity[station.city] = [];
  }
  byCity[station.city].push(station.id);

  if (!byProvince[station.province]) {
    byProvince[station.province] = [];
  }
  byProvince[station.province].push(station.id);
});

const output = {
  stations,
  indexes: {
    byId,
    byCity,
    byProvince,
  },
  metadata: {
    totalStations: stations.length,
    countries: ["Thailand"],
    companies: ["12go"],
    generatedAt: new Date().toISOString(),
  },
};

// Write output
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`Processed ${stations.length} stations`);
console.log(`Output written to: ${outputPath}`);
