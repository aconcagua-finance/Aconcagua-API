const Joi = require('joi');

const docSchema = Joi.object({
  createdAt: Joi.any().required(),
  updatedAt: Joi.any().required(),
  createdBy: Joi.string().required(),
  updatedBy: Joi.string().required(),
}).unknown(true);

const updateDocSchema = Joi.object({
  updatedAt: Joi.any().required(),

  updatedBy: Joi.string().required(),
}).unknown(true);

const stateSchema = Joi.object({
  state: Joi.number().integer().min(0).max(100).required(),
}).unknown(true);

module.exports = { docSchema, updateDocSchema, stateSchema };
