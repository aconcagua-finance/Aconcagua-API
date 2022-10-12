const Joi = require('joi');

const baseSchema = Joi.object({
  companyId: Joi.string(),
  userId: Joi.string(),

  employeeProfile: Joi.string(), // Arquitecto
  employeeDepartment: Joi.string(), // Arquitectura de sistemas

  employeeBoss: Joi.string().allow(null, ''),

  employeeRols: Joi.array().items(Joi.string()), // ['RRHH']

  // employeeEmail: Joi.string(),
  employeePhoneNumber: Joi.string().allow(null, ''),
  employeeLocation: Joi.string().allow(null, ''),

  notes: Joi.string().allow(''),
});

const requiredBaseFields = [
  'companyId',
  'userId',
  'employeeProfile',
  'employeeDepartment',
  'employeeRols',
];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
