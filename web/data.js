export async function loadData() {
  const res = await fetch('fusion.csv');
  const text = await res.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(';');
  const idx = name => headers.indexOf(name);

  const rows = lines.slice(1).map(line => line.split(';'));
  const num = v => (v === undefined || v === '' ? 0 : parseFloat(v)) || 0;

  const col = name => idx(name);

  // --- 1. Evenements par annee ---
  const parAnnee = {};
  const iAnnee = col('annee'), iEvt = col('att_nb_evenements');
  rows.forEach(r => {
    const annee = r[iAnnee];
    parAnnee[annee] = (parAnnee[annee] || 0) + num(r[iEvt]);
  });
  const annees = Object.keys(parAnnee).sort();

  // --- 2. Nb incidents par type d'attaque (gt_) ---
  const attackTypeCols = [
    'gt_Attack Type=DDoS', 'gt_Attack Type=Malware', 'gt_Attack Type=Man-in-the-Middle',
    'gt_Attack Type=Phishing', 'gt_Attack Type=Ransomware', 'gt_Attack Type=SQL Injection'
  ];
  const attackTypeTotals = attackTypeCols.map(c => {
    const i = col(c);
    return rows.reduce((s, r) => s + num(r[i]), 0);
  });

  // --- 3. Repartition par niveau de severite ---
  const severityCols = ['att_Severity Level=High', 'att_Severity Level=Medium', 'att_Severity Level=Low'];
  const severityTotals = severityCols.map(c => {
    const i = col(c);
    return rows.reduce((s, r) => s + num(r[i]), 0);
  });

  // --- 4. Top 5 pays source par nb evenements ---
  const iPaysNom = col('Pays_Source_nom');
  const parPays = {};
  rows.forEach(r => {
    const pays = r[iPaysNom];
    if (!pays) return;
    parPays[pays] = (parPays[pays] || 0) + num(r[iEvt]);
  });
  const topPays = Object.entries(parPays).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // --- 5. Secteurs cibles (gt_Target Industry) ---
  const industryCols = [
    'gt_Target Industry=Banking', 'gt_Target Industry=Education', 'gt_Target Industry=Government',
    'gt_Target Industry=Healthcare', 'gt_Target Industry=IT', 'gt_Target Industry=Retail',
    'gt_Target Industry=Telecommunications'
  ];
  const industryTotals = industryCols.map(c => {
    const i = col(c);
    return rows.reduce((s, r) => s + num(r[i]), 0);
  });

  // --- 6. Mecanismes de defense utilises ---
  const defenseCols = [
    'gt_Defense Mechanism Used=AI-based Detection', 'gt_Defense Mechanism Used=Antivirus',
    'gt_Defense Mechanism Used=Encryption', 'gt_Defense Mechanism Used=Firewall',
    'gt_Defense Mechanism Used=VPN'
  ];
  const defenseTotals = defenseCols.map(c => {
    const i = col(c);
    return rows.reduce((s, r) => s + num(r[i]), 0);
  });

  return {
    evenementsParAnnee: { labels: annees, values: annees.map(a => parAnnee[a]) },
    typesAttaque: { labels: attackTypeCols.map(c => c.split('=')[1]), values: attackTypeTotals },
    severite: { labels: severityCols.map(c => c.split('=')[1]), values: severityTotals },
    topPays: { labels: topPays.map(p => p[0]), values: topPays.map(p => p[1]) },
    secteurs: { labels: industryCols.map(c => c.split('=')[1]), values: industryTotals },
    defenses: { labels: defenseCols.map(c => c.split('=')[1]), values: defenseTotals }
  };
}
