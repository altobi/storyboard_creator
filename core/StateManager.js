/**
 * State Manager
 * Centralized state management for the application
 * Provides reactive state updates and subscriptions
 */
class StateManager {
    constructor(initialState = {}) {
        this.state = { ...initialState };
        this.subscribers = [];
        this.history = []; // For potential undo/redo
        this.maxHistorySize = 50;
    }

    /**
     * Get current state
     * @param {string} key - Optional key to get specific state property
     * @returns {*} Current state or specific property
     */
    getState(key) {
        if (key) {
            return this.state[key];
        }
        return { ...this.state }; // Return copy to prevent direct mutation
    }

    /**
     * Set state
     * @param {Object|Function} updates - State updates object or function that returns updates
     */
    setState(updates) {
        const prevState = { ...this.state };
        
        if (typeof updates === 'function') {
            this.state = { ...this.state, ...updates(this.state) };
        } else {
            this.state = { ...this.state, ...updates };
        }

        // Save to history
        this.addToHistory(prevState);

        // Notify subscribers
        this.notifySubscribers(this.state, prevState);
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback - Callback function(state, prevState)
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        this.subscribers.push(callback);
        
        // Return unsubscribe function
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }

    /**
     * Subscribe to specific state key changes
     * @param {string} key - State key to watch
     * @param {Function} callback - Callback function(newValue, oldValue)
     * @returns {Function} Unsubscribe function
     */
    subscribeTo(key, callback) {
        const wrapper = (state, prevState) => {
            if (state[key] !== prevState[key]) {
                callback(state[key], prevState[key]);
            }
        };
        return this.subscribe(wrapper);
    }

    /**
     * Notify all subscribers
     * @private
     */
    notifySubscribers(state, prevState) {
        this.subscribers.forEach(callback => {
            try {
                callback(state, prevState);
            } catch (error) {
                console.error('Error in state subscriber:', error);
            }
        });
    }

    /**
     * Add state to history
     * @private
     */
    addToHistory(state) {
        this.history.push(JSON.parse(JSON.stringify(state))); // Deep clone
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }

    /**
     * Reset state to initial state
     */
    reset() {
        const prevState = { ...this.state };
        this.state = { ...this.initialState };
        this.notifySubscribers(this.state, prevState);
    }
}

export default StateManager;

