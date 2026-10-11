"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = once;
function once(emitter, name) {
  var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
    signal = _ref.signal;
  return new Promise(function (resolve, reject) {
    function cleanup() {
      signal === null || signal === void 0 ? void 0 : signal.removeEventListener('abort', cleanup);
      emitter.removeListener(name, onEvent);
      emitter.removeListener('error', onError);
    }
    function onEvent() {
      cleanup();
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      resolve(args);
    }
    function onError(err) {
      cleanup();
      reject(err);
    }
    signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', cleanup);
    emitter.on(name, onEvent);
    emitter.on('error', onError);
  });
}
