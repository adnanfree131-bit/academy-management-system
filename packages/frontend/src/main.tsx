import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global Input Caret Fix: When selecting/focusing an input with existing text,
// prevent awkward caret placement at index 0 (|text) and position at end of text.
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      const type = target instanceof HTMLInputElement ? target.type.toLowerCase() : 'textarea';
      const textTypes = ['text', 'search', 'tel', 'url', 'password', 'email', 'textarea'];
      if (textTypes.includes(type) && typeof target.value === 'string') {
        const len = target.value.length;
        if (len > 0) {
          setTimeout(() => {
            try {
              if (target.selectionStart === 0 && target.selectionEnd === 0) {
                target.setSelectionRange(len, len);
              }
            } catch {
              // Ignore input types that do not support selection range
            }
          }, 0);
        }
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
