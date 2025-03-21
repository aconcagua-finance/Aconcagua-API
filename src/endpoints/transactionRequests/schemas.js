const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  userId: Joi.string(),
  vaultId: Joi.string(),
  transactionType: Joi.string(),
  rescueWalletAccount: Joi.string().allow(''),
  currency: Joi.string(),
  amount: Joi.number(),
  creditAmount: Joi.number(),
  requestStatus: Joi.string(),
  safeMainTransaction: Joi.any(),
  safeApproveData: Joi.any(),
  safeConfirmations: Joi.any(),
  safeAddress: Joi.string(),
  executionResult: Joi.any(),
  requestConversion: Joi.any(),
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = [
  'companyId',
  'userId',
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
