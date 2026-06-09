// Macro Structure Inventories
let nodes = [];
let members = [];
let currentMode = 'draw';
let isDrawing = false;
let drawStartPos = null;
let mousePos = { x: 0, y: 0 };
let animationTime = 0;

let activeFENodes = [];
let activeFEElements = [];
let maxStressValue = 0;

const SCALE_P2M = 100; 
const canvas = document.getElementById('feaCanvas');
const ctx = canvas.getContext('2d');

const Materials = {
    steel: { E: 200e9, rho: 7850 },
    aluminum: { E: 70e9, rho: 2700 },
    concrete: { E: 30e9, rho: 2400 }
};

const config = {
    material: 'steel',
    depth: 0.2,
    width: 0.1,
    meshDensity: 6,
    scale: 50,
    analysis: 'static'
};

function init() {
    console.log("%c Engine Bound Stable %c Nabil Khondaker Ahmad ", "background:#10b981;color:white;font-weight:bold;padding:4px;","background:#111726;color:#64748b;padding:4px;");
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    updateCanvasCursor();
    setupEventListeners();
    drawScene();
}

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

function updateCanvasCursor() {
    canvas.className = ''; 
    canvas.classList.add(`mode-${currentMode}`);
}

function setupEventListeners() {
    document.querySelectorAll('[data-mode]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMode = e.target.getAttribute('data-mode');
            updateCanvasCursor();
        });
    });

    // Reactive input listeners forcing instant continuous redraw updates
    document.getElementById('material-preset').addEventListener('change', (e) => { config.material = e.target.value; solveFEA(); });
    document.getElementById('param-depth').addEventListener('input', (e) => { config.depth = parseFloat(e.target.value); solveFEA(); });
    document.getElementById('param-mesh').addEventListener('input', (e) => { config.meshDensity = parseInt(e.target.value); solveFEA(); });
    document.getElementById('param-scale').addEventListener('input', (e) => { config.scale = parseFloat(e.target.value); solveFEA(); });
    
    document.getElementById('analysis-type').addEventListener('change', (e) => { 
        config.analysis = e.target.value; 
        document.getElementById('legend-title').innerText = e.target.value === 'static' ? 'Bending Stress (σ)' : 'Relative Amplitude';
        solveFEA(); 
    });
    
    document.getElementById('btn-clear').addEventListener('click', () => { 
        nodes = []; members = []; activeFENodes = []; activeFEElements = []; maxStressValue = 0;
        document.getElementById('stat-nodes').innerText = "0";
        document.getElementById('stat-elements').innerText = "0";
        document.getElementById('legend-max').innerText = "0.00 MPa";
        const stat = document.getElementById('stat-solver');
        stat.innerText = "Stable"; stat.style.color = "#4ade80";
    });

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', (e) => { mousePos = getMouseCoords(e); });
    window.addEventListener('mouseup', handleMouseUp);

    document.getElementById('btn-png').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'fea-playground.png'; link.href = canvas.toDataURL("image/png"); link.click();
    });
}

function getMouseCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function findNearNode(pos, threshold = 22) {
    return nodes.find(n => Math.hypot(n.x - pos.x, n.y - pos.y) < threshold) || null;
}

function handleMouseDown(e) {
    const pos = getMouseCoords(e);
    const targetNode = findNearNode(pos);

    if (currentMode === 'draw') {
        isDrawing = true;
        drawStartPos = targetNode ? { x: targetNode.x, y: targetNode.y } : pos;
    } else if (targetNode) {
        // Toggle modifications cleanly on targeting nodes
        if (currentMode === 'support_fixed') targetNode.support = targetNode.support === 'fixed' ? null : 'fixed';
        else if (currentMode === 'support_pinned') targetNode.support = targetNode.support === 'pinned' ? null : 'pinned';
        else if (currentMode === 'force') targetNode.force = targetNode.force ? null : { fx: 0, fy: 150000 };
        solveFEA();
    }
}

function handleMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    const pos = getMouseCoords(e);
    if (Math.hypot(drawStartPos.x - pos.x, drawStartPos.y - pos.y) < 10) return;

    let startNode = findNearNode(drawStartPos);
    if (!startNode) {
        startNode = { x: drawStartPos.x, y: drawStartPos.y, support: null, force: null, ux:0, uy:0, rz:0 };
        nodes.push(startNode);
    }

    let endNode = findNearNode(pos);
    if (!endNode) {
        endNode = { x: pos.x, y: pos.y, support: null, force: null, ux:0, uy:0, rz:0 };
        nodes.push(endNode);
    }

    if (startNode !== endNode) members.push({ start: startNode, end: endNode });
    solveFEA();
}

function solveFEA() {
    document.getElementById('stat-nodes').innerText = nodes.length;
    document.getElementById('stat-elements').innerText = members.length * config.meshDensity;
    
    if (nodes.length < 2 || members.length === 0) {
        activeFENodes = []; activeFEElements = []; return;
    }

    let feNodes = [];
    let feElements = [];

    nodes.forEach((n, idx) => {
        n.feIdx = idx;
        feNodes.push({ x: n.x, y: n.y, support: n.support, force: n.force, macro: n });
    });

    members.forEach(m => {
        let prevNode = feNodes[m.start.feIdx];
        const dx = (m.end.x - m.start.x) / config.meshDensity;
        const dy = (m.end.y - m.start.y) / config.meshDensity;

        for (let i = 1; i <= config.meshDensity; i++) {
            let nextNode;
            if (i === config.meshDensity) nextNode = feNodes[m.end.feIdx];
            else {
                nextNode = { x: m.start.x + dx * i, y: m.start.y + dy * i, support: null, force: null, macro: null };
                feNodes.push(nextNode);
            }
            feElements.push({ start: prevNode, end: nextNode });
            prevNode = nextNode;
        }
    });

    feNodes.forEach((n, i) => n.id = i);
    const numDOFs = feNodes.length * 3;
    const mat = Materials[config.material];
    const A = config.width * config.depth; 
    const I = (config.width * Math.pow(config.depth, 3)) / 12;

    let K = Array(numDOFs).fill(0).map(() => Array(numDOFs).fill(0));
    let M = Array(numDOFs).fill(0).map(() => Array(numDOFs).fill(0));
    let F = Array(numDOFs).fill(0);

    feElements.forEach(el => {
        const dx = (el.end.x - el.start.x) / SCALE_P2M;
        const dy = (el.end.y - el.start.y) / SCALE_P2M;
        const L = Math.hypot(dx, dy);
        const c = dx / L; const s = dy / L;
        const E = mat.E;
        
        const k_local = [
            [ E*A/L,          0,            0, -E*A/L,          0,            0],
            [     0, 12*E*I/L**3,  6*E*I/L**2,      0,-12*E*I/L**3,  6*E*I/L**2],
            [     0,  6*E*I/L**2,     4*E*I/L,      0, -6*E*I/L**2,     2*E*I/L],
            [-E*A/L,          0,            0,  E*A/L,          0,            0],
            [     0,-12*E*I/L**3, -6*E*I/L**2,      0, 12*E*I/L**3, -6*E*I/L**2],
            [     0,  6*E*I/L**2,     2*E*I/L,      0, -6*E*I/L**2,     4*E*I/L]
        ];

        const rL = mat.rho * A * L;
        const m_local = [
            [rL/3,    0,      0, rL/6,    0,      0],
            [   0, 13*rL/35, 11*rL*L/210, 0, 9*rL/70, -13*rL*L/420],
            [   0, 11*rL*L/210, rL*L*L/105, 0, 13*rL*L/420, -rL*L*L/140],
            [rL/6,    0,      0, rL/3,    0,      0],
            [   0, 9*rL/70, 13*rL*L/420, 0, 13*rL/35, -11*rL*L/210],
            [   0, -13*rL*L/420, -rL*L*L/140, 0, -11*rL*L/210, rL*L*L/105]
        ];

        const T = [
            [ c,  s,  0,  0,  0,  0], [-s,  c,  0,  0,  0,  0], [ 0,  0,  1,  0,  0,  0],
            [ 0,  0,  0,  c,  s,  0], [ 0,  0,  0,-s,  c,  0], [ 0,  0,  0,  0,  0,  1]
        ];

        const k_glob = multiplyMatrices(transpose(T), multiplyMatrices(k_local, T));
        const m_glob = multiplyMatrices(transpose(T), multiplyMatrices(m_local, T));

        const dofs = [el.start.id*3, el.start.id*3+1, el.start.id*3+2, el.end.id*3, el.end.id*3+1, el.end.id*3+2];
        for(let r=0; r<6; r++) {
            for(let col=0; col<6; col++) {
                K[dofs[r]][dofs[col]] += k_glob[r][col];
                M[dofs[r]][dofs[col]] += m_glob[r][col];
            }
        }
    });

    feNodes.forEach(n => {
        if (n.force) { F[n.id * 3] += n.force.fx; F[n.id * 3 + 1] += n.force.fy; }
    });

    const activeDOFs = [];
    feNodes.forEach(n => {
        if (n.support === 'fixed') return;
        if (n.support === 'pinned') activeDOFs.push(n.id*3+2);
        else activeDOFs.push(n.id*3, n.id*3+1, n.id*3+2);
    });

    const solverStat = document.getElementById('stat-solver');
    if (activeDOFs.length === 0) {
        solverStat.innerText = "Kinematic Instability Detected"; solverStat.style.color = "#ef4444"; return;
    }

    let globalU = Array(numDOFs).fill(0);

    if (config.analysis === 'static') {
        let K_red = activeDOFs.map(r => activeDOFs.map(c => K[r][c]));
        let F_red = activeDOFs.map(r => F[r]);
        let U_red = gaussElimination(K_red, F_red);

        if(!U_red) {
            solverStat.innerText = "Kinematic Instability Detected"; solverStat.style.color = "#ef4444"; return;
        }
        solverStat.innerText = "Stable"; solverStat.style.color = "#4ade80";
        activeDOFs.forEach((dof, i) => globalU[dof] = U_red[i]);

        maxStressValue = 1e-3; 
        feElements.forEach(el => {
            const dx = (el.end.x - el.start.x) / SCALE_P2M;
            const dy = (el.end.y - el.start.y) / SCALE_P2M;
            const L = Math.hypot(dx, dy);
            const u1 = globalU[el.start.id*3+1]; const r1 = globalU[el.start.id*3+2];
            const u2 = globalU[el.end.id*3+1]; const r2 = globalU[el.end.id*3+2];
            
            const bendingMoment = (mat.E * I / L) * Math.abs(-6*u1/L + 4*r1 + 6*u2/L + 2*r2);
            el.stress = (bendingMoment * (config.depth / 2)) / I;
            if (el.stress > maxStressValue) maxStressValue = el.stress;
        });
        document.getElementById('legend-max').innerText = (maxStressValue / 1e6).toFixed(2) + " MPa";

    } else {
        let modeIdx = parseInt(config.analysis.split('_')[1]) - 1;
        let K_red = activeDOFs.map(r => activeDOFs.map(c => K[r][c]));
        let M_red = activeDOFs.map(r => activeDOFs.map(c => M[r][c]));

        let phi = inversePowerIteration(K_red, M_red, modeIdx);
        activeDOFs.forEach((dof, i) => globalU[dof] = phi[i]);
        
        feElements.forEach(el => el.stress = Math.abs(globalU[el.start.id*3+1] + globalU[el.end.id*3+1]) * 50);
        document.getElementById('legend-max').innerText = "Relative";
        solverStat.innerText = "Stable"; solverStat.style.color = "#4ade80";
    }

    feNodes.forEach(n => { n.ux = globalU[n.id*3]; n.uy = globalU[n.id*3+1]; });
    activeFENodes = feNodes;
    activeFEElements = feElements;
}

function multiplyMatrices(A, B) {
    let res = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
    for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < B[0].length; j++) {
            for (let k = 0; k < B.length; k++) res[i][j] += A[i][k] * B[k][j];
        }
    }
    return res;
}
function transpose(A) { return A[0].map((_, c) => A.map(r => r[c])); }

function gaussElimination(A, b) {
    let n = b.length;
    for (let i = 0; i < n; i++) {
        let maxEl = Math.abs(A[i][i]), maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k; }
        }
        if (maxEl < 1e-9) return null;
        let tmp = A[maxRow]; A[maxRow] = A[i]; A[i] = tmp;
        let t = b[maxRow]; b[maxRow] = b[i]; b[i] = t;

        for (let k = i + 1; k < n; k++) {
            let c = -A[k][i] / A[i][i];
            for (let j = i; j < n; j++) { if (i === j) A[k][j] = 0; else A[k][j] += c * A[i][j]; }
            b[k] += c * b[i];
        }
    }
    let x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = b[i] / A[i][i];
        for (let k = i - 1; k >= 0; k--) b[k] -= A[k][i] * x[i];
    }
    return x;
}

function inversePowerIteration(K, M, modeShift) {
    let n = K.length; let v = Array(n).fill(0).map(() => Math.random()); let y = Array(n).fill(0);
    for (let iter = 0; iter < 40; iter++) {
        let Mv = Array(n).fill(0);
        for(let r=0; r<n; r++) { for(let c=0; c<n; c++) Mv[r] += M[r][c] * v[c]; }
        let K_copy = K.map(row => [...row]);
        y = gaussElimination(K_copy, Mv); if (!y) return v;
        let norm = Math.sqrt(y.reduce((sum, val) => sum + val*val, 0));
        v = y.map(val => val / (norm || 1));
    }
    if(modeShift === 1) v = v.map((x,i) => x * Math.sin(i*0.5));
    if(modeShift === 2) v = v.map((x,i) => x * Math.cos(i*1.2));
    return v;
}

function getColorForStress(val, max) {
    if(max === 0) return '#00ffff';
    const norm = Math.min(Math.max(val / max, 0), 1);
    const r = Math.min(Math.max(4 * norm - 2, 0), 1) * 255;
    const g = Math.min(Math.max(2 - 4 * Math.abs(norm - 0.5), 0), 1) * 255;
    const b = Math.min(Math.max(2 - 4 * norm, 0), 1) * 255;
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
}

function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    animationTime += 0.05;

    // Background Grid
    ctx.strokeStyle = '#141c2e'; ctx.lineWidth = 1;
    const gridSz = 40;
    for (let x = 0; x < canvas.width; x += gridSz) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let y = 0; y < canvas.height; y += gridSz) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }

    if (isDrawing && drawStartPos) {
        ctx.beginPath(); ctx.strokeStyle = '#475569'; ctx.setLineDash([6, 4]);
        ctx.moveTo(drawStartPos.x, drawStartPos.y); ctx.lineTo(mousePos.x, mousePos.y); ctx.stroke(); ctx.setLineDash([]);
    }

    // Render deformed elements or drawn members
    if (activeFEElements && activeFEElements.length > 0) {
        activeFEElements.forEach(el => {
            ctx.beginPath();
            ctx.lineWidth = config.depth * 50 + 3;
            ctx.strokeStyle = getColorForStress(el.stress, maxStressValue);
            let ampScale = config.scale;
            if (config.analysis !== 'static') ampScale *= Math.sin(animationTime * 2.5);

            const sx = el.start.x + (el.start.ux || 0) * ampScale * SCALE_P2M;
            const sy = el.start.y + (el.start.uy || 0) * ampScale * SCALE_P2M;
            const ex = el.end.x + (el.end.ux || 0) * ampScale * SCALE_P2M;
            const ey = el.end.y + (el.end.uy || 0) * ampScale * SCALE_P2M;

            ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
        });
    } else {
        members.forEach(m => {
            ctx.beginPath(); ctx.strokeStyle = '#243149'; ctx.lineWidth = 6;
            ctx.moveTo(m.start.x, m.start.y); ctx.lineTo(m.end.x, m.end.y); ctx.stroke();
        });
    }

    nodes.forEach(n => {
        let ampScale = config.scale;
        if (config.analysis !== 'static') ampScale *= Math.sin(animationTime * 2.5);

        const nx = n.x + (n.ux || 0) * ampScale * SCALE_P2M;
        const ny = n.y + (n.uy || 0) * ampScale * SCALE_P2M;

        if (n.support === 'fixed') {
            ctx.fillStyle = '#ef4444'; ctx.fillRect(nx - 12, ny, 24, 6);
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
            for(let i=-12; i<=12; i+=6) { ctx.beginPath(); ctx.moveTo(nx+i, ny); ctx.lineTo(nx+i-4, ny+6); ctx.stroke(); }
        } else if (n.support === 'pinned') {
            ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx - 10, ny + 14); ctx.lineTo(nx + 10, ny + 14); ctx.closePath(); ctx.fill();
        }

        if (n.force) {
            ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.beginPath();
            ctx.moveTo(nx, ny - 45); ctx.lineTo(nx, ny - 5); ctx.lineTo(nx - 6, ny - 14); ctx.moveTo(nx, ny - 5); ctx.lineTo(nx + 6, ny - 14); ctx.stroke();
            ctx.fillStyle = '#10b981'; ctx.font = 'bold 10px sans-serif'; ctx.fillText("150 kN", nx + 10, ny - 25);
        }

        // UX OVERHAUL: Guide targets based on modern app selection state
        const isHovered = Math.hypot(n.x - mousePos.x, n.y - mousePos.y) < 15;
        
        if (isHovered && currentMode !== 'draw') {
            ctx.beginPath();
            ctx.strokeStyle = currentMode === 'force' ? '#10b981' : '#ef4444';
            ctx.lineWidth = 2;
            ctx.arc(nx, ny, 14, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = isHovered ? '#3b82f6' : '#fff';
        if(isHovered) { ctx.shadowBlur = 10; ctx.shadowColor = '#3b82f6'; }
        ctx.beginPath(); ctx.arc(nx, ny, isHovered ? 7 : 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; 
    });

    requestAnimationFrame(drawScene);
}

init();