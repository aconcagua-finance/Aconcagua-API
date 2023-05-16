const Joi = require('joi');

const basicData = {
  actionType: Joi.string(),
  currency: Joi.string(),
  ratio: Joi.number(),
  swapPriority: Joi.number(),
};

const createSchema = Joi.object({
  ...basicData,
});

const updateSchema = Joi.object({
  ...basicData,
});

const requiredBaseFields = ['actionType', 'currency', 'ratio'];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
};

module.exports = schemas;
