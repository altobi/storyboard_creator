/**
 * DOM Utilities
 * Helper functions for DOM manipulation
 */

/**
 * Safe getElementById with null check
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} Element or null if not found
 */
export function getElementById(id) {
    return document.getElementById(id);
}

/**
 * Safe querySelector with null check
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement|null} Element or null if not found
 */
export function querySelector(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Safe querySelectorAll
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {NodeList} NodeList of elements
 */
export function querySelectorAll(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Create an element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attributes - Attributes object
 * @param {Array|string} children - Child elements or text
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);
    
    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'textContent') {
            element.textContent = value;
        } else if (key === 'innerHTML') {
            element.innerHTML = value;
        } else if (key.startsWith('data-')) {
            element.setAttribute(key, value);
        } else {
            element[key] = value;
        }
    });
    
    // Add children
    if (typeof children === 'string') {
        element.textContent = children;
    } else if (Array.isArray(children)) {
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });
    }
    
    return element;
}

/**
 * Show a custom alert dialog
 * @param {string} message - Alert message
 * @param {string} title - Alert title (optional)
 * @returns {Promise} Promise that resolves when alert is closed
 */
export function customAlert(message, title = 'Alert') {
    return new Promise((resolve) => {
        // Remove existing alert if any
        const existingAlert = document.getElementById('customAlert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // Create alert overlay
        const overlay = createElement('div', {
            id: 'customAlert',
            className: 'custom-alert-overlay'
        });

        // Create alert box
        const alertBox = createElement('div', {
            className: 'custom-alert-box'
        });

        // Create title
        if (title) {
            const titleEl = createElement('h3', {
                className: 'custom-alert-title',
                textContent: title
            });
            alertBox.appendChild(titleEl);
        }

        // Create message
        const messageEl = createElement('p', {
            className: 'custom-alert-message',
            textContent: message
        });
        alertBox.appendChild(messageEl);

        // Create OK button
        const okButton = createElement('button', {
            className: 'custom-alert-button',
            textContent: 'OK'
        });
        okButton.addEventListener('click', () => {
            overlay.remove();
            resolve();
        });
        alertBox.appendChild(okButton);

        overlay.appendChild(alertBox);
        document.body.appendChild(overlay);

        // Focus button for keyboard navigation
        okButton.focus();
    });
}

