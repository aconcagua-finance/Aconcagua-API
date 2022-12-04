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
  countItems,
} from '../baseEndpoint';

const { CurrencyTypes } = require('../../types/currencyTypes');

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

const normalizeAndCompleteWithEmptySlots = (itemsGroups, groupBy, startDate) => {
  if (!itemsGroups) return itemsGroups;

  // groupBy por ahora fijo por mes

  const newGroupsList = [];

  // new startDate.getMonth();

  const currentDate = new Date(Date.now());
  const nowMonth = currentDate.getUTCMonth();
  const nowYear = currentDate.getUTCFullYear();

  let month = startDate.getUTCMonth();
  let year = startDate.getUTCFullYear();

  let lastDate = new Date(startDate.getFullYear(), month, 1);

  const lastDateSubString1 = lastDate.toISOString().substring(0, 7);

  const itemGroup1 = itemsGroups.find((ig) => {
    return ig.date.substring(0, 7) === lastDateSubString1;
  });

  newGroupsList.push({
    date: lastDate.toISOString(),
    items: itemGroup1 && itemGroup1.items ? itemGroup1.items : [],
  });

  // TODO MICHEL - Si consulto por 12 meses nunca entra a este while
  // while (month !== nowMonth && year !== nowYear) {
  while (lastDate <= currentDate) {
    lastDate = new Date(lastDate.setMonth(lastDate.getUTCMonth() + 1));
    month = lastDate.getUTCMonth();
    year = lastDate.getUTCFullYear();

    // para que no agarre el mes siguiente
    if (month <= nowMonth && year <= nowYear) {
      const lastDateSubString2 = lastDate.toISOString().substring(0, 7);

      const itemGroup2 = itemsGroups.find((ig) => {
        return ig.date.substring(0, 7) === lastDateSubString2;
      });

      newGroupsList.push({
        date: lastDate.toISOString(),
        items:
          itemGroup2 && itemGroup2.items
            ? itemGroup2.items.map((item) => {
                return item.id;
              })
            : [],
      });
    }
  }

  return newGroupsList;
};

exports.findByCompany = async function (req, res) {
  try {
    const { limit, offset, filters, state, groupBy } = req.query;

    const { companyId } = req.params;

    console.log('Insights find with args: ' + JSON.stringify([filters, companyId]));

    // filters[createdAt][$gte]: 2022-01-22T18:46:13.487Z
    if (!filters || !filters.createdAt || !filters.createdAt.$gte || !companyId) {
      throw new CustomError.TechnicalError('ERROR_MISSING_ARGS', null, 'missing args', null);
    }

    const indexedFilters = ['createdAt', 'companyId', 'state'];
    filters['companyId'] = { $equal: companyId };

    // groupBy = month / week / day...
    const vaultsItems = await fetchItems({
      collectionName: Collections.VAULTS,
      limit: 10000,
      filters,
      indexedFilters,
    });

    console.log('Insights vaults len:' + vaultsItems.length);
    // return res.send(leadItems);
    const clientsItems = await fetchItems({
      collectionName: Collections.COMPANY_CLIENTS,

      filters,
      indexedFilters,
    });

    const vaultsGroupArrays = groupByMonth(
      vaultsItems.map((item) => {
        return { ...item, createdAtString: item.createdAt.toISOString() };
      }),
      'createdAtString'
    );

    console.log('Insights vaults vaultsGroupArrays:', vaultsGroupArrays);

    const clientesGroupArrays = groupByMonth(
      clientsItems.map((item) => {
        return { ...item, createdAtString: item.createdAt.toISOString() };
      }),
      'createdAtString'
    );

    let depositsAmount = 0;
    let creditsAmount = 0;

    vaultsItems.forEach((item) => {
      creditsAmount += item.amount;
      if (!item || !item.balances) return;
      const arsBalance = item.balances.find((balance) => {
        return balance.currency === CurrencyTypes.ARS;
      });

      if (!arsBalance) return;

      depositsAmount += arsBalance.balance;
    });

    const result = {
      vaults: normalizeAndCompleteWithEmptySlots(
        vaultsGroupArrays,
        groupBy,
        new Date(filters.createdAt.$gte)
      ),
      clients: normalizeAndCompleteWithEmptySlots(
        clientesGroupArrays,
        groupBy,
        new Date(filters.createdAt.$gte)
      ),
      depositsAmount,
      creditsAmount,
    };

    console.log('OK - all - fetch (' + 'INSIGHTS' + '): ');

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
