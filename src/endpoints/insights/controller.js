/* eslint-disable no-unused-vars */
import admin from 'firebase-admin';

import Fuse from 'fuse.js';

import { creationStruct, updateStruct } from '../../vs-core-firebase/audit';
import { ErrorHelper } from '../../vs-core-firebase';
import { LoggerHelper } from '../../vs-core-firebase';
import { Types } from '../../vs-core';
import { Auth } from '../../vs-core-firebase';

import { CustomError } from '../../vs-core';

import { Collections } from '../../types/collectionsTypes';

import schemas from './schemas';

import {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,
  fetchItems,
} from '../baseEndpoint';

const groupByMonth = (items, propName) => {
  // this gives an object with dates as keys
  const groups = items.reduce((gr, item) => {
    // const date = item[propName].split('T')[0];
    const date = item[propName].substring(0, 7);
    if (!gr[date]) {
      gr[date] = [];
    }

    gr[date].push(item);
    return gr;
  }, {});

  // Edit: to add it in the array format instead
  const groupArrays = Object.keys(groups).map((date) => {
    return {
      date: date + '-01T00:00:00.000Z',
      items: groups[date],
    };
  });

  return groupArrays;
};

const completeWithEmptySlots = (itemsGroups, groupBy, startDate) => {
  if (!itemsGroups) return itemsGroups;

  // groupBy por ahora fijo por mes

  const newGroupsList = [];

  // new startDate.getMonth();

  const currentDate = new Date(Date.now());
  const nowMonth = currentDate.getUTCMonth();
  let month = startDate.getUTCMonth();
  const startDateAux = { ...startDate };

  let lastDate = new Date(startDate.getFullYear(), month, 1);

  const lastDateSubString1 = lastDate.toISOString().substring(0, 7);

  const itemGroup1 = itemsGroups.find((ig) => {
    return ig.date.substring(0, 7) === lastDateSubString1;
  });

  newGroupsList.push({
    date: lastDate.toISOString(),
    items: itemGroup1 && itemGroup1.items ? itemGroup1.items : [],
  });

  while (month !== nowMonth) {
    lastDate = new Date(lastDate.setMonth(lastDate.getUTCMonth() + 1));
    month = lastDate.getUTCMonth();

    const lastDateSubString2 = lastDate.toISOString().substring(0, 7);

    const itemGroup2 = itemsGroups.find((ig) => {
      return ig.date.substring(0, 7) === lastDateSubString2;
    });

    newGroupsList.push({
      date: lastDate.toISOString(),
      items: itemGroup2 && itemGroup2.items ? itemGroup2.items : [],
    });
  }

  return newGroupsList;
};

const _find = async function (req, res) {
  try {
    const { limit, offset, filters, state, groupBy } = req.query;

    // filters[createdAt][$gte]: 2022-01-22T18:46:13.487Z
    if (!filters || !filters.createdAt || !filters.createdAt.$gte) {
      throw new CustomError.TechnicalError(
        'ERROR_MISSING_ARGS',
        null,
        'createdAt filter empty',
        null
      );
    }

    // groupBy = month / week / day...
    const leadItems = await fetchItems({
      collectionName: Collections.LEADS,
      limit: 10000,
      filters,
      indexedFilters: ['createdAt'],
    });

    // return res.send(leadItems);
    const usersItems = await fetchItems({
      collectionName: Collections.USERS,

      filters,
      indexedFilters: ['createdAt'],
    });

    const userTouchpointsItems = await fetchItems({
      collectionName: Collections.USER_TOUCHPOINTS,

      filters,
      indexedFilters: ['createdAt'],
    });

    const leadsGroupArrays = groupByMonth(
      leadItems.map((item) => {
        return { ...item, createdAtString: item.createdAt.toISOString() };
      }),
      'createdAtString'
    );
    const usersGroupArrays = groupByMonth(
      usersItems.map((item) => {
        return { ...item, createdAtString: item.createdAt.toISOString() };
      }),
      'createdAtString'
    );
    const touchpointsGroupArrays = groupByMonth(
      userTouchpointsItems.map((item) => {
        return { ...item, createdAtString: item.createdAt.toISOString() };
      }),
      'createdAtString'
    );

    console.log('OK - all - fetch (' + 'INSIGHTS' + '): ');

    const result = {
      leads: completeWithEmptySlots(leadsGroupArrays, groupBy, new Date(filters.createdAt.$gte)),
      users: completeWithEmptySlots(usersGroupArrays, groupBy, new Date(filters.createdAt.$gte)),
      userTouchpoints: completeWithEmptySlots(
        touchpointsGroupArrays,
        groupBy,
        new Date(filters.createdAt.$gte)
      ),
    };

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

const _get = async function (req, res) {
  return res.send(null);
};

export { _find as find };
export { _get as get };
