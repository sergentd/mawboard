export const Config = {
    api: {
        weather: 'api/get_weather.php',
        scan: 'api/check_scan.php',
        list: 'api/get_scan_list.php',
        ads: 'api/get_ads.php',
    },
    intervals: {
        memberScreenTimeout: 7000, // show the member screen for 7 seconds
        weatherRefresh: 15 * 60 * 1000, // refresh every 15 minutes
        scanPoll: 1000, // check for new scan every 1 seconds
        dateTime: 1000,  // update the date time every second
        timeoutDuration: 8000, // 8s before closing the password view
        adsRefresh: 1 * 60 * 1000 // refresh the ads list every 5 minutes
    },
    display: {
        screenId: 'WELCOME_SCREEN_1',
        defaultLanguage: 'fr',
        maxListItems: 12,
    },
    localStorage: {
        screenDisplay: 'setting_screen',
        weatherCity: 'setting_city',
        weatherCountry: 'setting_country',
        language: 'setting_language',
        lastScanID: 'setting_last_processed_scan_id',
        passwordToggle: 'setting_lock_password',
        adsEnabled: 'setting_ads_enabled',
        lastProcessedCheckIn: 'setting_last_processed_checkin',
    },
    paths: {
        langBase: 'lang/',
        messageIcons: 'static/img/',
    },
    logoSettings: {
        maxSizeMB: 2,
        defaultLogoSrc: 'static/img/default.png',
    },
    adSettings: {
        enabledByDefault: true,
        defaultDuration: 10000,
    },
    weatherSettings: {
        defaultLocation: { city: 'Geneva', country: 'CH' }
    },
    dom: { // Selectors for UIManager
        idleScreen: '#idle-screen',
        idleHeading: '#idle-screen-heading',
        idleScanPrompt: '#idle-screen .scan-prompt',
        memberScreen: '#member-screen',
        settingsScreen: '#settings-screen',
        idleWeatherIcon: '#idle-weather-icon-img',
        idleWeatherTemp: '#idle-weather-temp',
        idleWeatherDesc: '#idle-weather-desc',
        currentDate: '#current-date',
        currentTime: '#current-time',

        memberContentWrapper: '#member-screen .member-content-wrapper',
        trafficLight: '#traffic-light',
        welcomeMessage: '#welcome-message',
        customMessage: '#custom-message',
        statsArea: '#stats-area',
        statCheckin: '#stat-checkin',
        statTrainings: '#stat-trainings',
        statTotal: '#stat-total',
        statMeasure: '#stat-measure',
        statSessions: '#stat-sessions',
        statsHeading: '#stats-heading',

        labelCheckin: '#label-checkin',
        labelTrainings: '#label-trainings',
        labelTotal: '#label-total',
        labelMeasure: '#label-measure',
        labelSessions: '#label-sessions',

        openSettingsBtn: '#open-settings-btn',
        closeSettingsBtn: '#close-settings-btn',
        saveSettingsBtn: '#save-settings-btn',
        settingLanguageSelect: '#setting-language',
        settingLangFr: '#opt-lang-fr',
        settingLangEn: '#opt-lang-en',
        settingLangDe: '#opt-lang-de',
        settingLangIt: '#opt-lang-it',
        settingLangPt: '#opt-lang-pt',
        settingsStatusDiv: '#settings-status',
        settingsTitle: '#settings-title',
        settingsLangLabel: '#settings-language-label',
        settingsLocationLabel: '#settings-location-label',
        settingCityInput: '#setting-city',
        settingCountryInput: '#setting-country',
        settingCityError: "#setting-city-error",
        settingCountryError: "#setting-country-error",

        listScreen: '#list-screen',
        listScreenHeading: '#list-screen-heading',
        scanListUI: '#scan-list',
        noScansMessage: '#no-scans-message',
        modeToggleBtn: '#mode-toggle-btn',
        modeLabelIdle: '#mode-label-idle',
        modeLabelList: '#mode-label-list',
        idleHeader: '#idle-header',

        settingLockPasswordInput: '#setting-lock-password',
        passwordSetStatus: '#password-set-status',
        settingsPasswordLabel: '#setting-pwd-label',

        removePasswordBtn: '#remove-password-btn',
        passwordScreen: '#password-screen',
        passwordInput: '#password-input',
        confirmPasswordBtn: '#confirm-password-btn',
        cancelPasswordBtn: '#cancel-password-btn',
        passwordStatus: '#password-status',

        settingsAdsToggle: '#setting-ads-toggle',
        settingsAdsLabel: '#settings-ads-label',
        adOverlayContainer: '#ad-overlay-container',

        settingWeatherTitle: '#settings-location-label',
    }
};