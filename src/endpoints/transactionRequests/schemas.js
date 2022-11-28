const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  vaultId: Joi.string(),

  transactionType: Joi.string(),

  currency: Joi.string(),
  amount: Joi.number(),

  requestStatus: Joi.string(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = [
  'companyId',
  'vaultId',
  'transactionType',
  'currency',
  'amount',
  'requestStatus',
];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
