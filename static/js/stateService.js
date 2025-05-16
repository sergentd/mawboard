import { Config } from "./config.js";
import { APIService } from "./apiService.js";


export const StateService = {
    _state: {
        [Config.localStorage.language]: Config.display.defaultLanguage,
        translations: {},
        [Config.localStorage.weatherCity]: Config.weatherSettings.defaultLocation.city,
        [Config.localStorage.weatherCountry]: Config.weatherSettings.defaultLocation.country,
        currentScreen: 'idle',
        [Config.localStorage.screenDisplay]: 'idle',
        weatherData: null,
        memberData: null,
        memberScreenTimer: null,
        scanPollIntervalId: null,
        quoteIntervalId: null,
        weatherIntervalId: null,
        dateTimeIntervalId: null,
        [Config.localStorage.lastScanID]: null,
        [Config.localStorage.lastProcessedCheckIn]: null,
        isPasswordPanelActive: false,
        passwordActionPending: null,
        [Config.localStorage.adsEnabled]: Config.adSettings.enabledByDefault,
        currentAdList: [],
        currentAdIndex: -1,
    },

    _keyMap: {
        [Config.localStorage.language]: Config.localStorage.language,
        [Config.localStorage.lastScanID]: Config.localStorage.lastScanID,
        [Config.localStorage.weatherCity]: Config.localStorage.weatherCity,
        [Config.localStorage.weatherCountry]: Config.localStorage.weatherCountry,
        [Config.localStorage.lastProcessedCheckIn]: Config.localStorage.lastProcessedCheckIn,
        [Config.localStorage.adsEnabled]: Config.localStorage.adsEnabled,
        [Config.localStorage.screenDisplay]: Config.localStorage.screenDisplay,
    },

    initialize() {
        this.set(Config.localStorage.language, localStorage.getItem(Config.localStorage.language) || Config.display.defaultLanguage);
        this.set(Config.localStorage.lastScanID, localStorage.getItem(Config.localStorage.lastScanID) || 0);
        this.set(Config.localStorage.weatherCity, localStorage.getItem(Config.localStorage.weatherCity) || Config.weatherSettings.defaultLocation.city);
        this.set(Config.localStorage.weatherCountry, localStorage.getItem(Config.localStorage.weatherCountry) || Config.weatherSettings.defaultLocation.country);
        this.set(Config.localStorage.lastProcessedCheckIn, localStorage.getItem(Config.localStorage.lastProcessedCheckIn) || 0);
        this.set(Config.localStorage.adsEnabled, localStorage.getItem(Config.localStorage.adsEnabled) || Config.adSettings.enabledByDefault);
        this.set(Config.localStorage.screenDisplay, localStorage.getItem(Config.localStorage.screenDisplay) || 'idle');
        console.log(`[StateService.initialize] Loaded state:`, JSON.stringify(this._state));
    },

    get(key) {
        return this._state[key];
    },

    set(key, value) {
        this._state[key] = value;

        // check for persistance
        if (this._keyMap[key]) {
            const storageKey = this._keyMap[key];
            if (value !== null && value !== undefined) {
                localStorage.setItem(storageKey, value);
            } else {
                localStorage.removeItem(storageKey);
            }
        }
    },

    async loadTranslations() {
        const lang = this.get(Config.localStorage.language);
        try {
            const data = await APIService.fetchJson(`${Config.paths.langBase}${lang}.json`);
            this.set('translations', data);
            console.log(`[loadTranslations] Translations loaded for: ${lang}`);
        } catch (error) {
            console.error(`[loadTranslations] Failed to load translations for ${lang}:`, error);
            this.set('translations', {
                welcome: "Welcome", please_scan: "Scan card", greeting: "Hello", denied: "Denied",
                weather_loading: "Loading...", weather_na: "N/A", weather_fail: "Error",
                settings_close: "Close", settings_save: "Save", settings_title: "Settings",
                settings_language_label: "Language:", settings_save_error: "Save Error",
                stat_label_checkin: "Check-in:", stat_label_trainings_month: "Workouts month:",
                stat_label_trainings_total: "Total workouts:", stat_label_last_measure: "Last measure:",
                stat_label_sessions_remain: "Sessions left:"
            });
            console.warn("[loadTranslations] Using minimal fallback translations.");
        }
    },

    getNextAd() {
        const ads = Config.ads || [];
        if (!ads || ads.length === 0) return null;

        let index = this.get('currentAdIndex');
        index = (index + 1) % ads.length;
        this.set('currentAdIndex', index);

        const adConfig = ads[index];

        let duration = Config.adSettings.defaultDuration;
        console.log("Duration: " + duration)
        if (adConfig.duration !== undefined && adConfig.duration !== null) {
            duration = adConfig.duration;
        } else if (adConfig.type === 'image') {
            duration = Config.adSettings.defaultImageDuration || Config.adSettings.defaultDuration;
        } else if (adConfig.type === 'pdf') {
            duration = Config.adSettings.defaultPdfDuration || Config.adSettings.defaultDuration;
        }
        // Note: Video duration handling needs more work if not fixed duration

        return { ...adConfig, calculatedDuration: duration };
    }

};