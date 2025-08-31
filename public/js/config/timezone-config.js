/**
 * Timezone Configuration
 * Centralized timezone settings for the SignOuts application
 */

export const TIMEZONE_CONFIG = {
    // Primary timezone for display (EST/EDT handles daylight saving automatically)
    DISPLAY_TIMEZONE: 'America/New_York',
    
    // Storage timezone (always UTC for consistency)
    STORAGE_TIMEZONE: 'UTC',
    
    // Default locale for formatting
    LOCALE: 'en-US',
    
    // Common format options
    FORMATS: {
        DATE_ONLY: {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        },
        TIME_ONLY: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        DATETIME_SHORT: {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        },
        DATETIME_FULL: {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }
    }
};

/**
 * Helper function to get current UTC time for storage
 * @returns {string} ISO string in UTC
 */
export function getCurrentUTC() {
    return new Date().toISOString();
}

/**
 * Helper function to format time for display in configured timezone
 * @param {string} utcDateString - UTC date string
 * @param {string} formatType - Format type from FORMATS object
 * @returns {string} Formatted date string
 */
export function formatForDisplay(utcDateString, formatType = 'DATETIME_SHORT') {
    if (!utcDateString) return 'N/A';
    
    const date = new Date(utcDateString);
    const formatOptions = {
        timeZone: TIMEZONE_CONFIG.DISPLAY_TIMEZONE,
        ...TIMEZONE_CONFIG.FORMATS[formatType]
    };
    
    return date.toLocaleString(TIMEZONE_CONFIG.LOCALE, formatOptions);
}

/**
 * Get today's date in the display timezone for comparisons
 * @returns {string} Date string in MM/DD/YYYY format
 */
export function getTodayInDisplayTimezone() {
    return new Date().toLocaleDateString(TIMEZONE_CONFIG.LOCALE, {
        timeZone: TIMEZONE_CONFIG.DISPLAY_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}
