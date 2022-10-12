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

const stream = require('stream');

const schemas = require('./schemas');

const {
  find,
  get,
  patch,
  remove,
  create,
  fetchSingleItem,
  updateSingleItem,
} = require('../baseEndpoint');

const COLLECTION_NAME = Collections.ATTACHMENTS;

exports.find = async function (req, res) {
  await find(req, res, COLLECTION_NAME);
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

const uploadFile = async (fileObject) => {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(fileObject.buffer);

  // const { data } = await google.drive({ version: 'v3' }).files.create({
  //   media: {
  //     mimeType: fileObject.mimeType,
  //     body: bufferStream,
  //   },
  //   requestBody: {
  //     name: fileObject.originalname,
  //     parents: ['DRIVE_FOLDER_ID'],
  //   },
  //   fields: 'id,name',
  // });
  // console.log(`Uploaded file ${data.name} ${data.id}`);
};

exports.create = async function (req, res) {
  const { userId } = res.locals;
  const auditUid = userId;

  try {
    const { body, files } = req;

    console.log('Files jajajaja', files);
    for (let ff = 0; ff < files.length; ff += 1) {
      await uploadFile(files[ff]);
    }

    console.log(body);
    res.status(200).send('Form Submitted');
  } catch (e) {
    res.send(e.message);
  }

  // await create(req, res, auditUid, COLLECTION_NAME, schemas.create);
};
