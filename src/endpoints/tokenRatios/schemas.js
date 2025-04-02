const Joi = require('joi');

// Define schema directly
const createSchema = Joi.object({
  actionType: Joi.string().required(),
  currency: Joi.string().required(),
  ratio: Joi.number().required(),
  swapPriority: Joi.number().optional(),
}).required(); // Make the entire object required

const updateSchema = Joi.object({
  actionType: Joi.string(),
  currency: Joi.string(),
  ratio: Joi.number(),
  swapPriority: Joi.number(),
});

// Export with explicit property names
module.exports = {
  create: createSchema,
  update: updateSchema,
};
