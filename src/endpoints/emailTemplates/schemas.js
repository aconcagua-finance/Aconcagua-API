const Joi = require('joi');

const basicData = {
  subject: Joi.string(),
  html: Joi.string(),
  notes: Joi.string().allow(''),
  attachments: Joi.any(),
};

const createSchema = Joi.object({
  ...basicData,
  documentId: Joi.string(),
});

const updateSchema = Joi.object({
  ...basicData,
});

const requiredBaseFields = ['documentId', 'subject', 'html'];

const schemas = {
  create: createSchema.fork(requiredBaseFields, (field) => field.required()),
  update: updateSchema,
};

module.exports = schemas;
