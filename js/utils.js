export function parseTime(str) {
    if (!str) return 0;
    const parts = str.split(':');
    let ms = 0;
    if (parts.length === 3) {
        ms += parseInt(parts[0]) * 3600000;
        ms += parseInt(parts[1]) * 60000;
        ms += parseFloat(parts[2]) * 1000;
    } else if (parts.length === 2) {
        ms += parseInt(parts[0]) * 60000;
        ms += parseFloat(parts[1]) * 1000;
    }
    return ms;
}

export function formatTime(ms, isGap = false) {
    if (isNaN(ms)) return "0:00";
    let isNegative = ms < 0;
    ms = Math.abs(ms);

    let totalSeconds = Math.floor(ms / 1000);
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;

    let hStr = h > 0 ? h + ':' : '';
    let mStr = h > 0 ? m.toString().padStart(2, '0') + ':' : m + ':';
    let sStr = s.toString().padStart(2, '0');

    let sign = isGap ? (isNegative ? '-' : '+') : (isNegative ? '-' : '');
    return sign + hStr + mStr + sStr;
}

export function formatTimeForExport(ms) {
    if (isNaN(ms) || ms < 0) ms = 0;
    let totalSeconds = Math.floor(ms / 1000);
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;

    let hStr = h.toString().padStart(2, '0');
    let mStr = m.toString().padStart(2, '0');
    let sStr = s.toString().padStart(2, '0');

    return `${hStr}:${mStr}:${sStr}`;
}
