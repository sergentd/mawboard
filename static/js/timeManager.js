export const TimerManager = {
    timers: {
        memberScreen: null,
        scanPoll: null,
        quote: null,
        weather: null,
        dateTime: null,
        passwordTimeout: null,
        adInterval: null,
        adListRefresh: null
    },
    clear(timerName) {
        const timerId = this.timers[timerName];
        console.log(`[TimerManager.clear] Clearing timer: ${timerName} (ID: ${timerId})`); // Log ID
        if (this.timers[timerName]) {
            clearTimeout(this.timers[timerName]);
            this.timers[timerName] = null;
        } else {
            console.log(`[TimerManager.clear] Timer ${timerName} already null.`);
       }
    },
    clearAll() {
        for (const key in this.timers) {
            this.clear(key);
        }
        console.log("All timers cleared.");
    },
    start(timerName, callback, interval) {
        this.clear(timerName); // Clear previous timer if any
        let newTimerId = null;
        const intervals = ['scanPoll', 'quote', 'weather', 'dateTime', 'adInterval'];
        newTimerId = intervals.includes(timerName) ? setInterval(callback, interval) :  setTimeout(callback, interval);
        this.timers[timerName] = newTimerId;
        console.log(`[TimerManager.start] Started timer: ${timerName} with ID: ${newTimerId}`);
    }
};