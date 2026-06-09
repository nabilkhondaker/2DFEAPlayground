/**
 * Implements Euler-Bernoulli 2D frame element matrix computations.
 * Each element features 2 nodes with 3 DOFs each (u, v, theta).
 */
export class Element2D {
    static SCALE_P2M = 100; // 100 pixels = 1 Meter

    constructor(id, nodeStart, nodeEnd, material, profile) {
        this.id = id;
        this.start = nodeStart;
        this.end = nodeEnd;
        this.material = material;
        this.profile = profile;
        this.stress = 0;
    }

    getProperties() {
        const dx = (this.end.x - this.start.x) / Element2D.SCALE_P2M;
        const dy = (this.end.y - this.start.y) / Element2D.SCALE_P2M;
        const L = Math.hypot(dx, dy);
        return { L, c: dx / L, s: dy / L };
    }

    computeLocalStiffness() {
        const { L } = this.getProperties();
        const E = this.material.E;
        const A = this.profile.getArea();
        const I = this.profile.getMomentOfInertia();

        const L2 = L * L;
        const L3 = L2 * L;

        return [
            [ (E*A)/L,         0,         0, -(E*A)/L,         0,         0],
            [       0, (12*E*I)/L3, (6*E*I)/L2,        0,-(12*E*I)/L3, (6*E*I)/L2],
            [       0,  (6*E*I)/L2,   (4*E*I)/L,        0, -(6*E*I)/L2,   (2*E*I)/L],
            [-(E*A)/L,         0,         0,  (E*A)/L,         0,         0],
            [       0,-(12*E*I)/L3,-(6*E*I)/L2,        0, (12*E*I)/L3,-(6*E*I)/L2],
            [       0,  (6*E*I)/L2,   (2*E*I)/L,        0, -(6*E*I)/L2,   (4*E*I)/L]
        ];
    }

    computeLocalMass() {
        const { L } = this.getProperties();
        const A = this.profile.getArea();
        const rL = this.material.rho * A * L;

        return [
            [rL/3,    0,      0, rL/6,    0,      0],
            [   0, 13*rL/35, 11*rL*L/210, 0, 9*rL/70, -13*rL*L/420],
            [   0, 11*rL*L/210, rL*L*L/105, 0, 13*rL*L/420, -rL*L*L/140],
            [rL/6,    0,      0, rL/3,    0,      0],
            [   0, 9*rL/70, 13*rL*L/420, 0, 13*rL/35, -11*rL*L/210],
            [   0, -13*rL*L/420, -rL*L*L/140, 0, -11*rL*L/210, rL*L*L/105]
        ];
    }

    getTransformationMatrix() {
        const { c, s } = this.getProperties();
        return [
            [ c,  s,  0,  0,  0,  0],
            [-s,  c,  0,  0,  0,  0],
            [ 0,  0,  1,  0,  0,  0],
            [ 0,  0,  0,  c,  s,  0],
            [ 0,  0,  0,-s,  c,  0],
            [ 0,  0,  0,  0,  0,  1]
        ];
    }
}