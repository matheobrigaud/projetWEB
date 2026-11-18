const ATTACK_TYPE_COLS = [
  'gt_Attack Type=DDoS', 'gt_Attack Type=Malware', 'gt_Attack Type=Man-in-the-Middle',
  'gt_Attack Type=Phishing', 'gt_Attack Type=Ransomware', 'gt_Attack Type=SQL Injection'
];
const SEVERITY_COLS = ['att_Severity Level=High', 'att_Severity Level=Medium', 'att_Severity Level=Low'];
const INDUSTRY_COLS = [
  'gt_Target Industry=Banking', 'gt_Target Industry=Education', 'gt_Target Industry=Government',
  'gt_Target Industry=Healthcare', 'gt_Target Industry=IT', 'gt_Target Industry=Retail',
  'gt_Target Industry=Telecommunications'
];
const DEFENSE_COLS = [
  'gt_Defense Mechanism Used=AI-based Detection', 'gt_Defense Mechanism Used=Antivirus',
  'gt_Defense Mechanism Used=Encryption', 'gt_Defense Mechanism Used=Firewall',
  'gt_Defense Mechanism Used=VPN'
];

export async function loadRaw() {
  const res = await fetch('fusion.csv');
  const text = await res.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(';');
  const col = name => headers.indexOf(name);
  const rows = lines.slice(1).map(line => line.split(';'));
  const num = v => (v === undefined || v === '' ? 0 : parseFloat(v)) || 0;
  const iAnnee = col('annee');
  const years = Array.from(new Set(rows.map(r => r[iAnnee]))).filter(Boolean).sort();
  return { rows, col, num, iAnnee, years };
}

function sumCols(rows, cols, col, num) {
  return cols.map(c => {
    const i = col(c);
    return rows.reduce((s, r) => s + num(r[i]), 0);
  });
}

// evenementsParAnnee reste toujours calculé sur l'historique complet (c'est
// justement l'axe temporel) ; le reste respecte le filtre "year" (ou null = tout).
export function aggregate(raw, year) {
  const { rows, col, num, iAnnee } = raw;
  const iEvt = col('att_nb_evenements');

  const parAnnee = {};
  rows.forEach(r => {
    const a = r[iAnnee];
    parAnnee[a] = (parAnnee[a] || 0) + num(r[iEvt]);
  });
  const annees = Object.keys(parAnnee).sort();

  const filtered = year ? rows.filter(r => r[iAnnee] === year) : rows;

  const iPaysNom = col('Pays_Source_nom');
  const parPays = {};
  filtered.forEach(r => {
    const pays = r[iPaysNom];
    if (!pays) return;
    parPays[pays] = (parPays[pays] || 0) + num(r[iEvt]);
  });
  const topPays = Object.entries(parPays).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    evenementsParAnnee: { labels: annees, values: annees.map(a => parAnnee[a]) },
    typesAttaque: { labels: ATTACK_TYPE_COLS.map(c => c.split('=')[1]), values: sumCols(filtered, ATTACK_TYPE_COLS, col, num) },
    severite: { labels: SEVERITY_COLS.map(c => c.split('=')[1]), values: sumCols(filtered, SEVERITY_COLS, col, num) },
    topPays: { labels: topPays.map(p => p[0]), values: topPays.map(p => p[1]) },
    secteurs: { labels: INDUSTRY_COLS.map(c => c.split('=')[1]), values: sumCols(filtered, INDUSTRY_COLS, col, num) },
    defenses: { labels: DEFENSE_COLS.map(c => c.split('=')[1]), values: sumCols(filtered, DEFENSE_COLS, col, num) }
  };
}

// Conservé pour compatibilité : charge et agrège sans filtre.
export async function loadData() {
  const raw = await loadRaw();
  return aggregate(raw, null);
}
