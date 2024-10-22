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
const { invoke_get_api, invoke_post_api } = require('../../helpers/httpInvoker');

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

    // Extraer los valores de safeLiq1 (Polygon) y safeLiq3 (Rootstock) del body
    const safeLiq1 = body.safeLiq1; // Owner de Polygon
    const safeLiq3 = body.safeLiq3; // Owner de Rootstock

    if (!safeLiq1 || !safeLiq3) {
      throw new CustomError.TechnicalError(
        'ERROR_MISSING_OWNERS',
        null,
        'Faltan los owners para Polygon o Rootstock',
        null
      );
    }

    // Construir el objeto con los owners para cada red
    const vaultAdminData = {
      safeLiq1, // Owner para Polygon
      safeLiq3, // Owner para Rootstock
    };

    // Hacer el POST a la API que crea el Vault Admin
    const vaultAdminEndpoint = `${API_VAULT_ADMIN}`; // Aquí usamos la variable correcta
    const vaultAdminResponse = await invoke_post_api({
      endpoint: vaultAdminEndpoint,
      payload: vaultAdminData, // Cambiado a 'payload'
    });

    if (!vaultAdminResponse || !vaultAdminResponse.data) {
      throw new CustomError.TechnicalError(
        'ERROR_API_VAULT_ADMIN_CREATION_FAILED',
        null,
        'Error al crear el VaultAdmin en las redes',
        null
      );
    }

    // Verificar si las respuestas de las redes Polygon y Rootstock fueron exitosas
    const { polygon, rootstock } = vaultAdminResponse.data;
    if (!polygon || !rootstock) {
      throw new CustomError.TechnicalError(
        'ERROR_API_VAULT_ADMIN_CREATION_RESPONSE',
        null,
        'Faltan datos en la respuesta de creación de VaultAdmin para Polygon o Rootstock',
        null
      );
    }

    // Guardar los datos de Polygon y Rootstock en Firestore
    body.vaultAdminAddressPolygon = polygon.proxyAdminAddress;
    body.vaultAdminOwnerPolygon = polygon.owner;
    body.vaultAdminDeploymentPolygon = polygon.contractDeployment;

    body.vaultAdminAddressRootstock = rootstock.proxyAdminAddress;
    body.vaultAdminOwnerRootstock = rootstock.owner;
    body.vaultAdminDeploymentRootstock = rootstock.contractDeployment;

    // Sanitizar los datos y crear el documento en Firestore
    const itemData = await sanitizeData({ data: body, validationSchema: schemas.create });
    const createArgs = { collectionName: COLLECTION_NAME, itemData, auditUid };
    const dbItemData = await createFirestoreDocument(createArgs);

    console.log('Create data: (' + COLLECTION_NAME + ') ' + JSON.stringify(dbItemData));
    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};
