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
  const base = {
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
        pointBackgroundColor: '#4dabf7'
      }]
    },
    options: {
      animation: false,
      responsive: false,
      indexAxis: type === 'bar' && /pays/i.test(title) ? 'y' : 'x',
      plugins: {
        title: { display: true, text: title, color: '#eee', font: { size: 18 } },
        legend: { display: type !== 'bar' && type !== 'line', labels: { color: '#ccc' } }
      },
      scales: ['line', 'bar'].includes(type) ? {
        x: { ticks: { color: '#ccc' }, grid: { color: '#2a323c' } },
        y: { ticks: { color: '#ccc' }, grid: { color: '#2a323c' }, beginAtZero: true }
      } : {}
    }
  };
  return base;
}

const DEFINITIONS = (data) => [
  { id: 'evt', title: 'Événements par année', type: 'line', ...data.evenementsParAnnee },
  { id: 'atk', title: "Incidents par type d'attaque", type: 'bar', ...data.typesAttaque },
  { id: 'sev', title: 'Répartition par sévérité', type: 'doughnut', ...data.severite },
  { id: 'pays', title: 'Top 5 pays source (événements)', type: 'bar', ...data.topPays },
  { id: 'sect', title: 'Secteurs cibles', type: 'radar', ...data.secteurs },
  { id: 'def', title: 'Mécanismes de défense utilisés', type: 'polarArea', ...data.defenses }
];

// Construit les graphiques en double : un canvas haute résolution (texture 3D)
// et un canvas visible dans le tableau de bord 2D. Retourne la liste pour three.js.
window.buildDashboard = function (data) {
  const defs = DEFINITIONS(data);
  const results = [];

  const $factory = $('#chart-factory');
  const $grid = $('#dashboard2d-grid').empty();

  defs.forEach(def => {
    const cfg = chartConfig(def.type, def.labels, def.values, def.title);

    const $texCanvas = $('<canvas>').attr({ id: 'tex-' + def.id, width: 768, height: 480 });
    $factory.append($texCanvas);
    new Chart($texCanvas[0].getContext('2d'), cfg);

    const $card = $('<div>').addClass('chart-card');
    $('<h3>').text(def.title).appendTo($card);
    const $flatCanvas = $('<canvas>').attr({ id: 'flat-' + def.id, width: 420, height: 280 });
    $card.append($flatCanvas);
    $grid.append($card);
    new Chart($flatCanvas[0].getContext('2d'), chartConfig(def.type, def.labels, def.values, def.title));

    results.push({ title: def.title, canvas: $texCanvas[0] });
  });

  return results;
};
