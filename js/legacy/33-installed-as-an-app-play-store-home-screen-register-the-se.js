
(() => {
  // Installed as an app (Play Store / home screen): register the service
  // worker, and on a phone's first launch turn the touch controls on, since
  // nobody plays the app with a mouse. After that the settings switch rules.
  try {
    "serviceWorker" in navigator && /^https?:/.test(location.protocol) && navigator.serviceWorker.register("/sw.js").catch(() => {});
  } catch (e) {}
  const isApp = () => {
    try {
      return (
        matchMedia("(display-mode: fullscreen)").matches ||
        matchMedia("(display-mode: standalone)").matches ||
        /^android-app:\/\//.test(document.referrer || "") ||
        /[?&]source=app\b/.test(location.search)
      );
    } catch (e) {
      return !1;
    }
  };
  window.IS_APP = isApp();
  try {
    const touchy = (navigator.maxTouchPoints || 0) > 0 && matchMedia("(pointer: coarse)").matches;
    if (window.IS_APP && touchy && !localStorage.getItem("lgp_app_touch")) {
      localStorage.setItem("lgp_app_touch", "1");
      IS_TOUCH || setTouchMode(!0);
    }
  } catch (e) {}
})();
