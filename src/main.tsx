import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import VpnFloatingMonitor from './plugins/vpn-monitor/VpnFloatingMonitor';

const isMonitorWindow = new URLSearchParams(window.location.search).has('monitor');
if (isMonitorWindow) {
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  document.body.style.margin = '0';
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isMonitorWindow ? <VpnFloatingMonitor /> : <App />}</React.StrictMode>,
);
