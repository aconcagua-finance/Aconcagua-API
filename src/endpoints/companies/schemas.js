const Joi = require('joi');

const basicData = {
  name: Joi.string().min(2).max(100),
  description: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
};

const createSchema = Joi.object({
  ...basicData,

  safeLiq1: Joi.string().min(42).max(42),
  safeLiq2: Joi.string().min(42).max(42),

  vaultAdminAddress: Joi.string().min(42).max(42),
  vaultAdminOwner: Joi.string().min(42).max(42),
  vaultAdminDeployment: Joi.any(),
});

const updateSchema = Joi.object({ ...basicData });

const requiredBaseFields = [
  'name',
  'safeLiq1',
  'safeLiq2',
  'vaultAdminAddress',
  'vaultAdminOwner',
  'vaultAdminDeployment',
];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
};

module.exports = schemas;
