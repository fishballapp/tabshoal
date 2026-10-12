export const randomInt = (inclusiveLower: number, inclusiveUpper: number): number => {
  return Math.floor(Math.random() * (inclusiveUpper - inclusiveLower + 1)) + inclusiveLower;
};

// Group digits into thousands without `Intl`: Hermes ships ICU-less on some
// React Native builds, so this regex yields "1,940" identically on Android, iOS
// and web. For non-negative integers (counts); not locale-aware.
export const formatThousands = (n: number): string =>
  n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
