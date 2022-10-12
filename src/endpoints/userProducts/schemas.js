const Joi = require('joi');

const baseSchema = Joi.object({
  userId: Joi.string(),

  product: Joi.string(), // staffs ids || null si es automated

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['userId', 'product'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
