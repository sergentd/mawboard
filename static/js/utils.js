import { StateService } from "./stateService.js";

export function formatDateTime(dateString) {
    if (!dateString) return '--';
    const compatibleDateString = dateString.replace(' ', 'T');
    const dateObj = new Date(compatibleDateString);
    if (isNaN(dateObj.getTime())) {
        console.warn("Could not parse date string:", dateString);
        return dateString;
    }
    const timeOptions = {hour: '2-digit', minute: '2-digit', hour12: false}; // HH:MM only
    const dateOptions = {day: '2-digit', month: '2-digit', year: '2-digit'}; // DD.MM.YYYY
    const locale = StateService.get('currentLanguage') === 'en' ? 'en-GB' : 'fr-CH';
    const formattedTime = dateObj.toLocaleTimeString(locale, timeOptions);
    const formattedDate = dateObj.toLocaleDateString(locale, dateOptions);
    return `${formattedTime} ${formattedDate}`;
}