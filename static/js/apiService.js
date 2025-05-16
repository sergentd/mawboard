import { Config } from "./config.js";

export const APIService = {
    async _fetch(url, options = {}) {
        let response;
        try {
            response = await fetch(url, options);
            if (!response.ok) {

                let errorData = { message: `HTTP error! Status: ${response.status}` };
                try {
                    const errorJson = await response.json();
                    if (errorJson.error && errorJson.error.message) {
                        errorData.message = errorJson.error.message;
                    } else if (errorJson.message) {
                        errorData.message = errorJson.message;
                    }
                    errorData.details = errorJson;

                } catch (e) {
                    if (response.statusText) {
                        errorData.message = `${errorData.message} - ${response.statusText}`;
                    }
                    console.warn(`[APIService._fetch] Could not parse JSON error response for ${url}. Status: ${response.status}`);
                }

                const error = new Error(errorData.message);
                error.status = response.status;
                error.response = response;
                error.errorData = errorData;
                throw error;
            }
            return response;
        } catch (error) {
            console.error(`Fetch failed for ${url}:`, error.message, error.errorData || error);
            const outputError = new Error(error.errorData?.message || error.message || 'Network or API request failed');
            outputError.isApiServiceError = true;
            outputError.status = error.status || 0;
            outputError.details = error.errorData?.details || null;
            throw outputError;
        }
    },

    async fetchJson(url, options = {}) {
        const response = await this._fetch(url, {
            headers: { 'Accept': 'application/json', ...options.headers },
            ...options
        });
        try {
            return await response.json();
        } catch (e) {
            console.error(`[APIService.fetchJson] Failed to parse successful JSON response from ${url}:`, e);
            const parseError = new Error('Invalid JSON response from server.');
            parseError.isApiServiceError = true;
            parseError.status = response.status;
            throw parseError;
        }

    },

    async fetchScanList() {
        const url = Config.api.list;
        try {
            const data = await this.fetchJson(url);
            if (data.status === 'error') {
                return { success: false, error: { message: data.error?.message || 'Failed to load scan list' } };
            }
            return { success: true, data: data.data || [] };
        } catch (e) {
            return { success: false, error: { message: e.message, details: e.details } };
        }
    },

    async fetchWeather(lang, city, country) {
        const url = `${Config.api.weather}?lang=${encodeURIComponent(lang)}&city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
        console.log("[apiService.fetchWeather] Fetching weather for ", city, country, lang);
        try {
            const data = await this.fetchJson(url);

            if (data === 'error') {
                return { success: false, error: { message: data.error?.message || 'Weather API error' } };
            }
            return { success: true, data: data.data || data };
        } catch (e) {
            return { success: false, error: { message: e.message, details: e.details } };
        }
    },

    async fetchActiveAds() {
        const url = Config.api.ads;
        console.log('[apiService.fetchActiveAds] Fetching active ads.')
        try {
            const data = await this.fetchJson(url, { cache: 'no-cache' });

            if (data.status === 'error') {
                return { success: false, error: { message: data.error.message, details: data.error.details } }
            }
            return { success: true, data: data.data || [] }
        } catch (e) {
            return { success: false, error: { message: e.message, details: e.details } };
        }
    },

    async pollForScan() {
        const url = Config.api.scan;
        try {
            const data = await this.fetchJson(url, { method: 'GET' });
            return { success: true, data: data };
        } catch (e) {
            return { success: false, error: { message: e.message, details: e.details } };
        }
    }
};