import { parseISO } from 'date-fns';

const shiftUTCToLocal = (date = new Date()) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
};

const dateParser =
  (parser) =>
  (date, utc = false) => {
    try {
      const dateParse = parser(date);
      if (!Object.is(dateParse.getTime(), NaN) && dateParse.getTime() !== 0) {
        return utc ? shiftUTCToLocal(dateParse) : dateParse;
      }
    } catch (e) {
      throw new Error('Invalid date');
    }
    throw new Error('Invalid date');
  };

export const parseSpanishDate = dateParser(
  (date) =>
    new Date(
      Date.UTC(
        Number(date.split('/')[2]),
        Number(date.split('/')[1]) - 1,
        Number(date.split('/')[0])
      )
    )
);

export const date = dateParser((dt) => parseISO(dt));
