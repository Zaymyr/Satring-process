export const generateRandomHexColor = (): string => {
  const randomChannel = () => Math.floor(128 + Math.random() * 127);
  const toHex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();

  const r = randomChannel();
  const g = randomChannel();
  const b = randomChannel();

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
