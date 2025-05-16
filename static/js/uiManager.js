import { Config } from "./config.js";
import { StateService } from "./stateService.js";
import { TimerManager } from "./timeManager.js";
import { formatDateTime } from './utils.js';
import { PasswordService } from "./passwordService.js";

export const UIManager = {
    elements: {},
    _focusedElementBeforeDialog: null,

    initialize() {
        for (const key in Config.dom) {
            this.elements[key] = document.querySelector(Config.dom[key]);
            if (!this.elements[key]) {
                console.warn(`[UIManager.initialize] Element not found for selector '${Config.dom[key]}' (key: ${key})`);
            }
        }

        this.updateStaticText(StateService.get('translations'));
        this.updateToggleVisuals(StateService.get(Config.localStorage.screenDisplay));
        this.updatePasswordSetIndicator();
        console.log("[UIManager.initialize] UIManager initialized and elements cached.");
    },

    updateStaticText(T) {
        // IDLE PANEL
        this.elements.idleHeading.textContent = (T.welcome || 'Welcome').replace(',', ' !');
        this.elements.idleScanPrompt.textContent = T.please_scan || 'Please scan card';
        this.elements.modeLabelIdle.textContent = T.mode_scan || "Scan mode";
        this.elements.modeLabelList.textContent = T.mode_list || "List mode";

        // MEMBER PANEL
        this.elements.statsHeading.textContent = T.stats_heading || 'Your stats:'
        this.elements.labelCheckin.textContent = T.stat_label_checkin || 'Check-in:';
        this.elements.labelTrainings.textContent = T.stat_label_trainings_month || 'Workouts month:';
        this.elements.labelTotal.textContent = T.stat_label_trainings_total || 'Total workouts:';
        this.elements.labelMeasure.textContent = T.stat_label_last_measure || 'Last measure:';
        this.elements.labelSessions.textContent = T.stat_label_sessions_remain || 'Sessions left:';

        // SETTINGS PANEL
        this.elements.settingsTitle.textContent = T.settings_title || 'Settings';
        this.elements.settingsLangLabel.textContent = T.settings_language_label || 'Language:';
        this.elements.saveSettingsBtn.textContent = T.settings_save || 'Save';
        this.elements.closeSettingsBtn.textContent = T.settings_close || 'Close';
        this.elements.settingLangFr.textContent = T.lang_fr || 'Français';
        this.elements.settingLangEn.textContent = T.lang_en || 'English';
        this.elements.settingLangDe.textContent = T.lang_de || 'Deutsch';
        this.elements.settingLangIt.textContent = T.lang_it || 'Italiano';
        this.elements.settingLangEn.textContent = T.lang_en || 'English';
        this.elements.settingLockPasswordInput.placeholder = T.settings_password_placeholder_unset || 'Leave empty to disable';
        this.elements.settingsPasswordLabel.textContent = T.settings_lock_label || 'Screen lock (password)';
        this.elements.removePasswordBtn.textContent = T.settings_remove_password || 'Remove password';

        // METEO WIDGET
        this.elements.settingsLocationLabel.textContent = T.settings_location_label || 'Weather location:';
        this.elements.settingCityInput.textContent = T.setting_city_label || 'City:';
        this.elements.settingCountryInput.textContent = T.setting_country_label || 'Country';
        this.elements.settingCityInput.placeholder = T.setting_city_placeholder || 'Ex: Geneva';
        this.elements.settingCountryInput.placeholder = T.setting_country_placeholder || 'Ex: CH (2 letters code)';

        // ADS SETTING
        this.elements.settingsAdsLabel.textContent = T.settings_ads_label || 'Show ads:';

        // LIST PANEL
        this.elements.listScreenHeading.textContent = T.list_screen_heading || 'Recent Scans';
        this.elements.noScansMessage.textContent = T.list_empty || 'No recent scans.';

        const passTitle = document.getElementById('password-title');
        if (passTitle) passTitle.textContent = T.password_title || 'Password Required';
        if (this.elements.confirmPasswordBtn) this.elements.confirmPasswordBtn.textContent = T.password_confirm || 'Confirm';
        if (this.elements.cancelPasswordBtn) this.elements.cancelPasswordBtn.textContent = T.password_cancel || 'Cancel';
        if (this.elements.settingsLocationLabel) this.elements.settingsLocationLabel.textContent = T.settings_location_label || 'Weather Location:';
        const cityLabel = this.elements.settingCityInput?.previousElementSibling;
        if (cityLabel) cityLabel.textContent = T.settings_city_label || 'City:';
        const countryLabel = this.elements.settingCountryInput?.previousElementSibling;
        if (countryLabel) countryLabel.textContent = T.settings_country_label || 'Country:';
    },

    displayAd(adConfig) {
        const container = this.elements.adOverlayContainer;
        if (!container) return;

        container.innerHTML = ''; // Clear previous ad
        container.classList.remove('hidden');

        console.log("[UIManager.displayAd] Displaying ad:", adConfig);

        let adElement = null;
        if (adConfig.type === 'image') {
            adElement = document.createElement('img');
            adElement.src = adConfig.src;
            adElement.alt = adConfig.alt || 'Advertisement Image'; // Add alt text
            adElement.onerror = () => { // Basic error handling
                console.error(`Failed to load ad image: ${adConfig.src}`);
                container.classList.add('hidden'); // Hide container on error
            };
        } else if (adConfig.type === 'video') {
            adElement = document.createElement('video');
            adElement.src = adConfig.src;
            adElement.muted = adConfig.options?.muted !== false; // Default to muted
            adElement.autoplay = adConfig.options?.autoplay !== false; // Default to autoplay
            adElement.loop = adConfig.options?.loop || false; // Default no loop
            adElement.playsInline = true; // Good practice for mobile
            adElement.onerror = () => {
                console.error(`Failed to load ad video: ${adConfig.src}`);
                container.classList.add('hidden');
            };
            // TODO: Add event listener for 'ended' if using variable duration
        } else if (adConfig.type === 'pdf') {
            // Using embed is often simpler, iframe provides more isolation
            adElement = document.createElement('embed');
            adElement.src = adConfig.src;
            adElement.type = "application/pdf";
        } else {
            console.warn(`[UIManager.displayAd] Unsupported ad type: ${adConfig.type}`);
            container.classList.add('hidden');
            return;
        }

        if (adElement) {
            container.appendChild(adElement);
        }
    },

    hideAds() {
        const container = this.elements.adOverlayContainer;
        if (container) {
            container.classList.add('hidden');
            setTimeout(() => {
                if (container.classList.contains('hidden')) { // Check if still hidden
                    container.innerHTML = '';
                }
            }, 500);
            console.log("[UIManager.hideAds] Ad container hidden.");
        }
    },

    showScreen(screenName) {
        const currentMode = StateService.get(Config.localStorage.screenDisplay);
        StateService.set('currentScreen', screenName + 'Screen');
        const screens = ['idleScreen', 'memberScreen', 'settingsScreen', 'listScreen', 'passwordScreen'];
        const noAdsScreen = ['member', 'settings', 'list'];
        if (noAdsScreen.includes(screenName)) { this.hideAds(); }

        screens.forEach(key => {
            if (this.elements[key]) {
                this.elements[key].classList.add('hidden');
            }
        });

        if (this.elements.idleHeader) {
            this.elements.idleHeader.classList.toggle('hidden', screenName === 'settings')
        }

        if (this.elements[screenName + 'Screen']) {
            this.elements[screenName + 'Screen'].classList.remove('hidden');
        } else {
            console.error(`[UIManager.showScreen] Cannot show unknown screen '${screenName}'`);
            return;
        }

        if (screenName === 'settings') {
            this._focusedElementBeforeDialog = document.activeElement;
            setTimeout(() => this.elements.settingLanguageSelect?.focus(), 100);
        } else if (this._focusedElementBeforeDialog) {
            this._focusedElementBeforeDialog.focus();
            this._focusedElementBeforeDialog = null;
        }

        this.updateToggleVisuals(currentMode);
    },

    showPasswordPanel(action = 'toggle') {
        console.log("[UIManager.showPasswordPanel] Showing password panel");
        if (this.elements.passwordScreen) {
            if (this.elements.passwordInput) this.elements.passwordInput.value = '';
            this.displayPasswordStatus('');
            StateService.set('passwordActionPending', action)
            this.elements.passwordScreen.classList.remove('hidden');
            StateService.set('isPasswordPanelActive', true);
            setTimeout(() => this.elements.passwordInput?.focus(), 100);
        }
    },

    hidePasswordPanel() {
        console.log("[UIManager.hidPasswordPanel] Hiding password panel");
        if (this.elements.passwordScreen) {
            this.elements.passwordScreen.classList.add('hidden');
            StateService.set('isPasswordPanelActive', false);
            StateService.set('passwordActionPending', null);
        }
    },

    displayPasswordStatus(message, isError = true) {
        if (this.elements.passwordStatus) {
            const el = this.elements.passwordStatus;
            el.textContent = message;
            el.classList.remove('message-error', 'message-success', 'message-info'); // Reset
            if (message && isError) {
                el.classList.add('message-error');
            }
            // Clear input error state visually
            if (this.elements.passwordInput) {
                this.elements.passwordInput.classList.toggle('input-error', isError && !!message);
            }
        }
    },

    displayPasswordSetStatus(message, type = 'info') {
        if (this.elements.passwordSetStatus) {
            const el = this.elements.passwordSetStatus;
            el.textContent = message;
            el.classList.remove('message-info', 'message-success', 'message-error');
            el.classList.add(`message-${type}`);
        }
    },

    updatePasswordSetIndicator() {
        const isPasswordSet = PasswordService.isPasswordSet();
        const T = StateService.get('translations');

        if (this.elements.removePasswordBtn) {
            this.elements.removePasswordBtn.style.display = isPasswordSet ? 'inline-block' : 'none';
        }

        if (this.elements.settingLockPasswordInput) {
            if (isPasswordSet) {
                this.elements.settingLockPasswordInput.placeholder = T.settings_password_placeholder_set || '******** (Enabled)';
            } else {
                this.elements.settingLockPasswordInput.placeholder = T.settings_password_placeholder_unset || 'Leave empty to disable';
            }
            this.elements.settingLockPasswordInput.value = ''; // Always clear value on load
        }
    },

    updateDateTime(dateString, timeString) {
        if (this.elements.currentDate) this.elements.currentDate.textContent = dateString;
        if (this.elements.currentTime) this.elements.currentTime.textContent = timeString;
    },

    updateWeather(weatherResult) {
        const T = StateService.get('translations');
        const descEl = this.elements.idleWeatherDesc;
        const tempEl = this.elements.idleWeatherTemp;
        const iconEl = this.elements.idleWeatherIcon;

        if (!descEl || !tempEl || !iconEl) {
            console.warn("UIManager.updateWeather: Header weather elements not found.");
            return;
        }

        const isError = (weatherResult.status === 'error') || (weatherResult.error != null) || (weatherResult.status === 'success' && !weatherResult.data && !weatherResult.temp);
        if (isError) {
            let errorMsg = 'Unknown weather error';
            if (typeof weatherResult.error === 'string') {
                errorMsg = weatherResult.error;
            } else if (weatherResult.error?.message) {
                errorMsg = weatherResult.error.message;
            } else if (weatherResult.message) {
                errorMsg = weatherResult.message;
            }
            console.warn("[UIManager.updateWeather] Weather update failed: ", errorMsg);
            descEl.textContent = T.weather_fail || 'Weather unavailable';
            tempEl.textContent = '';
            iconEl.src = '';
            iconEl.alt = '';
            iconEl.style.display = 'none';
            return;
        }

        iconEl.style.display = 'inline-block';
        const data = weatherResult.data || weatherResult;

        this.elements.idleWeatherTemp.textContent = data.temp !== null ? `${Math.round(data.temp)}°C` : '--°C';
        this.elements.idleWeatherDesc.textContent = data.description || (T.weather_na || 'N/A');
        if (data.icon) {
            const iconUrl = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
            this.elements.idleWeatherIcon.src = iconUrl;
            this.elements.idleWeatherIcon.alt = data.description || (T.weather_na || 'Weather icon');
        } else {
            this.elements.idleWeatherIcon.src = "";
            this.elements.idleWeatherIcon.alt = T.weather_na || "Icon unavailable";
        }
    },

    prependScanItem(scanData) {
        const T = StateService.get('translations');
        const listUl = this.elements.scanListUI;
        if (!listUl) return;

        // Hide "no scans" message if it's visible
        this.displayNoScansMessage(false);

        // Create the new list item elements
        const li = document.createElement('li');
        // Add class for animation (optional)
        li.className = `scan-item status-${scanData.member_status || 'denied'} fade-in`;

        const indicator = document.createElement('span');
        indicator.className = 'status-indicator';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'member-name';
        nameSpan.textContent = scanData.name.trim() || T.list_unknown_member;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'scan-time';
        // Use the 'checkIn' from stats if available, otherwise maybe the scan processing time?
        // Assuming scanResult has the same structure as displayMemberInfo needs
        const checkInTime = scanData.stats?.checkIn;
        timeSpan.textContent = checkInTime ? formatDateTime(checkInTime) : '--';

        const messagesContainer = document.createElement('div');
        messagesContainer.className = 'scan-item-messages';

        const customMessages = scanData.custom_message; // Array of message objects
        if (Array.isArray(customMessages) && customMessages.length > 0) {
            customMessages.forEach(msg => {
                const msgSpan = document.createElement('span');
                msgSpan.className = 'scan-item-message-line'; // For styling
                if (msg.iconName) {
                    const img = document.createElement('img');
                    img.src = Config.paths.messageIcons + msg.iconName;
                    img.alt = msg.iconName.split('.')[0];
                    img.className = 'message-icon message-icon-small'; // Smaller icon for list
                    msgSpan.appendChild(img);
                }
                const textNode = document.createTextNode(msg.text); // Use text node for text part
                msgSpan.appendChild(textNode);
                messagesContainer.appendChild(msgSpan); // Append each message line to the container
            });
        }

        li.appendChild(indicator);
        li.appendChild(nameSpan);
        li.appendChild(messagesContainer);
        li.appendChild(timeSpan);

        // Insert at the beginning of the list
        listUl.insertBefore(li, listUl.firstChild);

        // Optional: Remove old items if list exceeds max size
        const maxItems = Config.display.maxListItems;
        while (listUl.children.length > maxItems) {
            listUl.removeChild(listUl.lastElementChild);
        }

        setTimeout(() => {
            li.classList.remove('fade-in');
        }, 500);
    },

    displayMemberInfo(scanResult) {
        TimerManager.clear('adInterval');
        TimerManager.clear('scanPoll');
        this.hideAds();

        const T = StateService.get('translations');
        const wrapper = this.elements.memberContentWrapper;
        const statsArea = this.elements.statsArea;
        const messageEl = this.elements.customMessage;

        if (!wrapper || !statsArea || !messageEl) {
            console.error("[UIManager.displayMemberInfo] required elements not found.")
            return;
        }

        wrapper.className = 'member-content-wrapper';
        messageEl.classList.remove('message-warning', 'message-denied');
        messageEl.innerHTML = ''
        let statusClass = '';

        if (scanResult.member_status === "allowed" || scanResult.member_status === "warning") {
            this.elements.welcomeMessage.textContent = `${T.welcome || 'Welcome,'} ${scanResult.name || 'Member'}!`;
            const customMessages = scanResult.custom_message;
            if (Array.isArray(customMessages) && (customMessages.length > 0)) {
                const fragment = document.createDocumentFragment();
                customMessages.forEach(msg => {
                    const p = document.createElement('p');
                    p.className = 'member-message-item';
                    if (msg.iconName) {
                        const img = document.createElement('img');
                        img.src = Config.paths.messageIcons + msg.iconName;
                        img.alt = msg.iconName.split('.')[0];
                        img.className = 'message-icon';
                        p.appendChild(img);
                    }
                    const textSpan = document.createElement('span');
                    textSpan.textContent = msg.text;
                    p.appendChild(textSpan);
                    fragment.appendChild(p);
                });
                messageEl.appendChild(fragment);
            } else {
                messageEl.textContent = (scanResult.member_status === 'warning') ? (T.warning_default || '') : (T.greeting || 'Have a workout !')
            }

            if (scanResult.member_status === 'warning') {
                messageEl.classList.add('message-warning');
            }

            statsArea.classList.remove('hidden');
            const stats = scanResult.stats || {};
            this.elements.statCheckin.textContent = formatDateTime(stats.checkIn);
            this.elements.statTrainings.textContent = stats.trainingsThisMonth ?? '--';
            this.elements.statTotal.textContent = stats.trainingsTotal ?? '--';
            this.elements.statMeasure.textContent = stats.daysSinceLastMeasure ?? '--';
            this.elements.statSessions.textContent = stats.remainingSessions ?? '--';

            statusClass = scanResult.member_status === "allowed" ? 'status-ok' : 'status-warning';
            if (statusClass === 'status-warning') {
                messageEl.classList.add('message-warning');
            }

        } else if (scanResult.member_status === 'denied') {
            this.elements.welcomeMessage.textContent = T.denied || 'Access Denied...';
            this.elements.customMessage.textContent = scanResult.custom_message || (T.denied_detail || 'Contact reception.');

            const customMessagesDenied = scanResult.customMessage;
            if (Array.isArray(customMessagesDenied) && customMessagesDenied.length > 0 && customMessagesDenied[0].text) {
                messageEl.innerHTML = '';
                const fragment = document.createDocumentFragment();
                customMessagesDenied.forEach(msg => { // Iterate if multiple messages are possible for denied
                    const p = document.createElement('p');
                    p.className = 'member-message-item';
                    if (msg.iconName) {
                        const img = document.createElement('img');
                        img.src = Config.paths.messageIcons + msg.iconName;
                        img.alt = msg.iconName.split('.')[0];
                        img.className = 'message-icon';
                        p.appendChild(img);
                    }
                    const textSpan = document.createElement('span');
                    textSpan.textContent = msg.text;
                    p.appendChild(textSpan);
                    fragment.appendChild(p);
                });
                messageEl.appendChild(fragment);
            } else {
                messageEl.textContent = T.denied_detail || 'Contact reception.';
            }

            messageEl.classList.add('message-denied');
            statsArea.classList.add('hidden');
            statusClass = 'status-denied';
        } else {
            this.elements.welcomeMessage.textContent = T.denied || 'Error';
            this.elements.customMessage.textContent = T.unknown_detail || 'Unknown status received.';
            messageEl.classList.add('message-denied');
            statsArea.classList.add('hidden');
            statusClass = 'status-denied';
            console.warn('[UIManager.displayMemberInfo] Received unknown member status:', scanResult.member_status);
        }

        if (statusClass) {
            wrapper.classList.add(statusClass);
        }
        this.showScreen('member');
    },

    displayValidationError(fieldKey, message) {
        const errorEl = this.elements[fieldKey + 'Error'];
        const inputEl = this.elements[fieldKey + 'Input'] || this.elements[fieldKey + 'Select'];

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('message-error');
        } else {
            console.warn(`[UIManager.displayValidationError] Validation error element not found for key: ${fieldKey}Error`);
        }

        if (inputEl) {
            inputEl.classList.add('input-error')
        }
    },

    clearValidationError(fieldKey) {
        const errorEl = this.elements[fieldKey + 'Error'];
        const inputEl = this.elements[fieldKey + 'Input'] || this.elements[fieldKey + 'Select'];

        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('message-error');
        }

        if (inputEl) {
            inputEl.classList.remove('input-error');
        }
    },

    clearAllValidationError() {
        this.clearValidationError('settingCity');
        this.clearValidationError('settingCountry');
    },

    loadSettingsToPanel() {
        const lang = StateService.get(Config.localStorage.language);
        if (this.elements.settingLogoInput) this.elements.settingLogoInput.value = null;
        if (this.elements.settingLanguageSelect) this.elements.settingLanguageSelect.value = lang;
        if (this.elements.settingsStatusDiv) this.elements.settingsStatusDiv.textContent = '';

        const savedCity = StateService.get(Config.localStorage.weatherCity) || '';
        const savedCountry = StateService.get(Config.localStorage.weatherCountry) || '';
        if (this.elements.settingCityInput) this.elements.settingCityInput.value = savedCity;
        if (this.elements.settingCountryInput) this.elements.settingCountryInput.value = savedCountry;

        this.updatePasswordSetIndicator();
        this.clearAllValidationError();
        console.log(`[UIManager.loadSettingsToPanel] Settings panel loaded. Language set to: ${lang}`);
    },

    handleRemovePasswordClick() {
        const T = StateService.get('translations');
        console.log("[UIManager.handleRemovePasswordClick] Removing password.");
        StateService.set(Config.localStorage.passwordToggle, null);

        UIManager.updatePasswordSetIndicator();
        UIManager.displayPasswordSetStatus(T.password_removed || 'Lock password removed.', 'info');
    },

    displaySettingsStatus(message, isError = false) {
        if (this.elements.settingsStatusDiv) {
            this.elements.settingsStatusDiv.textContent = message;
            this.elements.settingsStatusDiv.classList.add(isError ? 'message-error' : 'message-success');
            setTimeout(() => {
                this.elements.settingsStatusDiv.textContent = '';
                this.elements.settingsStatusDiv.classList.remove('message-error', 'message-success')
            }, 4000);
        }
    },

    renderScanList(scanDataArray) {
        const listUI = this.elements.scanListUI;
        if (!listUI) return;

        listUI.innerHTML = '';

        if (!scanDataArray || scanDataArray.length === 0) {
            this.displayNoScansMessage(true);
            return;
        }
        this.displayNoScansMessage(false);

        const fragment = document.createDocumentFragment();
        const T = StateService.get('translations') || {};
        const listUnknownMember = T.list_unknown_member || 'Client inconnu';

        scanDataArray.forEach(scan => {
            const li = document.createElement('li');
            li.className = `scan-item status-${scan.member_status || 'denied'}`;

            const indicator = document.createElement('span');
            indicator.className = 'status-indicator';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'member-name';
            const memberName = scan.name ? scan.name.trim() : '';
            nameSpan.textContent = memberName || listUnknownMember;

            const messagesContainer = document.createElement('div');
            messagesContainer.className = 'scan-item-messages';
            const customMessages = scan.custom_message;

            if (Array.isArray(customMessages) && customMessages.length > 0) {
                customMessages.forEach(msg => {
                    const msgSpan = document.createElement('span');
                    msgSpan.className = 'scan-item-message-line';
                    if (msg.iconName) {
                        const img = document.createElement('img');
                        img.src = Config.paths.messageIcons + msg.iconName;
                        img.alt = msg.iconName.split('.')[0];
                        img.className = 'message-icon message-icon-small';
                        msgSpan.appendChild(img);
                    }
                    const textNode = document.createTextNode(msg.text);
                    msgSpan.appendChild(textNode);
                    messagesContainer.appendChild(msgSpan);
                });
            }

            const timeSpan = document.createElement('span');
            timeSpan.className = 'scan-time';
            timeSpan.textContent = formatDateTime(scan.stats.checkIn) || '--';

            li.appendChild(indicator);
            li.appendChild(nameSpan);
            li.appendChild(messagesContainer);
            li.appendChild(timeSpan);

            fragment.appendChild(li);
        });
        listUI.appendChild(fragment);
    },

    displayNoScansMessage(show) {
        if (this.elements.noScansMessage && this.elements.scanListUI) {
            this.elements.noScansMessage.classList.toggle('hidden', !show);
            this.elements.scanListUI.classList.toggle('hidden', show);
        }
    },

    updateAdsToggleVisuals(isEnabled) {
        const btn = this.elements.settingsAdsToggle;
        if (btn) {
            btn.classList.toggle('active', isEnabled);
            btn.setAttribute('aria-pressed', isEnabled);
        }
    },

    updateToggleVisuals(mode) {
        console.log(`[UIManager.updateToggleVisuals] Called with mode: ${mode}`);
        const btn = this.elements.modeToggleBtn;
        const idleLabel = this.elements.modeLabelIdle;
        const listLabel = this.elements.modeLabelList;
        if (btn) {
            const isListMode = mode === 'list';
            btn.setAttribute('aria-pressed', isListMode);
            btn.classList.toggle('active', isListMode);

            idleLabel.style.opacity = isListMode ? '0' : '1';
            listLabel.style.opacity = isListMode ? '1' : '0';

            console.log(`[UIManager.updateToggleVisuals] Button classList: ${btn.classList}`);
        } else {
            console.log(`[UIManager.updateToggleVisuals] Toggle button not found !`);
        }
    },
};