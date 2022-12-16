const Joi = require('joi');

const basicData = {
  installmentNumber: Joi.number().allow(null),
  dueDate: Joi.date().allow(null),
  paymentStatus: Joi.string().allow(null, ''),

  debtAmount: Joi.number().allow(null),
  principalAmount: Joi.number().allow(null),
  interestAmount: Joi.number().allow(null),
  taxesAmount: Joi.number().allow(null),
  otherCosts: Joi.number().allow(null),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
};

const createSchema = Joi.object({
  ...basicData,

  // datos que no se pueden modificar
  companyId: Joi.string(),
  userId: Joi.string(),
  vaultId: Joi.string(),
});

const updateSchema = Joi.object({ ...basicData });

const requiredBaseFields = ['companyId', 'userId', 'vaultId', 'installmentNumber'];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
};

module.exports = schemas;
