import { Config } from './config.js';

let _newPasswordAttempt = null;

function obfuscate(plainText) {
    if (plainText === null || plainText === undefined) return null;
    try {
        return btoa(plainText);
    } catch (e) {
        console.error('Error while obfuscating password: ', e);
        return plainText;
    }
}

export const PasswordService = {
    isPasswordSet() {
        const storedPassword = localStorage.getItem(Config.localStorage.passwordToggle);
        return (storedPassword !== null) && (storedPassword !== '');
    },

    verifyPassword(enteredPassword) {
        if (!enteredPassword) return false;
        const currentObfuscatedPwd = localStorage.getItem(Config.localStorage.passwordToggle);
        if (!currentObfuscatedPwd) return false;

        return obfuscate(enteredPassword) === currentObfuscatedPwd;
    },

    setPassword(password) {
        if (password && typeof (password) === 'string') {
            const obfuscated = obfuscate(password);
            if (obfuscated) {
                localStorage.setItem(Config.localStorage.passwordToggle, obfuscated)
                console.log('[PasswordService] Lock password set/updated');
                return true;
            }
        } else if (password === null || password === '') {
            this.removePassword();
            return true;
        }
        console.warn('[PasswordService] failed to set password. Incorrect input');
        return false;
    },

    removePassword() {
        localStorage.removeItem(Config.localStorage.passwordToggle);
        console.log('[PasswordService] Toggle password removed.')
    },

    storeNewPasswordAttempt(password) {
        _newPasswordAttempt = password;
    },

    getNewPasswordAttempt() {
        return _newPasswordAttempt;
    },

    clearNewPasswordAttempt() {
        _newPasswordAttempt = null
    }
}