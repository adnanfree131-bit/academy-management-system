/**
 * @apex/shared-types
 * Core domain types and API contract definitions for Apex Academy Management System
 */
export const DEFAULT_DOCUMENT_CHECKLIST_HEADS = [];
export function defaultAcademicSessions(activeName) {
    const now = new Date().getFullYear();
    const sessions = [];
    const wanted = (activeName || '').trim();
    const m = wanted.match(/^(\d{4})/);
    const startY = m ? Math.max(now, parseInt(m[1], 10)) : now;
    for (let i = 0; i < 3; i++) {
        const y = startY + i;
        const name = `${y}-${y + 1}`;
        sessions.push({
            id: `session-${y}`,
            name,
            start_year: y,
            end_year: y + 1,
            is_active: false,
        });
    }
    const match = sessions.find(s => s.name === wanted) || sessions[0];
    if (match)
        match.is_active = true;
    return sessions;
}
export function activeSessionStartYear(settings) {
    const active = settings?.academic_sessions?.find(s => s.is_active);
    if (active?.start_year)
        return active.start_year;
    const m = String(settings?.academic_session || '').match(/^(\d{4})/);
    if (m)
        return parseInt(m[1], 10);
    return new Date().getFullYear();
}
//# sourceMappingURL=index.js.map