// Helper function to get formatted timestamp
export function getTimestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `[${hours}:${minutes}:${seconds}.${ms}]`;
}

// Wrap console.log to add timestamps
const originalLog = console.log;
console.log = function(...args: any[]) {
  originalLog(getTimestamp(), ...args);
};

const originalError = console.error;
console.error = function(...args: any[]) {
  originalError(getTimestamp(), ...args);
};

const originalWarn = console.warn;
console.warn = function(...args: any[]) {
  originalWarn(getTimestamp(), ...args);
};
