import { Config } from './config.js';
import { StateService } from './stateService.js';
import { APIService } from './apiService.js';
import { UIManager } from './uiManager.js';
import { TimerManager } from './timeManager.js';
import { PasswordService } from './passwordService.js';

let isAdCycleRunning = false;

function handleDateTimeTick() {
    const now = new Date();
    const lang = StateService.get(Config.localStorage.language);
    const locale = lang === 'en' ? 'en-GB' : `${lang}-CH`;
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    UIManager.updateDateTime(
        now.toLocaleDateString(locale, dateOptions),
        now.toLocaleTimeString(locale, timeOptions)
    );
}

async function handleWeatherUpdate() {
    const lang = StateService.get(Config.localStorage.language);
    const city = StateService.get(Config.localStorage.weatherCity);
    const country = StateService.get(Config.localStorage.weatherCountry);

    console.log(`[handleWeatherUpdate] Requesting weather for ${city}, ${country}, ${lang}`);
    const result = await APIService.fetchWeather(lang, city, country);

    if (result.success) {
        StateService.set('weatherData', result.data);
        UIManager.updateWeather(result.data);
    } else {
        console.error("[handleWeatherUpdate] Weather update failed:", result.error.message, result.error.details || '');
        UIManager.updateWeather({ status: 'error', error: { message: T.weather_fail || 'Weather not available' } })
    }
}

async function handleScanPoll() {
    if (StateService.get('currentScreen') === 'settingsScreen') return;
    const lastProcessedID = StateService.get(Config.localStorage.lastScanID);
    const lastProcessedCheckIn = StateService.get(Config.localStorage.lastProcessedCheckIn);
    let isNewScan = false;
    const result = await APIService.pollForScan();

    if (result.success) {
        const scanResult = result.data;

        if (scanResult.status === 'update_found' && scanResult.last_scan_id) {
            StateService.set(Config.localStorage.lastScanID, scanResult.last_scan_id);
            StateService.set(Config.localStorage.lastProcessedCheckIn, scanResult.stats.checkIn);
            if (lastProcessedID !== scanResult.last_scan_id) {
                console.log("[handleScanPoll] New scan detected:", scanResult.name);
                isNewScan = true;

                if (!scanResult.last_scan_id) {
                    StateService.set(Config.localStorage.lastScanID, 0);
                }
            } else if (String(scanResult.stats.checkIn).trim() !== String(lastProcessedCheckIn).trim()) {
                if (Date(scanResult.stats.checkIn) <= Date.now()) {
                    console.log(String(scanResult.stats.checkIn).trim());
                    console.log(String(lastProcessedCheckIn).trim());
                    isNewScan = true;
                }
            }
        } else if (scanResult.status === 'error') {
            console.error("[handleScanPoll] Scan poll error from backend:", scanResult.error?.message || scanResult.message || 'Unknown error');
            if (scanResult.last_scan_id) {
                StateService.set(Config.localStorage.lastScanID, scanResult.last_scan_id);
            }
        } else if (scanResult.status === 'no_update') {
            isNewScan = false;
            // console.log("No new scan."); // Optional debug
        } else {
            console.warn("[handleScanPoll] Received unexpected response from scan poll:", scanResult);
        }

        const currentMode = StateService.get(Config.localStorage.screenDisplay);
        if (currentMode === 'idle' && isNewScan === true) {
            StateService.set('memberData', scanResult);
            UIManager.displayMemberInfo(scanResult);
            TimerManager.start('memberScreen', () => {
                console.log("[memberScreen Timer Callback] Fired!");

                if (StateService.get('currentScreen') === 'memberScreen') {
                    console.log("[memberScreen Timer Callback] Returning to idle screen.");
                    UIManager.showScreen('idle');

                    if (!TimerManager.timers.scanPoll) {
                        console.log("[memberScreen Timer Callback] Restarting scan polling.");
                        TimerManager.start('scanPoll', handleScanPoll, Config.intervals.scanPoll);
                    }

                    if (StateService.get(Config.localStorage.adsEnabled)) {
                        console.log("[memberScreen Timer Callback] Ads enabled, restarting ad cycle.");
                        showNextAd();
                    }
                } else {
                    console.log("[memberScreen Timer Callback] Screen changed before timer fired, doing nothing.");
                }
            }, Config.intervals.memberScreenTimeout);
        } else if (currentMode === 'list' && isNewScan) {
            StateService.set('memberData', scanResult);
            UIManager.prependScanItem(scanResult);
        }
    } else {
        console.error("[handleScanPoll] Failed to fetch scan data:", result.error.message, result.error.details || '');
    }
}

async function fetchAndRenderList() {
    console.log("[fetchAndRenderList] Fetching scan list...");
    const result = await APIService.fetchScanList();

    if (result.success) {
        console.log(`[fetchAndRenderList] Scan list fetched successfully (${result.data.length} items)`);
        UIManager.renderScanList(result.data);
    } else {
        console.error("[fetchAndRenderList] Error fetching scan list:", result.error?.message || 'Unknown error');
        UIManager.displayNoScansMessage(true);
    }
}

function openSettings() {
    console.log("[openSettings] Opening settings...");
    UIManager.loadSettingsToPanel();
    UIManager.showScreen('settings');
    TimerManager.clear('scanPoll');
    TimerManager.clear('memberScreen');
    TimerManager.clear('adInterval');
    TimerManager.clear('adListRefresh');
    UIManager.hideAds();
}

function closeSettings() {
    console.log("[closeSettings] Closing settings...");
    const returnMode = StateService.get(Config.localStorage.screenDisplay);
    const adsAreEnabled = StateService.get(Config.localStorage.adsEnabled);
    UIManager.showScreen(returnMode);

    if (!TimerManager.timers.scanPoll) {
        TimerManager.start('scanPoll', handleScanPoll, Config.intervals.scanPoll);
    }

    if (adsAreEnabled) {
        TimerManager.start('adListRefresh', refreshAdList, Config.adSettings.refreshInterval);
        if (returnMode === 'idle') {
            console.log("[closeSettings] Ads enabled, starting ad cycle.");
            showNextAd();
        } else {
            console.log("[closeSettings] Ads enabled, but returning to list mode - not starting cycle.");
            TimerManager.clear('adInterval');
            UIManager.hideAds();
            isAdCycleRunning = false;
        }
    } else {
        console.log("[closeSettings] Ads disabled, ensuring timers are stopped.");
        TimerManager.clear('adInterval');
        TimerManager.clear('adListRefresh');
        UIManager.hideAds();
        isAdCycleRunning = false;
    }
}

async function saveSettings() {
    console.log(`[saveSettings] Function call START`);
    UIManager.clearAllValidationError(); // Clear previous errors first
    let isValid = true;

    // Get current translations for potential error messages during validation
    const T_Validation = StateService.get('translations') || {};

    // --- 1. Read and Validate Inputs ---
    const selectedLang = UIManager.elements.settingLanguageSelect.value;
    const adsEnabledInput = UIManager.elements.settingsAdsToggle.classList.contains('active'); // Assuming button toggle
    const cityInput = UIManager.elements.settingCityInput.value.trim();
    const countryInput = UIManager.elements.settingCountryInput.value.trim().toUpperCase();
    const newPasswordTyped = UIManager.elements.settingLockPasswordInput.value; // Don't trim passwords

    // Validate City
    if (!cityInput) {
        isValid = false;
        UIManager.displayValidationError('settingCity', T_Validation.error_city_required || 'City name required');
    }
    // Validate Country
    if (!countryInput) {
        isValid = false;
        UIManager.displayValidationError('settingCountry', T_Validation.error_country_required || 'Country code required');
    } else if (countryInput.length !== 2 || !/^[A-Z]+$/i.test(countryInput)) {
        isValid = false;
        UIManager.displayValidationError('settingCountry', T_Validation.error_country_code_length || 'Country code must be 2 letters');
    }

    if (!isValid) {
        console.warn('[saveSettings] Validation failed (City/Country). Settings not saved.');
        return; // Stop if basic validation fails
    }
    console.log('[saveSettings] City/Country inputs validated successfully.');

    try {
        let newT = T_Validation;

        // reload translations if language changed
        if (StateService.get(Config.localStorage.language) !== selectedLang) {
            console.log(`[saveSettings] Language preference saved: ${selectedLang}`);
            StateService.set(Config.localStorage.language, selectedLang);

            console.log(`[saveSettings] Language changed, reloading translations`);
            await StateService.loadTranslations();
            newT = StateService.get('translations');
        }

        // save location settings
        StateService.set(Config.localStorage.weatherCity, cityInput);
        StateService.set(Config.localStorage.weatherCountry, countryInput);
        console.log(`[saveSettings] Location saved: ${cityInput}, ${countryInput}`);
        const locationConfirmText = (newT.settings_save_ok_location || ` Location: {city}, {country}.`)
            .replace('{city}', cityInput)
            .replace('{country}', countryInput);

        // save ads settings
        StateService.set(Config.localStorage.adsEnabled, adsEnabledInput);
        console.log(`[saveSettings] Ads enabled state set to: ${adsEnabledInput}`);

        // save password settings
        let passwordActionMessage = '';
        let passwordActionType = 'info';

        // check to see if a password has been typed
        if (newPasswordTyped) {
            // check to see if a password already exists and if so, ask for it before update
            if (PasswordService.isPasswordSet()) {
                console.log('Password exists, prompting for current password to confirm change');
                PasswordService.storeNewPasswordAttempt(newPasswordTyped);
                UIManager.showPasswordPanel('change_password');
                TimerManager.start('passwordTimeout', handlePasswordTimeout, Config.intervals.timeoutDuration);
                passwordActionMessage = newT.password_input_label || 'Enter password to confirm change';

            } else {
                // otherwise, we can directly set the password
                if (PasswordService.setPassword(newPasswordTyped)) {
                    passwordActionMessage = newT.password_set_success || 'Password set.';
                    passwordActionType = 'success';
                } else {
                    passwordActionMessage = newT.error_generic || 'Error while setting password';
                    passwordActionType = 'error';
                }
            }
        } else {
            // otherwise, no change applied
            console.log('[saveSettings] Password field empty, no direct change to lock password.');
        }

        UIManager.updateStaticText(newT);
        UIManager.updatePasswordSetIndicator();
        if (passwordActionMessage) {
            UIManager.displayPasswordSetStatus(passwordActionMessage, passwordActionType);
        }

        console.log('[saveSettings] Triggering weather update');
        await handleWeatherUpdate();

        const langName = UIManager.elements.settingLanguageSelect.options[UIManager.elements.settingLanguageSelect.selectedIndex].text;
        let finalStatusMessage = (newT.settings_save_ok_base || 'settings saved! Language: {langName}').replace('{langName}', langName);
        finalStatusMessage += locationConfirmText;
        UIManager.displaySettingsStatus(finalStatusMessage);
        console.log('[saveSettings] Settings processed successfully.');
    } catch (e) {
        console.error('[saveSettings] Error while saving settings:', e);
        UIManager.displaySettingsStatus(T_Validation.settings_save_error || 'Error processing settings.', true);
    }

    console.log('[saveSettings] Function finished.');
}

function performModeToggle() {
    const currentMode = StateService.get(Config.localStorage.screenDisplay);
    const newMode = currentMode === 'idle' ? 'list' : 'idle';
    StateService.set(Config.localStorage.screenDisplay, newMode);
    UIManager.showScreen(newMode);

    if (newMode === 'list') {
        TimerManager.clear('adInterval');
        UIManager.hideAds();
        isAdCycleRunning = false;
        fetchAndRenderList();
        return
    } else {
        if (StateService.get(Config.localStorage.adsEnabled) && !isAdCycleRunning) {
            showNextAd();
        }
    }
}

function handleToggleClick() {
    console.log("[handleToggleClick] Toggle button clicked.");
    if (!PasswordService.isPasswordSet()) {
        console.log("[handleToggleClick] No lock password set, toggling directly.");
        performModeToggle();
    } else {
        console.log("[handleToggleClick] Lock password set, showing prompt.");
        UIManager.showPasswordPanel('toggle');
        TimerManager.start('passwordTimeout', handlePasswordTimeout, Config.intervals.timeoutDuration);
    }
}

function handlePasswordConfirm() {
    const T = StateService.get('translations');
    const enteredPassword = UIManager.elements.passwordInput?.value;
    const pendingAction = StateService.get('passwordActionPending');

    if (PasswordService.verifyPassword(enteredPassword)) {
        console.log("[handlePasswordConfirm] Password correct.");
        TimerManager.clear('passwordTimeout');
        UIManager.hidePasswordPanel();

        if (pendingAction === 'toggle') {
            performModeToggle();
        } else if (pendingAction === 'remove') {
            performPasswordRemoval();
        } else if (pendingAction === 'change_password') {
            console.log("[handlePasswordConfirm] Performing password change.");
            const newPlainTextPassword = PasswordService.getNewPasswordAttempt();
            if (newPlainTextPassword) {
                if (PasswordService.setPassword(newPlainTextPassword)) {
                    UIManager.updatePasswordSetIndicator();
                    UIManager.displayPasswordSetStatus(T.password_set_success || 'Password changed successfully.', 'success');
                } else {
                    UIManager.displayPasswordSetStatus(T.password_set_error || 'Failed to set new password.', 'error');
                }
                PasswordService.clearNewPasswordAttempt();

            } else {
                console.error("[handlePasswordConfirm] Tried to change password, but no new password was set.");
                UIManager.displayPasswordSetStatus(T.error_generic || 'An error occurred.', 'error');
            }
        } else {
            console.warn("[handlePasswordConfirm] Unknown pending action:", pendingAction);
        }
    } else {
        console.log("[handlePasswordConfirm] Password incorrect.");
        UIManager.displayPasswordStatus(T.error_incorrect_password || 'Incorrect Password.', true);
        if (UIManager.elements.passwordInput) UIManager.elements.passwordInput.value = '';
        UIManager.elements.passwordInput?.focus();
        TimerManager.start('passwordTimeout', handlePasswordTimeout, Config.intervals.timeoutDuration);
    }
}

function handleRemovePasswordClick() {
    console.log("[handleRemovePasswordClick] Removing password.");
    // Use StateService to ensure state and localStorage are cleared
    UIManager.showPasswordPanel('remove');
    TimerManager.start('passwordTimeout', handlePasswordTimeout, Config.intervals.timeoutDuration)
}

function handlePasswordCancel() {
    console.log("[handlePasswordCancel] Password entry cancelled.");
    TimerManager.clear('passwordTimeout');
    UIManager.hidePasswordPanel();
}

function handlePasswordTimeout() {
    console.log("[handlePasswordTimeout] Password entry timed out.");
    if (StateService.get('isPasswordPanelActive')) {
        UIManager.hidePasswordPanel();
    }
}

function handlePasswordInputActivity() {
    if (StateService.get('isPasswordPanelActive')) {
        TimerManager.start('passwordTimeout', handlePasswordTimeout, Config.intervals.timeoutDuration);
    }
}

function performPasswordRemoval() {
    const T = StateService.get('translations');
    PasswordService.removePassword();
    UIManager.updatePasswordSetIndicator();
    UIManager.displayPasswordSetStatus(T.password_removed || 'Lock password removed.', 'info');
    console.log("[performPasswordRemoval] Password confirmed. Removing lock.");

    if (UIManager.elements.settingLockPasswordInput) {
        UIManager.elements.settingLockPasswordInput.value = '';
    }
}

async function refreshAdList() {
    if (!StateService.get(Config.localStorage.adsEnabled)) {
        console.log("[refreshAdList] Ads disabled, skipping fetch.");
        TimerManager.clear('adInterval');
        UIManager.hideAds();
        isAdCycleRunning = false;
        return;
    }

    console.log("[refreshAdList] Fetching active ad list...");
    const result = await APIService.fetchActiveAds();

    if (result.success && Array.isArray(result.data)) {
        console.log(`[refreshAdList] Fetched ${result.data.length} active ads.`);
        StateService.set('currentAdList', result.data);
        StateService.set('currentAdIndex', -1);

        if (StateService.get(Config.localStorage.screenDisplay) === 'idle') {
            showNextAd();
        }
    } else {
        console.warn("[refreshAdList] Failed to get valid ad list:", result.error?.message);
        StateService.set('currentAdList', []); // Clear list on error
        TimerManager.clear('adInterval');
        UIManager.hideAds();
        isAdCycleRunning = false;
    }
}

function showNextAd() {
    // Check mode and enabled status again (belt-and-suspenders)
    if (StateService.get(Config.localStorage.screenDisplay) !== 'idle' || !StateService.get(Config.localStorage.adsEnabled)) {
        TimerManager.clear('adInterval');
        UIManager.hideAds();
        isAdCycleRunning = false;
        return;
    }

    const adList = StateService.get('currentAdList');
    if (!adList || adList.length === 0) {
        console.log("[showNextAd] No active ads available in current list.");
        UIManager.hideAds();
        TimerManager.clear('adInterval'); // Stop if list becomes empty
        isAdCycleRunning = false;
        return;
    }

    isAdCycleRunning = true; // Mark cycle as active

    // Get next ad index
    let index = StateService.get('currentAdIndex');
    index = (index + 1) % adList.length;
    StateService.set('currentAdIndex', index);

    const adConfig = adList[index]; // Get ad details from fetched list

    if (!adConfig) { // Safety check
        console.error("[showNextAd] Invalid ad config at index", index);
        // Try to advance again on next cycle? For now, just stop.
        TimerManager.clear('adInterval');
        UIManager.hideAds();
        isAdCycleRunning = false;
        return;
    }

    UIManager.displayAd(adConfig); // Display it

    // Schedule the next ad change using duration from fetched data
    const duration = adConfig.duration || Config.adSettings.defaultDuration || 15000;
    console.log(`[showNextAd] Scheduling next ad in ${duration}ms`);
    TimerManager.start('adInterval', showNextAd, duration); // Reschedule using TimerManager
}

// --- Initialization Sequence ---
async function initializeApp() {
    console.log("[intitializeApp] Initializing Application...");
    TimerManager.clearAll();

    StateService.initialize();
    await StateService.loadTranslations();
    UIManager.initialize();
    UIManager.updateAdsToggleVisuals(StateService.get(Config.localStorage.adsEnabled));

    handleDateTimeTick();
    await handleWeatherUpdate();

    TimerManager.start('dateTime', handleDateTimeTick, Config.intervals.dateTime);
    TimerManager.start('weather', handleWeatherUpdate, Config.intervals.weatherRefresh);
    TimerManager.start('scanPoll', handleScanPoll, Config.intervals.scanPoll);

    const initialMode = StateService.get(Config.localStorage.screenDisplay);
    const initialAdsEnabled = StateService.get(Config.localStorage.adsEnabled);

    if (initialAdsEnabled) {
        await refreshAdList();
        TimerManager.start('adListRefresh', refreshAdList, Config.intervals.adsRefresh)

        if (initialMode === 'idle') { showNextAd(); }
    }

    if (initialMode === 'list') { fetchAndRenderList(); }
    UIManager.showScreen(initialMode);

    UIManager.elements.openSettingsBtn?.addEventListener('click', openSettings);
    UIManager.elements.closeSettingsBtn?.addEventListener('click', closeSettings);
    UIManager.elements.saveSettingsBtn?.addEventListener('click', saveSettings);
    UIManager.elements.modeToggleBtn?.addEventListener('click', handleToggleClick);
    UIManager.elements.confirmPasswordBtn?.addEventListener('click', handlePasswordConfirm);
    UIManager.elements.cancelPasswordBtn?.addEventListener('click', handlePasswordCancel);
    UIManager.elements.passwordInput?.addEventListener('input', handlePasswordInputActivity);
    UIManager.elements.removePasswordBtn?.addEventListener('click', handleRemovePasswordClick);
    UIManager.elements.passwordInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handlePasswordConfirm();
        }
    });
    UIManager.elements.settingsAdsToggle?.addEventListener('click', (event) => {
        const btn = event.currentTarget;
        const newState = !btn.classList.contains('active');
        btn.classList.toggle('active', newState);
        btn.setAttribute('aria-pressed', newState);
        console.log(`[AdsToggle Click] Visual state toggled to: ${newState}. (Actual save on Save button)`);
    });
    console.log("Application initialization complete.");
}

function simulateScan(simulationType = 'allowed') {
    const allowedData = {
        status: 'update_found',
        name: 'Alex Fit',
        member_status: 'allowed',
        custom_message: 'Prêt pour votre séance !',
        stats: {
            daysSinceLastMeasure: 15,
            remainingSessions: 20,
            trainingsThisMonth: 8,
            trainingsTotal: 150,
            checkIn: '2025-12-05 15:02:00',
        },
        last_scan_id: 20250426180016_4702
    };

    const warningData = {
        status: 'update_found',
        name: 'Sam Warning',
        member_status: 'warning',
        custom_message: 'Abonnement expire bientôt !\nFrais de casier en retard !',
        stats: {
            daysSinceLastMeasure: 45,
            remainingSessions: 3,
            trainingsThisMonth: 5,
            trainingsTotal: 95,
            checkIn: '2025-12-05 15:02:00',
        },
        last_scan_id: 20250426180016_4702
    };

    const deniedData = {
        status: 'update_found',
        name: 'Denis Muser',
        member_status: 'denied',
        custom_message: "",
        stats: {
            daysSinceLastMeasure: null,
            remainingSessions: 0,
            trainingsThisMonth: 0,
            trainingsTotal: 72,
            checkIn: '2025-12-05 15:02:00',
        },
        last_scan_id: 20250426180016_4702
    };

    let dataToSend;

    switch (simulationType.toLowerCase()) {
        case 'warning':
            dataToSend = warningData;
            break;
        case 'denied':
            dataToSend = deniedData;
            break;
        case 'allowed':
        default:
            dataToSend = allowedData;
            break;
    }

    UIManager.displayMemberInfo(dataToSend);
    TimerManager.start('memberScreen', () => UIManager.showScreen('idle'), Config.intervals.memberScreenTimeout);
}

window.simulateScan = simulateScan
initializeApp();