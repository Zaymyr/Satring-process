export const generateRandomHexColor = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const toHex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();

  return `#${toHex(bytes[0])}${toHex(bytes[1])}${toHex(bytes[2])}`;
};
