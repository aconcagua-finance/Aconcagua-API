const Joi = require('joi');

const createSchema = Joi.object({
  delegateId: Joi.string().required()
});

module.exports = {
  create: createSchema
};
