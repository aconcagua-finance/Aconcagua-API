const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  userId: Joi.string(),
  employeeRols: Joi.array().items(Joi.string()), // ['RRHH']
  notes: Joi.string().allow(''),
});

const requiredBaseFields = ['companyId', 'userId', 'employeeRols'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
