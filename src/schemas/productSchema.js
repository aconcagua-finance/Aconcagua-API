const Joi = require('joi');

const createProductSchema = Joi.object({
  state: Joi.number().integer().min(0).max(100).required(),
  createdAt: Joi.any().required(),
  updatedAt: Joi.any().required(),
  createdBy: Joi.string().required(),
  updatedBy: Joi.string().required(),

  id: Joi.string().max(100).required(),
  code: Joi.string().max(100).required(),
  friendlyName: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(1000).allow(''),

  category: Joi.string(),
  type: Joi.string(),

  country: Joi.string(),
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

const updateProductSchema = Joi.object({
  state: Joi.number().integer().min(0).max(100).required(),

  updatedAt: Joi.any().required(),

  updatedBy: Joi.string().required(),

  id: Joi.string().max(100).required(),
  code: Joi.string().max(100).required(),
  friendlyName: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(1000).allow(''),

  category: Joi.string(),
  type: Joi.string(),

  country: Joi.string(),
  recomended: Joi.boolean(),

  price: Joi.object({
    monthlyValue: Joi.number().allow(null),
    anualValue: Joi.number().allow(null),
    currency: Joi.string(),
  }),

  subProducts: Joi.array().items(
    Joi.object({
      code: Joi.string().max(100).required(),
    })
  ),
});

module.exports = { createProductSchema, updateProductSchema };
