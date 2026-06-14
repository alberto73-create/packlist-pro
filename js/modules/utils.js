// js/modules/utils.js - Utility functions Packlist Pro

/**
 * Escapes HTML special characters to prevent XSS
 */
export function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Formats weight in grams to human-readable string
 */
export function weight(grams) {
    if (grams >= 1000) {
        return `${(grams / 1000).toFixed(1)} kg`;
    }
    return `${grams} g`;
}

/**
 * Generates a unique ID
 */
export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Deep clone an object
 */
export function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Shows a toast notification
 */
export function toast(message, duration = 2000) {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.remove(), duration);
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Export all utilities as U object for backward compatibility
export const U = {
    esc,
    weight,
    uid,
    clone,
    toast,
    debounce,
    throttle
};
