import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import App from './app/App.jsx';
import { store } from './store/index.js';
import { fetchMe } from './features/auth/authSlice.js';
import './styles/global.css';
import './styles/consultation-room.css';

store.dispatch(fetchMe());

// Motion is opt-in per visitor: nothing is hidden or animated when reduced motion is requested.
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('motion');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
