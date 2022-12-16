const Joi = require('joi');

const basicData = {
  currency: Joi.string(),
  targetCurrency: Joi.string(),
  value: Joi.number(),
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
};

const createSchema = Joi.object({
  ...basicData,
});

const updateSchema = Joi.object({
  ...basicData,
});

const requiredBaseFields = ['currency', 'targetCurrency', 'value'];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
};

module.exports = schemas;
