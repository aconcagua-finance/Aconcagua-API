/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const Fuse = require('fuse.js');

const { creationStruct, updateStruct } = require('../../vs-core-firebase/audit');
const { ErrorHelper } = require('../../vs-core-firebase');
const { LoggerHelper } = require('../../vs-core-firebase');
const { Types } = require('../../vs-core');
const { Auth } = require('../../vs-core-firebase');

const { CustomError } = require('../../vs-core');

const { Collections } = require('../../types/collectionsTypes');

const schemas = require('./schemas');

const {
  find,
  get,
  patch,
  remove,
  create,
  createInner,
  fetchSingleItem,
  updateSingleItem,
  fetchItemsByIds,
  sanitizeData,
  createFirestoreDocument,
  findWithRelationship,
  getWithRelationshipById,
  MULTIPLE_RELATIONSHIP_SUFFIX,

  findWithUserRelationship,
  getWithUserRelationshipById,
  listByProp,
  getByProp,
  listByPropInner,
} = require('../baseEndpoint');

const {
  WALLET_PRIVATE_KEY,
  ALCHEMY_API_KEY,
  PROVIDER_NETWORK_NAME,
} = require('../../config/appConfig');

const hre = require('hardhat');
// require('hardhat-change-network');

const COLLECTION_NAME = Collections.USER_VAULTS;
const INDEXED_FILTERS = ['userId', 'companyId'];

const COMPANY_ENTITY_PROPERTY_NAME = 'companyId';
const USER_ENTITY_PROPERTY_NAME = 'userId';

exports.findByCompany = async function (req, res) {
  const { companyId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
      primaryEntityValue: companyId,
      primaryEntityCollectionName: Collections.COMPANIES,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.findByUser = async function (req, res) {
  const { userId } = req.params;

  const { limit, offset } = req.query;
  let { filters } = req.query;

  if (!filters) filters = {};
  if (!filters.state) filters.state = { $equal: Types.StateTypes.STATE_ACTIVE };

  try {
    const result = await listByPropInner({
      limit,
      offset,
      filters,

      primaryEntityPropName: USER_ENTITY_PROPERTY_NAME,
      primaryEntityValue: userId,
      primaryEntityCollectionName: Collections.USERS,
      listByCollectionName: COLLECTION_NAME,
      indexedFilters: INDEXED_FILTERS,
      relationships: [
        { collectionName: Collections.COMPANIES, propertyName: COMPANY_ENTITY_PROPERTY_NAME },
      ],
    });

    return res.send(result);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.get = async function (req, res) {
  const { id } = req.params;

  await getByProp({
    req,
    res,

    byId: id,

    primaryEntityPropName: COMPANY_ENTITY_PROPERTY_NAME,
    primaryEntityCollectionName: Collections.COMPANIES,
    collectionName: COLLECTION_NAME,

    relationships: [{ collectionName: Collections.USERS, propertyName: USER_ENTITY_PROPERTY_NAME }],
  });
};

exports.patch = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.update);
};

exports.remove = async function (req, res) {
  await remove(req, res, COLLECTION_NAME);
};

const parseContractDeploymentToObject = (deploymentResponse) => {
  if (!deploymentResponse) return null;

  const deployTransaction = {};
  const contractFunctions = [];
  let signerAddress = null;

  if (deploymentResponse.deployTransaction) {
    const keys = Object.keys(deploymentResponse.deployTransaction);

    keys.forEach((key) => {
      if (typeof deploymentResponse.deployTransaction[key] === 'function') return;

      deployTransaction[key] = JSON.parse(
        JSON.stringify(deploymentResponse.deployTransaction[key])
      );
    });
  }

  if (deploymentResponse.functions) {
    const keys = Object.keys(deploymentResponse.functions);

    keys.forEach((key) => {
      contractFunctions.push(key);
    });
  }

  if (deploymentResponse.signer && deploymentResponse.signer.address) {
    signerAddress = deploymentResponse.signer.address;
  }

  return {
    deployTransaction,
    contractFunctions,
    signerAddress,
    address: deploymentResponse.address,
  };
};

exports.create = async function (req, res) {
  try {
    const { userId } = res.locals;
    const auditUid = userId;
    const { userId: targetUserId } = req.params;

    console.log('CURRENT NETWORK: ', hre.network.name);

    // const contractName = 'Greeter';
    const contractName = 'ColateralContract_v1_0_0';

    const blockchainContract = await hre.ethers.getContractFactory(contractName);
    // const deploymentResponse = await blockchainContract.deploy(contractName);
    const deploymentResponse = await blockchainContract.deploy();

    console.log('deploymentResponse!:', JSON.stringify(deploymentResponse));

    const contractDeployment = parseContractDeploymentToObject(deploymentResponse);

    const contractAddress = contractDeployment.address;
    const signerAddress = contractDeployment.signerAddress;

    // console.log('LOG RTA CONTRATO', deploymentResponse);
    if (!contractAddress) {
      throw new CustomError.TechnicalError(
        'ERROR_CREATE_CONTRACT',
        null,
        'Empty contract address response',
        null
      );
    }

    console.log('Contract deployment:', contractDeployment);

    const collectionName = COLLECTION_NAME;
    const validationSchema = schemas.create;

    const body = req.body;
    body.userId = targetUserId;
    body.contractAddress = contractAddress;
    body.contractSignerAddress = signerAddress;
    body.contractDeployment = contractDeployment;
    body.contractName = contractName;
    body.contractStatus = 'pending-deployment-verification';
    body.contractError = null;

    console.log('Create args (' + collectionName + '):', body);

    const itemData = await sanitizeData({ data: body, validationSchema });

    const dbItemData = await createFirestoreDocument({
      collectionName,
      itemData,
      auditUid,
      documentId: contractAddress,
    });

    console.log('Create data: (' + collectionName + ')', dbItemData);

    try {
      await deploymentResponse.deployed();
      console.log('Deployment success');

      await updateSingleItem({
        collectionName,
        data: { contractStatus: 'deployed', contractError: null },
        auditUid,
        id: contractAddress,
      });

      console.log('Update contract status success' + contractAddress);
    } catch (e) {
      console.log(
        'Deployment error while waiting for depoy confirmation' + contractAddress,
        JSON.stringify(e)
      );

      await updateSingleItem({
        collectionName,
        data: { contractError: e.message },
        auditUid,
        id: contractAddress,
      });

      console.log('Success updating errorto contract' + contractAddress);
    }

    return res.status(201).send(dbItemData);
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }
};

exports.configure = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  try {
    const { userId: targetUserId } = req.params;

    const itemId = req.params.id;

    const smartContract = await fetchSingleItem({ collectionName: COLLECTION_NAME, id: itemId });

    const contractJson = require('../../../artifacts/contracts/' +
      smartContract.contractName +
      '.sol/' +
      smartContract.contractName +
      '.json');
    const abi = contractJson.abi;

    console.log('CURRENT NETWORK: ', PROVIDER_NETWORK_NAME);

    // const alchemy = new hre.ethers.providers.AlchemyProvider('maticmum', process.env.ALCHEMY_API_KEY);
    const alchemy = new hre.ethers.providers.AlchemyProvider(
      PROVIDER_NETWORK_NAME,
      ALCHEMY_API_KEY
    );

    // const userWallet = new hre.ethers.Wallet(process.env.PRIVATE_KEY, alchemy);
    const userWallet = new hre.ethers.Wallet(WALLET_PRIVATE_KEY, alchemy);

    // // Get the deployed contract.
    const blockchainContract = new hre.ethers.Contract(
      smartContract.contractAddress,
      abi,
      userWallet
    );

    console.log('before: ' + (await blockchainContract.rescueWalletAccount()));

    const setTx1 = await blockchainContract.setRescueWalletAccount(req.body.rescueWalletAccount);
    await setTx1.wait();
    console.log('after: ' + (await blockchainContract.rescueWalletAccount()));
  } catch (err) {
    return ErrorHelper.handleError(req, res, err);
  }

  await patch(req, res, auditUid, COLLECTION_NAME, schemas.configure);
};
