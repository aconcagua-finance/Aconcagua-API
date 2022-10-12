import { FIREB_STORAGE_BUCKET } from '../config/appConfig';

const path = require('path');
const { Storage } = require('@google-cloud/storage');

const cwd = path.join(__dirname, '..');

exports.downlaodImageToPath = async function ({
  bucketName = FIREB_STORAGE_BUCKET,
  sourceFileName,
  destFileRelativePath,
}) {
  const destFilePath = path.join(cwd, destFileRelativePath);

  // Creates a client
  const storage = new Storage();

  const options = {
    destination: destFilePath,
  };

  // Downloads the file
  await storage.bucket(bucketName).file(sourceFileName).download(options);

  //   const myBucket = storage.bucket(bucketName);
  //   const file = myBucket.file(fileName);
  //   const content = await file.download();

  // return content;

  // console.log(`gs://${bucketName}/${fileName} downloaded to ${destFileName}.`);
};

exports.downlaodImage = async function ({ bucketName = FIREB_STORAGE_BUCKET, storageFilePath }) {
  // Creates a client
  const storage = new Storage();

  // Downloads the file
  await storage.bucket(bucketName).file(storageFilePath).download();
};

exports.uploadFile = async function ({
  bucketName = FIREB_STORAGE_BUCKET,
  destination,
  buffer,
  isPublic,
}) {
  // Creates a client
  const storage = new Storage();

  // Downloads the file
  const bucketFile = storage.bucket(bucketName).file(destination);

  await bucketFile.save(buffer);
  if (isPublic) await bucketFile.makePublic();

  const publicUrl = bucketFile.publicUrl();
  return { isPublic, url: publicUrl, storage: { bucketName, destination } };
};
