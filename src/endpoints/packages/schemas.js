const Joi = require('joi');

const baseSchema = Joi.object({
  code: Joi.string().max(100),
  friendlyName: Joi.string().min(2).max(100),
  description: Joi.string().max(1000).allow(''),

  category: Joi.string(),
  type: Joi.string(),

  country: Joi.array()
    .items(
      Joi.object({
        code: Joi.string().max(100),
      })
    )
    .default(null),

  recomended: Joi.boolean(),

  price: Joi.object({
    monthlyValue: Joi.number().allow(null),
    anualValue: Joi.number().allow(null),
    currency: Joi.string(),
  }),

  subProducts: Joi.array()
    .items(
      Joi.object({
        code: Joi.string().max(100).required(),
      })
    )
    .default(null),
});

const requiredBaseFields = ['code', 'friendlyName'];

const schemas = {
  create: baseSchema.fork(requiredBaseFields, (field) => field.required()),
  update: baseSchema,
};

module.exports = schemas;
