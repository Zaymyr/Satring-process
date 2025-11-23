import type { Locale } from './dictionaries';

type DateInput = string | number | Date | null | undefined;

export function createDateTimeFormatter(
  locale: Locale,
  options: Intl.DateTimeFormatOptions
): (value: DateInput) => string | null {
  const formatter = new Intl.DateTimeFormat(locale, options);

  return (value: DateInput) => {
    if (!value) {
      return null;
    }

    try {
      const date = value instanceof Date ? value : new Date(value);

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return formatter.format(date);
    } catch (error) {
      console.error('Unable to format date', error);
      return null;
    }
  };
}
