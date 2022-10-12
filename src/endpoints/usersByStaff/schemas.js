const Joi = require('joi');

const baseSchema = Joi.object({
  staffId: Joi.string(),
  userId: Joi.string(),

  relationshipType: Joi.array().items(Joi.string()),
  grants: Joi.array().items(Joi.string()),

  notes: Joi.string().allow(''),
});

const requiredBaseFields = ['staffId', 'userId', 'relationshipType'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
