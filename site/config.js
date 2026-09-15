window.ONE_TAP_API = window.ONE_TAP_API || (function () {
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    return 'http://127.0.0.1:3000';
  }
  return window.ONE_TAP_API_OVERRIDE || '';
})();
