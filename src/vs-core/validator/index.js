/* eslint-disable no-new-wrappers */
const DOCUMENT_LENGTH = 10;
/*
 * Composes multiple validators into one
 */
export const composeValidators =
  (...validators) =>
  (value) =>
    validators.reduce((error, validator) => error || validator(value), undefined);

export const required = (value) => (value ? undefined : true);

export const onlyNumbers = composeValidators(required, (value) =>
  Object.is(new Number(value).valueOf(), NaN) ? true : undefined
);

export const positiveNumber = composeValidators(onlyNumbers, (value) =>
  new Number(value) > 0 ? undefined : true
);

export const email = (value) =>
  value &&
  value.search(
    /^(([A-Za-z0-9_-])+(\.))*([A-Za-z0-9_-])+@([A-Za-z0-9_-]){2,}((\.)([A-Za-z0-9_-]){2,})*\.([A-Za-z]{2,4})$/
  ) === 0 ?
    undefined :
    true;

export const minLength = (length) =>
  composeValidators(required, (value) => (value.length >= length ? undefined : true));

export const maxLength = (length) =>
  composeValidators(required, (value) => (value.length <= length ? undefined : true));

export const exactLength = (length) =>
  composeValidators(required, (value) => (value.length === length ? undefined : true));

export const minDigits = (digits) => (value) =>
  value && String(value).length >= digits ? undefined : true;

export const onlyWords = composeValidators(required, (value) =>
  /^[\sa-zA-Z ñ Ñ]+$/.test(value) ? undefined : true
);

export const validateDocument = composeValidators(onlyNumbers, maxLength(DOCUMENT_LENGTH));

/*
 * Add a specific message to failed validations
 */
export const withMessage = (validator, message) => (value) =>
  validator(value) ? message : undefined;
