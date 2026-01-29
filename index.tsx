// Fix: Added DOM library reference to resolve 'document' and other global web types.
/// <reference lib="dom" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Fix: Accessing document requires DOM library reference to satisfy TypeScript environment
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);