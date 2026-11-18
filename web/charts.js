// Construction du tableau de bord (jQuery pour le DOM, Chart.js pour les graphiques)
const PALETTE = ['#4dabf7', '#ff6b6b', '#51cf66', '#ffd43b', '#da77f2', '#22b8cf', '#ff922b', '#845ef7'];

// Fond opaque : sans ça, les zones vides du canvas restent transparentes
// (noires une fois utilisées comme texture three.js, qui ignore l'alpha).
const bgPlugin = {
  id: 'opaqueBg',
  beforeDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
};

function chartConfig(type, labels, values, title) {
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);
  return {
    type,
    plugins: [bgPlugin],
    data: {
      labels,
      datasets: [{
        label: title,
        data: values,
        backgroundColor: type === 'line' ? 'rgba(77,171,247,0.25)' : colors,
        borderColor: type === 'line' ? '#4dabf7' : '#10141a',
        borderWidth: type === 'line' ? 3 : 1,
        fill: type === 'line',
        tension: 0.3,
        pointBackgroundColor: '#4dabf7',
        pointRadius: type === 'line' ? 4 : undefined,
        pointHoverRadius: type === 'line' ? 7 : undefined
      }]
    },
    options: {
      animation: false,
      responsive: false,
      indexAxis: type === 'bar' && /pays/i.test(title) ? 'y' : 'x',
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        title: { display: true, text: title, color: '#eee', font: { size: 18 } },
        legend: { display: type !== 'bar' && type !== 'line', labels: { color: '#ccc' } },
        tooltip: { enabled: true, backgroundColor: '#0d1117', titleColor: '#9fd3ff', bodyColor: '#eee' }
      },
      scales: ['line', 'bar'].includes(type) ? {
        x: { ticks: { color: '#ccc' }, grid: { color: '#2a323c' } },
        y: { ticks: { color: '#ccc' }, grid: { color: '#2a323c' }, beginAtZero: true }
      } : {}
    }
  };
}

const DEFINITIONS = (data) => [
  { id: 'evt', title: 'Événements par année', type: 'line', ...data.evenementsParAnnee },
  { id: 'atk', title: "Incidents par type d'attaque", type: 'bar', ...data.typesAttaque },
  { id: 'sev', title: 'Répartition par sévérité', type: 'doughnut', ...data.severite },
  { id: 'pays', title: 'Top 5 pays source (événements)', type: 'bar', ...data.topPays },
  { id: 'sect', title: 'Secteurs cibles', type: 'radar', ...data.secteurs },
  { id: 'def', title: 'Mécanismes de défense utilisés', type: 'polarArea', ...data.defenses }
];

const chartsById = {};      // id -> Chart (texture 3D)
const flatChartsById = {};  // id -> Chart (tableau de bord 2D)
const texCanvasById = {};   // id -> <canvas> (texture 3D)
const metaById = {};        // id -> { title, labels, values, type } pour le tooltip 3D

// Construit les graphiques en double : un canvas haute résolution (texture 3D)
// et un canvas visible dans le tableau de bord 2D. Retourne la liste pour three.js.
window.buildDashboard = function (data) {
  const defs = DEFINITIONS(data);
  const results = [];

  const $factory = $('#chart-factory');
  const $grid = $('#dashboard2d-grid').empty();

  defs.forEach(def => {
    const $texCanvas = $('<canvas>').attr({ id: 'tex-' + def.id, width: 768, height: 480 });
    $factory.append($texCanvas);
    const texChart = new Chart($texCanvas[0].getContext('2d'), chartConfig(def.type, def.labels, def.values, def.title));

    const $card = $('<div>').addClass('chart-card').attr('data-id', def.id);
    $('<h3>').text(def.title).appendTo($card);
    const $flatCanvas = $('<canvas>').attr({ id: 'flat-' + def.id, width: 420, height: 280 });
    $card.append($flatCanvas);

    if (def.id === 'evt') {
      const $scrub = $('<div>').addClass('scrub-controls');
      const $range = $('<input>').attr({ type: 'range', min: 0, max: Math.max(def.labels.length - 1, 0), value: def.labels.length - 1, step: 1 });
      const $label = $('<div>').addClass('scrub-label');
      $scrub.append($range, $label);
      $card.append($scrub);
      const updateLabel = (idx) => {
        const val = Math.round(def.values[idx] || 0).toLocaleString('fr-FR');
        $label.text(`Année sélectionnée : ${def.labels[idx]} — ${val} événements`);
      };
      $range.on('input', function () {
        const idx = +this.value;
        updateLabel(idx);
        window.scrubEvt(idx);
      });
      $range.on('change', () => { if (window.CyberSound) window.CyberSound.playClick(); });
      updateLabel(def.labels.length - 1);
    }

    $grid.append($card);
    const flatChart = new Chart($flatCanvas[0].getContext('2d'), chartConfig(def.type, def.labels, def.values, def.title));

    chartsById[def.id] = texChart;
    flatChartsById[def.id] = flatChart;
    texCanvasById[def.id] = $texCanvas[0];
    metaById[def.id] = { title: def.title, labels: def.labels, values: def.values, type: def.type };

    results.push({ id: def.id, title: def.title, canvas: $texCanvas[0] });
  });

  return results;
};

// Met à jour les graphiques déjà construits (filtre année) sans tout recréer.
window.updateDashboard = function (data) {
  const defs = DEFINITIONS(data);
  const updatedIds = [];
  defs.forEach(def => {
    const colors = def.labels.map((_, i) => PALETTE[i % PALETTE.length]);
    [chartsById[def.id], flatChartsById[def.id]].forEach(ch => {
      if (!ch) return;
      ch.data.labels = def.labels;
      ch.data.datasets[0].data = def.values;
      if (ch.config.type !== 'line') ch.data.datasets[0].backgroundColor = colors;
      ch.update('none');
    });
    metaById[def.id] = { title: def.title, labels: def.labels, values: def.values, type: def.type };
    updatedIds.push(def.id);
    if (window.onChartTextureDirty) window.onChartTextureDirty(def.id);
  });
  return updatedIds;
};

// Déplace le curseur de valeur active sur le graphique d'évolution (3D + 2D).
window.scrubEvt = function (index) {
  ['evt'].forEach(id => {
    [chartsById[id], flatChartsById[id]].forEach(ch => {
      if (!ch) return;
      const meta = ch.getDatasetMeta(0);
      const point = meta.data[index];
      if (!point) return;
      ch.setActiveElements([{ datasetIndex: 0, index }]);
      ch.tooltip.setActiveElements([{ datasetIndex: 0, index }], { x: point.x, y: point.y });
      ch.update();
    });
    if (window.onChartTextureDirty) window.onChartTextureDirty(id);
  });
};

window.getChartMeta = (id) => metaById[id];
window.getTexCanvas = (id) => texCanvasById[id];
