const Joi = require('joi');

const baseSchema = Joi.object({
  firstName: Joi.string().min(2).max(100),
  lastName: Joi.string().min(2).max(100),
  nickname: Joi.string().allow(''),
  email: Joi.string().email({ minDomainSegments: 2 }),
  phoneNumber: Joi.string().allow(''),
  identificationNumber: Joi.string().allow(''),

  gender: Joi.string().allow(null).allow(''),

  birthDate: Joi.date().allow(null, ''),

  addressResidenceCountry: Joi.string().allow(null).allow(''),

  staffType: Joi.array().items(Joi.string()),

  calendly: Joi.string().allow(''),
  hourlyCost: Joi.string().allow(''),

  mainAspects: Joi.array().items(Joi.string()).allow(null),

  // Se autogenera
  // applicativeUserId: Joi.string().required(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const requiredBaseFields = ['firstName', 'lastName', 'staffType'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
