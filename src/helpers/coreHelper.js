const _ = require('lodash');

exports.areEqualStringLists = function (list1, list2) {
  let areEqual = true;
  list1.forEach((element) => {
    if (
      !list2.find((l2) => {
        return l2 === element;
      })
    ) {
      areEqual = false;
      return false;
    }
  });

  return areEqual;
};

const DOCUMENT_COMPARE_EXCLUDE_KEYS = ['createdAt', 'updatedAt', 'createdBy', 'updatedBy'];

exports.DOCUMENT_COMPARE_EXCLUDE_KEYS = DOCUMENT_COMPARE_EXCLUDE_KEYS;

const areDeepEqualArrays = function (array1, array2) {
  if (!array1 && !array2) return true;
  if (!array1 && array2) return false;
  if (array1 && !array2) return false;

  // TODO - Tiene sentido tmb recibir un array de keys a exluir ?
  return !_.isEqual(array1, array2);
};

exports.areDeepEqualArrays = areDeepEqualArrays;

const areDeepEqual = function (element1, element2, exludeKeys) {
  if (!element1 && !element2) return true;
  if (!element1 && element2) return false;
  if (element1 && !element2) return false;

  if (Array.isArray(element1) && Array.isArray(element2)) {
    return areDeepEqualArrays(element1, element2);
  }

  let element1Keys = Object.keys(element1);
  let element2Keys = Object.keys(element2);

  if (exludeKeys) {
    element1Keys = element1Keys.filter((key) => {
      return !exludeKeys.includes(key);
    });

    element2Keys = element2Keys.filter((key) => {
      return !exludeKeys.includes(key);
    });
  }

  if (!_.isEqual(element1Keys, element2Keys)) return false;

  let areEqual = true;
  element1Keys.forEach((key) => {
    if (!_.isEqual(element1[key], element2[key])) areEqual = false;
  });

  return areEqual;
};

exports.areDeepEqual = areDeepEqual;

const areDeepEqualDocuments = function (document1, document2) {
  return areDeepEqual(document1, document2, DOCUMENT_COMPARE_EXCLUDE_KEYS);
};

exports.areDeepEqualDocuments = areDeepEqualDocuments;

exports.toDateObject = function (dirtyDate) {
  if (!dirtyDate) return null;

  if (dirtyDate instanceof Date) return dirtyDate;

  if (dirtyDate._seconds) return new Date(dirtyDate._seconds * 1000);
  else if (typeof dirtyDate === 'string') return new Date(dirtyDate);

  // .toLocaleDateString(
  //     'en-ES'
  //   );
  // const createdAtString = new Date(userTask.createdAt._seconds * 1000).toLocaleDateString(
  //   'en-ES'
  // );
};

exports.enumValuesToArray = (enumType) => {
  return Object.keys(enumType).filter((item) => {
    return isNaN(Number(item));
  });
};
