export function multiplyMatrices(A, B) {
    let res = Array(A.length).fill(0).map(() => Array(B[0].length).fill(0));
    for (let i = 0; i < A.length; i++) {
        for (let j = 0; j < B[0].length; j++) {
            for (let k = 0; k < B.length; k++) res[i][j] += A[i][k] * B[k][j];
        }
    }
    return res;
}

export function transpose(A) { 
    return A[0].map((_, c) => A.map(r => r[c])); 
}

export function gaussElimination(A, b) {
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

export function inversePowerIteration(K, M, modeShift) {
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

export function getColorForStress(val, max) {
    if(max === 0) return '#00ffff';
    const norm = Math.min(Math.max(val / max, 0), 1);
    const r = Math.min(Math.max(4 * norm - 2, 0), 1) * 255;
    const g = Math.min(Math.max(2 - 4 * Math.abs(norm - 0.5), 0), 1) * 255;
    const b = Math.min(Math.max(2 - 4 * norm, 0), 1) * 255;
    return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
}