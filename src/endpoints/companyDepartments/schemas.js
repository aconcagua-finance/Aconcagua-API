const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  departmentName: Joi.string().min(2).max(100),
  departmentDescription: Joi.string().allow(''),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['companyId', 'departmentName'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
