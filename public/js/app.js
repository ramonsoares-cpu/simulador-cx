// Simulador CX - front-end (substitui google.script.run por fetch)
const $ = (id) => document.getElementById(id);
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const RUN_LABEL = '▶ Rodar Simulação';

let chartSimulacao = null;

// ==========================================
// Utilitários (api / toast / loading)
// ==========================================
async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Falha de rede ao comunicar com o servidor.');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* corpo não JSON */ }
  if (!res.ok) throw new Error((data && data.message) || `Erro ${res.status} no servidor.`);
  return data;
}

function showToast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  $('toastWrap').appendChild(el);
  setTimeout(() => el.remove(), 7000);
}

function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.textContent = '';
  if (loading) {
    const sp = document.createElement('span');
    sp.className = 'spinner';
    btn.appendChild(sp);
  }
  btn.appendChild(document.createTextNode(text));
}

function el(tag, { className, text, style, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (style) node.style.cssText = style;
  if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  children.forEach((c) => node.appendChild(c));
  return node;
}

// ==========================================
// Filtro de equipes e agentes
// ==========================================
function buildDropdown(hierarchyData) {
  const list = $('dropdownList');
  list.textContent = '';

  const allCb = el('input', { className: 'all-cb', attrs: { type: 'checkbox', value: 'ALL' } });
  allCb.checked = true;
  allCb.addEventListener('change', () => toggleAll(allCb));
  list.appendChild(el('div', { className: 'dropdown-item' }, [allCb, el('strong', { text: ' Todas as Coordenações' })]));

  Object.keys(hierarchyData).sort((a, b) => a.localeCompare(b)).forEach((coord) => {
    const coordCb = el('input', { className: 'coord-cb', attrs: { type: 'checkbox', value: coord } });
    coordCb.dataset.coord = coord;
    coordCb.checked = true;
    coordCb.addEventListener('change', () => toggleCoord(coordCb));
    list.appendChild(
      el('div', { className: 'dropdown-item', style: 'background: var(--preto-4); padding-top: 10px; padding-bottom: 10px;' }, [
        coordCb,
        el('strong', { text: coord, style: 'color: var(--laranja-lt);' }),
      ])
    );

    hierarchyData[coord].slice().sort((a, b) => a.localeCompare(b)).forEach((eq) => {
      const teamCb = el('input', { className: 'team-cb', attrs: { type: 'checkbox', value: eq } });
      teamCb.dataset.parent = coord;
      teamCb.checked = true;
      teamCb.addEventListener('change', updateAll);
      list.appendChild(el('div', { className: 'dropdown-item', style: 'padding-left: 30px;' }, [teamCb, document.createTextNode(' ' + eq)]));
    });
  });
  $('dropdownText').textContent = 'Todas as Coordenações';
}

function buildAgentDropdown(listaAgentes) {
  const container = $('agentItemsContainer');
  container.textContent = '';
  listaAgentes.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((ag) => {
    const cb = el('input', { className: 'agent-cb', attrs: { type: 'checkbox', value: ag.email } });
    cb.addEventListener('change', updateAgentState);
    const item = el('div', { className: 'dropdown-item agent-item' }, [
      cb,
      el('span', { text: ag.name, attrs: { title: ag.equipe } }),
    ]);
    item.dataset.name = ag.name.toLowerCase();
    item.dataset.team = ag.equipe;
    container.appendChild(item);
  });
}

function toggleAll(cb) {
  document.querySelectorAll('.coord-cb, .team-cb').forEach((c) => { c.checked = cb.checked; });
  updateAll();
}

function toggleCoord(cb) {
  document.querySelectorAll('.team-cb').forEach((c) => {
    if (c.dataset.parent === cb.dataset.coord) c.checked = cb.checked;
  });
  updateAll();
}

function updateAll() {
  const allCb = document.querySelector('.all-cb');
  const teams = Array.from(document.querySelectorAll('.team-cb'));
  allCb.checked = teams.length > 0 && teams.every((b) => b.checked);

  document.querySelectorAll('.coord-cb').forEach((coordCb) => {
    const coordTeams = teams.filter((t) => t.dataset.parent === coordCb.dataset.coord);
    coordCb.checked = coordTeams.length > 0 && coordTeams.every((b) => b.checked);
  });

  const checkedCoords = document.querySelectorAll('.coord-cb:checked');
  const checkedTeams = document.querySelectorAll('.team-cb:checked');
  $('dropdownText').textContent = allCb.checked
    ? 'Todas as Coordenações'
    : (checkedCoords.length > 0 ? `${checkedCoords.length} coordenações ativas` : `${checkedTeams.length} equipas ativas`);

  filterAgentsList();
}

function filterAgentsList() {
  const allCb = document.querySelector('.all-cb');
  const isAllTeams = allCb ? allCb.checked : true;
  const selectedTeams = Array.from(document.querySelectorAll('.team-cb:checked')).map((cb) => cb.value);
  const searchVal = $('searchAgentInput').value.toLowerCase();

  document.querySelectorAll('.agent-item').forEach((item) => {
    const teamMatch = isAllTeams || selectedTeams.includes(item.dataset.team);
    const textMatch = item.dataset.name.includes(searchVal);

    if (teamMatch && textMatch) {
      item.style.display = 'flex';
    } else {
      item.style.display = 'none';
      if (!teamMatch) {
        const cb = item.querySelector('.agent-cb');
        if (cb.checked) {
          cb.checked = false;
          updateAgentState();
        }
      }
    }
  });
}

function updateAgentState() {
  const checked = document.querySelectorAll('.agent-cb:checked');
  const txt = $('agentDropdownText');
  txt.textContent = checked.length === 0 ? 'Nenhum agente ausente' : `${checked.length} agentes ausentes (- Capacidade)`;
  txt.style.color = checked.length > 0 ? 'var(--vermelho)' : 'var(--branco)';
}

function switchTab(btn) {
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  $('tab' + btn.dataset.tab).classList.add('active');
}

function updateVal(id, value, symbol) {
  const display = Number(value) > 0 && id === 'simVolumetria' ? '+' + value : value;
  $('val_' + id).textContent = display + symbol;
}

// ==========================================
// Simulação
// ==========================================
const intValue = (id) => parseInt($(id).value, 10) || 0;

async function executarSimulacao() {
  const btn = $('btnRun1');
  setLoading(btn, true, 'Calculando...');

  const allCb = document.querySelector('.all-cb');
  const parametros = {
    periodo: $('simPeriodo').value,
    isAllTeams: allCb ? allCb.checked : true,
    selectedTeams: Array.from(document.querySelectorAll('.team-cb:checked')).map((cb) => cb.value),
    agentesAusentes: Array.from(document.querySelectorAll('.agent-cb:checked')).map((cb) => cb.value),
    volumetria: Number($('simVolumetria').value),
    hcBaseManual: intValue('simHcBase'),
    ferias: intValue('simFerias'),
    atestados: intValue('simAtestados'),
    afastamentos: intValue('simAfastamentos'),
    faltas: intValue('simFaltas'),
  };

  try {
    const response = await api('/api/simulador/run', { method: 'POST', body: parametros });
    atualizarPainel(response);
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(btn, false, RUN_LABEL);
  }
}

function setDiff(node, text, cls) {
  node.textContent = text;
  node.className = 'stat-diff ' + cls;
}

function atualizarPainel(dados) {
  const { kpis, financeiro: fin, deltaMatrix: matrix, chartData } = dados;
  const fmt = (n) => n.toLocaleString('pt-PT');

  $('kpiVolBase').textContent = fmt(kpis.volBase);
  $('kpiVolSimulado').textContent = fmt(kpis.volSimulado);
  const diffVol = kpis.volSimulado - kpis.volBase;
  setDiff($('kpiVolDiff'), (diffVol > 0 ? '+' : '') + fmt(diffVol), diffVol > 0 ? 'diff-up' : (diffVol < 0 ? 'diff-down' : 'diff-neutral'));

  const sla = $('kpiSlaSimulado');
  sla.textContent = kpis.slaSimulado + '%';
  sla.style.color = kpis.slaSimulado < 70 ? 'var(--vermelho)' : (kpis.slaSimulado < 90 ? 'var(--amarelo)' : 'var(--verde)');

  const alvo = $('kpiSlaAlvo');
  alvo.textContent = '';
  alvo.appendChild(el('span', { text: 'SLA Alvo: 1ª Resp < 5min / Total < 30min', style: 'color:var(--laranja);' }));
  alvo.appendChild(document.createElement('br'));
  alvo.appendChild(el('span', { text: 'SLA Alvo: Total < 48h', style: 'color:var(--azul);' }));

  $('kpiHcSimulado').textContent = kpis.hcSimulado + ' agentes';
  $('kpiHcBase').textContent = kpis.hcBase;
  const diffHc = kpis.hcSimulado - kpis.hcBase;
  setDiff($('kpiHcDiff'), (diffHc > 0 ? '+' : '') + diffHc, diffHc < 0 ? 'diff-up' : 'diff-neutral');

  setDiff($('kpiBacklogDiff'), '+' + fmt(kpis.backlog), kpis.backlog > 0 ? 'diff-up' : 'diff-neutral');
  $('tbl_backlogTck').textContent = fmt(kpis.backlog);
  $('tbl_horasZerar').textContent = Math.floor(fin.horasZerar) + 'h ' + Math.round((fin.horasZerar % 1) * 60) + 'm';

  atualizarGrafico(chartData);
  renderDeltaTable(matrix);
}

function renderDeltaTable(matrix) {
  const table = $('heatmapDeltaSimulado');
  table.textContent = '';

  const headRow = el('tr', {}, [el('th', { text: 'Dia' })]);
  for (let h = 0; h < 24; h++) headRow.appendChild(el('th', { text: String(h).padStart(2, '0') + 'h' }));
  table.appendChild(el('thead', {}, [headRow]));

  const tbody = el('tbody');
  for (let wd = 0; wd < 7; wd++) {
    const tr = el('tr', {}, [el('td', { className: 'm-row-header', text: DAY_NAMES[wd] })]);
    for (let h = 0; h < 24; h++) {
      const delta = matrix[wd][h];
      let bg = 'transparent';
      let cor = 'var(--branco-2)';
      if (delta > 0) { bg = 'rgba(34, 197, 94, 0.15)'; cor = 'var(--verde)'; }
      else if (delta < 0) { bg = 'rgba(239, 68, 68, 0.15)'; cor = 'var(--vermelho)'; }
      tr.appendChild(el('td', { text: delta > 0 ? '+' + delta : String(delta), style: `background:${bg}; color:${cor};` }));
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
}

function atualizarGrafico(chartData) {
  const ctx = $('canvasSimDemanda').getContext('2d');
  const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}h`);

  if (chartSimulacao) chartSimulacao.destroy();

  if (!chartData) {
    chartData = { demanda: Array(24).fill(0), capBase: Array(24).fill(0), capLiquid: Array(24).fill(0) };
  }

  chartSimulacao = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Demanda Projetada Média (Tickets/h)', data: chartData.demanda, borderColor: '#FF4500', backgroundColor: 'rgba(255, 69, 0, 0.15)', borderWidth: 2, fill: true, tension: 0.4 },
        { label: 'Cap. Base Escalada (Sem Faltas)', data: chartData.capBase, borderColor: '#888888', borderDash: [5, 5], borderWidth: 2, fill: false, pointRadius: 0 },
        { label: 'Cap. Líquida Simulação (Com Desfalques)', data: chartData.capLiquid, borderColor: '#EAB308', borderDash: [5, 5], borderWidth: 2, fill: false, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#C8C8C8' } } },
      scales: { x: { ticks: { color: '#C8C8C8' } }, y: { beginAtZero: true, ticks: { color: '#C8C8C8' } } },
    },
  });
}

// ==========================================
// Inicialização (no final do script: todas as declarações já existem)
// ==========================================
async function init() {
  $('btnReset').addEventListener('click', () => window.location.reload());
  document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b)));
  $('teamDropdownToggle').addEventListener('click', () => $('dropdownList').classList.toggle('show'));
  $('agentDropdownToggle').addEventListener('click', () => $('agentList').classList.toggle('show'));
  $('searchAgentInput').addEventListener('keyup', filterAgentsList);
  $('simVolumetria').addEventListener('input', (e) => updateVal('simVolumetria', e.target.value, '%'));
  $('simMigracaoCanal').addEventListener('input', (e) => updateVal('simMigracaoCanal', e.target.value, '%'));
  $('btnRun1').addEventListener('click', executarSimulacao);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#teamDropdown')) $('dropdownList').classList.remove('show');
    if (!e.target.closest('#agentDropdown')) $('agentList').classList.remove('show');
  });

  atualizarGrafico(null);

  try {
    const data = await api('/api/simulador/initial-data');
    buildDropdown(data.hierarquia || {});
    buildAgentDropdown(data.listaAgentes || []);
    setLoading($('btnRun1'), false, RUN_LABEL);
    executarSimulacao();
  } catch (error) {
    $('statusHeader').textContent = 'Erro ao carregar equipas e agentes: ' + error.message;
    showToast(error.message);
  }
}

init();
