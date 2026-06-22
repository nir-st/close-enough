// Google Cast SDK globals. The SDKs are loaded at runtime from gstatic, so we
// only declare loose types here to satisfy TypeScript — the real shapes come
// from the Cast Sender / CAF Receiver frameworks.
declare const cast: any;
declare const chrome: any;

interface Window {
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
  cast?: any;
  chrome?: any;
}
