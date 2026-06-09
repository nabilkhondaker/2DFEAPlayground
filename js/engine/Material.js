/**
 * Material database and physical property provider profiles.
 */
export const MaterialsRegistry = {
    steel: { name: "Structural Steel", E: 200e9, rho: 7850 },
    aluminum: { name: "Aluminum Alloy", E: 70e9, rho: 2700 },
    concrete: { name: "High-Strength Concrete", E: 30e9, rho: 2400 }
};

export class SectionProfile {
    constructor(width, depth) {
        this.width = width;   // m
        this.depth = depth;   // m
    }

    getArea() {
        return this.width * this.depth;
    }

    getMomentOfInertia() {
        // Principal 2D bending inertia equation (I_xx)
        return (this.width * Math.pow(this.depth, 3)) / 12;
    }
}