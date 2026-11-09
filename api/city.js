// api/city.js — "+ Citta'" di Thai Expat: chiede a Gemini la scheda di una localita'
// thailandese. La chiave resta su Vercel (GEMINI_API_KEY). Protetto da APP_PIN.
const MODEL = "gemini-2.5-flash";

const SYSTEM = `Sei il massimo esperto di espatrio, pensionamento e vita in Thailandia.
L'utente ti fornira' il nome di una localita' o isola thailandese. Restituisci ESCLUSIVAMENTE un oggetto JSON valido che rispetti lo schema, con testi in italiano adatti a un pensionato di 55-60 anni che valuta: vita serale, relazioni stabili con una compagna, budget mensile realistico e qualita' della sanita'.
Le coordinate lat/lng devono essere quelle reali del centro della localita'.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    id: { type: "STRING" },
    name: { type: "STRING" },
    zone: { type: "STRING" },
    type: { type: "STRING" },
    nightlife: { type: "NUMBER", description: "Voto da 1 a 10 per locali e movida" },
    dating: { type: "NUMBER", description: "Voto da 1 a 10 per facilità di trovare moglie o compagna seria e duratura per un 60enne" },
    cost: { type: "NUMBER", description: "Voto da 1 a 10 per convenienza economica (10 = super economico)" },
    services: { type: "NUMBER", description: "Voto da 1 a 10 per qualità ospedali e comodità" },
    beachQuality: { type: "NUMBER", description: "Voto da 1 a 10 per mare e spiagge (1 se non c'è il mare)" },
    lat: { type: "NUMBER", description: "Latitudine del centro della località (gradi decimali)" },
    lng: { type: "NUMBER", description: "Longitudine del centro della località (gradi decimali)" },
    budgetThb: { type: "STRING", description: "Range mensile in Baht, es. 28.000 - 45.000" },
    budgetEurMin: { type: "INTEGER", description: "Spesa minima mensile in Euro" },
    budgetEurMax: { type: "INTEGER", description: "Spesa confortevole mensile in Euro" },
    badge: { type: "STRING", description: "Titolo sintetico breve, es. Natura & Serenità" },
    badgeColor: { type: "STRING", description: "Classe tailwind per badge (usa: bg-teal-900/60 text-teal-300 border-teal-700 oppure bg-cyan-900/60 text-cyan-300 border-cyan-700)" },
    summary: { type: "STRING", description: "Breve sintesi di 1-2 frasi" },
    datingDynamic: { type: "STRING", description: "Dettaglio su come trovare una compagna seria a 50-60 anni in questa zona" },
    nightlifeDetail: { type: "STRING", description: "Dettaglio sulla vita serale, bar, musica live" },
    healthcare: { type: "STRING", description: "Ospedali principali e cliniche private vicine" },
    housing: { type: "STRING", description: "Tipologia e costo degli affitti mensili" },
    pros: { type: "ARRAY", items: { type: "STRING" } },
    cons: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["id", "name", "zone", "type", "nightlife", "dating", "cost", "services", "beachQuality", "budgetThb", "budgetEurMin", "budgetEurMax", "badge", "badgeColor", "summary", "datingDynamic", "nightlifeDetail", "healthcare", "housing", "pros", "cons"]
};
SCHEMA.required = SCHEMA.required.concat(["lat", "lng"]);

// Qualsiasi indirizzo (file sul Mac, GitHub Pages, Vercel): a proteggere la chiave c'e' il PIN
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-App-Pin");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Metodo non consentito" }); return; }

  const appPin = process.env.APP_PIN;
  if (!appPin) { res.status(503).json({ error: "AI non configurata: manca APP_PIN su Vercel." }); return; }
  if ((req.headers["x-app-pin"] || "") !== appPin) { res.status(401).json({ error: "PIN non valido" }); return; }

  const key = process.env.GEMINI_API_KEY;
  if (!key) { res.status(503).json({ error: "AI non configurata: manca GEMINI_API_KEY su Vercel." }); return; }

  const city = String((req.body && req.body.city) || "").trim().slice(0, 80);
  if (!city) { res.status(400).json({ error: "Scrivi il nome di una localita'." }); return; }

  try {
    const body = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Genera i dati completi per la localita' thailandese: "${city}".` }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0.4 }
    };
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: JSON.stringify(body) }
    );
    const data = await r.json();
    if (!r.ok) { res.status(502).json({ error: "Errore Gemini: " + (data?.error?.message || r.status) }); return; }
    const text = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    let cityData;
    try { cityData = JSON.parse(text); } catch (e) { res.status(502).json({ error: "Risposta di Gemini non valida, riprova." }); return; }
    res.status(200).json({ city: cityData });
  } catch (err) {
    res.status(500).json({ error: "Errore interno: " + String(err) });
  }
};
