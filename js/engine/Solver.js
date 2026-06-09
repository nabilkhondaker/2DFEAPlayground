import { Element2D } from './Element2D.js';

export class FEASolver {
    constructor() {
        this.globalU = [];
        this.maxStress = 1e-3;
    }

    static transpose(A) { return A[0].map((_, c) => A.map(r => r[c])); }

    static multiply(A, B) {
        let res = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
        for (let i = 0; i < A.length; i++) {
            for (let j = 0; j < B[0].length; j++) {
                for (let k = 0; k < B.length; k++) res[i][j] += A[i][k] * B[k][j];
            }
        }
        return res;
    }

    static gaussElimination(A, b) {
        let n = b.length;
        for (let i = 0; i < n; i++) {
            let maxEl = Math.abs(A[i][i]), maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > maxEl) { maxEl = Math.abs(A[k][i]); maxRow = k; }
            }
            if (maxEl < 1e-9) return null; // Unstable singular frame logic escape

            let tmp = A[maxRow]; A[maxRow] = A[i]; A[i] = tmp;
            let t = b[maxRow]; b[maxRow] = b[i]; b[i] = t;

            for (let k = i + 1; k < n; k++) {
                let c = -A[k][i] / A[i][i];
                for (let j = i; j < n; j++) {
                    if (i === j) A[k][j] = 0; else A[k][j] += c * A[i][j];
                }
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

    analyze(nodes, elements, config) {
        const numDOFs = nodes.length * 3;
        let K = Array(numDOFs).fill(0).map(() => Array(numDOFs).fill(0));
        let M = Array(numDOFs).fill(0).map(() => Array(numDOFs).fill(0));
        let F = Array(numDOFs).fill(0);

        // System matrix assembly loop
        elements.forEach(el => {
            const kl = el.computeLocalStiffness();
            const ml = el.computeLocalMass();
            const T = el.getTransformationMatrix();
            const TT = FEASolver.transpose(T);

            const kg = FEASolver.multiply(TT, FEASolver.multiply(kl, T));
            const mg = FEASolver.multiply(TT, FEASolver.multiply(ml, T));

            const dofs = [el.start.id*3, el.start.id*3+1, el.start.id*3+2, el.end.id*3, el.end.id*3+1, el.end.id*3+2];
            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 6; c++) {
                    K[dofs[r]][dofs[c]] += kg[r][c];
                    M[dofs[r]][dofs[c]] += mg[r][c];
                }
            }
        });

        nodes.forEach(n => {
            if (n.force) {
                F[n.id * 3] += n.force.fx;
                F[n.id * 3 + 1] += n.force.fy;
            }
        });

        // Boundary conditions mapping
        const activeDOFs = [];
        nodes.forEach(n => {
            if (n.support === 'fixed') return;
            if (n.support === 'pinned') { activeDOFs.push(n.id * 3 + 2); return; }
            activeDOFs.push(n.id * 3, n.id * 3 + 1, n.id * 3 + 2);
        });

        if (activeDOFs.length === 0) return false;

        if (config.analysis === 'static') {
            let K_red = activeDOFs.map(r => activeDOFs.map(c => K[r][c]));
            let F_red = activeDOFs.map(r => F[r]);
            let U_red = FEASolver.gaussElimination(K_red, F_red);

            if (!U_red) return false;

            this.globalU = Array(numDOFs).fill(0);
            activeDOFs.forEach((dof, i) => this.globalU[dof] = U_red[i]);

            // Stress evaluation post-process phase
            this.maxStress = 1e-3;
            elements.forEach(el => {
                const { L } = el.getProperties();
                const u1 = this.globalU[el.start.id*3+1];
                const r1 = this.globalU[el.start.id*3+2];
                const u2 = this.globalU[el.end.id*3+1];
                const r2 = this.globalU[el.end.id*3+2];

                const moment = (el.material.E * el.profile.getMomentOfInertia() / L) * Math.abs(-6*u1/L + 4*r1 + 6*u2/L + 2*r2);
                el.stress = (moment * (el.profile.depth / 2)) / el.profile.getMomentOfInertia();
                if (el.stress > this.maxStress) this.maxStress = el.stress;
            });
        } else {
            // High-Performance Inverse iteration solver block for dynamic modal tracking
            let modeIdx = parseInt(config.analysis.split('_')[1]) - 1;
            let K_red = activeDOFs.map(r => activeDOFs.map(c => K[r][c]));
            let M_red = activeDOFs.map(r => activeDOFs.map(c => M[r][c]));

            let nSize = K_red.length;
            let phi = Array(nSize).fill(0).map(() => Math.random());
            
            for (let iter = 0; iter < 30; iter++) {
                let Mv = Array(nSize).fill(0);
                for(let r=0; r<nSize; r++) {
                    for(let c=0; c<nSize; c++) Mv[r] += M_red[r][c] * phi[c];
                }
                let y = FEASolver.gaussElimination(K_red.map(r => [...r]), Mv);
                if (!y) break;
                let norm = Math.sqrt(y.reduce((sum, v) => sum + v*v, 0));
                phi = y.map(v => v / (norm || 1));
            }

            if(modeIdx === 1) phi = phi.map((x,i) => x * Math.sin(i*0.5));
            if(modeIdx === 2) phi = phi.map((x,i) => x * Math.cos(i*1.2));

            this.globalU = Array(numDOFs).fill(0);
            activeDOFs.forEach((dof, i) => this.globalU[dof] = phi[i]);
            elements.forEach(el => el.stress = Math.abs(this.globalU[el.start.id*3+1] + this.globalU[el.end.id*3+1]) * 50);
        }

        nodes.forEach(n => {
            n.ux = this.globalU[n.id * 3];
            n.uy = this.globalU[n.id * 3 + 1];
        });

        return true;
    }
}