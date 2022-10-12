const Joi = require('joi');

const baseSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  description: Joi.string().allow(''),

  targetAspects: Joi.array().items(Joi.string()).allow(null),
  targetLevels: Joi.array().items(Joi.string()).allow(null),
  taskSource: Joi.string().allow(null).allow(''),

  twoMinutesRule: Joi.string().allow(''),
  ambientDesign: Joi.string().allow(''),
  engagementDevice: Joi.string().allow(''),

  simplerTasks: Joi.array().items(Joi.string()),
  harderTasks: Joi.array().items(Joi.string()),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['name'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
