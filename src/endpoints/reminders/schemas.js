const Joi = require('joi');

const basicData = {
  title: Joi.string(),
  message: Joi.string(),
  eventDate: Joi.date().required(),
  startDate: Joi.date().required(),
  amount: Joi.number(),

  notes: Joi.string().allow(''),
  attachments: Joi.any(),
};

const createSchema = Joi.object({
  ...basicData,
});

const updateSchema = Joi.object({
  ...basicData,
});

const requiredBaseFields = ['title', 'eventDate', 'startDate'];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
};

module.exports = schemas;
