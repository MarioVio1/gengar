// Keep-alive service - Mantiene il server sempre attivo
// Pinga ogni 5 minuti e si assicura che il server risponda

const PING_INTERVAL = 5 * 60 * 1000; // 5 minuti
const SERVER_URL = "http://localhost:3000";
const HEALTH_ENDPOINT = `${SERVER_URL}/manifest.json`;

let consecutiveFailures = 0;
const MAX_FAILURES = 3;

async function ping() {
  const now = new Date().toLocaleString("it-IT");
  const hour = new Date().getHours();
  
  try {
    // Ping l'endpoint manifest per verificare che l'addon funzioni
    const response = await fetch(HEALTH_ENDPOINT, {
      signal: AbortSignal.timeout(10000) // 10 secondi timeout
    });
    
    if (response.ok) {
      consecutiveFailures = 0;
      console.log(`[${now}] ✅ Server attivo - Status: ${response.status}`);
    } else {
      consecutiveFailures++;
      console.log(`[${now}] ⚠️ Server risponde con status: ${response.status} (fallimenti: ${consecutiveFailures})`);
    }
  } catch (error) {
    consecutiveFailures++;
    console.log(`[${now}] ❌ Errore ping #${consecutiveFailures}: ${error}`);
    
    if (consecutiveFailures >= MAX_FAILURES) {
      console.log(`[${now}] 🚨 Troppi fallimenti consecutivi! Il server potrebbe essere down.`);
    }
  }
}

// Sveglia alle 9 di mattina (se il server fosse in sleep)
function scheduleMorningWakeUp() {
  const now = new Date();
  const target = new Date();
  target.setHours(9, 0, 0, 0);
  
  // Se sono già passate le 9, programma per domani
  if (now.getHours() >= 9) {
    target.setDate(target.getDate() + 1);
  }
  
  const msUntilWakeUp = target.getTime() - now.getTime();
  
  console.log(`⏰ Sveglia programmata alle 09:00 (tra ${Math.round(msUntilWakeUp / 60000)} minuti)`);
  
  setTimeout(() => {
    console.log("🌅 Buongiorno! Sveglia delle 9:00 - Ping in corso...");
    ping();
    scheduleMorningWakeUp(); // Riprogramma per domani
  }, msUntilWakeUp);
}

// Log stato
function logStatus() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "";
  
  if (hour >= 6 && hour < 12) greeting = "🌅 Buongiorno";
  else if (hour >= 12 && hour < 18) greeting = "☀️ Buon pomeriggio";
  else if (hour >= 18 && hour < 22) greeting = "🌆 Buonasera";
  else greeting = "🌙 Buonanotte";
  
  console.log(`\n${greeting}! Keep-alive service attivo.`);
  console.log(`📊 Uptime: ${Math.floor(process.uptime() / 60)} minuti`);
  console.log(`🎯 Target: ${SERVER_URL}`);
  console.log(`⏰ Prossimo ping tra: ${PING_INTERVAL / 60000} minuti\n`);
}

// Avvio
console.log("🔄 Keep-alive service avviato!");
console.log(`🎯 Target: ${SERVER_URL}`);
console.log(`⏰ Intervallo ping: ${PING_INTERVAL / 60000} minuti`);

// Ping immediato
ping();

// Poi ogni 5 minuti
setInterval(ping, PING_INTERVAL);

// Schedula sveglia mattutina
scheduleMorningWakeUp();

// Log stato ogni ora
setInterval(logStatus, 60 * 60 * 1000);
