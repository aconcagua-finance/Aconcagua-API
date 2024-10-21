/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');

const schemas = require('./schemas');

// eslint-disable-next-line camelcase
const { invoke_get_api } = require('../../helpers/httpInvoker');

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,

  sanitizeData,
  createFirestoreDocument,

  fetchItemsByIds,
  filterItems,
  fetchItems,
} = require('../baseEndpoint');

const { API_VAULT_ADMIN } = require('../../config/appConfig');

const COLLECTION_NAME = Collections.COMPANIES;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
};

const getGrantedIds = async ({ enterpriseRols, userId }) => {
  let ids = [];
  if (enterpriseRols && enterpriseRols.length) {
    ids = enterpriseRols.map((entRol) => {
      return entRol.companyId;
    });
  } else {
    const companyClientsRelationships = await fetchItems({
      collectionName: Collections.COMPANY_CLIENTS,
      limit: 1000,
      filterState: Types.StateTypes.STATE_ACTIVE,
      filters: { userId: { $equal: userId } },
    });

    if (companyClientsRelationships && companyClientsRelationships.length) {
      companyClientsRelationships.forEach((element) => {
        if (!ids.includes(element.companyId)) ids.push(element.companyId);
      });
    }
  }

  return ids;
};

exports.findGranted = async function (req, res) {
  try {
    const { userId, enterpriseRols } = res.locals;

    const collectionName = COLLECTION_NAME;

    const ids = await getGrantedIds({ enterpriseRols, userId });

    console.log(
      'enterpriseRols: ' + JSON.stringify(enterpriseRols) + '. ids: ' + JSON.stringify(ids)
    );
    let items = [];

    if (ids.length !== 0) {
      items = await fetchItemsByIds({ collectionName, ids });

      console.log('OK - all - fetch (' + collectionName + '): ' + items.length);
    }

    // / movies?filters[movies]=USA&fields[]=id&fields[]=name
    let { limit, offset, filters, state } = req.query;

    if (limit) limit = parseInt(limit);

    const filteredItems = filterItems({ items, limit, offset, filters });

    if (filteredItems.items) {
      console.log('OK - all - filter (' + collectionName + '): ' + filteredItems.items.length);
    }

    return res.send(filteredItems);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.getGranted = async function (req, res) {
  try {
    const { userId, enterpriseRols } = res.locals;

    const collectionName = COLLECTION_NAME;

    const { id } = req.params;

    const ids = await getGrantedIds({ enterpriseRols, userId });

    console.log(
      'enterpriseRols: ' +
        JSON.stringify(enterpriseRols) +
        '. ids: ' +
        JSON.stringify(ids) +
        '. param.id: ' +
        id
    );

    if (!ids.includes(id)) {
      throw new CustomError.TechnicalError(
        'ERROR_NOT_ALLOWED',
        null,
        'se esta consultando por un id que no está habilitado',
        null
      );
    }

    const item = await fetchSingleItem({ collectionName, id });
    return res.send(item);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  await get(req, res, COLLECTION_NAME);
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

exports.create = async function (req, res) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;
    const body = req.body;
    console.log('Create args (' + COLLECTION_NAME + '):', body);

    const endpoint = `${API_VAULT_ADMIN}/${body.safeLiq1}`;
    const apiResponse = await invoke_get_api({ endpoint });

    if (!apiResponse) {
      throw new CustomError.TechnicalError(
        'ERROR_API_VAULT_ADMIN_INVALID_RESPONSE',
        null,
        'Respuesta inválida del servicio de creación de VaultAdmin',
        null
      );
    }

    // Verificar si hay error en la red Polygon
    // Verificar si hay error en la red Polygon
    if (
      !apiResponse.data || // Verifica que el objeto `data` esté presente
      !apiResponse.data.polygon || // Verifica que la respuesta de Polygon esté presente dentro de `data`
      !apiResponse.data.polygon.proxyAdminAddress // Verifica si 'proxyAdminAddress' está presente en la respuesta de Polygon
    ) {
      const errorMessage = 'Error desconocido en la creación de ProxyAdmin en Polygon';

      throw new CustomError.TechnicalError(
        'ERROR_API_VAULT_ADMIN_INVALID_RESPONSE_POLYGON',
        null,
        errorMessage,
        null
      );
    }

    // Verificar si hay error en la red Rootstock (RSK)
    if (
      !apiResponse.data || // Verifica que el objeto `data` esté presente
      !apiResponse.data.rootstock || // Verifica que la respuesta de Rootstock esté presente dentro de `data`
      !apiResponse.data.rootstock.proxyAdminAddress // Verifica si 'proxyAdminAddress' está presente en la respuesta de Rootstock
    ) {
      const errorMessage = 'Error desconocido en la creación de ProxyAdmin en Rootstock';

      throw new CustomError.TechnicalError(
        'ERROR_API_VAULT_ADMIN_INVALID_RESPONSE_RSK',
        null,
        errorMessage,
        null
      );
    }

    // Si llegamos aquí, ambas redes (Polygon y Rootstock) fueron exitosas
    console.log('ProxyAdmin creado con éxito en Polygon y Rootstock.');

    // Guardar datos de Polygon y Rootstock en Firestore
    body.vaultAdminAddressPolygon = apiResponse.data.polygon.proxyAdminAddress;
    body.vaultAdminOwnerPolygon = apiResponse.data.polygon.owner;
    body.vaultAdminDeploymentPolygon = apiResponse.data.polygon.contractDeployment;

    body.vaultAdminAddressRootstock = apiResponse.data.rootstock.proxyAdminAddress;
    body.vaultAdminOwnerRootstock = apiResponse.data.rootstock.owner;
    body.vaultAdminDeploymentRootstock = apiResponse.data.rootstock.contractDeployment;

    const itemData = await sanitizeData({ data: body, validationSchema: schemas.create });
    const createArgs = { collectionName: COLLECTION_NAME, itemData, auditUid };
    const dbItemData = await createFirestoreDocument(createArgs);

    console.log('Create data: (' + COLLECTION_NAME + ') ' + JSON.stringify(dbItemData));
    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
