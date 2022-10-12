import { format } from 'date-fns';
import locale from 'date-fns/locale/es';

import { Logger } from '../logger';

/**
 * Format's a currecy number.
 * Example: 2.54013 => "2,54"
 */
export const currency = (amount, options) => {
  if (amount === undefined || amount === '' || amount === null) return '-';

  let decimalCount = 2;
  let decimal = ',';
  let thousands = '.';
  let badge = null;

  if (options && options.decimalCount) decimalCount = options.decimalCount;
  if (options && options.decimal) decimal = options.decimal;
  if (options && options.thousands) thousands = options.thousands;
  if (options && options.badge) badge = options.badge;

  try {
    decimalCount = Math.abs(decimalCount);
    decimalCount = isNaN(decimalCount) ? 2 : decimalCount;

    const negativeSign = amount < 0 ? '-' : '';

    const i = parseInt((amount = Math.abs(Number(amount) || 0).toFixed(decimalCount))).toString();
    const j = i.length > 3 ? i.length % 3 : 0;

    const res =
      negativeSign +
      (j ? i.substr(0, j) + thousands : '') +
      i.substr(j).replace(/(\d{3})(?=\d)/g, `$1${thousands}`) +
      (decimalCount ?
        decimal +
          Math.abs(amount - i)
            .toFixed(decimalCount)
            .slice(2) :
        '');

    if (badge) return `${badge} ${res}`;

    return res;
  } catch (e) {
    Logger.error(e);
    return '-';
  }
};

/**
 * Capitalize a string
 * Example: "texto" => "Texto"
 */
export const capitalize = (st) => st && st.length && st.charAt(0).toUpperCase() + st.slice(1);

/**
 * creates a date formatter with a date-fns mask
 * Example: "dd/MM/yyyy" => (date) => spanishDateFormat
 */
export const dateFormatter = (mask) => (date) => {
  try {
    return format(date, mask, { locale });
  } catch (e) {
    return 'Fecha no disponible';
  }
};

/**
 * formats a day and month
 * Example: "Date("2019-3-1")" => "1 de marzo"
 */
export const dayMonthDate = dateFormatter('dd \'de\' MMMM');

/**
 * formats a day and month
 * Example: "Date("2019-3-1")" => "01/03/2019"
 */
export const spanishDate = dateFormatter('dd/MM/yyyy');

/**
 * formats a date in a ISO format
 * Example: "Date("2019-3-1")" => "2019-03-01"
 */
export const urlDate = dateFormatter('yyyy-MM-dd');

/**
 * formats a date into a readable month
 * Example: "Date("2019-3-1")" => "marzo 2019"
 */
export const monthDate = dateFormatter('MMMM yyyy');
