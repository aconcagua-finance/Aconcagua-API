const Joi = require('joi');

const baseSchema = Joi.object({
  userId: Joi.string(),

  attributeType: Joi.string(),
  attributeValue: Joi.string().allow(''),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['userId', 'attributeType', 'attributeValue'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
