import { config, state, SCALE_P2M, Materials } from './materialProfiles.js';
import { multiplyMatrices, transpose, gaussElimination, inversePowerIteration } from '../math/linearAlgebra.js';

export function solveFEA() {
    if (state.nodes.length < 2 || state.members.length === 0) {
        state.activeFENodes = []; state.activeFEElements = []; return;
    }

    document.getElementById('stat-nodes').innerText = state.nodes.length;
    document.getElementById('stat-elements').innerText = state.members.length * config.meshDensity;

    let feNodes = [];
    let feElements = [];

    state.nodes.forEach((n, idx) => {
        n.feIdx = idx;
        feNodes.push({ x: n.x, y: n.y, support: n.support, force: n.force, macro: n });
    });

    state.members.forEach(m => {
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
        if(L === 0) return;
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

        state.maxStressValue = 1e-3; 
        feElements.forEach(el => {
            const dx = (el.end.x - el.start.x) / SCALE_P2M;
            const dy = (el.end.y - el.start.y) / SCALE_P2M;
            const L = Math.hypot(dx, dy);
            const u1 = globalU[el.start.id*3+1]; const r1 = globalU[el.start.id*3+2];
            const u2 = globalU[el.end.id*3+1]; const r2 = globalU[el.end.id*3+2];
            
            const bendingMoment = (mat.E * I / L) * Math.abs(-6*u1/L + 4*r1 + 6*u2/L + 2*r2);
            el.stress = (bendingMoment * (config.depth / 2)) / I;
            if (el.stress > state.maxStressValue) state.maxStressValue = el.stress;
        });
        document.getElementById('legend-max').innerText = (state.maxStressValue / 1e6).toFixed(2) + " MPa";

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
    state.activeFENodes = feNodes;
    state.activeFEElements = feElements;
}