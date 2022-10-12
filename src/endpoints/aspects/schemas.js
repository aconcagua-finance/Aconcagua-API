const Joi = require('joi');

const baseSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  description: Joi.string().allow(''),

  mainAspect: Joi.string().allow(null),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['name'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
