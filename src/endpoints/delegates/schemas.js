const Joi = require('joi');

const createSchema = Joi.object({
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().allow('', null),
  identificationNumber: Joi.string().required(),
  status: Joi.string().default('inactive'),
});

module.exports = {
  create: createSchema,
};
