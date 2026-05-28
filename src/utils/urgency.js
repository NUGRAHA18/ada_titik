// Aturan urgency otomatis berdasarkan progress (collected / goal).
//   progress <  0.33  → Mendesak
//   progress <  0.80  → Normal
//   progress >= 0.80  → Rendah
//
// Catatan corner case:
//   - goal_amount <= 0 → default 'Mendesak' (titik baru / tanpa target).
//   - collected_amount > goal_amount → di-clamp ke 1 (>= 0.80 → Rendah).

export const URGENCY = Object.freeze({
    HIGH:   'Mendesak',
    NORMAL: 'Normal',
    LOW:    'Rendah',
});

export const computeUrgency = (goalAmount, collectedAmount) => {
    const goal      = Number(goalAmount) || 0;
    const collected = Math.max(0, Number(collectedAmount) || 0);

    if (goal <= 0) return URGENCY.HIGH;

    const progress = Math.min(1, collected / goal);
    if (progress < 0.33) return URGENCY.HIGH;
    if (progress < 0.80) return URGENCY.NORMAL;
    return URGENCY.LOW;
};

// Poin yang diberikan ke donatur setiap participant ditandai 'completed'.
export const DONATOR_POINTS_PER_COMPLETION = 50;
