const Joi = require('joi');
const { CompanyTypes } = require('../../vs-core/types');

const basicData = {
  name: Joi.string().min(2).max(100),
  description: Joi.string().allow(''),
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
  companyType: Joi.string().valid(CompanyTypes.TRUST, CompanyTypes.LENDER),
};

const createSchema = Joi.object({
  ...basicData,

  // Validación para las direcciones de seguridad
  safeLiq1: Joi.string().length(42).required(),
  safeLiq2: Joi.string().length(42).required(),
  safeLiq3: Joi.string().length(42).required(),
  safeLiq4: Joi.string().length(42).required(),

  // Validación para la red Polygon
  vaultAdminAddressPolygon: Joi.string().length(42).required(),
  vaultAdminOwnerPolygon: Joi.string().length(42).required(),
  vaultAdminDeploymentPolygon: Joi.any().required(),

  // Validación para la red Rootstock
  vaultAdminAddressRootstock: Joi.string().length(42).required(),
  vaultAdminOwnerRootstock: Joi.string().length(42).required(),
  vaultAdminDeploymentRootstock: Joi.any().required(),
});

const updateSchema = Joi.object({ ...basicData });

const requiredBaseFields = [
  'name',
  'safeLiq1',
  'safeLiq2',
  'safeLiq3',
  'safeLiq4',
  'companyType',
  // Campos para la red Polygon
  'vaultAdminAddressPolygon',
  'vaultAdminOwnerPolygon',
  'vaultAdminDeploymentPolygon',

  // Campos para la red Rootstock
  'vaultAdminAddressRootstock',
  'vaultAdminOwnerRootstock',
  'vaultAdminDeploymentRootstock',
];
const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
};

module.exports = schemas;
