const Joi = require('joi');

const baseSchema = Joi.object({
  userId: Joi.string(),

  aspectId: Joi.string(),
  score: Joi.number(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['userId', 'aspectId', 'score'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
