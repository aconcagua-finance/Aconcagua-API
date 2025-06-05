const Joi = require('joi');

const createSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().allow('', null),
  identificationNumber: Joi.string().required(),
  status: Joi.string().default('inactive'),
});

const createDelegateRelationshipSchema = Joi.object({
  delegateId: Joi.string().required(),
  status: Joi.string().default('active'),
  state: Joi.number().optional(),
});

module.exports = {
  create: createSchema,
  createDelegateRelationship: createDelegateRelationshipSchema,
};
