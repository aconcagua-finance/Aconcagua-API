const Joi = require('joi');

const baseSchema = Joi.object({
  firstName: Joi.string().min(2).max(100),
  lastName: Joi.string().min(2).max(100),
  nickname: Joi.string().allow(''),
  email: Joi.string().email({ minDomainSegments: 2 }),
  phoneNumber: Joi.string().allow(''),

  gender: Joi.string().allow(null).allow(''),
  maritalStatus: Joi.string().allow(null).allow(''),
  birthDate: Joi.date().allow(null, ''),

  company: Joi.any(),

  addressResidenceCountry: Joi.string().allow(null).allow(''),
  currentJobType: Joi.string().allow(null).allow(''),

  leadStatus: Joi.string(),
  priority: Joi.string().allow(null).allow(''),

  step: Joi.string().allow(''),
  utmData: Joi.any().allow(''),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
});

const checkoutSchema = Joi.object({
  id: Joi.string().required(),
  creditCardNumber: Joi.string().required(),
  creditCardExpirity: Joi.string().required(),
  creditCardHolder: Joi.string().required(),
  creditCardCode: Joi.string().required(),

  packageId: Joi.string().required(),
  priceType: Joi.string().required(),

  step: Joi.string().allow(''),
  utmData: Joi.any().allow(''),
});

const requiredBaseFields = ['firstName', 'lastName'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
  checkout: checkoutSchema,
};

module.exports = schemas;
