const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  userId: Joi.string(),
  vaultId: Joi.string(),

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
});

const requiredBaseFields = ['companyId', 'userId', 'vaultId'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
