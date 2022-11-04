const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  userId: Joi.string(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['companyId', 'userId'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
