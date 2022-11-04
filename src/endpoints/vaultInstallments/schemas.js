const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  userId: Joi.string(),
  vaultId: Joi.string(),

  installmentNumber: Joi.number().allow(null),
  dueDate: Joi.date().allow(null),
  paymentStatus: Joi.string().allow(null, ''),
  amount: Joi.number().allow(null),
  amortizationAmount: Joi.number().allow(null),
  nominalInterest: Joi.number().allow(null),
  seals: Joi.number().allow(null),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['companyId', 'userId', 'vaultId'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
